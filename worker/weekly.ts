import type { ScrapeMethod, ScrapeResult } from './scraper'
import type { ResearchSource } from './sources'
import type { WeekInfo } from './week'

import { AI_MODEL } from './config'
import { createCloudflareScraper, ScrapeError } from './scraper'

export interface WeeklyArticle {
  category: 'news' | 'model' | 'tool'
  date: string
  reason: string
  score: number
  source: string
  summary: string
  title: string
  url: string
}

export interface ResearchFailure {
  attempts?: { error: string, method: string }[]
  error: string
  source: string
  url: string
}

export interface SourceResearchResult {
  articles: WeeklyArticle[]
  failures: ResearchFailure[]
  method?: ScrapeMethod
  source: string
}

export interface WeeklyDraft {
  content: string
  summary: string
  tags: string[]
  title: string
}

interface Candidate {
  date?: string
  summary?: string
  title: string
  url: string
}

interface ScoredArticle {
  category: WeeklyArticle['category']
  impact: number
  reason: string
  relevance: number
  summary: string
  utility: number
}

interface ModelResponse {
  response?: string
  choices?: {
    message?: {
      content?: string
    }
  }[]
}

const MAX_SOURCE_CHARACTERS = 50_000
const MAX_ARTICLE_CHARACTERS = 36_000
const MAX_CANDIDATES_PER_SOURCE = 4
const MAX_SELECTED_ARTICLES = 15

function clip(content: string, maximum: number): string {
  if (content.length <= maximum)
    return content
  return `${content.slice(0, maximum)}\n\n[内容已截断]`
}

function getModelText(result: unknown): string {
  if (typeof result === 'string')
    return result

  const response = result as ModelResponse
  if (typeof response.response === 'string')
    return response.response

  const content = response.choices?.[0]?.message?.content
  if (typeof content === 'string')
    return content

  throw new Error('模型未返回文本内容')
}

export function parseModelJson<T>(content: string): T {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  const objectStart = trimmed.indexOf('{')
  const arrayStart = trimmed.indexOf('[')
  const start = [objectStart, arrayStart]
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0]

  if (start === undefined)
    throw new Error('模型未返回有效 JSON')

  const opener = trimmed[start]
  const end = opener === '{' ? trimmed.lastIndexOf('}') : trimmed.lastIndexOf(']')
  if (end < start)
    throw new Error('模型未返回有效 JSON')

  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as T
  }
  catch {
    throw new Error('模型未返回有效 JSON')
  }
}

export function parseWeeklyDraft(content: string): WeeklyDraft {
  const draft = parseModelJson<unknown>(content)
  if (!draft || typeof draft !== 'object')
    throw new Error('模型返回的周刊字段不完整')

  const value = draft as Record<string, unknown>
  if (
    typeof value.title !== 'string'
    || typeof value.summary !== 'string'
    || typeof value.content !== 'string'
    || !Array.isArray(value.tags)
    || value.tags.some(tag => typeof tag !== 'string')
  ) {
    throw new Error('模型返回的周刊字段不完整')
  }

  return {
    content: value.content.trim(),
    summary: value.summary.trim().slice(0, 200),
    tags: value.tags.filter(Boolean).slice(0, 8),
    title: value.title.trim(),
  }
}

async function runModel(env: Cloudflare.Env, system: string, prompt: string, maxTokens = 4096): Promise<string> {
  const result = await env.AI.run(AI_MODEL, {
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  })

  return getModelText(result)
}

function resolveCandidate(candidate: unknown, source: ResearchSource): Candidate | null {
  if (
    !candidate
    || typeof candidate !== 'object'
  ) {
    return null
  }

  const value = candidate as Record<string, unknown>
  if (
    typeof value.title !== 'string'
    || typeof value.url !== 'string'
    || !value.title.trim()
    || !value.url.trim()
  ) {
    return null
  }

  try {
    return {
      date: typeof value.date === 'string' ? value.date : '',
      summary: typeof value.summary === 'string' ? value.summary : '',
      title: value.title.trim(),
      url: new URL(value.url, source.url).toString(),
    }
  }
  catch {
    return null
  }
}

