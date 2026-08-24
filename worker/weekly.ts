import type { ScrapeMethod } from './scraper'
import type { ResearchSource } from './sources'
import type { WeekInfo } from './week'

import { AI_MODEL } from './config'
import { fetchHnFeedItems } from './hn'
import { buildImageMarkdown, ensureArticleImages, fetchArticleImageUrl } from './images'
import { fetchFeedForSource, filterFeedItems } from './rss'
import { createCloudflareScraper, ScrapeError } from './scraper'
import { chunkSources, getMaxCandidates } from './sources'

export interface WeeklyArticle {
  category: 'news' | 'model' | 'tool'
  date: string
  imageMarkdown?: string
  imageUrl?: string
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
  method?: ResearchMethod
  source: string
}

export type ResearchMethod = ScrapeMethod | 'hn-api' | 'rss' | 'rsshub'

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
const MAX_SELECTED_ARTICLES = 15
const MAX_SELECTION_CANDIDATES = 30
const MAX_HISTORICAL_RSS_CHARACTERS = 8_000
const SCORE_PARALLELISM = 3
const HN_FULL_SCRAPE_THRESHOLD = 85
const PRESCORE_THRESHOLD = 65
const MIN_SUMMARY_FOR_PRESCORE = 40

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
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
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
    catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('模型未返回文本内容')
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
  maxCandidates: number,
): Promise<Candidate[]> {
  const output = await runModel(
    env,
    '你是 AIGC 新聞研究員。全程使用繁體中文（台灣），只返回 JSON，不要輸出解釋或 Markdown 程式碼區塊。',
    `从以下页面中找出发布日期在 ${week.startDate} 至 ${week.endDate}（UTC）之间、与生成式 AI、LLM、AI Agent 或 AI 编程直接相关的文章。
最多返回 ${maxCandidates} 篇。不要编造页面中不存在的 URL 或日期。无法确认日期时 date 使用空字符串。

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
    .slice(0, maxCandidates)
}

function normalizeScore(value: unknown, maximum: number): number {
  const score = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(score))
    return 0
  return Math.max(0, Math.min(maximum, Math.round(score)))
}

async function prescoreArticle(
  env: Cloudflare.Env,
  source: ResearchSource,
  candidate: Candidate,
): Promise<number | null> {
  const summary = candidate.summary?.trim() ?? ''
  if (summary.length < MIN_SUMMARY_FOR_PRESCORE)
    return null

  const output = await runModel(
    env,
    '你是嚴格的 AIGC 週刊主編。全程使用繁體中文（台灣），只返回 JSON，不要輸出解釋或 Markdown 程式碼區塊。',
    `根据标题与摘要快速预估总分（0-100）。营销软文或与 AIGC 无关内容应低于 70 分。
返回格式：{"relevance":0,"impact":0,"utility":0}

标题：${candidate.title}
URL：${candidate.url}
来源：${source.name}
摘要：${summary}`,
    512,
  )

  const parsedScore = parseModelJson<Partial<ScoredArticle>>(output)
  if (!parsedScore || typeof parsedScore !== 'object')
    return null

  return normalizeScore(parsedScore.relevance, 40)
    + normalizeScore(parsedScore.impact, 30)
    + normalizeScore(parsedScore.utility, 30)
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

function feedItemToCandidate(item: { date: string, summary: string, title: string, url: string }): Candidate {
  return {
    date: item.date,
    summary: item.summary,
    title: item.title,
    url: item.url,
  }
}

export function isHnItemUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '') === 'news.ycombinator.com'
      && parsed.pathname === '/item'
      && parsed.searchParams.has('id')
  }
  catch {
    return false
  }
}

function metadataContent(candidate: Candidate): string {
  const parts = [candidate.title, candidate.summary].filter(part => part?.trim())
  return parts.join('\n\n') || candidate.title
}

async function attachArticleImage(article: WeeklyArticle): Promise<WeeklyArticle> {
  if (isHnItemUrl(article.url) || article.imageMarkdown)
    return article

  const imageUrl = await fetchArticleImageUrl(article.url)
  if (!imageUrl)
    return article

  return {
    ...article,
    imageMarkdown: buildImageMarkdown(article.title, imageUrl),
    imageUrl,
  }
}

async function collectCandidates(
  env: Cloudflare.Env,
  source: ResearchSource,
  week: WeekInfo,
): Promise<{ candidates: Candidate[], method: ResearchMethod, prefetchByUrl: Map<string, string>, snapshot: string }> {
  const maxCandidates = getMaxCandidates(source)

  switch (source.kind) {
    case 'rss':
    case 'rsshub': {
      const { feed } = await fetchFeedForSource(env, source, week)
      const candidates = filterFeedItems(feed.items, week, {
        aiKeywordsOnly: source.url.includes('/solidot/'),
      })
        .map(feedItemToCandidate)
        .slice(0, maxCandidates)
      return {
        candidates,
        method: source.kind === 'rsshub' ? 'rsshub' : 'rss',
        prefetchByUrl: new Map(),
        snapshot: feed.raw,
      }
    }

    case 'hn': {
      if (!source.hnFeed)
        throw new Error('HN 来源缺少 hnFeed 配置')

      const items = await fetchHnFeedItems(source.hnFeed, week)
      return {
        candidates: items.map(feedItemToCandidate).slice(0, maxCandidates),
        method: 'hn-api',
        prefetchByUrl: new Map(),
        snapshot: JSON.stringify(items, null, 2),
      }
    }

    default: {
      const scraper = createCloudflareScraper(env)
      const landing = await scraper.scrape(source.url)
      const candidates = await findCandidates(env, source, week, landing.content, maxCandidates)
      const prefetchByUrl = new Map<string, string>()

      await Promise.all(candidates.map(async (candidate) => {
        if (candidate.url === source.url || prefetchByUrl.has(candidate.url))
          return

        try {
          const scraped = await scraper.scrape(candidate.url)
          prefetchByUrl.set(candidate.url, scraped.content)
        }
        catch {
          // 浅层爬取失败时保留候选，后续评分阶段再尝试
        }
      }))

      return {
        candidates,
        method: landing.method,
        prefetchByUrl,
        snapshot: landing.content,
      }
    }
  }
}

async function scoreSingleCandidate(
  env: Cloudflare.Env,
  source: ResearchSource,
  candidate: Candidate,
  failures: ResearchFailure[],
  contentByUrl: Map<string, string>,
): Promise<WeeklyArticle | null> {
  const scraper = createCloudflareScraper(env)

  try {
    const cached = contentByUrl.get(candidate.url)
    let articleContent: string

    if (cached) {
      articleContent = cached
    }
    else if (isHnItemUrl(candidate.url)) {
      articleContent = metadataContent(candidate)
    }
    else {
      const prescore = await prescoreArticle(env, source, candidate)
      if (prescore !== null && prescore < PRESCORE_THRESHOLD)
        return null

      articleContent = (await scraper.scrape(candidate.url)).content
    }

    let article = await scoreArticle(env, source, candidate, articleContent)

    if (article && isHnItemUrl(candidate.url) && article.score >= HN_FULL_SCRAPE_THRESHOLD) {
      try {
        const fullContent = (await scraper.scrape(candidate.url)).content
        const rescored = await scoreArticle(env, source, candidate, fullContent)
        if (rescored)
          article = rescored
      }
      catch {
        // 保留基于元数据的评分结果
      }
    }

    if (!article)
      return null

    return await attachArticleImage(article)
  }
  catch (error) {
    failures.push(failureFrom(error, source, candidate.url))
    return null
  }
}

async function scoreCandidates(
  env: Cloudflare.Env,
  source: ResearchSource,
  candidates: Candidate[],
  failures: ResearchFailure[],
  contentByUrl: Map<string, string>,
): Promise<WeeklyArticle[]> {
  const articles: WeeklyArticle[] = []

  for (const chunk of chunkSources(candidates, SCORE_PARALLELISM)) {
    const scored = await Promise.all(
      chunk.map(candidate => scoreSingleCandidate(env, source, candidate, failures, contentByUrl)),
    )
    articles.push(...scored.filter((article): article is WeeklyArticle => article !== null))
  }

  return articles
}

export async function researchSource(
  env: Cloudflare.Env,
  source: ResearchSource,
  week: WeekInfo,
  artifactPrefix: string,
): Promise<SourceResearchResult> {
  const failures: ResearchFailure[] = []

  try {
    const collected = await collectCandidates(env, source, week)
    const contentByUrl = new Map<string, string>()
    if (source.kind === 'url')
      contentByUrl.set(source.url, collected.snapshot)
    for (const [url, content] of collected.prefetchByUrl.entries())
      contentByUrl.set(url, content)

    await env.AGENT_STORAGE.put(
      `${artifactPrefix}/sources/${encodeURIComponent(source.name)}.md`,
      clip(collected.snapshot, MAX_SOURCE_CHARACTERS),
      {
        customMetadata: {
          kind: source.kind,
          method: collected.method,
          source: source.name,
          url: source.url,
        },
        httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
      },
    )

    const articles = await scoreCandidates(
      env,
      source,
      collected.candidates,
      failures,
      contentByUrl,
    )

    return {
      articles,
      failures,
      method: collected.method,
      source: source.name,
    }
  }
  catch (error) {
    failures.push(failureFrom(error, source, source.url))
    return { articles: [], failures, source: source.name }
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

export function selectArticlesByScore(
  articles: WeeklyArticle[],
  limit = MAX_SELECTED_ARTICLES,
): WeeklyArticle[] {
  const ranked = deduplicateArticles(articles)
  if (ranked.length <= limit)
    return ranked

  const selected: WeeklyArticle[] = []
  const used = new Set<string>()
  const categories: WeeklyArticle['category'][] = ['news', 'model', 'tool']

  for (const category of categories) {
    if (selected.length >= limit)
      break

    const pick = ranked.find(article => article.category === category && !used.has(canonicalUrl(article.url)))
    if (pick) {
      selected.push(pick)
      used.add(canonicalUrl(pick.url))
    }
  }

  for (const article of ranked) {
    if (selected.length >= limit)
      break

    const key = canonicalUrl(article.url)
    if (used.has(key))
      continue

    selected.push(article)
    used.add(key)
  }

  return selected.slice(0, limit)
}

export async function selectArticles(
  env: Cloudflare.Env,
  articles: WeeklyArticle[],
  historicalRss: string,
): Promise<WeeklyArticle[]> {
  const candidates = deduplicateArticles(articles)
  if (candidates.length <= MAX_SELECTED_ARTICLES)
    return candidates

  const pool = candidates.slice(0, MAX_SELECTION_CANDIDATES)
  const compact = pool.map(article => ({
    category: article.category,
    score: article.score,
    source: article.source,
    title: article.title,
    url: article.url,
  }))

  try {
    const output = await runModel(
      env,
      '你是 AIGC 週刊主編。全程使用繁體中文（台灣），只返回 JSON，不要輸出解釋或 Markdown 程式碼區塊。',
      `从候选文章中选择最多 ${MAX_SELECTED_ARTICLES} 篇，兼顾资讯、模型、工具三类。
排除历史周刊中已报道的相同 URL、相同发布事件或高度重复主题。
只能返回候选列表中已有的 URL。

返回格式：{"urls":["https://..."]}

候选：
${JSON.stringify(compact)}

历史 RSS：
${clip(historicalRss, MAX_HISTORICAL_RSS_CHARACTERS)}`,
      2_048,
    )

    const selected = parseModelJson<{ urls?: unknown } | null>(output)
    const selectedUrls = Array.isArray(selected?.urls)
      ? selected.urls.filter((url): url is string => typeof url === 'string')
      : []
    const urls = new Set(selectedUrls.map(canonicalUrl))
    const matches = pool.filter(article => urls.has(canonicalUrl(article.url)))
    if (matches.length > 0)
      return matches.slice(0, MAX_SELECTED_ARTICLES)
  }
  catch (error) {
    console.warn('模型筛选失败，改用分数排序 fallback', error)
  }

  return selectArticlesByScore(pool)
}

const CATEGORY_HEADINGS: Record<WeeklyArticle['category'], string> = {
  news: '資訊',
  model: '模型',
  tool: '工具',
}

export function buildWeeklyDraftFallback(week: WeekInfo, articles: WeeklyArticle[]): WeeklyDraft {
  const grouped: Record<WeeklyArticle['category'], WeeklyArticle[]> = {
    news: [],
    model: [],
    tool: [],
  }

  for (const article of articles)
    grouped[article.category].push(article)

  const sections = (['news', 'model', 'tool'] as const)
    .filter(category => grouped[category].length > 0)
    .map((category) => {
      const lines = grouped[category].map((article) => {
        const image = article.imageMarkdown ? `\n\n${article.imageMarkdown}` : ''
        return `**[${article.title}](${article.url})**（${article.source}）\n\n${article.summary}${image}`
      })
      return `## ${CATEGORY_HEADINGS[category]}\n\n${lines.join('\n\n')}`
    })

  const tags = [...new Set(articles.flatMap(article => [article.category, article.source]))]
    .slice(0, 8)

  return {
    content: [
      `# DrData 的 AIGC 週刊（${week.weekId}）`,
      '',
      `本期自動 fallback 草稿，範圍 ${week.startDate} 至 ${week.endDate}。`,
      '',
      ...sections,
      '',
      '## 結束語',
      '',
      '以上內容由候選素材自動整理，請人工審核後發布。',
    ].join('\n'),
    summary: articles[0]?.summary.slice(0, 200) ?? `DrData 的 AIGC 週刊（${week.weekId}）`,
    tags,
    title: `DrData 的 AIGC 週刊（${week.weekId}）`,
  }
}

