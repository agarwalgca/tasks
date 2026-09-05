/**
 * Everything is stored as timestamptz (or a bare date/time) and read in one
 * fixed zone. India has no DST, so a single offset lookup per instant is exact.
 */
export const APP_TZ = 'Asia/Kolkata'

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const partsFormatter = new Map<string, Intl.DateTimeFormat>()

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = partsFormatter.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatter.set(tz, f)
  }
  return f
}

export function zonedParts(instant: Date, tz: string = APP_TZ): ZonedParts {
  const parts = formatterFor(tz).formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)!.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

function tzOffsetMs(instant: Date, tz: string): number {
  const p = zonedParts(instant, tz)
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUTC - instant.getTime()
}

/** Wall-clock time in `tz` to the instant it names. */
export function zonedToInstant(
  isoDate: string,
  timeOfDay: string | null,
  tz: string = APP_TZ,
): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  const [hh, mm] = timeOfDay ? timeOfDay.split(':').map(Number) : [0, 0]
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0)
  return new Date(guess - tzOffsetMs(new Date(guess), tz))
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' for an instant, in `tz`. */
export function toISODate(instant: Date, tz: string = APP_TZ): string {
  const p = zonedParts(instant, tz)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

export function todayISO(now: Date = new Date(), tz: string = APP_TZ): string {
  return toISODate(now, tz)
}

/** Date-only arithmetic; never touches a timezone. */
export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

export function daysBetweenISO(from: string, to: string): number {
  const [ay, am, ad] = from.split('-').map(Number)
  const [by, bm, bd] = to.split('-').map(Number)
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000,
  )
}

/** 0 = Sunday. */
export function weekdayISO(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export const WEEKDAY_NAMES = WEEKDAY_SHORT
export const MONTH_NAMES = MONTH_SHORT

/** '5:00 pm' from 'HH:MM' or 'HH:MM:SS'. */
export function formatTime(timeOfDay: string): string {
  const [hhRaw, mmRaw] = timeOfDay.split(':')
  const hh = Number(hhRaw)
  const mm = Number(mmRaw)
  const suffix = hh < 12 ? 'am' : 'pm'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${pad(mm)} ${suffix}`
}

/** 'Today', 'Tomorrow', 'Thu', 'Sep 12', 'Sep 12 2027'. */
export function formatDateLabel(
  isoDate: string,
  now: Date = new Date(),
  tz: string = APP_TZ,
): string {
  const today = todayISO(now, tz)
  const delta = daysBetweenISO(today, isoDate)
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Tomorrow'
  if (delta === -1) return 'Yesterday'
  if (delta > 1 && delta < 7) return WEEKDAY_SHORT[weekdayISO(isoDate)]
  const [y, m, d] = isoDate.split('-').map(Number)
  const thisYear = Number(today.slice(0, 4))
  return y === thisYear
    ? `${MONTH_SHORT[m - 1]} ${d}`
    : `${MONTH_SHORT[m - 1]} ${d} ${y}`
}

export function formatDue(
  isoDate: string,
  timeOfDay: string | null,
  now: Date = new Date(),
  tz: string = APP_TZ,
): string {
  const day = formatDateLabel(isoDate, now, tz)
  return timeOfDay ? `${day} ${formatTime(timeOfDay)}` : day
}

/**
 * A dated task is overdue once its day has passed; a task with a time is
 * overdue once that moment has passed.
 */
export function isOverdue(
  isoDate: string | null,
  timeOfDay: string | null,
  now: Date = new Date(),
  tz: string = APP_TZ,
): boolean {
  if (!isoDate) return false
  if (timeOfDay) return zonedToInstant(isoDate, timeOfDay, tz).getTime() < now.getTime()
  return daysBetweenISO(todayISO(now, tz), isoDate) < 0
}

export function isToday(
  isoDate: string | null,
  now: Date = new Date(),
  tz: string = APP_TZ,
): boolean {
  return !!isoDate && isoDate === todayISO(now, tz)
}

/** Today through today+6, inclusive. */
export function next7DaysRange(
  now: Date = new Date(),
  tz: string = APP_TZ,
): { from: string; to: string } {
  const from = todayISO(now, tz)
  return { from, to: addDaysISO(from, 6) }
}

export function nowISO(): string {
  return new Date().toISOString()
}