async function findCandidates(
  env: Cloudflare.Env,
  source: ResearchSource,
  week: WeekInfo,
  content: string,
): Promise<Candidate[]> {
  const output = await runModel(
    env,
    '你是 AIGC 新聞研究員。全程使用繁體中文（台灣），只返回 JSON，不要輸出解釋或 Markdown 程式碼區塊。',
    `从以下页面中找出发布日期在 ${week.startDate} 至 ${week.endDate}（UTC）之间、与生成式 AI、LLM、AI Agent 或 AI 编程直接相关的文章。
最多返回 ${MAX_CANDIDATES_PER_SOURCE} 篇。不要编造页面中不存在的 URL 或日期。无法确认日期时 date 使用空字符串。

返回格式：
{"articles":[{"title":"标题","url":"绝对或相对 URL","date":"YYYY-MM-DD","summary":"页面中可确认的一句话信息"}]}

来源：${source.name}
入口：${source.url}
页面内容：
${clip(content, MAX_SOURCE_CHARACTERS)}`,
  )

  const parsed = parseModelJson<{ articles?: unknown }>(output)
  const articles = parsed && Array.isArray(parsed.articles) ? parsed.articles : []
  return articles
    .map(candidate => resolveCandidate(candidate, source))
    .filter((candidate): candidate is Candidate => candidate !== null)
    .slice(0, MAX_CANDIDATES_PER_SOURCE)
}

function normalizeScore(value: unknown, maximum: number): number {
  const score = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(score))
    return 0
  return Math.max(0, Math.min(maximum, Math.round(score)))
}

async function scoreArticle(
  env: Cloudflare.Env,
  source: ResearchSource,
  candidate: Candidate,
  content: string,
): Promise<WeeklyArticle | null> {
  const output = await runModel(
    env,
    '你是嚴格的 AIGC 週刊主編。全程使用繁體中文（台灣），只返回 JSON，不要輸出解釋或 Markdown 程式碼區塊。',
    `评估这篇文章，按相关性 0-40、影响力/新颖性 0-30、实操性 0-30 打分。
营销软文、与 AIGC 无关内容应低于 70 分。若是 GitHub 项目且正文明确显示少于 100 Stars，应低于 70 分。

返回格式：
{"relevance":0,"impact":0,"utility":0,"category":"news|model|tool","summary":"2-4 句繁體中文事實摘要","reason":"1-2 句入選或淘汰理由"}

标题：${candidate.title}
URL：${candidate.url}
来源：${source.name}
正文：
${clip(content, MAX_ARTICLE_CHARACTERS)}`,
  )

  const parsedScore = parseModelJson<unknown>(output)
  const scored = parsedScore && typeof parsedScore === 'object'
    ? parsedScore as Partial<ScoredArticle>
    : {}
  const relevance = normalizeScore(scored.relevance, 40)
  const impact = normalizeScore(scored.impact, 30)
  const utility = normalizeScore(scored.utility, 30)
  const score = relevance + impact + utility
  const categories = new Set(['news', 'model', 'tool'])

  if (score < 70 || typeof scored.category !== 'string' || !categories.has(scored.category))
    return null

  return {
    category: scored.category as WeeklyArticle['category'],
    date: candidate.date || '',
    reason: typeof scored.reason === 'string' ? scored.reason.trim() : '符合周刊选题标准',
    score,
    source: source.name,
    summary: typeof scored.summary === 'string'
      ? scored.summary.trim()
      : candidate.summary?.trim() || '',
    title: candidate.title,
    url: candidate.url,
  }
}

function failureFrom(error: unknown, source: ResearchSource, url: string): ResearchFailure {
  return {
    attempts: error instanceof ScrapeError ? error.attempts : undefined,
    error: error instanceof Error ? error.message : String(error),
    source: source.name,
    url,
  }
}

export async function researchSource(
  env: Cloudflare.Env,
  source: ResearchSource,
  week: WeekInfo,
  artifactPrefix: string,
): Promise<SourceResearchResult> {
  const scraper = createCloudflareScraper(env)
  const failures: ResearchFailure[] = []
  let landing: ScrapeResult

  try {
    landing = await scraper.scrape(source.url)
  }
  catch (error) {
    failures.push(failureFrom(error, source, source.url))
    return { articles: [], failures, source: source.name }
  }

  await env.AGENT_STORAGE.put(`${artifactPrefix}/sources/${encodeURIComponent(source.name)}.md`, landing.content, {
    customMetadata: {
      method: landing.method,
      source: source.name,
      url: source.url,
    },
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  })

  let candidates: Candidate[]
  try {
    candidates = await findCandidates(env, source, week, landing.content)
  }
  catch (error) {
    failures.push(failureFrom(error, source, source.url))
    return { articles: [], failures, method: landing.method, source: source.name }
  }

  const articles: WeeklyArticle[] = []
  for (const candidate of candidates) {
    try {
      const articleContent = candidate.url === landing.url
        ? landing.content
        : (await scraper.scrape(candidate.url)).content
      const article = await scoreArticle(env, source, candidate, articleContent)
      if (article)
        articles.push(article)
    }
    catch (error) {
      failures.push(failureFrom(error, source, candidate.url))
    }
  }

  return {
    articles,
    failures,
    method: landing.method,
    source: source.name,
  }
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value)
    const trackingParameters = [...url.searchParams.keys()]
      .filter(key => key.startsWith('utm_') || ['ref', 'source', 'campaign'].includes(key))
    trackingParameters.forEach(key => url.searchParams.delete(key))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  }
  catch {
    return value
  }
}

