import { afterEach, describe, expect, it, vi } from 'vitest'

import { publishWeekly } from './payload'

const week = {
  weekId: 'Y26W38',
  weekNumber: '38',
  yearShort: '26',
  yearFull: '2026',
  startDate: '2026-09-20',
  endDate: '2026-09-26',
  currentDate: '2026-09-26',
  timezone: 'UTC+0' as const,
}

const draft = {
  title: 'DrData 的 AIGC 週刊（Y26W38）',
  summary: '本期摘要。',
  tags: ['AIGC', '模型'],
  content: '## 開場白\n\n正文。',
}

function createEnv(): Cloudflare.Env {
  return {
    PAYLOAD_API_KEY: 'payload-test-key',
    PAYLOAD_BASE_URL: 'https://ai.shor.lol',
  } as Cloudflare.Env
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('publishWeekly', () => {
  it('creates a published weekly so the frontend can list it', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/weekly?') && init?.method === undefined)
        return Response.json({ docs: [] })
      if (url.endsWith('/api/weekly') && init?.method === 'POST')
        return Response.json({ id: 48 })
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishWeekly(createEnv(), week, draft)

    expect(result).toEqual({ id: 48, operation: 'created' })
    const createCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      issueNumber: 'Y26W38',
      status: 'published',
      title: 'DrData 的 AIGC 週刊（Y26W38）',
    })
  })

  it('updates an existing weekly to published', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/weekly?') && init?.method === undefined)
        return Response.json({ docs: [{ id: 47 }] })
      if (url.endsWith('/api/weekly/47') && init?.method === 'PATCH')
        return Response.json({ doc: { id: 47 } })
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishWeekly(createEnv(), week, draft)

    expect(result).toEqual({ id: 47, operation: 'updated' })
    const updateCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      issueNumber: 'Y26W38',
      status: 'published',
    })
  })
})
