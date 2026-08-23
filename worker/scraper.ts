import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import TurndownService from 'turndown'

export type ScrapeMethod
  = | 'markdown-for-agents'
    | 'readability'
    | 'static-text'
    | 'browser-run'
    | 'jina-reader'

interface ScraperDependencies {
  fetch: typeof fetch
  browserMarkdown: (url: string) => Promise<string>
  jinaRead: (url: string) => Promise<string>
}

interface ScraperOptions {
  minimumContentLength?: number
  requestTimeoutMs?: number
}

export interface ScrapeAttempt {
  method: 'static-fetch' | 'browser-run' | 'jina-reader'
  error: string
}

export interface ScrapeResult {
  content: string
  method: ScrapeMethod
  title?: string
  url: string
}

interface ExtractedContent {
  content: string
  method: ScrapeMethod
  title?: string
}

const DEFAULT_MINIMUM_CONTENT_LENGTH = 280
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000
const CHALLENGE_MARKERS = [
  /verify you are human/i,
  /checking your browser/i,
  /enable javascript and cookies/i,
  /captcha/i,
  /access denied/i,
  /启用\s*javascript/i,
  /请完成安全验证/,
  /访问过于频繁/,
]

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local'))
    return true

  if (normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:'))
    return true

  const parts = normalized.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part)))
    return false

  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0
}

function validateTarget(target: string): URL {
  let url: URL
  try {
    url = new URL(target)
  }
  catch {
    throw new Error(`URL 无效：${target}`)
  }

  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error(`不支持的 URL 协议：${url.protocol}`)

  if (isPrivateHostname(url.hostname))
    throw new Error(`不允许抓取私有网络地址：${url.hostname}`)

  return url
}

function normalizedLength(content: string): number {
  return content
    .replace(/```[\s\S]*?```/g, ' code ')
    .replace(/[#>*_`~\-[\]()]/g, '')
    .replace(/\s+/g, '')
    .length
}

function isUsableContent(content: string, minimumContentLength: number): boolean {
  if (normalizedLength(content) < minimumContentLength)
    return false

  return !CHALLENGE_MARKERS.some(marker => marker.test(content.slice(0, 4_000)))
}

function htmlToMarkdown(html: string, url: string): ExtractedContent | null {
  const { document } = parseHTML(html)
  document.querySelectorAll('nav, aside, header, footer, script, style, noscript')
    .forEach(element => element.remove())
  const article = new Readability(document as unknown as Document, { charThreshold: 20 }).parse()
  if (!article?.content)
    return null

  const turndown = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    headingStyle: 'atx',
  })
  const content = turndown.turndown(article.content)
  if (!content)
    return null

  return {
    content: article.title ? `# ${article.title}\n\n${content}` : content,
    method: 'readability',
    title: article.title || new URL(url).hostname,
  }
}

async function staticExtract(
  target: string,
  requestTimeoutMs: number,
  fetcher: typeof fetch,
): Promise<ExtractedContent> {
  const response = await fetcher(target, {
    headers: {
      'Accept': 'text/markdown, text/html;q=0.9, application/rss+xml;q=0.8, application/xml;q=0.8, text/plain;q=0.7',
      'User-Agent': 'AIGCWeeklyBot/1.0 (+https://aigc-weekly.agi.li)',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(requestTimeoutMs),
  })

  if (!response.ok)
    throw new Error(`HTTP ${response.status}`)

  const body = await response.text()
  const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? ''

  if (contentType.includes('text/markdown')) {
    return {
      content: body,
      method: 'markdown-for-agents',
    }
  }

  if (contentType.includes('html') || /<html|<article|<main/i.test(body)) {
    const extracted = htmlToMarkdown(body, response.url || target)
    if (!extracted)
      throw new Error('Readability 未提取到正文')
    return extracted
  }

  return {
    content: body,
    method: 'static-text',
  }
}

export class ScrapeError extends Error {
  attempts: ScrapeAttempt[]

  constructor(url: string, attempts: ScrapeAttempt[]) {
    super(`所有抓取方式均失败：${url}`)
    this.name = 'ScrapeError'
    this.attempts = attempts
  }
}

export function createScraper(dependencies: ScraperDependencies, options: ScraperOptions = {}) {
  const minimumContentLength = options.minimumContentLength ?? DEFAULT_MINIMUM_CONTENT_LENGTH
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS

  return {
    async scrape(target: string): Promise<ScrapeResult> {
      const url = validateTarget(target).toString()
      const attempts: ScrapeAttempt[] = []

      try {
        const extracted = await staticExtract(url, requestTimeoutMs, dependencies.fetch)
        if (isUsableContent(extracted.content, minimumContentLength))
          return { ...extracted, url }
        attempts.push({ method: 'static-fetch', error: '正文为空、过短或为验证页面' })
      }
      catch (error) {
        attempts.push({ method: 'static-fetch', error: errorMessage(error) })
      }

      try {
        const content = await dependencies.browserMarkdown(url)
        if (isUsableContent(content, minimumContentLength))
          return { content, method: 'browser-run', url }
        attempts.push({ method: 'browser-run', error: '正文为空、过短或为验证页面' })
      }
      catch (error) {
        attempts.push({ method: 'browser-run', error: errorMessage(error) })
      }

      try {
        const content = await dependencies.jinaRead(url)
        if (isUsableContent(content, minimumContentLength))
          return { content, method: 'jina-reader', url }
        attempts.push({ method: 'jina-reader', error: '正文为空、过短或为验证页面' })
      }
      catch (error) {
        attempts.push({ method: 'jina-reader', error: errorMessage(error) })
      }

      throw new ScrapeError(url, attempts)
    },
  }
}

export async function readBrowserMarkdownResponse(response: Response): Promise<string> {
  const body = await response.text()
  if (!response.ok)
    throw new Error(`Browser Run HTTP ${response.status}：${body.slice(0, 500)}`)

  try {
    const result = JSON.parse(body) as { result?: unknown, success?: unknown }
    if (result.success !== true || typeof result.result !== 'string')
      throw new Error('Browser Run 返回字段不完整')
    return result.result
  }
  catch (error) {
    if (error instanceof SyntaxError)
      throw new Error('Browser Run 返回了无效 JSON')
    throw error
  }
}

async function browserMarkdown(browser: BrowserRun, url: string): Promise<string> {
  const response = await browser.quickAction('markdown', {
    rejectResourceTypes: ['image', 'media', 'font'],
    url,
  })
  return readBrowserMarkdownResponse(response)
}

async function jinaRead(fetcher: typeof fetch, apiKey: string | undefined, url: string): Promise<string> {
  const headers = new Headers({
    'Accept': 'text/markdown',
    'X-Return-Format': 'markdown',
  })
  if (apiKey)
    headers.set('Authorization', `Bearer ${apiKey}`)

  const response = await fetcher(`https://r.jina.ai/${url}`, {
    headers,
    signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
  })
  if (!response.ok)
    throw new Error(`Jina Reader HTTP ${response.status}`)

  return response.text()
}

export function createCloudflareScraper(env: Cloudflare.Env) {
  return createScraper({
    browserMarkdown: url => browserMarkdown(env.BROWSER, url),
    fetch,
    jinaRead: url => jinaRead(fetch, env.JINA_API_KEY, url),
  })
}
