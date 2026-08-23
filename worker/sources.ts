import type { HnFeedKind } from './hn'

import type { WeekInfo } from './week'

export type ResearchSourceKind = 'hn' | 'rss' | 'rsshub' | 'url'

export interface ResearchSource {
  hnFeed?: HnFeedKind
  kind: ResearchSourceKind
  name: string
  priority: 'important' | 'blog' | 'kol'
  /** `rss` 为完整 Feed URL；`rsshub` 为路径（如 `/hackernews/best`）；`url` / `hn` 为说明性 URL */
  url: string
}

const RSSHUB_SOURCES: ResearchSource[] = [
  { name: 'HN Front Page', kind: 'rsshub', url: '/hackernews', priority: 'important' },
  { name: 'HN Show', kind: 'rsshub', url: '/hackernews/show', priority: 'important' },
  { name: 'HN Best', kind: 'rsshub', url: '/hackernews/best', priority: 'important' },
  { name: 'AI日报', kind: 'rsshub', url: '/aibase/daily', priority: 'important' },
  { name: 'OpenAI News', kind: 'rsshub', url: '/openai/news', priority: 'important' },
  { name: 'DeepSeek News', kind: 'rsshub', url: '/deepseek/news', priority: 'important' },
  { name: 'Anthropic News', kind: 'rsshub', url: '/anthropic/news', priority: 'blog' },
  { name: 'Anthropic Engineering', kind: 'rsshub', url: '/anthropic/engineering', priority: 'blog' },
  { name: 'Anthropic Research', kind: 'rsshub', url: '/anthropic/research', priority: 'blog' },
  { name: 'Cursor Blog', kind: 'rsshub', url: '/cursor/blog', priority: 'blog' },
  { name: '宝玉 Blog', kind: 'rsshub', url: '/baoyu/blog', priority: 'kol' },
  { name: 'Product Hunt Today', kind: 'rsshub', url: '/producthunt/today', priority: 'important' },
  { name: '每日 AI 资讯', kind: 'rsshub', url: '/ai-bot/daily-ai-news', priority: 'important' },
  { name: 'Hugging Face Trending Spaces', kind: 'rsshub', url: '/huggingface/spaces-trending', priority: 'important' },
  { name: 'Trending arXiv Papers', kind: 'rsshub', url: '/trendingpapers/papers', priority: 'important' },
  { name: 'TechCrunch News', kind: 'rsshub', url: '/techcrunch/news', priority: 'important' },
  { name: 'Solidot Linux', kind: 'rsshub', url: '/solidot/linux', priority: 'important' },
  { name: 'GitHub Trending', kind: 'rsshub', url: '/github/trending', priority: 'important' },
  { name: 'V2EX Latest', kind: 'rsshub', url: '/v2ex/topics/latest', priority: 'kol' },
]

const NATIVE_RSS_SOURCES: ResearchSource[] = [
  { name: 'Google DeepMind', kind: 'rss', url: 'https://deepmind.google/blog/rss.xml', priority: 'blog' },
  { name: 'Hugging Face Blog', kind: 'rss', url: 'https://huggingface.co/blog/feed.xml', priority: 'blog' },
  { name: 'Simon Willison', kind: 'rss', url: 'https://simonwillison.net/atom/everything/', priority: 'kol' },
  { name: 'Lenny’s Newsletter', kind: 'rss', url: 'https://www.lennysnewsletter.com/feed?sectionId=198869', priority: 'kol' },
  { name: 'Latent Space', kind: 'rss', url: 'https://www.latent.space/feed', priority: 'kol' },
  { name: 'One Useful Thing', kind: 'rss', url: 'https://www.oneusefulthing.org/feed', priority: 'kol' },
  { name: 'Interconnects', kind: 'rss', url: 'https://www.interconnects.ai/feed', priority: 'kol' },
  { name: 'Ben’s Bites', kind: 'rss', url: 'https://www.bensbites.com/feed', priority: 'kol' },
]

const HN_ADAPTER_SOURCES: ResearchSource[] = [
  {
    name: 'HN AI 本周',
    kind: 'hn',
    hnFeed: 'algolia-ai',
    url: 'https://hn.algolia.com',
    priority: 'important',
  },
  {
    name: 'HN Show 本周',
    kind: 'hn',
    hnFeed: 'algolia-show',
    url: 'https://hn.algolia.com',
    priority: 'important',
  },
]

const URL_SOURCES: ResearchSource[] = [
  { name: 'Miantiao Drafts', kind: 'url', url: 'https://drafts.miantiao.me/', priority: 'important' },
  { name: 'Every Newsletter', kind: 'url', url: 'https://every.to/newsletter', priority: 'important' },
  { name: 'HackerNoon AI', kind: 'url', url: 'https://hackernoon.com/c/ai', priority: 'important' },
]

export function getResearchSources(_week: WeekInfo): ResearchSource[] {
  return [
    ...HN_ADAPTER_SOURCES,
    ...RSSHUB_SOURCES,
    ...NATIVE_RSS_SOURCES,
    ...URL_SOURCES,
  ]
}
