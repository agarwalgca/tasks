import { describe, expect, it } from 'vitest'
import {
  buildRrule,
  describeRrule,
  firstOccurrenceFrom,
  nextDueDate,
  nextOccurrence,
  parseRecurrencePhrase,
  parseRrule,
} from './recurrence'

describe('buildRrule / parseRrule', () => {
  it('round-trips a spec', () => {
    const spec = { frequency: 'weekly' as const, interval: 2, weekdays: [1, 4] }
    const rule = buildRrule(spec)
    expect(rule).toBe('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH')
    expect(parseRrule(rule)).toEqual(spec)
  })

  it('omits a redundant interval', () => {
    expect(buildRrule({ frequency: 'daily', interval: 1, weekdays: [] })).toBe(
      'RRULE:FREQ=DAILY',
    )
    expect(buildRrule({ frequency: 'monthly', interval: 1, weekdays: [] })).toBe(
      'RRULE:FREQ=MONTHLY',
    )
  })

  it('maps Sunday correctly in both directions', () => {
    const rule = buildRrule({ frequency: 'weekly', interval: 1, weekdays: [0] })
    expect(rule).toBe('RRULE:FREQ=WEEKLY;BYDAY=SU')
    expect(parseRrule(rule)?.weekdays).toEqual([0])
  })

  it('returns null for nonsense', () => {
    expect(parseRrule('not a rule')).toBeNull()
  })
})

describe('nextOccurrence', () => {
  it('steps daily and by interval', () => {
    expect(nextOccurrence('RRULE:FREQ=DAILY', '2026-09-10')).toBe('2026-09-11')
    expect(nextOccurrence('RRULE:FREQ=DAILY;INTERVAL=3', '2026-09-10')).toBe(
      '2026-09-13',
    )
  })

  it('steps weekly on the same weekday', () => {
    // 2026-09-10 is a Thursday.
    expect(nextOccurrence('RRULE:FREQ=WEEKLY', '2026-09-10')).toBe('2026-09-17')
  })

  it('honours BYDAY', () => {
    // From Thursday, the next Mon-or-Thu is the following Monday.
    expect(nextOccurrence('RRULE:FREQ=WEEKLY;BYDAY=MO,TH', '2026-09-10')).toBe(
      '2026-09-14',
    )
    expect(nextOccurrence('RRULE:FREQ=WEEKLY;BYDAY=MO,TH', '2026-09-14')).toBe(
      '2026-09-17',
    )
  })

  it('steps monthly and yearly across boundaries', () => {
    expect(nextOccurrence('RRULE:FREQ=MONTHLY', '2026-12-20')).toBe('2027-01-20')
    expect(nextOccurrence('RRULE:FREQ=YEARLY', '2026-02-28')).toBe('2027-02-28')
    expect(nextOccurrence('RRULE:FREQ=MONTHLY;INTERVAL=3', '2026-09-30')).toBe(
      '2026-12-30',
    )
  })

  it('never returns the date it started from', () => {
    expect(nextOccurrence('RRULE:FREQ=DAILY', '2026-09-10')).not.toBe('2026-09-10')
  })
})

describe('nextDueDate anchoring', () => {
  const monthly = 'RRULE:FREQ=MONTHLY'

  it('anchored on the due date ignores when it was ticked off', () => {
    // The bill was due on the 5th and paid late, on the 20th. Next is the 5th.
    expect(nextDueDate(monthly, 'due_date', '2026-09-05', '2026-09-20')).toBe(
      '2026-10-05',
    )
  })

  it('anchored on completion measures from the day it was done', () => {
    expect(
      nextDueDate('RRULE:FREQ=DAILY;INTERVAL=3', 'completion_date', '2026-09-05', '2026-09-20'),
    ).toBe('2026-09-23')
  })

  it('handles a completion-anchored task with no due date', () => {
    expect(
      nextDueDate('RRULE:FREQ=DAILY;INTERVAL=7', 'completion_date', null, '2026-09-20'),
    ).toBe('2026-09-27')
  })

  it('cannot advance a due-date-anchored task with no due date', () => {
    expect(nextDueDate(monthly, 'due_date', null, '2026-09-20')).toBeNull()
  })
})

describe('firstOccurrenceFrom', () => {
  it('can land on today when today already matches', () => {
    // 2026-09-10 is a Thursday.
    expect(firstOccurrenceFrom('RRULE:FREQ=WEEKLY;BYDAY=TH', '2026-09-10')).toBe(
      '2026-09-10',
    )
  })

  it('otherwise finds the next matching day', () => {
    expect(firstOccurrenceFrom('RRULE:FREQ=WEEKLY;BYDAY=MO', '2026-09-10')).toBe(
      '2026-09-14',
    )
  })
})

describe('describeRrule', () => {
  it('reads back in plain words', () => {
    expect(describeRrule('RRULE:FREQ=DAILY', null)).toBe('Daily')
    expect(describeRrule('RRULE:FREQ=DAILY;INTERVAL=3', null)).toBe('Every 3 days')
    expect(describeRrule('RRULE:FREQ=WEEKLY;BYDAY=MO,TH', null)).toBe(
      'Weekly on Mon, Thu',
    )
    expect(describeRrule('RRULE:FREQ=MONTHLY', '2026-09-01')).toBe(
      'Monthly on the 1st',
    )
    expect(describeRrule('RRULE:FREQ=MONTHLY', '2026-09-22')).toBe(
      'Monthly on the 22nd',
    )
    expect(describeRrule('RRULE:FREQ=MONTHLY', '2026-09-13')).toBe(
      'Monthly on the 13th',
    )
    expect(describeRrule('RRULE:FREQ=YEARLY', '2026-04-15')).toBe(
      'Yearly on Apr 15',
    )
  })
})

describe('parseRecurrencePhrase', () => {
  it('reads weekday phrases', () => {
    expect(parseRecurrencePhrase('standup every monday')).toEqual({
      rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
      matched: 'every monday',
    })
    expect(parseRecurrencePhrase('gym every sat')?.rrule).toBe(
      'RRULE:FREQ=WEEKLY;BYDAY=SA',
    )
  })

  it('reads intervals and bare units', () => {
    expect(parseRecurrencePhrase('water plants every 3 days')?.rrule).toBe(
      'RRULE:FREQ=DAILY;INTERVAL=3',
    )
    expect(parseRecurrencePhrase('file gst every month')?.rrule).toBe(
      'RRULE:FREQ=MONTHLY',
    )
    expect(parseRecurrencePhrase('review every 2 weeks')?.rrule).toBe(
      'RRULE:FREQ=WEEKLY;INTERVAL=2',
    )
  })

  it('ignores text with no recurrence in it', () => {
    expect(parseRecurrencePhrase('buy milk tomorrow')).toBeNull()
    expect(parseRecurrencePhrase('every so often')).toBeNull()
  })
})
