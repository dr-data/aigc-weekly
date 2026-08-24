import { describe, expect, it } from 'vitest'

import { filterByAiKeywords, filterFeedItems, matchesAiKeywords, parseFeedXml } from './rss'
import { getWeekInfo } from './week'

const RSS_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>AI Agent 週報</title>
      <link>https://example.com/ai-agent</link>
      <pubDate>Sat, 23 Aug 2026 10:00:00 GMT</pubDate>
      <description>測試摘要</description>
    </item>
    <item>
      <title>舊文章</title>
      <link>https://example.com/old</link>
      <pubDate>Mon, 01 Aug 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

const ATOM_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>LLM 工具更新</title>
    <link href="https://example.com/llm-tool" />
    <updated>2026-08-22T12:00:00Z</updated>
    <summary>Atom 摘要</summary>
  </entry>
</feed>`

describe('parseFeedXml', () => {
  it('parses RSS 2.0 items', () => {
    const feed = parseFeedXml(RSS_SAMPLE)
    expect(feed.title).toBe('Test Feed')
    expect(feed.items).toHaveLength(2)
    expect(feed.items[0]).toMatchObject({
      date: '2026-08-23',
      title: 'AI Agent 週報',
      url: 'https://example.com/ai-agent',
    })
  })

  it('parses Atom entries', () => {
    const feed = parseFeedXml(ATOM_SAMPLE)
    expect(feed.items).toHaveLength(1)
    expect(feed.items[0]).toMatchObject({
      date: '2026-08-22',
      title: 'LLM 工具更新',
      url: 'https://example.com/llm-tool',
    })
  })

  it('normalizes Hacker News item ids into full URLs', () => {
    const feed = parseFeedXml(`<?xml version="1.0"?><rss><channel><title>HN</title><item><title>Story</title><link>49407576</link></item></channel></rss>`)
    expect(feed.items[0]?.url).toBe('https://news.ycombinator.com/item?id=49407576')
  })
})

describe('filterFeedItems', () => {
  it('keeps only items inside the target week when dates exist', () => {
    const week = getWeekInfo('2026-08-23')
    const feed = parseFeedXml(RSS_SAMPLE)
    const filtered = filterFeedItems(feed.items, week)

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.title).toBe('AI Agent 週報')
  })

  it('falls back to recent undated items', () => {
    const week = getWeekInfo('2026-08-23')
    const filtered = filterFeedItems([
      { date: '', summary: '', title: 'No date 1', url: 'https://example.com/1' },
      { date: '', summary: '', title: 'No date 2', url: 'https://example.com/2' },
    ], week)

    expect(filtered).toHaveLength(2)
  })

  it('filters Solidot-style feeds to AI-related items when requested', () => {
    const week = getWeekInfo('2026-08-23')
    const filtered = filterFeedItems([
      { date: '', summary: '内核更新', title: 'Linux 6.18 发布', url: 'https://example.com/linux' },
      { date: '', summary: '新模型发布', title: 'OpenAI 发布 GPT-5', url: 'https://example.com/ai' },
    ], week, { aiKeywordsOnly: true })

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.title).toBe('OpenAI 发布 GPT-5')
  })
})

describe('matchesAiKeywords', () => {
  it('matches common AI terms in Chinese and English', () => {
    expect(matchesAiKeywords('OpenAI 发布新模型')).toBe(true)
    expect(matchesAiKeywords('Linux kernel 6.18')).toBe(false)
  })
})

describe('filterByAiKeywords', () => {
  it('keeps only AI-related feed items', () => {
    const filtered = filterByAiKeywords([
      { date: '', summary: '', title: 'Ubuntu 更新', url: 'https://example.com/1' },
      { date: '', summary: 'LLM benchmark', title: '新基准测试', url: 'https://example.com/2' },
    ])

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.url).toBe('https://example.com/2')
  })
})
