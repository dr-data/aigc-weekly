import { describe, expect, it } from 'vitest'

import { deduplicateArticles, isHnItemUrl, parseModelJson, parseWeeklyDraft } from './weekly'

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

describe('parseModelJson', () => {
  it('accepts JSON wrapped in a Markdown code fence', () => {
    expect(parseModelJson<{ pass: boolean }>('```json\n{"pass":true}\n```')).toEqual({ pass: true })
  })

  it('rejects non-JSON model output', () => {
    expect(() => parseModelJson('无法解析')).toThrow('模型未返回有效 JSON')
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
