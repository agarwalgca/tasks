import {
  APP_TZ,
  addDaysISO,
  todayISO,
  weekdayISO,
} from '@/lib/time'
import { parseRecurrencePhrase } from '@/features/recurrence/recurrence'

export interface ParsedQuickAdd {
  title: string
  due_date: string | null
  /** 'HH:MM' */
  due_time: string | null
  priority: number
  tags: string[]
  rrule: string | null
}

interface Span {
  start: number
  end: number
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

const pad = (n: number) => String(n).padStart(2, '0')

function overlaps(spans: Span[], start: number, end: number): boolean {
  return spans.some((s) => start < s.end && end > s.start)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function makeISO(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

/** The next occurrence of a weekday, never today. */
function nextWeekday(today: string, target: number): string {
  const delta = (target - weekdayISO(today) + 7) % 7
  return addDaysISO(today, delta === 0 ? 7 : delta)
}

/** A day/month with no year lands on the next such date that is not past. */
function resolveYear(today: string, month: number, day: number): string | null {
  const year = Number(today.slice(0, 4))
  const candidate = makeISO(year, month, day)
  if (!candidate) return null
  return candidate >= today ? candidate : makeISO(year + 1, month, day)
}

function normaliseHour(hour: number, meridiem: string | undefined): number | null {
  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    if (meridiem === 'am') return hour === 12 ? 0 : hour
    return hour === 12 ? 12 : hour + 12
  }
  if (hour < 0 || hour > 23) return null
  return hour
}

/**
 * Parses "call the bank tomorrow 5pm !p1 #work" into its pieces and leaves the
 * rest as the title. Matchers run in order and claim their span, so an earlier,
 * more specific pattern wins over a later one.
 */
export function parseQuickAdd(
  input: string,
  now: Date = new Date(),
  tz: string = APP_TZ,
): ParsedQuickAdd {
  const text = input
  const today = todayISO(now, tz)
  const claimed: Span[] = []

  let dueDate: string | null = null
  let dueTime: string | null = null
  let priority = 0
  const tags: string[] = []
  let rrule: string | null = null
  let sawTonight = false

  const scan = (
    regex: RegExp,
    handle: (m: RegExpExecArray) => boolean,
  ): void => {
    regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      if (m[0].length === 0) {
        regex.lastIndex += 1
        continue
      }
      const lead = m[1]?.length ?? 0
      const start = m.index + lead
      const end = m.index + m[0].length
      if (overlaps(claimed, start, end)) continue
      if (handle(m)) claimed.push({ start, end })
    }
  }

  scan(/(^|\s)!p?([0-3])(?=\s|$)/gi, (m) => {
    priority = Number(m[2])
    return true
  })

  scan(/(^|\s)#([\p{L}\p{N}_-]+)(?=\s|$)/giu, (m) => {
    const name = m[2].toLowerCase()
    if (!tags.includes(name)) tags.push(name)
    return true
  })

  // Recurrence is claimed before the date matchers so "every monday" reads as a
  // repeat rather than a due date.
  const recurrence = parseRecurrencePhrase(text)
  if (recurrence) {
    const start = text.toLowerCase().indexOf(recurrence.matched.toLowerCase())
    if (start >= 0 && !overlaps(claimed, start, start + recurrence.matched.length)) {
      rrule = recurrence.rrule
      claimed.push({ start, end: start + recurrence.matched.length })
    }
  }

  // 2026-09-12
  scan(/(^|\s)(\d{4})-(\d{2})-(\d{2})(?=\s|$)/g, (m) => {
    if (dueDate) return false
    const iso = makeISO(Number(m[2]), Number(m[3]), Number(m[4]))
    if (!iso) return false
    dueDate = iso
    return true
  })

  // 12/9 or 12/9/27 — day first.
  scan(/(^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s|$)/g, (m) => {
    if (dueDate) return false
    const day = Number(m[2])
    const month = Number(m[3])
    if (m[4]) {
      const raw = Number(m[4])
      const year = raw < 100 ? 2000 + raw : raw
      const iso = makeISO(year, month, day)
      if (!iso) return false
      dueDate = iso
      return true
    }
    const iso = resolveYear(today, month, day)
    if (!iso) return false
    dueDate = iso
    return true
  })

