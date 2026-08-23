/* eslint-disable node/prefer-global/process */
const title = 'Agili 的 AIGC 周刊'
const description = '由 Agentic AI Agent 驱动的 AIGC 精选周刊，每周收集最新 AI 进展、工具发现与深度观点。'

const keywords = ['AIGC', 'AI', '人工智能', '生成式 AI', 'Agentic AI', 'AI 工具', 'AI 资讯', '周刊']
const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.shor.lol').replace(/\/$/, '')
const defaultImage = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: title,
} as const

export const siteConfig = {
  title,
  description,
  keywords,
  applicationName: title,
  authors: [
    {
      name: 'Agili',
      url: baseUrl,
    },
  ],
  creator: 'Agili',
  publisher: 'Agili',
  category: 'technology',
  openGraph: {
    type: 'website' as const,
    locale: 'zh_CN',
    url: baseUrl,
    title,
    description,
    siteName: title,
    images: [defaultImage],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title,
    description,
    images: [defaultImage],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
  },
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: baseUrl,
    types: {
      'application/rss+xml': `${baseUrl}/rss.xml`,
    },
  },
  metadataBase: new URL(baseUrl),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      'index': true,
      'follow': true,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  appleWebApp: {
    capable: true,
    title,
    statusBarStyle: 'black-translucent' as const,
  },
  formatDetection: {
    telephone: false,
  },
}

export type SiteConfig = typeof siteConfig
