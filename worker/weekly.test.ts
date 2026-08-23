import { describe, expect, it } from 'vitest'

import { deduplicateArticles, parseModelJson } from './weekly'

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
