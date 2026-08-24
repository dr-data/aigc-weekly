import type { ResearchSource } from './sources'
import type { WeekInfo } from './week'

import { parseHTML } from 'linkedom'

import { getCachedFeed, putCachedFeed } from './feed-cache'

export interface FeedItem {
  date: string
  summary: string
  title: string
  url: string
}

export interface ParsedFeed {
  items: FeedItem[]
  raw: string
  title: string
}

const DEFAULT_RSSHUB_BASE = 'https://rsshub.shorlol.workers.dev'
const MAX_UNDATED_ITEMS = 20
const MAX_FEED_ITEMS = 60
const REQUEST_TIMEOUT_MS = 30_000

export function getRssHubBase(env: Cloudflare.Env): string {
  return (env.RSSHUB_BASE_URL || DEFAULT_RSSHUB_BASE).replace(/\/$/, '')
}

export function resolveFeedUrl(
  kind: 'rss' | 'rsshub',
  url: string,
  env: Cloudflare.Env,
): string {
  if (kind === 'rss')
    return url

  const path = url.startsWith('/') ? url : `/${url}`
  return `${getRssHubBase(env)}${path}`
}

function normalizeDate(value: string | null | undefined): string {
  if (!value?.trim())
    return ''

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()))
    return ''

  return parsed.toISOString().slice(0, 10)
}

function textContent(element: Element | null | undefined): string {
  return element?.textContent?.trim() ?? ''
}

function firstLink(element: Element): string {
  const link = element.querySelector('link[href]')
  if (link) {
    const href = link.getAttribute('href')?.trim()
    if (href)
      return href
  }

  const atomLink = [...element.querySelectorAll('link')]
    .find(node => node.getAttribute('rel') !== 'enclosure')
  return atomLink?.getAttribute('href')?.trim() ?? ''
}

function normalizeFeedItemUrl(url: string): string {
  const trimmed = url.trim()
  if (/^\d+$/.test(trimmed))
    return `https://news.ycombinator.com/item?id=${trimmed}`
  return trimmed
}

