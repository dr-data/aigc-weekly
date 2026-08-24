/* eslint-disable node/prefer-global/process */
const title = 'DrData 的 AIGC 週刊'
const description = '由 Agentic AI Agent 驅動的 AIGC 精選周刊，每週收集最新 AI 進展、工具發現與深度觀點。'

const keywords = ['AIGC', 'AI', '人工智慧', '生成式 AI', 'Agentic AI', 'AI 工具', 'AI 資訊', '周刊']
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
      name: 'DrData',
      url: baseUrl,
    },
  ],
  creator: 'DrData',
  publisher: 'DrData',
  category: 'technology',
  openGraph: {
    type: 'website' as const,
    locale: 'zh_TW',
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
