import { describe, expect, it } from 'vitest'

import { getWeekInfo } from './week'
import { buildWeeklyDraftFallback, deduplicateArticles, isHnItemUrl, parseModelJson, parseWeeklyDraft, selectArticlesByScore } from './weekly'

describe('isHnItemUrl', () => {
  it('detects Hacker News item pages', () => {
    expect(isHnItemUrl('https://news.ycombinator.com/item?id=49407576')).toBe(true)
    expect(isHnItemUrl('https://example.com/item?id=1')).toBe(false)
  })
})

describe('deduplicateArticles', () => {
  it('keeps the highest scoring version of a repeated URL', () => {
    const articles = deduplicateArticles([
      {
        category: 'tool',
        date: '2026-08-23',
        reason: '较低分版本',
        score: 72,
        source: 'A',
        summary: '摘要 A',
        title: 'Example Tool',
        url: 'https://example.com/tool?utm_source=newsletter',
      },
      {
        category: 'tool',
        date: '2026-08-24',
        reason: '较高分版本',
        score: 91,
        source: 'B',
        summary: '摘要 B',
        title: 'Example Tool 发布',
        url: 'https://example.com/tool',
      },
    ])

    expect(articles).toHaveLength(1)
    expect(articles[0]?.score).toBe(91)
  })
})

describe('selectArticlesByScore', () => {
  it('prefers category diversity before filling by score', () => {
    const articles = [
      {
        category: 'tool' as const,
        date: '2026-08-23',
        reason: '工具',
        score: 95,
        source: 'A',
        summary: '工具摘要',
        title: '高分工具',
        url: 'https://example.com/tool',
      },
      {
        category: 'news' as const,
        date: '2026-08-23',
        reason: '资讯',
        score: 80,
        source: 'B',
        summary: '资讯摘要',
        title: '资讯稿',
        url: 'https://example.com/news',
      },
      {
        category: 'model' as const,
        date: '2026-08-23',
        reason: '模型',
        score: 82,
        source: 'C',
        summary: '模型摘要',
        title: '模型发布',
        url: 'https://example.com/model',
      },
    ]

    const selected = selectArticlesByScore(articles, 2)
    expect(selected).toHaveLength(2)
    expect(selected.map(article => article.category).sort()).toEqual(['model', 'news'])
  })
})

describe('parseModelJson', () => {
  it('accepts JSON wrapped in a Markdown code fence', () => {
    expect(parseModelJson<{ pass: boolean }>('```json\n{"pass":true}\n```')).toEqual({ pass: true })
  })

  it('rejects non-JSON model output', () => {
    expect(() => parseModelJson('无法解析')).toThrow('模型未返回有效 JSON')
  })
})

describe('buildWeeklyDraftFallback', () => {
  it('builds a markdown draft from selected articles', () => {
    const week = getWeekInfo('2025-08-20')
    const draft = buildWeeklyDraftFallback(week, [{
      category: 'news',
      date: '2025-08-20',
      reason: '重要',
      score: 88,
      source: 'Example',
      summary: '摘要内容',
      title: '示例新闻',
      url: 'https://example.com/news',
    }])

    expect(draft.title).toContain('Y25W33')
    expect(draft.content).toContain('示例新闻')
    expect(draft.content).toContain('https://example.com/news')
  })
})

describe('parseWeeklyDraft', () => {
  it('normalizes a complete model draft', () => {
    expect(parseWeeklyDraft(JSON.stringify({
      content: '  # 正文  ',
      summary: '  摘要  ',
      tags: ['模型', '工具'],
      title: '  本周周刊  ',
    }))).toEqual({
      content: '# 正文',
      summary: '摘要',
      tags: ['模型', '工具'],
      title: '本周周刊',
    })
  })

  it('rejects missing or incorrectly typed fields', () => {
    expect(() => parseWeeklyDraft('{"title":"标题","summary":"摘要","content":"正文"}'))
      .toThrow('周刊字段不完整')
    expect(() => parseWeeklyDraft('{"title":"标题","summary":"摘要","content":"正文","tags":"AI"}'))
      .toThrow('周刊字段不完整')
  })
})
