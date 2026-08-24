import { parseHTML } from 'linkedom'

const IMAGE_FETCH_TIMEOUT_MS = 12_000
const MAX_HTML_BYTES = 120_000
const WSRV_BASE = 'https://wsrv.nl/'

const META_IMAGE_SELECTORS = [
  'meta[property="og:image:secure_url"]',
  'meta[property="og:image"]',
  'meta[name="twitter:image"]',
  'meta[name="twitter:image:src"]',
  'meta[itemprop="image"]',
]

const SKIP_IMAGE_PATTERNS = [
  /favicon/i,
  /\/apple-touch-icon/i,
  /\/sprite/i,
  /\/avatar/i,
  /\/emoji/i,
  /1x1/,
  /pixel\.gif/i,
  /spacer\.gif/i,
  /badge/i,
  /logo(?:-|\.)[^/]{0,24}\.(?:png|svg|ico)(?:\?|$)/i,
]

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

function validatePublicHttpUrl(target: string): URL {
  const url = new URL(target)
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error(`不支持的 URL 协议：${url.protocol}`)

  if (isPrivateHostname(url.hostname))
    throw new Error(`不允许访问私有网络地址：${url.hostname}`)

  return url
}

function normalizeMetaContent(value: string | null | undefined): string {
  return value?.trim().replace(/^['"]|['"]$/g, '') ?? ''
}

function resolveAbsoluteImageUrl(rawUrl: string, pageUrl: string): string | undefined {
  const trimmed = rawUrl.trim()
  if (!trimmed || trimmed.startsWith('data:'))
    return undefined

  try {
    return validatePublicHttpUrl(new URL(trimmed, pageUrl).toString()).toString()
  }
  catch {
    return undefined
  }
}

export function isUsableArticleImageUrl(imageUrl: string): boolean {
  try {
    const parsed = validatePublicHttpUrl(imageUrl)
    if (parsed.hostname.replace(/^www\./, '') === 'wsrv.nl')
      return false

    const path = `${parsed.pathname}${parsed.search}`
    if (SKIP_IMAGE_PATTERNS.some(pattern => pattern.test(path)))
      return false

    return /\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(path)
      || path.includes('/image')
      || path.includes('/upload')
      || path.includes('/assets')
      || path.includes('/media')
      || path.includes('/cover')
      || path.includes('/og')
  }
  catch {
    return false
  }
}

export function extractImageUrlFromHtml(html: string, pageUrl: string): string | undefined {
  const { document } = parseHTML(html)
  for (const selector of META_IMAGE_SELECTORS) {
    const element = document.querySelector(selector)
    const content = normalizeMetaContent(element?.getAttribute('content'))
    const resolved = content ? resolveAbsoluteImageUrl(content, pageUrl) : undefined
    if (resolved && isUsableArticleImageUrl(resolved))
      return resolved
  }

  return undefined
}

export function buildProxiedImageUrl(imageUrl: string): string {
  const validated = validatePublicHttpUrl(imageUrl)
  const params = new URLSearchParams({
    url: validated.toString(),
    w: '1200',
    h: '675',
    fit: 'cover',
    a: 'focal',
    output: 'webp',
    q: '80',
    maxage: '1y',
  })
  return `${WSRV_BASE}?${params.toString()}`
}

export function buildImageMarkdown(alt: string, imageUrl: string): string {
  const safeAlt = alt.replace(/\s+/g, ' ').trim().slice(0, 120)
  return `![${safeAlt}](${buildProxiedImageUrl(imageUrl)})`
}

export async function fetchArticleImageUrl(
  pageUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<string | undefined> {
  try {
    const target = validatePublicHttpUrl(pageUrl).toString()
    const response = await fetcher(target, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'AIGCWeeklyBot/1.0 (+https://ai.shor.lol)',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    })

    if (!response.ok)
      return undefined

    const html = (await response.text()).slice(0, MAX_HTML_BYTES)
    return extractImageUrlFromHtml(html, response.url || target)
  }
  catch {
    return undefined
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function ensureArticleImages(content: string, articles: Array<{ imageMarkdown?: string, url: string }>): string {
  let result = content

  for (const article of articles) {
    const markdown = article.imageMarkdown?.trim()
    if (!markdown || result.includes(markdown))
      continue

    const escapedUrl = escapeRegExp(article.url)
    const patterns = [
      new RegExp(`(\\*\\*\\[[^\\]]+\\]\\(${escapedUrl}\\)[^*\\n]*)\\n`),
      new RegExp(`(\\[[^\\]]+\\]\\(${escapedUrl}\\)[^\\n]*)\\n`),
    ]

    let inserted = false
    for (const pattern of patterns) {
      if (pattern.test(result)) {
        result = result.replace(pattern, `$1\n\n${markdown}\n`)
        inserted = true
        break
      }
    }

    if (inserted)
      continue

    const urlIndex = result.indexOf(article.url)
    if (urlIndex < 0)
      continue

    const lineEnd = result.indexOf('\n', urlIndex)
    const insertAt = lineEnd >= 0 ? lineEnd + 1 : result.length
    result = `${result.slice(0, insertAt)}\n${markdown}\n${result.slice(insertAt)}`
  }

  return result
}
