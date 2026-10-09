import { describe, expect, it } from 'vitest'

import { getWeekInfo } from './week'
import { buildWeeklyDraftFallback, deduplicateArticles, getModelText, hasExpectedArticleLayout, isHnItemUrl, MODEL_RUN_OPTIONS, normalizeWeeklyLayout, parseModelJson, parseWeeklyDraft, parseWeeklyReview, selectArticlesByScore, toWeeklyPromptArticles, writeWeekly } from './weekly'

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
    expect(draft.content).toContain('### 資訊')
    expect(draft.content).not.toMatch(/^## /m)
    expect(draft.content).not.toContain('自動 fallback')
    expect(draft.content).toContain('摘要内容 [示例新闻](https://example.com/news)')
  })
})

describe('normalizeWeeklyLayout', () => {
  it('converts fallback dump into W34-style headings and inline links', () => {
    const result = normalizeWeeklyLayout(`# DrData 的 AIGC 週刊（Y26W35）

本期自動 fallback 草稿，範圍 2026-08-30 至 2026-09-05。

## 資訊

**[Example News](https://example.com/news)**（HN）

本文探討編碼代理安全。

![Example News](https://wsrv.nl/?url=https://example.com/cover.jpg&w=1200)

## 結束語

以上內容由候選素材自動整理，請人工審核後發布。`)

    expect(result).not.toContain('fallback')
    expect(result).not.toContain('# DrData')
    expect(result).toContain('### 資訊')
    expect(result).not.toMatch(/^## /m)
    expect(result).toContain('本文探討編碼代理安全。 [Example News](https://example.com/news)')
    expect(result).toContain('wsrv.nl')
    expect(result).not.toContain('### 結束語')
    expect(result).not.toContain('以上內容由候選素材')
  })

  it('strips empty category headings and intro/outro titles', () => {
    const result = normalizeWeeklyLayout(`### 開場白
本期聚焦 Agent 與推理引擎。

### 資訊
文章探討 Warp 如何自我進化。[Warp](https://example.com/warp)

![Warp](https://wsrv.nl/?url=https://example.com/warp.png&w=1200)

### 模型

### 工具`)

    expect(result.startsWith('本期聚焦')).toBe(true)
    expect(result).toContain('### 資訊')
    expect(result).not.toContain('### 開場白')
    expect(result).not.toContain('### 模型')
    expect(result).not.toContain('### 工具')
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
  it('keeps image markdown so the writer can restore cover images', () => {
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
      imageMarkdown: '![cover](https://wsrv.nl/?url=https://example.com/cover.jpg&w=1200)',
      score: 90,
      source: 'Every',
      summary: '摘要',
      title: 'How to Get Better at AI',
      url: 'https://every.to/p/example',
    }])
  })
})

describe('hasExpectedArticleLayout', () => {
  it('requires per-article links and cover images', () => {
    const articles = [{
      category: 'news' as const,
      date: '2026-10-01',
      imageMarkdown: '![cover](https://wsrv.nl/?url=https://example.com/cover.jpg&w=1200)',
      reason: '相关',
      score: 90,
      source: 'Every',
      summary: '摘要',
      title: 'How to Get Better at AI',
      url: 'https://every.to/p/example',
    }]

    expect(hasExpectedArticleLayout('本期没有链接。', articles)).toBe(false)
    expect(hasExpectedArticleLayout('[How to Get Better at AI](https://every.to/p/example)\n\n![cover](https://wsrv.nl/?url=https://example.com/cover.jpg&w=1200)\n', articles)).toBe(true)
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
          expect(input.messages[1]?.content).toContain('imageMarkdown')
          expect(input.messages[1]?.content).toContain('wsrv.nl')
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

  it('retries when the draft omits per-article links or images', async () => {
    let calls = 0
    const env = {
      AI: {
        run: async () => {
          calls += 1
          if (calls === 1) {
            return {
              response: {
                content: '本期聚焦 AI 原生思维与开发流程。',
                summary: '本期摘要',
                tags: ['AIGC'],
                title: 'DrData 的 AIGC 週刊（Y26W39）',
              },
            }
          }

          return {
            response: {
              content: '[How to Get Better at AI](https://every.to/p/example)',
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
    expect(draft.content).toContain('https://every.to/p/example')
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
