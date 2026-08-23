export interface WeekInfo {
  weekId: string
  weekNumber: string
  yearShort: string
  yearFull: string
  startDate: string
  endDate: string
  currentDate: string
  timezone: 'UTC+0'
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function getWorkflowTargetDate(
  payloadDate: string | undefined,
  eventTimestamp: Date,
  scheduledTime?: number,
): string {
  if (payloadDate)
    return payloadDate

  const triggerTime = scheduledTime === undefined
    ? eventTimestamp
    : new Date(scheduledTime - 86_400_000)
  return formatDate(triggerTime)
}

function parseDate(targetDate?: string): Date {
  if (!targetDate)
    return new Date()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate))
    throw new Error(`日期格式无效：${targetDate}`)

  const date = new Date(`${targetDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || formatDate(date) !== targetDate)
    throw new Error(`日期格式无效：${targetDate}`)

  return date
}

function calculateWeekNumber(sunday: Date): string {
  const year = sunday.getUTCFullYear()
  const januaryFirst = new Date(Date.UTC(year, 0, 1))
  const firstSunday = januaryFirst.getUTCDay() === 0
    ? januaryFirst
    : new Date(Date.UTC(year, 0, 8 - januaryFirst.getUTCDay()))

  if (sunday < firstSunday)
    return '00'

  const elapsedDays = Math.floor((sunday.getTime() - firstSunday.getTime()) / 86_400_000)
  return String(Math.floor(elapsedDays / 7) + 1).padStart(2, '0')
}

export function getWeekInfo(targetDate?: string): WeekInfo {
  const current = parseDate(targetDate)
  const sunday = new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate() - current.getUTCDay(),
  ))
  const saturday = new Date(sunday)
  saturday.setUTCDate(sunday.getUTCDate() + 6)

  const weekNumber = calculateWeekNumber(sunday)
  const yearFull = String(sunday.getUTCFullYear())
  const yearShort = yearFull.slice(-2)

  return {
    weekId: `Y${yearShort}W${weekNumber}`,
    weekNumber,
    yearShort,
    yearFull,
    startDate: formatDate(sunday),
    endDate: formatDate(saturday),
    currentDate: formatDate(current),
    timezone: 'UTC+0',
  }
}
