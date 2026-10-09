import { describe, expect, it } from 'vitest'

import { getWeekInfo } from './week'
import { buildWeeklyDraftFallback, deduplicateArticles, getModelText, isHnItemUrl, MODEL_RUN_OPTIONS, parseModelJson, parseWeeklyDraft, parseWeeklyReview, selectArticlesByScore, toWeeklyPromptArticles, writeWeekly } from './weekly'

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

describe('mODEL_RUN_OPTIONS', () => {
  it('requests JSON object output', () => {
    expect(MODEL_RUN_OPTIONS.response_format.type).toBe('json_object')
  })
})

describe('getModelText', () => {
  it('reads OpenAI-style chat completion content and ignores reasoning', () => {
    expect(getModelText({
      choices: [{
        message: {
          content: '{"title":"测试"}',
          reasoning: '先思考再输出',
          reasoning_content: '先思考再输出',
        },
      }],
    })).toBe('{"title":"测试"}')
  })

  it('stringifies a parsed JSON object in the Workers AI response field', () => {
    expect(getModelText({
      response: {
        content: '测试正文',
        summary: '测试摘要',
        tags: ['AI'],
        title: '测试标题',
      },
    })).toBe('{"content":"测试正文","summary":"测试摘要","tags":["AI"],"title":"测试标题"}')
  })
})

describe('parseModelJson', () => {
  it('accepts JSON wrapped in a Markdown code fence', () => {
    expect(parseModelJson<{ pass: boolean }>('```json\n{"pass":true}\n```')).toEqual({ pass: true })
  })

  it('ignores GLM thinking blocks that contain braces', () => {
    expect(parseModelJson<{ pass: boolean }>('<think>use {json} here</think>{"pass":true}')).toEqual({
      pass: true,
    })
  })

  it('skips invalid brace fragments before the real JSON object', () => {
    expect(parseModelJson<{ pass: boolean }>('先思考 {oops} 再输出 {"pass":true}')).toEqual({
      pass: true,
    })
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

describe('parseWeeklyReview', () => {
  it('accepts a valid review payload', () => {
    expect(parseWeeklyReview('{"pass":true,"critique":""}')).toEqual({
      critique: '',
      pass: true,
    })
  })

  it('treats unparseable review output as a failed review', () => {
    expect(parseWeeklyReview('不是 JSON')).toEqual({
      critique: '审核模型未返回有效 JSON，请保持事实准确、链接完整，并重新整理本期重点。',
      pass: false,
    })
  })
})

describe('toWeeklyPromptArticles', () => {
  it('omits image markdown so the writing JSON stays small', () => {
    expect(toWeeklyPromptArticles([{
      category: 'news',
      date: '2026-10-01',
      imageMarkdown: '![cover](https://wsrv.nl/?url=https://example.com/cover.jpg&w=1200)',
      reason: '相关',
      score: 90,
      source: 'Every',
      summary: '摘要',
      title: 'How to Get Better at AI',
      url: 'https://every.to/p/example',
    }])).toEqual([{
      category: 'news',
      date: '2026-10-01',
      score: 90,
      source: 'Every',
      summary: '摘要',
      title: 'How to Get Better at AI',
      url: 'https://every.to/p/example',
    }])
  })
})

describe('writeWeekly', () => {
  const week = getWeekInfo('2026-10-03')
  const articles = [{
    category: 'news' as const,
    date: '2026-10-01',
    imageMarkdown: '![How to Get Better at AI](https://wsrv.nl/?url=https://example.com/cover.jpg&w=1200)',
    reason: '相关',
    score: 90,
    source: 'Every',
    summary: '作者分享如何用 Codex 评估 AI 使用习惯。',
    title: 'How to Get Better at AI',
    url: 'https://every.to/p/example',
  }]

  it('retries unparseable JSON and does not publish the fallback banner', async () => {
    let calls = 0
    const env = {
      AI: {
        run: async (_model: string, input: { max_tokens?: number, messages: { content: string }[] }) => {
          calls += 1
          expect(input.max_tokens).toBeGreaterThanOrEqual(16_384)
          expect(input.messages[1]?.content).not.toContain('imageMarkdown')
          expect(input.messages[1]?.content).not.toContain('wsrv.nl')
          if (calls === 1)
            return { response: 'truncated { "title":' }

          return {
            response: {
              content: '开场白 [How to Get Better at AI](https://every.to/p/example)',
              summary: '本期摘要',
              tags: ['AIGC'],
              title: 'DrData 的 AIGC 週刊（Y26W39）',
            },
          }
        },
      },
    } as unknown as Cloudflare.Env

    const draft = await writeWeekly(env, week, articles)

    expect(calls).toBe(2)
    expect(draft.content).not.toContain('自動 fallback')
    expect(draft.content).toContain('How to Get Better at AI')
    expect(draft.content).toContain('wsrv.nl')
  })

  it('throws after repeated unparseable JSON instead of returning fallback', async () => {
    const env = {
      AI: {
        run: async () => ({ response: '不是 JSON' }),
      },
    } as unknown as Cloudflare.Env

    await expect(writeWeekly(env, week, articles)).rejects.toThrow('模型未返回有效 JSON')
  })
})
