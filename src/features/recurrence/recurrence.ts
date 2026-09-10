import { RRule, rrulestr } from 'rrule'
import { MONTH_NAMES, WEEKDAY_NAMES, addDaysISO } from '@/lib/time'
import type { RecurrenceAnchor } from '@/lib/types'

/**
 * Recurrence is computed on plain calendar dates. Every date is handled as UTC
 * midnight so no zone ever shifts an occurrence onto the wrong day — the stored
 * column is a DATE, not an instant.
 */
function isoToUtc(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function utcToISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceSpec {
  frequency: Frequency
  interval: number
  /** 0 = Sunday. Weekly only; empty means "same weekday as the due date". */
  weekdays: number[]
}

const FREQ: Record<Frequency, number> = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
  yearly: RRule.YEARLY,
}

export function buildRrule(spec: RecurrenceSpec): string {
  const parts = [`FREQ=${spec.frequency.toUpperCase()}`]
  if (spec.interval > 1) parts.push(`INTERVAL=${spec.interval}`)
  if (spec.frequency === 'weekly' && spec.weekdays.length > 0) {
    parts.push(`BYDAY=${spec.weekdays.map((d) => WEEKDAY_CODES[d]).join(',')}`)
  }
  return `RRULE:${parts.join(';')}`
}

export function parseRrule(rule: string): RecurrenceSpec | null {
  try {
    const options = rrulestr(rule).origOptions
    const frequency = (
      Object.keys(FREQ) as Frequency[]
    ).find((key) => FREQ[key] === options.freq)
    if (!frequency) return null

    const byweekday = options.byweekday
    const weekdays = byweekday
      ? (Array.isArray(byweekday) ? byweekday : [byweekday]).map((day) =>
          // rrule counts Monday as 0; the app counts Sunday as 0.
          typeof day === 'number' ? (day + 1) % 7 : ((day as { weekday: number }).weekday + 1) % 7,
        )
      : []

    return { frequency, interval: options.interval ?? 1, weekdays: weekdays.sort() }
  } catch {
    return null
  }
}

/**
 * The next occurrence strictly after `from`. `from` is the current due date for
 * a due_date-anchored task, or the day it was completed for a
 * completion_date-anchored one.
 */
export function nextOccurrence(
  rule: string,
  from: string,
  dtstart: string = from,
): string | null {
  const spec = parseRrule(rule)
  if (!spec) return null

  const options = {
    freq: FREQ[spec.frequency],
    interval: spec.interval,
    dtstart: isoToUtc(dtstart),
    ...(spec.frequency === 'weekly' && spec.weekdays.length > 0
      ? { byweekday: spec.weekdays.map((d) => (d + 6) % 7) }
      : {}),
  }

  const next = new RRule(options).after(isoToUtc(from), false)
  return next ? utcToISO(next) : null
}

/**
 * Where the next instance is measured from. A monthly bill recurs from its due
 * date whenever you tick it off; "every 3 days" recurs from the day you did it.
 */
export function nextDueDate(
  rule: string,
  anchor: RecurrenceAnchor,
  currentDue: string | null,
  completedOn: string,
): string | null {
  if (anchor === 'completion_date') {
    return nextOccurrence(rule, completedOn, currentDue ?? completedOn)
  }
  if (!currentDue) return null
  return nextOccurrence(rule, currentDue)
}

const ORDINAL = ['', 'st', 'nd', 'rd']
function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  return `${n}${ORDINAL[n % 10] ?? 'th'}`
}

/** Human wording for the picker and the task row, e.g. "Every 2 weeks on Mon". */
export function describeRrule(rule: string, dueDate: string | null): string {
  const spec = parseRrule(rule)
  if (!spec) return 'Repeats'

  const every =
    spec.interval === 1
      ? { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[
          spec.frequency
        ]
      : `Every ${spec.interval} ${
          { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' }[
            spec.frequency
          ]
        }`

  if (spec.frequency === 'weekly' && spec.weekdays.length > 0) {
    return `${every} on ${spec.weekdays.map((d) => WEEKDAY_NAMES[d]).join(', ')}`
  }
  if (spec.frequency === 'monthly' && dueDate) {
    return `${every} on the ${ordinal(Number(dueDate.slice(8, 10)))}`
  }
  if (spec.frequency === 'yearly' && dueDate) {
    const [, m, d] = dueDate.split('-').map(Number)
    return `${every} on ${MONTH_NAMES[m - 1]} ${d}`
  }
  return every
}

/** "every monday", "every 3 days", "every month" in quick add. */
export function parseRecurrencePhrase(
  text: string,
): { rrule: string; matched: string } | null {
  const weekdayNames =
    'sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday'

  const weekday = new RegExp(`(^|\\s)every\\s+(${weekdayNames})(?=\\s|$)`, 'i').exec(text)
  if (weekday) {
    const index = WEEKDAY_LOOKUP[weekday[2].toLowerCase()]
    return {
      rrule: buildRrule({ frequency: 'weekly', interval: 1, weekdays: [index] }),
      matched: weekday[0].trimStart(),
    }
  }

  const interval = /(^|\s)every\s+(\d{1,3})\s+(day|days|week|weeks|month|months|year|years)(?=\s|$)/i.exec(
    text,
  )
  if (interval) {
    return {
      rrule: buildRrule({
        frequency: UNIT_FREQUENCY[interval[3].toLowerCase().replace(/s$/, '')],
        interval: Number(interval[2]),
        weekdays: [],
      }),
      matched: interval[0].trimStart(),
    }
  }

  const simple = /(^|\s)every\s+(day|week|month|year)(?=\s|$)/i.exec(text)
  if (simple) {
    return {
      rrule: buildRrule({
        frequency: UNIT_FREQUENCY[simple[2].toLowerCase()],
        interval: 1,
        weekdays: [],
      }),
      matched: simple[0].trimStart(),
    }
  }

  return null
}

const UNIT_FREQUENCY: Record<string, Frequency> = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
}

const WEEKDAY_LOOKUP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

/** The first due date for a task created as "every monday" with no date given. */
export function firstOccurrenceFrom(rule: string, today: string): string | null {
  return nextOccurrence(rule, addDaysISO(today, -1), today)
}