function parseRssItemsFromRegex(xml: string): FeedItem[] {
  const items: FeedItem[] = []
  const itemPattern = /<item\b[^>]*>([\s\S]*?)<\/item>/gi

  for (const match of xml.matchAll(itemPattern)) {
    const block = match[1] ?? ''
    const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim()
    const url = block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1]?.trim()
      || block.match(/<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i)?.[1]?.trim()
    const pubDate = block.match(/<pubDate[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i)?.[1]?.trim()
      || block.match(/<dc:date[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:date>/i)?.[1]?.trim()
    const summary = block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim()

    if (!title || !url)
      continue

    items.push({
      date: normalizeDate(pubDate),
      summary: summary ?? '',
      title,
      url: normalizeFeedItemUrl(url),
    })
  }

  return items
}

function parseRssItems(document: Document, xml: string): FeedItem[] {
  const nodes = [
    ...document.querySelectorAll('item'),
    ...document.getElementsByTagName('item'),
  ]

  const parsed = [...new Set(nodes)]
    .map((item) => {
      const title = textContent(item.querySelector('title'))
      const url = textContent(item.querySelector('link')) || textContent(item.querySelector('guid'))
      if (!title || !url)
        return null

      const pubDate = textContent(item.querySelector('pubDate'))
        || item.querySelector('pubDate')?.getAttribute('title')
        || textContent(item.querySelector('dc\\:date, date'))

      return {
        date: normalizeDate(pubDate),
        summary: textContent(item.querySelector('description')),
        title,
        url: normalizeFeedItemUrl(url),
      }
    })
    .filter((item): item is FeedItem => item !== null)

  if (parsed.length > 0)
    return parsed

  return parseRssItemsFromRegex(xml)
}

function parseAtomItems(document: Document): FeedItem[] {
  const nodes = [
    ...document.querySelectorAll('entry'),
    ...document.getElementsByTagName('entry'),
  ]

  return [...new Set(nodes)]
    .map((entry) => {
      const title = textContent(entry.querySelector('title'))
      const url = firstLink(entry)
      if (!title || !url)
        return null

      const updated = textContent(entry.querySelector('updated'))
        || textContent(entry.querySelector('published'))

      return {
        date: normalizeDate(updated),
        summary: textContent(entry.querySelector('summary')) || textContent(entry.querySelector('content')),
        title,
        url: normalizeFeedItemUrl(url),
      }
    })
    .filter((item): item is FeedItem => item !== null)
}

export function parseFeedXml(xml: string): ParsedFeed {
  const { document } = parseHTML(xml, { xml: true })
  const title = textContent(document.querySelector('channel > title'))
    || textContent(document.querySelector('feed > title'))
    || textContent(document.getElementsByTagName('title')[0])
    || 'Feed'

  const isAtom = Boolean(document.querySelector('feed') || document.getElementsByTagName('feed').length > 0)
  const items = isAtom ? parseAtomItems(document) : parseRssItems(document, xml)
  return {
    items: items.slice(0, MAX_FEED_ITEMS),
    raw: xml,
    title,
  }
}

export async function fetchFeed(feedUrl: string): Promise<ParsedFeed> {
  const response = await fetch(feedUrl, {
    headers: {
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      'User-Agent': 'AIGCWeeklyBot/1.0 (+https://ai.shor.lol)',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const body = await response.text()
  if (!response.ok)
    throw new Error(`Feed HTTP ${response.status}：${body.slice(0, 300)}`)

  if (!body.trim())
    throw new Error('Feed 返回空内容')

  return parseFeedXml(body)
}

function isRetriableFeedStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504
}

async function fetchFeedFromUrl(feedUrl: string): Promise<ParsedFeed> {
  try {
    return await fetchFeed(feedUrl)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = Number(message.match(/Feed HTTP (\d+)/)?.[1])
    if (Number.isFinite(status) && isRetriableFeedStatus(status))
      throw error
    throw error
  }
}

export async function fetchFeedForSource(
  env: Cloudflare.Env,
  source: ResearchSource,
  week: WeekInfo,
): Promise<{ feed: ParsedFeed, feedUrl: string }> {
  const primaryUrl = resolveFeedUrl(source.kind as 'rss' | 'rsshub', source.url, env)
  const candidates = [primaryUrl, ...(source.fallbackUrls ?? [])]
  const cached = await getCachedFeed(env, week.weekId, primaryUrl)
  if (cached)
    return { feed: cached, feedUrl: primaryUrl }

  let lastError: unknown
  for (const feedUrl of candidates) {
    try {
      const feed = await fetchFeedFromUrl(feedUrl)
      if (feedUrl === primaryUrl)
        await putCachedFeed(env, week.weekId, primaryUrl, feed)
      return { feed, feedUrl }
    }
    catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Feed 抓取失败')
}

function isDateInWeek(date: string, week: WeekInfo): boolean {
  if (!date)
    return false
  return date >= week.startDate && date <= week.endDate
}

const AI_KEYWORD_PATTERNS = [
  /\bAIGC\b/i,
  /\bAI\b/i,
  /\bLLM\b/i,
  /\bGPT\b/i,
  /\bChatGPT\b/i,
  /\bClaude\b/i,
  /\bGemini\b/i,
  /\bDeepSeek\b/i,
  /\bOpenAI\b/i,
  /\bAnthropic\b/i,
  /\bCopilot\b/i,
  /\bAgent\b/i,
  /\bTransformer\b/i,
  /人工智能/,
  /机器学习/,
  /大模型/,
  /生成式/,
  /神经网络/,
  /深度学习/,
]

export function matchesAiKeywords(text: string): boolean {
  const haystack = text.trim()
  if (!haystack)
    return false

  return AI_KEYWORD_PATTERNS.some(pattern => pattern.test(haystack))
}

export function filterByAiKeywords(items: FeedItem[]): FeedItem[] {
  return items.filter(item => matchesAiKeywords(`${item.title} ${item.summary}`))
}

export interface FeedFilterOptions {
  aiKeywordsOnly?: boolean
}

export function filterFeedItems(items: FeedItem[], week: WeekInfo, options?: FeedFilterOptions): FeedItem[] {
  const dated = items.filter(item => isDateInWeek(item.date, week))
  let filtered = dated.length > 0 ? dated : items
  filtered = filtered.slice(0, MAX_UNDATED_ITEMS)

  if (options?.aiKeywordsOnly)
    filtered = filterByAiKeywords(filtered)

  return filtered
}
