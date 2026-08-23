import { describe, expect, it, vi } from 'vitest'

import { createScraper } from './scraper'

const URL = 'https://example.com/article'

function response(body: string, contentType: string) {
  return new Response(body, {
    headers: { 'Content-Type': contentType },
  })
}

describe('scraper fallback chain', () => {
  it('returns Markdown for Agents without invoking fallbacks', async () => {
    const browserMarkdown = vi.fn()
    const jinaRead = vi.fn()
    const scraper = createScraper({
      browserMarkdown,
      fetch: vi.fn(async () => response('# 标题\n\n这是一段足够长的有效正文内容。', 'text/markdown')),
      jinaRead,
    }, { minimumContentLength: 10 })

    const result = await scraper.scrape(URL)

    expect(result.method).toBe('markdown-for-agents')
    expect(browserMarkdown).not.toHaveBeenCalled()
    expect(jinaRead).not.toHaveBeenCalled()
  })

  it('extracts readable Markdown from static HTML', async () => {
    const scraper = createScraper({
      browserMarkdown: vi.fn(),
      fetch: vi.fn(async () => response(`
        <html>
          <head><title>测试文章</title></head>
          <body>
            <nav>导航噪音</nav>
            <article><h1>测试文章</h1><p>这里是需要保留的文章正文，包含足够的信息。</p></article>
          </body>
        </html>
      `, 'text/html')),
      jinaRead: vi.fn(),
    }, { minimumContentLength: 10 })

    const result = await scraper.scrape(URL)

    expect(result.method).toBe('readability')
    expect(result.content).toContain('需要保留的文章正文')
    expect(result.content).not.toContain('导航噪音')
  })

  it('uses Browser Run when static extraction is too thin', async () => {
    const browserMarkdown = vi.fn(async () => '# 动态文章\n\n这是浏览器渲染后得到的完整正文内容。')
    const jinaRead = vi.fn()
    const scraper = createScraper({
      browserMarkdown,
      fetch: vi.fn(async () => response('<html><body>请启用 JavaScript</body></html>', 'text/html')),
      jinaRead,
    }, { minimumContentLength: 10 })

    const result = await scraper.scrape(URL)

    expect(result.method).toBe('browser-run')
    expect(browserMarkdown).toHaveBeenCalledWith(URL)
    expect(jinaRead).not.toHaveBeenCalled()
  })

  it('uses Jina Reader after Browser Run returns unusable content', async () => {
    const jinaRead = vi.fn(async () => '# Jina 结果\n\n这是由 Jina Reader 返回的有效文章正文。')
    const scraper = createScraper({
      browserMarkdown: vi.fn(async () => 'Just a moment... Verify you are human'),
      fetch: vi.fn(async () => response('<html><body></body></html>', 'text/html')),
      jinaRead,
    }, { minimumContentLength: 10 })

    const result = await scraper.scrape(URL)

    expect(result.method).toBe('jina-reader')
    expect(jinaRead).toHaveBeenCalledWith(URL)
  })

  it('reports every attempted method when all methods fail', async () => {
    const scraper = createScraper({
      browserMarkdown: vi.fn(async () => ''),
      fetch: vi.fn(async () => new Response('upstream error', { status: 502 })),
      jinaRead: vi.fn(async () => ''),
    }, { minimumContentLength: 10 })

    await expect(scraper.scrape(URL)).rejects.toMatchObject({
      attempts: [
        { method: 'static-fetch' },
        { method: 'browser-run' },
        { method: 'jina-reader' },
      ],
    })
  })

  it('rejects private network targets before fetching', async () => {
    const fetch = vi.fn()
    const scraper = createScraper({
      browserMarkdown: vi.fn(),
      fetch,
      jinaRead: vi.fn(),
    })

    await expect(scraper.scrape('http://127.0.0.1/private')).rejects.toThrow('不允许抓取私有网络地址')
    expect(fetch).not.toHaveBeenCalled()
  })
})
