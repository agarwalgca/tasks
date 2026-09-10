import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './parse'

// Noon IST on Sunday 2026-09-06.
const NOW = new Date('2026-09-06T06:30:00Z')
const parse = (input: string) => parseQuickAdd(input, NOW)

describe('parseQuickAdd', () => {
  it('parses the whole example', () => {
    expect(parse('call the bank tomorrow 5pm !p1 #work')).toEqual({
      title: 'call the bank',
      due_date: '2026-09-07',
      due_time: '17:00',
      priority: 1,
      tags: ['work'],
      rrule: null,
    })
  })

  it('leaves a plain title alone', () => {
    expect(parse('buy milk')).toEqual({
      title: 'buy milk',
      due_date: null,
      due_time: null,
      priority: 0,
      tags: [],
      rrule: null,
    })
  })

  it('reads weekdays as the next occurrence, never today', () => {
    expect(parse('review deck thursday').due_date).toBe('2026-09-10')
    expect(parse('review deck thu').due_date).toBe('2026-09-10')
    expect(parse('next friday retro').due_date).toBe('2026-09-11')
    // Today is Sunday, so "sunday" means the one coming.
    expect(parse('sunday roast').due_date).toBe('2026-09-13')
  })

  it('reads relative days', () => {
    expect(parse('ping ops today').due_date).toBe('2026-09-06')
    expect(parse('ping ops tmrw').due_date).toBe('2026-09-07')
    expect(parse('missed this yesterday').due_date).toBe('2026-09-05')
    expect(parse('retro next week').due_date).toBe('2026-09-13')
    expect(parse('renew passport in 3 days').due_date).toBe('2026-09-09')
    expect(parse('renew passport in 2 weeks').due_date).toBe('2026-09-20')
  })

  it('gives tonight an evening time', () => {
    expect(parse('dinner tonight')).toMatchObject({
      title: 'dinner',
      due_date: '2026-09-06',
      due_time: '20:00',
    })
    // An explicit time still wins.
    expect(parse('dinner tonight 9pm').due_time).toBe('21:00')
  })

  it('reads day-first numeric dates', () => {
    expect(parse('pay rent 1/10').due_date).toBe('2026-10-01')
    expect(parse('pay rent 1/10/27').due_date).toBe('2027-10-01')
    expect(parse('pay rent 2026-12-01').due_date).toBe('2026-12-01')
  })

  it('rolls a bare day/month forward when it has passed', () => {
    // 1 September is behind us, so it means next year.
    expect(parse('pay rent 1/9').due_date).toBe('2027-09-01')
  })

  it('reads month names either way round', () => {
    expect(parse('call mom sep 12').due_date).toBe('2026-09-12')
    expect(parse('call mom 12 sep').due_date).toBe('2026-09-12')
    expect(parse('call mom 12th september').due_date).toBe('2026-09-12')
  })

  it('reads times in several shapes', () => {
    expect(parse('standup 9am').due_time).toBe('09:00')
    expect(parse('standup at 9:30am').due_time).toBe('09:30')
    expect(parse('sync 17:30').due_time).toBe('17:30')
    expect(parse('lunch noon').due_time).toBe('12:00')
    expect(parse('deploy midnight').due_time).toBe('00:00')
    expect(parse('call at 5').due_time).toBe('17:00')
    expect(parse('call at 10').due_time).toBe('10:00')
  })

  it('does not invent a time from a bare number', () => {
    expect(parse('buy 5 apples').due_time).toBeNull()
    expect(parse('read chapter 12').due_time).toBeNull()
  })

  it('collects priorities and multiple tags', () => {
    expect(parse('standup today at 9am #work #team')).toEqual({
      title: 'standup',
      due_date: '2026-09-06',
      due_time: '09:00',
      priority: 0,
      tags: ['work', 'team'],
      rrule: null,
    })
    expect(parse('urgent thing !p1').priority).toBe(1)
    expect(parse('someday thing !p3').priority).toBe(3)
    expect(parse('clear it !p0').priority).toBe(0)
    expect(parse('short form !2').priority).toBe(2)
  })

  it('ignores impossible dates and leaves them in the title', () => {
    expect(parse('order 32/13')).toEqual({
      title: 'order 32/13',
      due_date: null,
      due_time: null,
      priority: 0,
      tags: [],
      rrule: null,
    })
    expect(parse('feb 30 party').due_date).toBeNull()
  })

  it('keeps the raw text when nothing but tokens were typed', () => {
    expect(parse('tomorrow').title).toBe('tomorrow')
  })

  it('reads recurrence, and does not mistake it for a due date', () => {
    expect(parse('standup every monday')).toMatchObject({
      title: 'standup',
      rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
      due_date: null,
    })
    expect(parse('water plants every 3 days')).toMatchObject({
      title: 'water plants',
      rrule: 'RRULE:FREQ=DAILY;INTERVAL=3',
    })
    expect(parse('file gst every month !p1 #finance')).toMatchObject({
      title: 'file gst',
      rrule: 'RRULE:FREQ=MONTHLY',
      priority: 1,
      tags: ['finance'],
    })
  })

  it('keeps an explicit due date alongside a repeat', () => {
    expect(parse('rent every month 1/10')).toMatchObject({
      title: 'rent',
      rrule: 'RRULE:FREQ=MONTHLY',
      due_date: '2026-10-01',
    })
  })

  it('takes the first date and first time when several are present', () => {
    const result = parse('move meeting tomorrow 5pm not friday 6pm')
    expect(result.due_date).toBe('2026-09-07')
    expect(result.due_time).toBe('17:00')
    expect(result.title).toBe('move meeting not friday 6pm')
  })
})
