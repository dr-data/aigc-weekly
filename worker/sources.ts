import type { HnFeedKind } from './hn'

import type { WeekInfo } from './week'

export type ResearchSourceKind = 'hn' | 'rss' | 'rsshub' | 'url'
export type ResearchSourcePriority = 'important' | 'blog' | 'kol'

export const RESEARCH_PARALLELISM = 5
export const PRIORITY_ORDER: ResearchSourcePriority[] = ['important', 'blog', 'kol']

export const DEFAULT_MAX_CANDIDATES = {
  feed: 10,
  hn: 10,
  url: 6,
} as const

export interface ResearchSource {
  fallbackUrls?: string[]
  hnFeed?: HnFeedKind
  kind: ResearchSourceKind
  maxCandidates?: number
  name: string
  priority: ResearchSourcePriority
  /** `rss` 为完整 Feed URL；`rsshub` 为路径；`url` / `hn` 为说明性 URL */
  url: string
}

function source(
  partial: ResearchSource,
): ResearchSource {
  return partial
}

const RSSHUB_SOURCES: ResearchSource[] = [
  source({ name: 'HN Best', kind: 'rsshub', url: '/hackernews/best', priority: 'important', maxCandidates: 10 }),
  source({ name: 'AI日报', kind: 'rsshub', url: '/aibase/daily', priority: 'important' }),
  source({ name: 'DeepSeek News', kind: 'rsshub', url: '/deepseek/news', priority: 'important' }),
  source({ name: 'Anthropic News', kind: 'rsshub', url: '/anthropic/news', priority: 'blog' }),
  source({ name: 'Anthropic Engineering', kind: 'rsshub', url: '/anthropic/engineering', priority: 'blog' }),
  source({ name: 'Anthropic Research', kind: 'rsshub', url: '/anthropic/research', priority: 'blog' }),
  source({ name: 'Cursor Blog', kind: 'rsshub', url: '/cursor/blog', priority: 'blog' }),
  source({ name: '宝玉 Blog', kind: 'rsshub', url: '/baoyu/blog', priority: 'kol' }),
  source({
    name: 'Product Hunt Today',
    kind: 'rsshub',
    url: '/producthunt/today',
    fallbackUrls: ['https://www.producthunt.com/feed'],
    priority: 'important',
  }),
  source({ name: '每日 AI 资讯', kind: 'rsshub', url: '/ai-bot/daily-ai-news', priority: 'important' }),
  source({ name: 'Hugging Face Trending Spaces', kind: 'rsshub', url: '/huggingface/spaces-trending', priority: 'important' }),
  source({ name: 'TechCrunch News', kind: 'rsshub', url: '/techcrunch/news', priority: 'important' }),
  source({ name: 'Solidot', kind: 'rsshub', url: '/solidot/www', priority: 'important' }),
  source({
    name: 'GitHub Trending',
    kind: 'rsshub',
    url: '/github/trending/weekly/any',
    fallbackUrls: ['https://github.com/trending'],
    priority: 'important',
  }),
  source({ name: 'V2EX Latest', kind: 'rsshub', url: '/v2ex/topics/latest', priority: 'kol' }),
  source({ name: 'Cline Blog', kind: 'rsshub', url: '/cline/blog', priority: 'blog' }),
  source({ name: 'Kilo Blog', kind: 'rsshub', url: '/kilo/blog', priority: 'blog' }),
]

const NATIVE_RSS_SOURCES: ResearchSource[] = [
  source({ name: 'OpenAI News', kind: 'rss', url: 'https://openai.com/news/rss.xml', priority: 'important' }),
  source({ name: 'arXiv cs.AI', kind: 'rss', url: 'https://arxiv.org/rss/cs.AI', priority: 'important', maxCandidates: 12 }),
  source({ name: 'Google DeepMind', kind: 'rss', url: 'https://deepmind.google/blog/rss.xml', priority: 'blog' }),
  source({ name: 'Hugging Face Blog', kind: 'rss', url: 'https://huggingface.co/blog/feed.xml', priority: 'blog' }),
  source({ name: 'GitHub Blog AI', kind: 'rss', url: 'https://github.blog/ai-and-ml/feed/', priority: 'blog' }),
  source({ name: 'Continue Blog', kind: 'rss', url: 'https://blog.continue.dev/feed', priority: 'blog' }),
  source({ name: 'Simon Willison', kind: 'rss', url: 'https://simonwillison.net/atom/everything/', priority: 'kol' }),
  source({ name: 'Lenny’s Newsletter', kind: 'rss', url: 'https://www.lennysnewsletter.com/feed?sectionId=198869', priority: 'kol' }),
  source({ name: 'Latent Space', kind: 'rss', url: 'https://www.latent.space/feed', priority: 'kol' }),
  source({ name: 'One Useful Thing', kind: 'rss', url: 'https://www.oneusefulthing.org/feed', priority: 'kol' }),
  source({ name: 'Interconnects', kind: 'rss', url: 'https://www.interconnects.ai/feed', priority: 'kol' }),
  source({ name: 'Ben’s Bites', kind: 'rss', url: 'https://www.bensbites.com/feed', priority: 'kol' }),
]

