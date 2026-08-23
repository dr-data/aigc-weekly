import { describe, expect, it } from 'vitest'

import { getWeekInfo, getWorkflowTargetDate } from './week'

describe('getWeekInfo', () => {
  it('uses Sunday through Saturday as the weekly range', () => {
    expect(getWeekInfo('2026-08-23')).toEqual({
      weekId: 'Y26W34',
      weekNumber: '34',
      yearShort: '26',
      yearFull: '2026',
      startDate: '2026-08-23',
      endDate: '2026-08-29',
      currentDate: '2026-08-23',
      timezone: 'UTC+0',
    })
  })

  it('places dates before the first Sunday in week zero', () => {
    expect(getWeekInfo('2026-01-01').weekId).toBe('Y25W52')
  })

  it('rejects invalid date input', () => {
    expect(() => getWeekInfo('not-a-date')).toThrow('日期格式无效')
  })
})

describe('getWorkflowTargetDate', () => {
  it('uses the persisted manual payload date', () => {
    expect(getWorkflowTargetDate(
      '2026-08-20',
      new Date('2026-08-23T23:00:00Z'),
    )).toBe('2026-08-20')
  })

  it('targets the completed week when the Sunday schedule fires', () => {
    expect(getWorkflowTargetDate(
      undefined,
      new Date('2026-08-23T23:00:00Z'),
      Date.parse('2026-08-23T23:00:00Z'),
    )).toBe('2026-08-22')
  })
})
