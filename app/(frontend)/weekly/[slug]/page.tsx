import type { Metadata } from 'next'
import type { Media, Weekly } from '@/payload-types'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Pagination } from '@/components/theme/Pagination'
import { PostMeta } from '@/components/theme/PostMeta'
import { TagList } from '@/components/theme/TagList'
import { siteConfig } from '@/lib/config'
import { renderMarkdown } from '@/lib/markdown'
import { absoluteUrl, getBaseUrl } from '@/lib/url'
import { getWeeklyBySlug } from '@/lib/weekly/data'

export const revalidate = 86400

interface WeeklyDetailPageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: WeeklyDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const weekly = await getWeeklyBySlug(slug)

  if (!weekly)
    notFound()

  const url = absoluteUrl(`/weekly/${weekly.issueNumber}`)
  const coverImageUrl = getCoverImageUrl(weekly.coverImage)
  const images = coverImageUrl
    ? [{ url: coverImageUrl, alt: weekly.title }]
    : siteConfig.openGraph.images
  const tags = weekly.tags?.map(tag => tag.value) ?? []

  return {
    title: weekly.title,
    description: weekly.summary,
    keywords: tags,
    authors: siteConfig.authors,
    alternates: url
      ? {
          canonical: url,
        }
      : undefined,
    openGraph: {
      ...siteConfig.openGraph,
      title: weekly.title,
      description: weekly.summary,
      url,
      type: 'article',
      publishedTime: weekly.publishDate,
      images,
    },
    twitter: {
      ...siteConfig.twitter,
      title: weekly.title,
      description: weekly.summary,
      images,
    },
  }
}

export default async function WeeklyDetailPage({ params }: WeeklyDetailPageProps) {
  const { slug } = await params
  const weekly = await getWeeklyBySlug(slug)

  if (!weekly)
    notFound()

  const html = renderMarkdown(weekly.content)
  const jsonLd = getWeeklyJsonLd(weekly)

  const prevLink = weekly.prev
    ? { href: `/weekly/${weekly.prev.slug}`, text: weekly.prev.title }
    : undefined
  const nextLink = weekly.next
    ? { href: `/weekly/${weekly.next.slug}`, text: weekly.next.title }
    : undefined

  return (
    <article className="post">
      <script
        type="application/ld+json"
        // JSON-LD 仅输出结构化数据，不渲染可见内容
        // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <h1 className="post-title">
        <Link href={`/weekly/${weekly.issueNumber}`}>{weekly.title}</Link>
      </h1>

      <PostMeta date={weekly.publishDate} issueNumber={weekly.issueNumber} />

      <TagList tags={weekly.tags} />

      {/* Markdown 内容经由 markdown-it 渲染，仅展示服务端输出 */}
      {/* eslint-disable-next-line react-dom/no-dangerously-set-innerhtml */}
      <div className="post-content" dangerouslySetInnerHTML={{ __html: html }} />

      <Pagination
        prev={prevLink}
        next={nextLink}
      />
    </article>
  )
}

function getCoverImageUrl(coverImage: Media | number | null | undefined) {
  if (!coverImage || typeof coverImage === 'number' || !coverImage.url)
    return undefined

  return absoluteUrl(coverImage.url)
}

function getWeeklyJsonLd(weekly: Weekly) {
  const baseUrl = getBaseUrl()
  const weeklyUrl = absoluteUrl(`/weekly/${weekly.issueNumber}`)
  const coverImageUrl = getCoverImageUrl(weekly.coverImage)
  const imageUrl = coverImageUrl ?? absoluteUrl(siteConfig.openGraph.images[0].url)
  const author = siteConfig.authors[0]
  const graph: Array<Record<string, unknown>> = [
    {
      '@type': 'Article',
      '@id': weeklyUrl ? `${weeklyUrl}#article` : undefined,
      'headline': weekly.title,
      'description': weekly.summary,
      'url': weeklyUrl,
      'datePublished': weekly.publishDate,
      'dateModified': weekly.updatedAt,
      'image': imageUrl,
      'keywords': weekly.tags?.map(tag => tag.value),
      'author': {
        '@type': 'Person',
        'name': author.name,
        'url': author.url,
      },
      'publisher': {
        '@type': 'Person',
        'name': siteConfig.creator,
        'url': baseUrl,
      },
      'mainEntityOfPage': weeklyUrl,
    },
  ]

  if (baseUrl && weeklyUrl) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${weeklyUrl}#breadcrumb`,
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': '首頁',
          'item': baseUrl,
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': weekly.title,
          'item': weeklyUrl,
        },
      ],
    })
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  }
}
