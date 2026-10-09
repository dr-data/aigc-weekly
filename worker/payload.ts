import type { WeekInfo } from './week'
import type { WeeklyDraft } from './weekly'

interface PayloadListResponse {
  docs?: {
    id: number | string
  }[]
}

export interface PublishedWeekly {
  id: number | string
  operation: 'created' | 'updated'
}

function payloadHeaders(apiKey: string): Headers {
  return new Headers({
    'Authorization': `users API-Key ${apiKey}`,
    'Content-Type': 'application/json',
  })
}

async function payloadRequest<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30_000),
  })
  const body = await response.text()

  if (!response.ok)
    throw new Error(`Payload API ${response.status}：${body.slice(0, 1_000)}`)

  try {
    return JSON.parse(body) as T
  }
  catch {
    throw new Error('Payload API 返回了无效 JSON')
  }
}

export async function publishWeekly(
  env: Cloudflare.Env,
  week: WeekInfo,
  draft: WeeklyDraft,
): Promise<PublishedWeekly> {
  if (!env.PAYLOAD_BASE_URL)
    throw new Error('缺少 PAYLOAD_BASE_URL')
  if (!env.PAYLOAD_API_KEY)
    throw new Error('缺少 PAYLOAD_API_KEY')

  const baseUrl = env.PAYLOAD_BASE_URL.replace(/\/$/, '')
  const headers = payloadHeaders(env.PAYLOAD_API_KEY)
  const query = new URLSearchParams({
    'limit': '1',
    'where[issueNumber][equals]': week.weekId,
  })
  const existing = await payloadRequest<PayloadListResponse>(
    `${baseUrl}/api/weekly?${query}`,
    { headers },
  )

  const data = {
    content: draft.content,
    issueNumber: week.weekId,
    publishDate: week.currentDate,
    status: 'published',
    summary: draft.summary,
    tags: draft.tags.map(value => ({ value })),
    title: draft.title,
  }
  const id = existing.docs?.[0]?.id

  if (id !== undefined) {
    await payloadRequest(
      `${baseUrl}/api/weekly/${id}`,
      {
        body: JSON.stringify(data),
        headers,
        method: 'PATCH',
      },
    )
    return { id, operation: 'updated' }
  }

  const created = await payloadRequest<{ doc?: { id?: number | string }, id?: number | string }>(
    `${baseUrl}/api/weekly`,
    {
      body: JSON.stringify(data),
      headers,
      method: 'POST',
    },
  )
  const createdId = created.id ?? created.doc?.id
  if (createdId === undefined)
    throw new Error('Payload 未返回周刊 ID')

  return { id: createdId, operation: 'created' }
}
