import { describe, expect, it } from 'vitest'

import { getWeekInfo } from './week'

describe('hn adapter contracts', () => {
  it('defines a valid week range for Algolia filters', () => {
    const week = getWeekInfo('2026-08-23')
    expect(week.startDate).toBe('2026-08-23')
    expect(week.endDate).toBe('2026-08-29')
  })
})
