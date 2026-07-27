import { MS_PER_DAY } from './constants'

/**
 * Returns the first millisecond of the local calendar day containing timestamp.
 * Review intervals are calendar days, not fixed 24-hour periods, so this also
 * stays correct on daylight-saving time changes.
 */
export function startOfLocalDay(timestamp = Date.now()): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function addCalendarDays(timestamp: number, days: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

/** Adds calendar days while preserving local time-of-day (and respecting DST). */
export function addReviewInterval(timestamp: number, days: number): number {
  const date = new Date(timestamp)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export function scheduleReview(intervalDays: number, reviewedAt = Date.now()): number {
  return intervalDays <= 0 ? reviewedAt : addReviewInterval(reviewedAt, intervalDays)
}

/** Returns the difference between local calendar dates, irrespective of DST. */
export function calendarDayOffset(timestamp: number, from = Date.now()): number {
  const date = new Date(timestamp)
  const base = new Date(from)
  const dateDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const baseDay = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())
  return Math.round((dateDay - baseDay) / MS_PER_DAY)
}
