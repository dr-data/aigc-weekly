import { getWeekInfo, getWorkflowTargetDate } from './week'

export const WEEKLY_CRON = '0 23 * * SUN'

export interface ScheduledWeeklyStart {
  id: string
  issueNumber: string
  reused: boolean
}

function isDuplicateInstanceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /already exists|already been created|duplicate instance/i.test(message)
}

export async function startScheduledWeekly(
  env: Cloudflare.Env,
  scheduledTime: number,
): Promise<ScheduledWeeklyStart> {
  const targetDate = getWorkflowTargetDate(
    undefined,
    new Date(scheduledTime),
    scheduledTime,
  )
  const week = getWeekInfo(targetDate)
  const id = week.weekId.toLowerCase()

  try {
    await env.WEEKLY_WORKFLOW.create({
      id,
      params: { date: targetDate },
    })
    return { id, issueNumber: week.weekId, reused: false }
  }
  catch (error) {
    if (isDuplicateInstanceError(error))
      return { id, issueNumber: week.weekId, reused: true }
    throw error
  }
}