export function deduplicateArticles(articles: WeeklyArticle[]): WeeklyArticle[] {
  const byUrl = new Map<string, WeeklyArticle>()
  for (const article of articles) {
    const key = canonicalUrl(article.url)
    const current = byUrl.get(key)
    if (!current || article.score > current.score)
      byUrl.set(key, article)
  }

  return [...byUrl.values()].sort((a, b) => b.score - a.score)
}

export async function selectArticles(
  env: Cloudflare.Env,
  articles: WeeklyArticle[],
  historicalRss: string,
): Promise<WeeklyArticle[]> {
  const candidates = deduplicateArticles(articles).slice(0, 30)
  if (candidates.length <= MAX_SELECTED_ARTICLES)
    return candidates

  const output = await runModel(
    env,
    '你是 AIGC 週刊主編。全程使用繁體中文（台灣），只返回 JSON，不要輸出解釋或 Markdown 程式碼區塊。',
    `从候选文章中选择最多 ${MAX_SELECTED_ARTICLES} 篇，兼顾资讯、模型、工具三类。
排除历史周刊中已报道的相同 URL、相同发布事件或高度重复主题。
只能返回候选列表中已有的 URL。

返回格式：{"urls":["https://..."]}

候选：
${JSON.stringify(candidates)}

历史 RSS：
${clip(historicalRss, 24_000)}`,
  )

  const selected = parseModelJson<{ urls?: unknown } | null>(output)
  const selectedUrls = Array.isArray(selected?.urls)
    ? selected.urls.filter((url): url is string => typeof url === 'string')
    : []
  const urls = new Set(selectedUrls.map(canonicalUrl))
  const matches = candidates.filter(article => urls.has(canonicalUrl(article.url)))
  return matches.length > 0 ? matches.slice(0, MAX_SELECTED_ARTICLES) : candidates.slice(0, MAX_SELECTED_ARTICLES)
}

export async function writeWeekly(
  env: Cloudflare.Env,
  week: WeekInfo,
  articles: WeeklyArticle[],
): Promise<WeeklyDraft> {
  const output = await runModel(
    env,
    `你是面向科技愛好者和開發者的繁體中文（台灣）科技專欄作家。
寫作應簡單、人性化、清晰、專業客觀，不堆砌形容詞。所有事實必須來自輸入素材。
原文連結必須用貼近標題或核心名詞的錨點文字自然嵌入段落，禁止單列「原文連結」或「閱讀更多」。`,
    `撰寫「DrData 的 AIGC 週刊（${week.weekId}）」。
正文使用 Markdown，包含简短开场白、资讯、模型、工具和结束语。没有素材的分类可以省略。
每条素材写成连贯段落，不要在标题后附发布日期。

返回严格 JSON：
{"title":"标题","summary":"不超过 200 字摘要","content":"Markdown 正文","tags":["标签"]}

本期范围：${week.startDate} 至 ${week.endDate}
素材：
${JSON.stringify(articles)}`,
    8_192,
  )

  return parseWeeklyDraft(output)
}

export async function reviewWeekly(
  env: Cloudflare.Env,
  week: WeekInfo,
  draft: WeeklyDraft,
): Promise<{ critique: string, pass: boolean }> {
  const output = await runModel(
    env,
    '你是嚴格的繁體中文（台灣）科技週刊審稿人。只返回 JSON，不要輸出解釋或 Markdown 程式碼區塊。',
    `检查草稿是否满足：
1. 内容与 AIGC 高度相关且没有营销软文；
2. 没有超出素材的事实断言；
3. 原文链接均保留为自然锚文本；
4. 中文准确、流畅、简洁；
5. 内容属于 ${week.startDate} 至 ${week.endDate} 的本期范围。

返回格式：{"pass":true|false,"critique":"通过时为空字符串，否则给出具体修改意见"}

草稿：
${JSON.stringify(draft)}`,
  )

  const review = parseModelJson<{ critique?: unknown, pass?: unknown } | null>(output)
  return {
    critique: typeof review?.critique === 'string' ? review.critique.trim() : '',
    pass: review?.pass === true,
  }
}

export async function reviseWeekly(
  env: Cloudflare.Env,
  draft: WeeklyDraft,
  critique: string,
): Promise<WeeklyDraft> {
  const output = await runModel(
    env,
    '你是繁體中文（台灣）科技專欄作家。根據審稿意見修訂，不得刪除有效原文連結或加入輸入中不存在的事實。只返回 JSON。',
    `返回格式：{"title":"标题","summary":"摘要","content":"Markdown 正文","tags":["标签"]}

审稿意见：
${critique}

原草稿：
${JSON.stringify(draft)}`,
    8_192,
  )

  return parseWeeklyDraft(output)
}
