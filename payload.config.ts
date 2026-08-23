import type { CloudflareContext } from '@opennextjs/cloudflare'
import type { R2StorageOptions } from '@payloadcms/storage-r2'
import type { GetPlatformProxyOptions } from 'wrangler'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { r2Storage } from '@payloadcms/storage-r2'
import { zhTw } from '@payloadcms/translations/languages/zhTw'
import { buildConfig } from 'payload'

import { Media } from './collections/Media'
import { Users } from './collections/Users'
import { Weekly } from './collections/Weekly'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const isCLI = process.argv.some(value => value.match(/^(generate|migrate):?/))
const isProduction = process.env.NODE_ENV === 'production'
const serverURL = (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.shor.lol').replace(/\/$/, '')

type PayloadR2Bucket = R2StorageOptions['bucket']

const cloudflare = isCLI || !isProduction
  ? await getCloudflareContextFromWrangler()
  : await getCloudflareContext({ async: true })

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Weekly, Media],
  cors: [serverURL],
  csrf: [serverURL],
  editor: lexicalEditor(),
  i18n: {
    supportedLanguages: { zhTw },
    fallbackLanguage: 'zhTw',
  },
  secret: process.env.PAYLOAD_SECRET || '',
  serverURL,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteD1Adapter({
    binding: cloudflare.env.D1,
    readReplicas: 'first-primary',
  }),
  plugins: [
    r2Storage({
      bucket: cloudflare.env.R2 as unknown as PayloadR2Bucket,
      collections: { media: true },
    }),
  ],
})

// Adapted from https://github.com/opennextjs/opennextjs-cloudflare/blob/d00b3a13e42e65aad76fba41774815726422cc39/packages/cloudflare/src/api/cloudflare-context.ts#L328C36-L328C46
async function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  const { getPlatformProxy } = await import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`)
  console.info('Getting Cloudflare context from Wrangler bindings', {
    remoteBindings: isProduction,
  })
  return getPlatformProxy({
    remoteBindings: isProduction,
  } satisfies GetPlatformProxyOptions)
}
