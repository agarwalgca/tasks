import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createTask, setTaskStatus, setTaskTags, ensureTags } from './mutations'
import { setCurrentUserId } from './session'
import { todayISO } from './time'
import type { Task } from './types'

const USER = '00000000-0000-4000-8000-000000000001'

const open = (id: string) => db.tasks.get(id) as Promise<Task>
const seriesTasks = async (seriesId: string) =>
  (await db.tasks.toArray())
    .filter((t) => t.recurrence_series_id === seriesId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

beforeEach(async () => {
  setCurrentUserId(USER)
  await Promise.all([db.tasks.clear(), db.tags.clear(), db.task_tags.clear(), db.outbox.clear()])
})

afterEach(async () => {
  await Promise.all([db.tasks.clear(), db.tags.clear(), db.task_tags.clear(), db.outbox.clear()])
})

describe('completing a recurring task', () => {
  it('leaves the completed one and creates the next', async () => {
    const task = await createTask({
      title: 'file GST return',
      due_date: '2026-09-20',
      rrule: 'RRULE:FREQ=MONTHLY',
      recurrence_anchor: 'due_date',
    })

    await setTaskStatus(await open(task.id), true)

    const done = await open(task.id)
    expect(done.status).toBe('done')
    expect(done.completed_at).not.toBeNull()

    const series = await seriesTasks(task.id)
    expect(series).toHaveLength(2)
    const next = series.find((t) => t.id !== task.id)!
    expect(next.status).toBe('todo')
    expect(next.due_date).toBe('2026-10-20')
    expect(next.title).toBe('file GST return')
    expect(next.source).toBe('recurrence')
    expect(next.rrule).toBe('RRULE:FREQ=MONTHLY')
  })

  it('links both occurrences into one series', async () => {
    const task = await createTask({
      due_date: '2026-09-20',
      rrule: 'RRULE:FREQ=MONTHLY',
      recurrence_anchor: 'due_date',
    })
    await setTaskStatus(await open(task.id), true)

    const series = await seriesTasks(task.id)
    expect(series).toHaveLength(2)
    expect(series.every((t) => t.recurrence_series_id === task.id)).toBe(true)
  })

  it('carries the tags across', async () => {
    const task = await createTask({
      due_date: '2026-09-20',
      rrule: 'RRULE:FREQ=MONTHLY',
      recurrence_anchor: 'due_date',
    })
    const [tag] = await ensureTags(['finance'])
    await setTaskTags(task.id, [tag.id])

    await setTaskStatus(await open(task.id), true)

    const next = (await seriesTasks(task.id)).find((t) => t.id !== task.id)!
    const links = (await db.task_tags.toArray()).filter(
      (l) => l.task_id === next.id && !l.deleted_at,
    )
    expect(links.map((l) => l.tag_id)).toEqual([tag.id])
  })

  it('recreates subtasks unticked', async () => {
    const task = await createTask({
      due_date: '2026-09-20',
      rrule: 'RRULE:FREQ=MONTHLY',
      recurrence_anchor: 'due_date',
    })
    const child = await createTask({ title: 'download invoices', parent_task_id: task.id })
    await setTaskStatus(await open(child.id), true)

    await setTaskStatus(await open(task.id), true)

    const next = (await seriesTasks(task.id)).find((t) => t.id !== task.id)!
    const children = (await db.tasks.toArray()).filter(
      (t) => t.parent_task_id === next.id,
    )
    expect(children).toHaveLength(1)
    expect(children[0].title).toBe('download invoices')
    expect(children[0].status).toBe('todo')
  })

  it('measures from the completion day when anchored that way', async () => {
    const task = await createTask({
      due_date: '2026-09-01',
      rrule: 'RRULE:FREQ=DAILY;INTERVAL=3',
      recurrence_anchor: 'completion_date',
    })
    await setTaskStatus(await open(task.id), true)

    const next = (await db.tasks.toArray()).find((t) => t.id !== task.id)!
    const expected = new Date(Date.parse(`${todayISO()}T00:00:00Z`) + 3 * 86_400_000)
    expect(next.due_date).toBe(expected.toISOString().slice(0, 10))
  })

  it('keeps the gap between start and due', async () => {
    const task = await createTask({
      due_date: '2026-09-20',
      start_date: '2026-09-18',
      rrule: 'RRULE:FREQ=MONTHLY',
      recurrence_anchor: 'due_date',
    })
    await setTaskStatus(await open(task.id), true)

    const next = (await seriesTasks(task.id)).find((t) => t.id !== task.id)!
    expect(next.due_date).toBe('2026-10-20')
    expect(next.start_date).toBe('2026-10-18')
  })

  it('does not spawn anything for a one-off task', async () => {
    const task = await createTask({ title: 'buy milk', due_date: '2026-09-20' })
    await setTaskStatus(await open(task.id), true)
    expect(await db.tasks.count()).toBe(1)
  })

  it('does not spawn when a due-date anchor has no date to advance', async () => {
    const task = await createTask({
      rrule: 'RRULE:FREQ=MONTHLY',
      recurrence_anchor: 'due_date',
      due_date: null,
    })
    await setTaskStatus(await open(task.id), true)
    expect(await db.tasks.count()).toBe(1)
    expect((await open(task.id)).status).toBe('done')
  })

  it('does not spawn again when un-completing and re-completing', async () => {
    const task = await createTask({
      due_date: '2026-09-20',
      rrule: 'RRULE:FREQ=MONTHLY',
      recurrence_anchor: 'due_date',
    })
    await setTaskStatus(await open(task.id), true)
    expect(await db.tasks.count()).toBe(2)

    await setTaskStatus(await open(task.id), false)
    expect(await db.tasks.count()).toBe(2)

    await setTaskStatus(await open(task.id), true)
    expect(await db.tasks.count()).toBe(3)
  })
})
