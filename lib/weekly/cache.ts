import { revalidatePath, revalidateTag } from 'next/cache'

export const WEEKLY_CACHE_TAG = 'weekly'

export async function revalidateWeeklyCache(issueNumber?: string): Promise<void> {
  try {
    revalidateTag(WEEKLY_CACHE_TAG)
    revalidatePath('/')
    revalidatePath('/rss.xml')
    revalidatePath('/weekly/[slug]', 'page')
    if (issueNumber)
      revalidatePath(`/weekly/${issueNumber}`)
  }
  catch (error) {
    console.error('Next.js 周刊缓存失效异常', error)
  }

  try {
    const { cache } = await import(/* webpackIgnore: true */ 'cloudflare:workers')
    const result = await cache.purge({ tags: [WEEKLY_CACHE_TAG] })

    if (!result.success)
      console.warn('Workers Cache 周刊标签清除失败', result.errors)
  }
  catch (error) {
    console.error('Workers Cache 周刊标签清除异常', error)
  }
}
