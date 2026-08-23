import Link from 'next/link'
import { Pagination } from '@/components/theme/Pagination'
import { PostMeta } from '@/components/theme/PostMeta'
import { TagList } from '@/components/theme/TagList'
import { siteConfig } from '@/lib/config'
import { absoluteUrl } from '@/lib/url'
import { getWeeklyList } from '@/lib/weekly/data'

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const page = parsePage(params?.page)
  const weeklyList = await getWeeklyList({ page })
  const rssUrl = absoluteUrl('/rss.xml') ?? '/rss.xml'

  const { hasNextPage, hasPrevPage } = weeklyList.pagination
  const prevLink = hasPrevPage
    ? { href: `/?page=${weeklyList.pagination.page - 1}`, text: '上一頁' }
    : undefined
  const nextLink = hasNextPage
    ? { href: `/?page=${weeklyList.pagination.page + 1}`, text: '下一頁' }
    : undefined

  return (
    <>
      <h1 className="sr-only">{siteConfig.title}</h1>

      <div className="index-content">
        <div className="framed">
          <p>
            { siteConfig.description }
          </p>
          <p>
            <a href={rssUrl} rel="alternate noopener noreferrer" target="_blank">
              RSS 訂閱
            </a>
            <span>
              {' '}
              ::
              {' '}
            </span>
            <a href="https://github.com/dr-data/aigc-weekly" target="_blank" rel="noopener noreferrer">
              GitHub 儲存庫
            </a>
          </p>
        </div>
      </div>

      <div className="posts">
        {weeklyList.items.map(item => (
          <article className="post on-list" key={item.id}>
            <h2 className="post-title">
              <Link href={`/weekly/${item.slug}`}>{item.title}</Link>
            </h2>

            <PostMeta date={item.publishDate} />

            <TagList tags={item.tags} />

            <div className="post-content">
              {item.summary ? <p>{item.summary}</p> : <p>暫無摘要。</p>}
            </div>

            <div>
              <Link className="read-more button inline" href={`/weekly/${item.slug}`}>
                閱讀更多
              </Link>
            </div>
          </article>
        ))}

        <Pagination
          prev={prevLink}
          next={nextLink}
        />
      </div>
    </>
  )
}

function parsePage(page: string | string[] | undefined) {
  const value = Array.isArray(page) ? page[0] : page
  if (!value)
    return 1

  const parsed = Number(value)
  if (Number.isNaN(parsed) || parsed <= 0)
    return 1

  return Math.floor(parsed)
}
