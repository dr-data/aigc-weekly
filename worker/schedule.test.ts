import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import { startScheduledWeekly, WEEKLY_CRON } from './schedule'
import { getWeekInfo, getWorkflowTargetDate } from './week'

function readWorkerWrangler(): string {
  return readFileSync(new URL('./wrangler.jsonc', import.meta.url), 'utf8')
}

function createWorkflowEnv(create: ReturnType<typeof vi.fn>) {
  return {
    WEEKLY_WORKFLOW: { create },
  } as unknown as Cloudflare.Env
}

describe('weekly cron configuration', () => {
  it('uses Cloudflare Sunday (SUN); weekday 7 is Saturday', () => {
    const wrangler = readWorkerWrangler()

    expect(WEEKLY_CRON).toBe('0 23 * * SUN')
    expect(wrangler).toContain(WEEKLY_CRON)
    expect(wrangler).not.toMatch(/0 23 \* \* 7/)
  })

  it('registers a Worker cron trigger instead of a 1-hour Workflow schedule', () => {
    const wrangler = readWorkerWrangler()

    expect(wrangler).toMatch(/"crons"\s*:\s*\[\s*"0 23 \* \* SUN"/)
    expect(wrangler).not.toMatch(/"schedules"\s*:\s*\[/)
  })
})

describe('startScheduledWeekly', () => {
  it('creates a durable workflow for the completed week with a stable instance id', async () => {
    const scheduledTime = Date.parse('2026-08-23T23:00:00Z')
    const targetDate = getWorkflowTargetDate(
      undefined,
      new Date(scheduledTime),
      scheduledTime,
    )
    const week = getWeekInfo(targetDate)
    const create = vi.fn(async (options: { id: string }) => ({ id: options.id }))
    const env = createWorkflowEnv(create)

    const result = await startScheduledWeekly(env, scheduledTime)

    expect(targetDate).toBe('2026-08-22')
    expect(result).toEqual({
      id: 'y26w33',
      issueNumber: week.weekId,
      reused: false,
    })
    expect(create).toHaveBeenCalledWith({
      id: 'y26w33',
      params: { date: targetDate },
    })
  })

  it('treats a duplicate instance as a successful idempotent cron run', async () => {
    const create = vi.fn(async () => {
      throw new Error('instance with id "y26w33" already exists')
    })

    const result = await startScheduledWeekly(
      createWorkflowEnv(create),
      Date.parse('2026-08-23T23:00:00Z'),
    )

    expect(result).toEqual({
      id: 'y26w33',
      issueNumber: 'Y26W33',
      reused: true,
    })
  })
})
