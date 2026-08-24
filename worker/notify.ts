import type { WeekInfo } from './week'

export interface ResearchProgressPayload {
  completed: number
  priority: string
  total: number
  week: WeekInfo
}

export async function notifyResearchProgress(
  env: Cloudflare.Env,
  payload: ResearchProgressPayload,
): Promise<void> {
  const webhookUrl = env.PROGRESS_WEBHOOK_URL?.trim()
  if (!webhookUrl)
    return

  const message = [
    `周刊 ${payload.week.weekId} 研究进度：${payload.completed}/${payload.total}`,
    `当前批次：${payload.priority}`,
    `周期：${payload.week.startDate} ~ ${payload.week.endDate}`,
  ].join('\n')

  try {
    await fetch(webhookUrl, {
      body: JSON.stringify({ text: message }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    })
  }
  catch (error) {
    console.warn('研究进度 Webhook 发送失败', error)
  }
}
