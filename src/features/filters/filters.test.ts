import { describe, expect, it } from 'vitest'
import type { Task } from '@/lib/types'
import { describeCriteria, matchesFilter, type FilterContext } from './filters'

// Noon IST on 2026-09-10.
const NOW = new Date('2026-09-10T06:30:00Z')

function task(patch: Partial<Task> = {}): Task {
  return {
    id: 't1',
    user_id: 'u',
    list_id: null,
    parent_task_id: null,
    title: 'call the bank',
    notes: null,
    status: 'todo',
    priority: 0,
    due_date: null,
    due_time: null,
    start_date: null,
    estimate_minutes: null,
    completed_at: null,
    sort_order: 0,
    rrule: null,
    recurrence_anchor: null,
    recurrence_series_id: null,
    client_id: null,
    source: 'manual',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    deleted_at: null,
    ...patch,
  }
}

const context = (patch: Partial<FilterContext> = {}): FilterContext => ({
  tagsByTask: new Map(),
  textByTask: new Map(),
  now: NOW,
  ...patch,
})

describe('matchesFilter', () => {
  it('empty criteria match every open task', () => {
    expect(matchesFilter(task(), {}, context())).toBe(true)
    expect(matchesFilter(task({ status: 'done' }), {}, context())).toBe(false)
  })

  it('can include completed tasks', () => {
    expect(
      matchesFilter(task({ status: 'done' }), { includeCompleted: true }, context()),
    ).toBe(true)
  })

  it('filters on the due window', () => {
    const overdue = task({ due_date: '2026-09-08' })
    const today = task({ due_date: '2026-09-10' })
    const soon = task({ due_date: '2026-09-15' })
    const far = task({ due_date: '2026-12-01' })
    const undated = task()

    expect(matchesFilter(overdue, { due: 'overdue' }, context())).toBe(true)
    expect(matchesFilter(today, { due: 'overdue' }, context())).toBe(false)
    expect(matchesFilter(today, { due: 'today' }, context())).toBe(true)
    expect(matchesFilter(overdue, { due: 'today' }, context())).toBe(true)
    expect(matchesFilter(soon, { due: 'next7' }, context())).toBe(true)
    expect(matchesFilter(far, { due: 'next7' }, context())).toBe(false)
    expect(matchesFilter(undated, { due: 'none' }, context())).toBe(true)
    expect(matchesFilter(today, { due: 'none' }, context())).toBe(false)
    expect(matchesFilter(undated, { due: 'overdue' }, context())).toBe(false)
  })

  it('treats several priorities as "any of"', () => {
    expect(matchesFilter(task({ priority: 1 }), { priorities: [1, 2] }, context())).toBe(
      true,
    )
    expect(matchesFilter(task({ priority: 3 }), { priorities: [1, 2] }, context())).toBe(
      false,
    )
    expect(matchesFilter(task({ priority: 3 }), { priorities: [] }, context())).toBe(true)
  })

  it('filters on list and client', () => {
    expect(matchesFilter(task({ list_id: 'l1' }), { listIds: ['l1'] }, context())).toBe(
      true,
    )
    expect(matchesFilter(task({ list_id: null }), { listIds: ['l1'] }, context())).toBe(
      false,
    )
    expect(
      matchesFilter(task({ client_id: 'c1' }), { clientIds: ['c1'] }, context()),
    ).toBe(true)
  })

  it('matches any of the chosen tags', () => {
    const ctx = context({ tagsByTask: new Map([['t1', ['work', 'urgent']]]) })
    expect(matchesFilter(task(), { tagIds: ['work'] }, ctx)).toBe(true)
    expect(matchesFilter(task(), { tagIds: ['home', 'urgent'] }, ctx)).toBe(true)
    expect(matchesFilter(task(), { tagIds: ['home'] }, ctx)).toBe(false)
  })

  it('matches text against the prepared haystack', () => {
    const ctx = context({ textByTask: new Map([['t1', 'call the bank about the loan']]) })
    expect(matchesFilter(task(), { text: 'loan' }, ctx)).toBe(true)
    expect(matchesFilter(task(), { text: 'LOAN' }, ctx)).toBe(true)
    expect(matchesFilter(task(), { text: 'dentist' }, ctx)).toBe(false)
  })

  it('requires every criterion to hold at once', () => {
    const ctx = context({ tagsByTask: new Map([['t1', ['work']]]) })
    const subject = task({ priority: 1, due_date: '2026-09-08', list_id: 'l1' })
    expect(
      matchesFilter(
        subject,
        { due: 'overdue', priorities: [1], listIds: ['l1'], tagIds: ['work'] },
        ctx,
      ),
    ).toBe(true)
    // One criterion off is enough to exclude it.
    expect(
      matchesFilter(
        subject,
        { due: 'overdue', priorities: [2], listIds: ['l1'], tagIds: ['work'] },
        ctx,
      ),
    ).toBe(false)
  })
})

describe('describeCriteria', () => {
  it('summarises in one line', () => {
    expect(describeCriteria({})).toBe('everything open')
    expect(describeCriteria({ due: 'overdue', priorities: [1] })).toBe('overdue · P1')
    expect(describeCriteria({ priorities: [0] })).toBe('no priority')
    expect(describeCriteria({ text: ' bank ' })).toBe('"bank"')
    expect(describeCriteria({ due: 'next7', includeCompleted: true })).toBe(
      'due within 7 days · including completed',
    )
  })
})
