import { withPayload } from '@payloadcms/next/withPayload'

const WEEKLY_CACHE_TAG = 'weekly'

function weeklyCacheHeaders(cacheControl) {
  return [
    {
      key: 'Cache-Tag',
      value: WEEKLY_CACHE_TAG,
    },
    {
      key: 'Cloudflare-CDN-Cache-Control',
      value: cacheControl,
    },
  ]
}

const privateCacheHeaders = [
  {
    key: 'Cloudflare-CDN-Cache-Control',
    value: 'private, no-store',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  expireTime: 43200, // 12h
  serverExternalPackages: ['jose'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/rss.xml',
        headers: weeklyCacheHeaders('public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800'),
      },
      {
        source: '/sitemap.xml',
        headers: weeklyCacheHeaders('public, max-age=21600, stale-while-revalidate=86400, stale-if-error=604800'),
      },
      {
        source: '/weekly/:slug',
        missing: [{ type: 'header', key: 'RSC' }],
        headers: weeklyCacheHeaders('public, max-age=0, must-revalidate, stale-while-revalidate=60, stale-if-error=86400'),
      },
      {
        source: '/',
        missing: [{ type: 'header', key: 'RSC' }],
        headers: weeklyCacheHeaders('public, max-age=300, stale-while-revalidate=900, stale-if-error=86400'),
      },
      {
        source: '/admin/:path*',
        headers: privateCacheHeaders,
      },
      {
        source: '/api/:path*',
        headers: privateCacheHeaders,
      },
    ]
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
