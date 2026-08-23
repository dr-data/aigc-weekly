import type { FeedItem } from './rss'

import type { WeekInfo } from './week'

const ALGOLIA_BASE = 'https://hn.algolia.com/api/v1'
const FIREBASE_BASE = 'https://hacker-news.firebaseio.com/v0'
const REQUEST_TIMEOUT_MS = 30_000
const MAX_ITEMS = 30

interface AlgoliaHit {
  author?: string
  created_at?: string
  created_at_i?: number
  objectID?: string
  points?: number
  story_title?: string
  title?: string
  url?: string | null
}

interface AlgoliaResponse {
  hits?: AlgoliaHit[]
}

interface FirebaseItem {
  time?: number
  title?: string
  url?: string
}

function normalizeDateFromUnix(seconds: number | undefined): string {
  if (!seconds)
    return ''
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

function normalizeDateFromIso(value: string | undefined): string {
  if (!value)
    return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()))
    return ''
  return parsed.toISOString().slice(0, 10)
}

function weekUnixRange(week: WeekInfo): { end: number, start: number } {
  const start = Math.floor(new Date(`${week.startDate}T00:00:00Z`).getTime() / 1000)
  const end = Math.floor(new Date(`${week.endDate}T23:59:59Z`).getTime() / 1000)
  return { end, start }
}

function hitToFeedItem(hit: AlgoliaHit): FeedItem | null {
  const title = hit.title || hit.story_title
  const url = hit.url || (hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : '')
  if (!title?.trim() || !url)
    return null

  return {
    date: normalizeDateFromIso(hit.created_at) || normalizeDateFromUnix(hit.created_at_i),
    summary: typeof hit.points === 'number' ? `${hit.points} points` : '',
    title: title.trim(),
    url,
  }
}

async function fetchAlgolia(
  path: string,
  params: Record<string, string>,
): Promise<FeedItem[]> {
  const query = new URLSearchParams(params)
  const response = await fetch(`${ALGOLIA_BASE}${path}?${query}`, {
    headers: { 'User-Agent': 'AIGCWeeklyBot/1.0 (+https://ai.shor.lol)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const body = await response.text()
  if (!response.ok)
    throw new Error(`HN Algolia HTTP ${response.status}：${body.slice(0, 300)}`)

  const data = JSON.parse(body) as AlgoliaResponse
  return (data.hits ?? [])
    .map(hitToFeedItem)
    .filter((item): item is FeedItem => item !== null)
    .slice(0, MAX_ITEMS)
}

async function fetchFirebaseStoryIds(endpoint: string): Promise<number[]> {
  const response = await fetch(`${FIREBASE_BASE}/${endpoint}.json`, {
    headers: { 'User-Agent': 'AIGCWeeklyBot/1.0 (+https://ai.shor.lol)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok)
    throw new Error(`HN Firebase HTTP ${response.status}`)

  const ids = await response.json() as number[]
  return Array.isArray(ids) ? ids.slice(0, MAX_ITEMS) : []
}

async function fetchFirebaseItem(id: number): Promise<FeedItem | null> {
  const response = await fetch(`${FIREBASE_BASE}/item/${id}.json`, {
    headers: { 'User-Agent': 'AIGCWeeklyBot/1.0 (+https://ai.shor.lol)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok)
    return null

  const item = await response.json() as FirebaseItem | null
  if (!item?.title)
    return null

  const url = item.url || `https://news.ycombinator.com/item?id=${id}`
  return {
    date: normalizeDateFromUnix(item.time),
    summary: '',
    title: item.title.trim(),
    url,
  }
}

export type HnFeedKind = 'algolia-ai' | 'algolia-show' | 'algolia-week' | 'firebase-best' | 'firebase-show'

export async function fetchHnFeedItems(kind: HnFeedKind, week: WeekInfo): Promise<FeedItem[]> {
  const { end, start } = weekUnixRange(week)

  switch (kind) {
    case 'algolia-week':
      return fetchAlgolia('/search_by_date', {
        hitsPerPage: String(MAX_ITEMS),
        numericFilters: `created_at_i>=${start},created_at_i<=${end}`,
        tags: 'story',
      })

    case 'algolia-show':
      return fetchAlgolia('/search_by_date', {
        hitsPerPage: String(MAX_ITEMS),
        numericFilters: `created_at_i>=${start},created_at_i<=${end}`,
        tags: 'show_hn',
      })

    case 'algolia-ai':
      return fetchAlgolia('/search_by_date', {
        hitsPerPage: String(MAX_ITEMS),
        numericFilters: `created_at_i>=${start},created_at_i<=${end}`,
        query: 'AI OR LLM OR agent OR GPT OR Claude OR Gemini',
        tags: 'story',
      })

    case 'firebase-best': {
      const ids = await fetchFirebaseStoryIds('beststories')
      const items = await Promise.all(ids.map(id => fetchFirebaseItem(id)))
      return items
        .filter((item): item is FeedItem => item !== null)
        .filter(item => !item.date || (item.date >= week.startDate && item.date <= week.endDate))
    }

    case 'firebase-show': {
      const ids = await fetchFirebaseStoryIds('showstories')
      const items = await Promise.all(ids.map(id => fetchFirebaseItem(id)))
      return items
        .filter((item): item is FeedItem => item !== null)
        .filter(item => !item.date || (item.date >= week.startDate && item.date <= week.endDate))
    }

    default:
      return []
  }
}
