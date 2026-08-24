import type { ParsedFeed } from './rss'

const CACHE_PREFIX = 'feed-cache'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

function cacheKey(weekId: string, feedUrl: string): string {
  return `${CACHE_PREFIX}/${weekId}/${encodeURIComponent(feedUrl)}.json`
}

interface CachedFeedPayload {
  cachedAt: string
  feed: ParsedFeed
}

export async function getCachedFeed(
  env: Cloudflare.Env,
  weekId: string,
  feedUrl: string,
): Promise<ParsedFeed | null> {
  const object = await env.AGENT_STORAGE.get(cacheKey(weekId, feedUrl))
  if (!object)
    return null

  try {
    const payload = await object.json<CachedFeedPayload>()
    const cachedAt = Date.parse(payload.cachedAt)
    if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > CACHE_TTL_MS)
      return null

    return payload.feed
  }
  catch {
    return null
  }
}

export async function putCachedFeed(
  env: Cloudflare.Env,
  weekId: string,
  feedUrl: string,
  feed: ParsedFeed,
): Promise<void> {
  const payload: CachedFeedPayload = {
    cachedAt: new Date().toISOString(),
    feed,
  }

  await env.AGENT_STORAGE.put(
    cacheKey(weekId, feedUrl),
    JSON.stringify(payload),
    { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
  )
}
