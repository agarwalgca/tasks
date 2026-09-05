import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  daysBetweenISO,
  formatDateLabel,
  formatDue,
  formatTime,
  isOverdue,
  isToday,
  next7DaysRange,
  toISODate,
  weekdayISO,
  zonedToInstant,
} from './time'

// 2026-09-06 is a Sunday. IST is UTC+5:30 year round.
const SUNDAY_NOON_IST = new Date('2026-09-06T06:30:00Z')

describe('toISODate', () => {
  it('reads the calendar day in Asia/Kolkata, not UTC', () => {
    // 19:00Z is already 00:30 the next day in IST.
    expect(toISODate(new Date('2026-09-06T19:00:00Z'))).toBe('2026-09-07')
    // 18:29Z is still 23:59 the same day.
    expect(toISODate(new Date('2026-09-06T18:29:00Z'))).toBe('2026-09-06')
  })

  it('honours an explicit zone', () => {
    expect(toISODate(new Date('2026-09-06T19:00:00Z'), 'UTC')).toBe('2026-09-06')
  })
})

describe('addDaysISO', () => {
  it('crosses months, years and leap days', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysISO('2027-02-28', 1)).toBe('2027-03-01')
    expect(addDaysISO('2026-09-06', 30)).toBe('2026-10-06')
  })
})

describe('daysBetweenISO', () => {
  it('counts calendar days in both directions', () => {
    expect(daysBetweenISO('2026-09-06', '2026-09-06')).toBe(0)
    expect(daysBetweenISO('2026-09-06', '2026-09-13')).toBe(7)
    expect(daysBetweenISO('2026-09-06', '2026-09-05')).toBe(-1)
    expect(daysBetweenISO('2026-12-31', '2027-01-01')).toBe(1)
  })
})

describe('weekdayISO', () => {
  it('returns 0 for Sunday', () => {
    expect(weekdayISO('2026-09-06')).toBe(0)
    expect(weekdayISO('2026-09-10')).toBe(4)
  })
})

describe('zonedToInstant', () => {
  it('treats the wall clock as IST', () => {
    expect(zonedToInstant('2026-09-07', '05:30').toISOString()).toBe(
      '2026-09-07T00:00:00.000Z',
    )
    expect(zonedToInstant('2026-09-07', null).toISOString()).toBe(
      '2026-09-06T18:30:00.000Z',
    )
    expect(zonedToInstant('2026-09-07', '17:00:00').toISOString()).toBe(
      '2026-09-07T11:30:00.000Z',
    )
  })
})

describe('formatTime', () => {
  it('renders a 12-hour clock', () => {
    expect(formatTime('17:00:00')).toBe('5:00 pm')
    expect(formatTime('00:30')).toBe('12:30 am')
    expect(formatTime('12:00')).toBe('12:00 pm')
    expect(formatTime('09:05')).toBe('9:05 am')
  })
})

describe('formatDateLabel', () => {
  it('names nearby days and dates the rest', () => {
    expect(formatDateLabel('2026-09-06', SUNDAY_NOON_IST)).toBe('Today')
    expect(formatDateLabel('2026-09-07', SUNDAY_NOON_IST)).toBe('Tomorrow')
    expect(formatDateLabel('2026-09-05', SUNDAY_NOON_IST)).toBe('Yesterday')
    expect(formatDateLabel('2026-09-10', SUNDAY_NOON_IST)).toBe('Thu')
    expect(formatDateLabel('2026-09-20', SUNDAY_NOON_IST)).toBe('Sep 20')
    expect(formatDateLabel('2027-01-02', SUNDAY_NOON_IST)).toBe('Jan 2 2027')
  })

  it('appends the time when there is one', () => {
    expect(formatDue('2026-09-07', '17:00:00', SUNDAY_NOON_IST)).toBe(
      'Tomorrow 5:00 pm',
    )
    expect(formatDue('2026-09-07', null, SUNDAY_NOON_IST)).toBe('Tomorrow')
  })
})

describe('isOverdue', () => {
  it('is false without a date', () => {
    expect(isOverdue(null, null, SUNDAY_NOON_IST)).toBe(false)
  })

  it('uses the day for date-only tasks', () => {
    expect(isOverdue('2026-09-05', null, SUNDAY_NOON_IST)).toBe(true)
    expect(isOverdue('2026-09-06', null, SUNDAY_NOON_IST)).toBe(false)
    expect(isOverdue('2026-09-07', null, SUNDAY_NOON_IST)).toBe(false)
  })

  it('uses the moment when a time is set', () => {
    // now is 12:00 IST on the 6th.
    expect(isOverdue('2026-09-06', '11:59', SUNDAY_NOON_IST)).toBe(true)
    expect(isOverdue('2026-09-06', '12:01', SUNDAY_NOON_IST)).toBe(false)
  })
})

describe('isToday / next7DaysRange', () => {
  it('anchors on the IST day', () => {
    expect(isToday('2026-09-06', SUNDAY_NOON_IST)).toBe(true)
    expect(isToday('2026-09-07', SUNDAY_NOON_IST)).toBe(false)
    expect(isToday(null, SUNDAY_NOON_IST)).toBe(false)
    expect(next7DaysRange(SUNDAY_NOON_IST)).toEqual({
      from: '2026-09-06',
      to: '2026-09-12',
    })
  })
})
