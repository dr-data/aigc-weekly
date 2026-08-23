import process from 'node:process'
import RSS from 'rss'
import { siteConfig } from '@/lib/config'
import { renderMarkdown } from '@/lib/markdown'
import { getBaseUrl } from '@/lib/url'
import { getWeeklyList } from '@/lib/weekly/data'

export const revalidate = 3600 // 1h

export async function GET() {
  const weeklyResult = await getWeeklyList({ pageSize: 10 })
  const weeks = weeklyResult.items
  const baseUrl = getBaseUrl()

  if (!baseUrl) {
    console.error('NEXT_PUBLIC_BASE_URL is required to generate RSS feed')
    return new Response('Server configuration error', { status: 500 })
  }

  const feed = new RSS({
    title: siteConfig.title,
    description: siteConfig.description,
    feed_url: `${baseUrl}/rss.xml`,
    site_url: baseUrl,
    image_url: `${baseUrl}/favicon.ico`,
    language: 'zh-TW',
    pubDate: new Date(),
    copyright: `Copyright ${new Date().getFullYear()} ${siteConfig.title}`,
    ttl: 1440, // 24 hours in minutes
  })

  weeks.forEach((week) => {
    const weekUrl = `${baseUrl}/weekly/${week.slug}`

    feed.item({
      title: week.title,
      url: weekUrl,
      guid: weekUrl,
      date: new Date(week.publishDate),
      author: siteConfig.authors[0].name,
      description: week.summary,
      custom_elements: [
        {
          'content:encoded': {
            _cdata: `
              ${renderMarkdown(week.content)}
              ${process.env.NEXT_TRACKING_IMAGE ? `<img src="${process.env.NEXT_TRACKING_IMAGE}/${week.slug}" alt="${week.title}" width="1" height="1" loading="lazy" aria-hidden="true" style="opacity: 0;pointer-events: none;" />` : ''}
            `,
          },
        },
      ],
    })
  })

  return new Response(feed.xml({ indent: true }), {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': `s-maxage=${revalidate}, max-age=${revalidate}, stale-while-revalidate=86400`, // 1 hour cache
    },
  })
}
