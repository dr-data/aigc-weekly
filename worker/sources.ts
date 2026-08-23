import type { WeekInfo } from './week'

export interface ResearchSource {
  name: string
  url: string
  priority: 'important' | 'blog' | 'kol'
}

const STATIC_SOURCES: ResearchSource[] = [
  { name: 'Hacker News Show', url: 'https://news.ycombinator.com/show', priority: 'important' },
  { name: 'Miantiao Drafts', url: 'https://drafts.miantiao.me/', priority: 'important' },
  { name: 'Solidot AI', url: 'https://www.solidot.org/search?tid=151', priority: 'important' },
  { name: 'Poche Explore', url: 'https://poche.app/explore', priority: 'important' },
  { name: 'daily.dev AI', url: 'https://app.daily.dev/squads/ai', priority: 'important' },
  { name: 'daily.dev Prompt Engineering', url: 'https://app.daily.dev/squads/promptengineering', priority: 'important' },
  { name: 'daily.dev Vibecoding', url: 'https://app.daily.dev/squads/vibecoding', priority: 'important' },
  { name: 'Engineering.fyi Generative AI', url: 'https://engineering.fyi/tag/generative-ai', priority: 'important' },
  { name: 'Every Newsletter', url: 'https://every.to/newsletter', priority: 'important' },
  { name: 'HackerNoon AI', url: 'https://hackernoon.com/c/ai', priority: 'important' },
  { name: 'Anthropic Engineering', url: 'https://www.anthropic.com/engineering', priority: 'blog' },
  { name: 'Anthropic Research', url: 'https://www.anthropic.com/research', priority: 'blog' },
  { name: 'Claude Blog', url: 'https://claude.com/blog', priority: 'blog' },
  { name: 'OpenAI Developers', url: 'https://developers.openai.com/', priority: 'blog' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/', priority: 'blog' },
  { name: 'GitHub AI & ML', url: 'https://github.blog/ai-and-ml/', priority: 'blog' },
  { name: 'Continue Blog', url: 'https://blog.continue.dev/', priority: 'blog' },
  { name: 'Kilo AI Blog', url: 'https://blog.kilo.ai/', priority: 'blog' },
  { name: 'Cline Blog', url: 'https://cline.bot/blog/archive', priority: 'blog' },
  { name: 'Amp Chronicle', url: 'https://ampcode.com/chronicle', priority: 'blog' },
  { name: 'Cognition Blog', url: 'https://cognition.ai/blog/1', priority: 'blog' },
  { name: 'Manus Blog', url: 'https://manus.im/zh-cn/blog', priority: 'blog' },
  { name: 'Augmented SWE', url: 'https://www.augmentedswe.com/', priority: 'blog' },
  { name: 'Adventures in Claude', url: 'https://adventuresinclaude.ai/', priority: 'blog' },
  { name: 'Sources News', url: 'https://sources.news/', priority: 'blog' },
  { name: 'Cursor', url: 'https://cursor.com/', priority: 'blog' },
  { name: '宝玉', url: 'https://baoyu.io/', priority: 'kol' },
  { name: 'Ben’s Bites', url: 'https://www.bensbites.com/', priority: 'kol' },
  { name: 'Andrej Karpathy', url: 'https://karpathy.bearblog.dev/blog/', priority: 'kol' },
  { name: 'Matt Shumer', url: 'https://shumer.dev/blog', priority: 'kol' },
  { name: 'Aman Khan', url: 'https://amankhan1.substack.com/', priority: 'kol' },
  { name: 'Lenny’s Newsletter', url: 'https://www.lennysnewsletter.com/feed?sectionId=198869', priority: 'kol' },
  { name: 'Latent Space', url: 'https://www.latent.space/feed', priority: 'kol' },
  { name: 'One Useful Thing', url: 'https://www.oneusefulthing.org/feed', priority: 'kol' },
  { name: 'Interconnects', url: 'https://www.interconnects.ai/feed', priority: 'kol' },
  { name: 'Ruben', url: 'https://ruben.substack.com/', priority: 'kol' },
]

export function getResearchSources(week: WeekInfo): ResearchSource[] {
  const hackerNews: ResearchSource[] = []
  const start = new Date(`${week.startDate}T00:00:00Z`)

  for (let offset = 0; offset < 7; offset++) {
    const current = new Date(start)
    current.setUTCDate(start.getUTCDate() + offset)
    const date = current.toISOString().slice(0, 10)
    hackerNews.push({
      name: `Hacker News ${date}`,
      url: `https://news.ycombinator.com/front?day=${date}`,
      priority: 'important',
    })
  }

  return [...hackerNews, ...STATIC_SOURCES]
}
