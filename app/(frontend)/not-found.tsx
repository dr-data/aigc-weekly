import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '找不到頁面',
}

export default function NotFoundPage() {
  return (
    <article className="post">
      <h1 className="post-title">找不到頁面</h1>
      <div className="post-content">
        <p>找不到對應內容，請返回首頁查看其他期刊。</p>
        <Link className="button inline" href="/">
          返回首頁
        </Link>
      </div>
    </article>
  )
}