export async function writeWeekly(
  env: Cloudflare.Env,
  week: WeekInfo,
  articles: WeeklyArticle[],
): Promise<WeeklyDraft> {
  try {
    const output = await runModel(
      env,
      `你是面向科技愛好者和開發者的繁體中文（台灣）科技專欄作家。
寫作應簡單、人性化、清晰、專業客觀，不堆砌形容詞。所有事實必須來自輸入素材。
原文連結必須用貼近標題或核心名詞的錨點文字自然嵌入段落，禁止單列「原文連結」或「閱讀更多」。`,
      `撰寫「DrData 的 AIGC 週刊（${week.weekId}）」。
正文使用 Markdown，包含简短开场白、资讯、模型、工具和结束语。没有素材的分类可以省略。
每条素材写成连贯段落，不要在标题后附发布日期。
若素材 JSON 中包含 imageMarkdown 字段，请在该条段落结束后单独一行插入 imageMarkdown，不要修改其中的 URL。

返回严格 JSON：
{"title":"标题","summary":"不超过 200 字摘要","content":"Markdown 正文","tags":["标签"]}

本期范围：${week.startDate} 至 ${week.endDate}
素材：
${JSON.stringify(articles.map(article => ({
  category: article.category,
  date: article.date,
  imageMarkdown: article.imageMarkdown,
  score: article.score,
  source: article.source,
  summary: article.summary,
  title: article.title,
  url: article.url,
})))}`,
      8_192,
    )

    try {
      const draft = parseWeeklyDraft(output)
      return {
        ...draft,
        content: ensureArticleImages(draft.content, articles),
      }
    }
    catch (error) {
      console.warn('周刊模型输出无法解析，使用 fallback 草稿', error)
      return buildWeeklyDraftFallback(week, articles)
    }
  }
  catch (error) {
    console.warn('周刊撰写模型失败，使用 fallback 草稿', error)
    return buildWeeklyDraftFallback(week, articles)
  }
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