const SUBSTACK_NEWSLETTER_SOURCES: ResearchSource[] = [
  source({ name: 'AI Supremacy', kind: 'rss', url: 'https://www.ai-supremacy.com/feed', priority: 'important' }),
  source({ name: 'The Rundown AI', kind: 'rss', url: 'https://www.therundown.ai/feed', priority: 'important' }),
  source({ name: 'State of AI', kind: 'rss', url: 'https://nathanbenaich.substack.com/feed', priority: 'important' }),
  source({ name: 'Every', kind: 'rss', url: 'https://every.to/feed', priority: 'important' }),
  source({ name: 'Ahead of AI', kind: 'rss', url: 'https://magazine.sebastianraschka.com/feed', priority: 'blog' }),
  source({ name: 'Mostly Harmless AI', kind: 'rss', url: 'https://newsletter.maartengrootendorst.com/feed', priority: 'blog' }),
  source({ name: 'DAIR.AI', kind: 'rss', url: 'https://nlp.elvissaravia.com/feed', priority: 'blog' }),
  source({ name: 'The Algorithmic Bridge', kind: 'rss', url: 'https://www.thealgorithmicbridge.com/feed', priority: 'kol' }),
  source({ name: 'Aman Khan', kind: 'rss', url: 'https://amankhan1.substack.com/feed', priority: 'kol' }),
  source({ name: 'Ruben AI', kind: 'rss', url: 'https://ruben.substack.com/feed', priority: 'kol' }),
]

const HN_ADAPTER_SOURCES: ResearchSource[] = [
  source({
    name: 'HN AI 本周',
    kind: 'hn',
    hnFeed: 'algolia-ai',
    url: 'https://hn.algolia.com',
    priority: 'important',
    maxCandidates: 10,
  }),
  source({
    name: 'HN Show 本周',
    kind: 'hn',
    hnFeed: 'algolia-show',
    url: 'https://hn.algolia.com',
    priority: 'important',
    maxCandidates: 10,
  }),
  source({
    name: 'HN 本周故事',
    kind: 'hn',
    hnFeed: 'algolia-week',
    url: 'https://hn.algolia.com',
    priority: 'important',
    maxCandidates: 10,
  }),
]

const URL_SOURCES: ResearchSource[] = [
  source({ name: 'Miantiao Drafts', kind: 'url', url: 'https://drafts.miantiao.me/', priority: 'important' }),
  source({ name: 'HackerNoon AI', kind: 'url', url: 'https://hackernoon.com/c/ai', priority: 'important' }),
  source({ name: 'Poche Explore', kind: 'url', url: 'https://poche.app/explore', priority: 'important' }),
  source({ name: 'Engineering FYI', kind: 'url', url: 'https://engineering.fyi/tag/generative-ai', priority: 'important' }),
  source({ name: 'daily.dev AI', kind: 'url', url: 'https://app.daily.dev/squads/ai', priority: 'important' }),
  source({ name: 'daily.dev Prompt Engineering', kind: 'url', url: 'https://app.daily.dev/squads/promptengineering', priority: 'important' }),
  source({ name: 'daily.dev Vibecoding', kind: 'url', url: 'https://app.daily.dev/squads/vibecoding', priority: 'important' }),
  source({ name: 'Sources News', kind: 'url', url: 'https://sources.news/', priority: 'kol' }),
]

function enumerateWeekDates(week: WeekInfo): string[] {
  const dates: string[] = []
  let current = new Date(`${week.startDate}T00:00:00Z`).getTime()
  const endTime = new Date(`${week.endDate}T00:00:00Z`).getTime()

  while (current <= endTime) {
    dates.push(new Date(current).toISOString().slice(0, 10))
    current += 86_400_000
  }

  return dates
}

function buildHnFrontSources(week: WeekInfo): ResearchSource[] {
  return enumerateWeekDates(week).map(date => source({
    name: `HN Front ${date}`,
    kind: 'url',
    url: `https://news.ycombinator.com/front?day=${date}`,
    priority: 'important',
    maxCandidates: 6,
  }))
}

export function getMaxCandidates(source: ResearchSource): number {
  if (source.maxCandidates !== undefined)
    return source.maxCandidates

  if (source.kind === 'hn')
    return DEFAULT_MAX_CANDIDATES.hn
  if (source.kind === 'url')
    return DEFAULT_MAX_CANDIDATES.url
  return DEFAULT_MAX_CANDIDATES.feed
}

export function parseDisabledSources(env?: Cloudflare.Env): Set<string> {
  const raw = env?.DISABLED_SOURCES?.trim()
  if (!raw)
    return new Set()

  return new Set(
    raw.split(',')
      .map(name => name.trim())
      .filter(Boolean),
  )
}

export function filterEnabledSources(sources: ResearchSource[], env?: Cloudflare.Env): ResearchSource[] {
  const disabled = parseDisabledSources(env)
  if (disabled.size === 0)
    return sources

  return sources.filter(source => !disabled.has(source.name))
}

export function groupSourcesByPriority(sources: ResearchSource[]): ResearchSource[][] {
  return PRIORITY_ORDER
    .map(priority => sources.filter(source => source.priority === priority))
    .filter(batch => batch.length > 0)
}

export function chunkSources<T>(items: T[], size: number): T[][] {
  if (size <= 0)
    return [items]

  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size)
    chunks.push(items.slice(index, index + size))
  return chunks
}

export function getResearchSources(week: WeekInfo, env?: Cloudflare.Env): ResearchSource[] {
  const sources = [
    ...HN_ADAPTER_SOURCES,
    ...buildHnFrontSources(week),
    ...RSSHUB_SOURCES,
    ...NATIVE_RSS_SOURCES,
    ...SUBSTACK_NEWSLETTER_SOURCES,
    ...URL_SOURCES,
  ]

  return filterEnabledSources(sources, env)
}
