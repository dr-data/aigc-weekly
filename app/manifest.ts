import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/config'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.title,
    short_name: 'AIGC 週刊',
    description: siteConfig.description,
    lang: 'zh-Hant',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#1a170f',
    theme_color: '#1a170f',
    categories: ['technology', 'news', 'education'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
