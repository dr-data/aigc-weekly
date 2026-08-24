import { describe, expect, it } from 'vitest'

import {
  buildImageMarkdown,
  buildProxiedImageUrl,
  ensureArticleImages,
  extractImageUrlFromHtml,
  isUsableArticleImageUrl,
} from './images'

describe('extractImageUrlFromHtml', () => {
  it('reads og:image and resolves relative URLs', () => {
    const html = `<html><head>
      <meta property="og:image" content="/assets/cover.jpg" />
    </head></html>`
    expect(extractImageUrlFromHtml(html, 'https://example.com/posts/ai'))
      .toBe('https://example.com/assets/cover.jpg')
  })

  it('prefers secure og:image when available', () => {
    const html = `<html><head>
      <meta property="og:image" content="https://example.com/low.jpg" />
      <meta property="og:image:secure_url" content="https://example.com/high.jpg" />
    </head></html>`
    expect(extractImageUrlFromHtml(html, 'https://example.com/post'))
      .toBe('https://example.com/high.jpg')
  })
})

describe('isUsableArticleImageUrl', () => {
  it('rejects favicon-like assets', () => {
    expect(isUsableArticleImageUrl('https://example.com/favicon.ico')).toBe(false)
  })

  it('accepts common article cover URLs', () => {
    expect(isUsableArticleImageUrl('https://example.com/uploads/cover.png')).toBe(true)
  })
})

describe('buildProxiedImageUrl', () => {
  it('wraps remote images with wsrv.nl', () => {
    const proxied = buildProxiedImageUrl('https://example.com/cover.jpg')
    expect(proxied.startsWith('https://wsrv.nl/?')).toBe(true)
    expect(proxied).toContain(encodeURIComponent('https://example.com/cover.jpg'))
    expect(proxied).toContain('output=webp')
  })
})

describe('buildImageMarkdown', () => {
  it('creates markdown image syntax with proxied URL', () => {
    expect(buildImageMarkdown('Gemini 发布', 'https://example.com/cover.jpg'))
      .toBe('![Gemini 发布](https://wsrv.nl/?url=https%3A%2F%2Fexample.com%2Fcover.jpg&w=1200&h=675&fit=cover&a=focal&output=webp&q=80&maxage=1y)')
  })
})

describe('ensureArticleImages', () => {
  it('inserts image markdown after the matching article paragraph', () => {
    const content = `## 資訊

**[Gemini 3.7 Flash](https://deepmind.google/blog/introducing-gemini-3-7-flash/) 正式發布。**

## 結束語
`
    const imageMarkdown = '![Gemini 3.7 Flash](https://wsrv.nl/?url=https%3A%2F%2Fexample.com%2Fcover.jpg&w=1200&h=675&fit=cover&a=focal&output=webp&q=80&maxage=1y)'

    const updated = ensureArticleImages(content, [{
      imageMarkdown,
      url: 'https://deepmind.google/blog/introducing-gemini-3-7-flash/',
    }])

    expect(updated).toContain(imageMarkdown)
    expect(updated.indexOf(imageMarkdown)).toBeGreaterThan(updated.indexOf('Gemini 3.7 Flash'))
  })
})