  // sep 12 / 12 sep
  const monthNames = Object.keys(MONTHS).join('|')
  scan(
    new RegExp(
      `(^|\\s)(${monthNames})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?=\\s|$)`,
      'gi',
    ),
    (m) => {
      if (dueDate) return false
      const iso = resolveYear(today, MONTHS[m[2].toLowerCase()], Number(m[3]))
      if (!iso) return false
      dueDate = iso
      return true
    },
  )
  scan(
    new RegExp(
      `(^|\\s)(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})[a-z]*\\.?(?=\\s|$)`,
      'gi',
    ),
    (m) => {
      if (dueDate) return false
      const iso = resolveYear(today, MONTHS[m[3].toLowerCase()], Number(m[2]))
      if (!iso) return false
      dueDate = iso
      return true
    },
  )

  scan(/(^|\s)(today|tod|tonight|tomorrow|tmrw|tmr|tom|yesterday)(?=\s|$)/gi, (m) => {
    if (dueDate) return false
    const word = m[2].toLowerCase()
    if (word === 'yesterday') dueDate = addDaysISO(today, -1)
    else if (word === 'today' || word === 'tod') dueDate = today
    else if (word === 'tonight') {
      dueDate = today
      sawTonight = true
    } else dueDate = addDaysISO(today, 1)
    return true
  })

  scan(/(^|\s)next\s+week(?=\s|$)/gi, () => {
    if (dueDate) return false
    dueDate = addDaysISO(today, 7)
    return true
  })

  scan(/(^|\s)in\s+(\d{1,3})\s+(day|days|week|weeks)(?=\s|$)/gi, (m) => {
    if (dueDate) return false
    const n = Number(m[2])
    dueDate = addDaysISO(today, m[3].toLowerCase().startsWith('week') ? n * 7 : n)
    return true
  })

  const weekdayNames = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|')
  scan(new RegExp(`(^|\\s)(?:next\\s+)?(${weekdayNames})(?=\\s|$)`, 'gi'), (m) => {
    if (dueDate) return false
    dueDate = nextWeekday(today, WEEKDAYS[m[2].toLowerCase()])
    return true
  })

  scan(/(^|\s)(?:at\s+)?(noon|midday|midnight)(?=\s|$)/gi, (m) => {
    if (dueTime) return false
    dueTime = m[2].toLowerCase() === 'midnight' ? '00:00' : '12:00'
    return true
  })

  // 5pm, 5:30 pm, 17:00
  scan(/(^|\s)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s|$)/gi, (m) => {
    if (dueTime) return false
    const hour = normaliseHour(Number(m[2]), m[4].toLowerCase())
    const minute = m[3] ? Number(m[3]) : 0
    if (hour === null || minute > 59) return false
    dueTime = `${pad(hour)}:${pad(minute)}`
    return true
  })
  scan(/(^|\s)(?:at\s+)?(\d{1,2}):(\d{2})(?=\s|$)/g, (m) => {
    if (dueTime) return false
    const hour = normaliseHour(Number(m[2]), undefined)
    const minute = Number(m[3])
    if (hour === null || minute > 59) return false
    dueTime = `${pad(hour)}:${pad(minute)}`
    return true
  })
  // Bare "at 5" reads as an hour of the working day: 1-7 is afternoon.
  scan(/(^|\s)at\s+(\d{1,2})(?=\s|$)/gi, (m) => {
    if (dueTime) return false
    const raw = Number(m[2])
    if (raw < 1 || raw > 23) return false
    dueTime = `${pad(raw >= 1 && raw <= 7 ? raw + 12 : raw)}:00`
    return true
  })

  if (sawTonight && !dueTime) dueTime = '20:00'

  const kept: string[] = []
  let cursor = 0
  for (const span of [...claimed].sort((a, b) => a.start - b.start)) {
    kept.push(text.slice(cursor, span.start))
    cursor = span.end
  }
  kept.push(text.slice(cursor))
  const title = kept.join(' ').replace(/\s+/g, ' ').trim()

  return {
    title: title || input.trim(),
    due_date: dueDate,
    due_time: dueTime,
    priority,
    tags,
    rrule,
  }
}
