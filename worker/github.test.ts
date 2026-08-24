import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildIssueBody, publishWeeklyIssue } from './github'

const week = {
  weekId: 'Y25W33',
  weekNumber: '33',
  yearShort: '25',
  yearFull: '2025',
  startDate: '2025-08-17',
  endDate: '2025-08-23',
  currentDate: '2025-08-20',
  timezone: 'UTC+0' as const,
}

const draft = {
  title: '测试周刊标题',
  summary: '这是摘要。',
  tags: ['AI', '模型'],
  content: '# 正文\n\n内容段落。',
}

const payload = {
  id: 42,
  operation: 'created' as const,
}

function createEnv(): Cloudflare.Env {
  return {
    GITHUB_REPOSITORY: 'dr-data/aigc-weekly',
    GITHUB_TOKEN: 'ghp_test_token',
    PAYLOAD_BASE_URL: 'https://ai.shor.lol',
  } as Cloudflare.Env
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildIssueBody', () => {
  it('包含 CMS 链接、摘要与正文', () => {
    const body = buildIssueBody(createEnv(), week, draft, payload)

    expect(body).toContain('Y25W33')
    expect(body).toContain('https://ai.shor.lol/weekly/Y25W33')
    expect(body).toContain('https://ai.shor.lol/admin/collections/weekly/42')
    expect(body).toContain('这是摘要。')
    expect(body).toContain('# 正文')
    expect(body).toContain('AI、模型')
  })
})

describe('publishWeeklyIssue', () => {
  it('创建新的 GitHub Issue', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/issues?') && init?.method === undefined) {
        return Response.json([])
      }
      if (url.endsWith('/issues') && init?.method === 'POST') {
        return Response.json({
          html_url: 'https://github.com/dr-data/aigc-weekly/issues/99',
          number: 99,
        })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishWeeklyIssue(createEnv(), week, draft, payload)

    expect(result).toEqual({
      number: 99,
      operation: 'created',
      url: 'https://github.com/dr-data/aigc-weekly/issues/99',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const createCall = fetchMock.mock.calls[1]
    expect(createCall?.[0]).toBe('https://api.github.com/repos/dr-data/aigc-weekly/issues')
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      labels: ['weekly-draft', 'Y25W33'],
      title: '[周刊草稿] Y25W33 · 测试周刊标题',
    })
  })

  it('更新已存在的 GitHub Issue', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/issues?') && init?.method === undefined) {
        return Response.json([{
          html_url: 'https://github.com/dr-data/aigc-weekly/issues/12',
          number: 12,
        }])
      }
      if (url.endsWith('/issues/12') && init?.method === 'PATCH') {
        return Response.json({
          html_url: 'https://github.com/dr-data/aigc-weekly/issues/12',
          number: 12,
        })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishWeeklyIssue(createEnv(), week, draft, {
      ...payload,
      operation: 'updated',
    })

    expect(result).toEqual({
      number: 12,
      operation: 'updated',
      url: 'https://github.com/dr-data/aigc-weekly/issues/12',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('labels=weekly-draft%2CY25W33')
  })
})
