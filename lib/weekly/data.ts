import type { PaginatedDocs } from 'payload'
import type { Weekly } from '@/payload-types'
import payloadConfig from '@payload.config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import { cache } from 'react'

import { WEEKLY_CACHE_TAG } from '@/lib/weekly/cache'

const DEFAULT_PAGE_SIZE = 3
const MAX_PAGE_SIZE = 50
const SITEMAP_PAGE_SIZE = 100
const MAX_SITEMAP_PAGES = 1000
const CACHE_VERSION = 'v2'

const getPayloadClient = cache(async () => {
  const config = await payloadConfig
  return getPayload({ config })
})

export interface WeeklyListParams {
  page?: number
  pageSize?: number
}

export interface WeeklyListItem {
  id: number
  slug: string
  title: string
  summary: string
  content: string
  publishDate: string
  tags?: string[]
}

export interface WeeklyListResult {
  items: WeeklyListItem[]
  pagination: {
    page: number
    pageSize: number
    totalDocs: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

export interface WeeklySitemapItem {
  slug: string
  publishDate: string
}

interface WeeklyAdjacentLink {
  title: string
  slug: string
}

type WeeklyDetail = Weekly & {
  prev: WeeklyAdjacentLink | null
  next: WeeklyAdjacentLink | null
}

async function getWeeklyListFromPayload(page: number, pageSize: number): Promise<WeeklyListResult> {
  const payload = await getPayloadClient()
  const response = (await payload.find({
    collection: 'weekly',
    limit: pageSize,
    page,
    where: {
      status: {
        equals: 'published',
      },
    },
    sort: '-publishDate',
  })) as PaginatedDocs<Weekly>

  return {
    items: response.docs.map(doc => ({
      id: doc.id,
      slug: doc.issueNumber,
      title: doc.title,
      summary: doc.summary,
      content: doc.content,
      publishDate: doc.publishDate,
      tags: doc.tags?.map(t => t.value) ?? [],
    })),
    pagination: {
      page: response.page,
      pageSize: response.limit,
      totalDocs: response.totalDocs,
      totalPages: response.totalPages,
      hasPrevPage: response.hasPrevPage,
      hasNextPage: response.hasNextPage,
    },
  }
}

const getWeeklyListCached = unstable_cache(getWeeklyListFromPayload, ['weekly-list', CACHE_VERSION], {
  revalidate: 3600,
  tags: [WEEKLY_CACHE_TAG],
})

const getWeeklyListByPage = cache(async (page: number, pageSize: number): Promise<WeeklyListResult> => getWeeklyListCached(page, pageSize))

export async function getWeeklyList(params: WeeklyListParams = {}): Promise<WeeklyListResult> {
  const page = normalizePositiveInteger(params.page, 1)
  const pageSize = normalizePositiveInteger(params.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  return getWeeklyListByPage(page, pageSize)
}

async function getWeeklyBySlugFromPayload(slug: string): Promise<WeeklyDetail | null> {
  const payload = await getPayloadClient()
  const response = (await payload.find({
    collection: 'weekly',
    limit: 1,
    where: {
      issueNumber: {
        equals: slug.toUpperCase(),
      },
      status: {
        equals: 'published',
      },
    },
  })) as PaginatedDocs<Weekly>

  const currentDoc = response.docs[0]
  if (!currentDoc)
    return null

  const [prevDoc, nextDoc] = await Promise.all([
    payload.find({
      collection: 'weekly',
      limit: 1,
      where: {
        publishDate: {
          less_than: currentDoc.publishDate,
        },
        status: {
          equals: 'published',
        },
      },
      sort: '-publishDate',
    }),
    payload.find({
      collection: 'weekly',
      limit: 1,
      where: {
        publishDate: {
          greater_than: currentDoc.publishDate,
        },
        status: {
          equals: 'published',
        },
      },
      sort: 'publishDate',
    }),
  ])

  return {
    ...currentDoc,
    prev: prevDoc.docs[0] ? { title: prevDoc.docs[0].title, slug: prevDoc.docs[0].issueNumber } : null,
    next: nextDoc.docs[0] ? { title: nextDoc.docs[0].title, slug: nextDoc.docs[0].issueNumber } : null,
  }
}

const getWeeklyBySlugCached = unstable_cache(getWeeklyBySlugFromPayload, ['weekly-by-slug', CACHE_VERSION], {
  revalidate: 86400,
  tags: [WEEKLY_CACHE_TAG],
})

const getWeeklyByNormalizedSlug = cache(async (slug: string): Promise<WeeklyDetail | null> => getWeeklyBySlugCached(slug))

export async function getWeeklyBySlug(slug: string): Promise<WeeklyDetail | null> {
  if (!slug)
    return null

  return getWeeklyByNormalizedSlug(slug.toUpperCase())
}

async function getAllWeeklySitemapItemsFromPayload(): Promise<WeeklySitemapItem[]> {
  const payload = await getPayloadClient()
  const items: WeeklySitemapItem[] = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage && page <= MAX_SITEMAP_PAGES) {
    const response = (await payload.find({
      collection: 'weekly',
      limit: SITEMAP_PAGE_SIZE,
      page,
      depth: 0,
      select: {
        issueNumber: true,
        publishDate: true,
      },
      where: {
        status: {
          equals: 'published',
        },
      },
      sort: '-publishDate',
    })) as PaginatedDocs<Pick<Weekly, 'issueNumber' | 'publishDate'>>

    items.push(...response.docs.map(doc => ({
      slug: doc.issueNumber,
      publishDate: doc.publishDate,
    })))

    hasNextPage = response.hasNextPage
    page += 1
  }

  return items
}

const getAllWeeklySitemapItemsCached = unstable_cache(getAllWeeklySitemapItemsFromPayload, ['weekly-sitemap-items', CACHE_VERSION], {
  revalidate: 604800,
  tags: [WEEKLY_CACHE_TAG],
})

export const getAllWeeklySitemapItems = cache(async (): Promise<WeeklySitemapItem[]> => getAllWeeklySitemapItemsCached())

function normalizePositiveInteger(value: number | undefined, fallback: number, max = Number.POSITIVE_INFINITY) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return fallback
  }

  const normalized = Math.floor(value)
  return Math.min(normalized, max)
}
