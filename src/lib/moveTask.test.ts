import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createList, createTask, moveTask } from './mutations'
import { setCurrentUserId } from './session'

const USER = '00000000-0000-4000-8000-000000000001'

async function reset() {
  await Promise.all([db.tasks.clear(), db.lists.clear(), db.outbox.clear()])
}

beforeEach(async () => {
  setCurrentUserId(USER)
  await reset()
})
afterEach(reset)

describe('moveTask', () => {
  it('moves a task between lists', async () => {
    const work = await createList('Work')
    const home = await createList('Home')
    const task = await createTask({ title: 'file GST', list_id: work.id })

    await moveTask(task.id, home.id)

    expect((await db.tasks.get(task.id))!.list_id).toBe(home.id)
  })

  it('moves to the Inbox when the target is null', async () => {
    const work = await createList('Work')
    const task = await createTask({ list_id: work.id })

    await moveTask(task.id, null)

    expect((await db.tasks.get(task.id))!.list_id).toBeNull()
  })

  it('takes the subtasks along', async () => {
    const work = await createList('Work')
    const home = await createList('Home')
    const parent = await createTask({ title: 'file GST', list_id: work.id })
    const a = await createTask({ title: 'invoices', parent_task_id: parent.id, list_id: work.id })
    const b = await createTask({ title: 'ledger', parent_task_id: parent.id, list_id: work.id })

    await moveTask(parent.id, home.id)

    for (const id of [parent.id, a.id, b.id]) {
      expect((await db.tasks.get(id))!.list_id).toBe(home.id)
    }
  })

  it('moving a subtask moves the family it belongs to', async () => {
    const work = await createList('Work')
    const home = await createList('Home')
    const parent = await createTask({ list_id: work.id })
    const child = await createTask({ parent_task_id: parent.id, list_id: work.id })

    await moveTask(child.id, home.id)

    expect((await db.tasks.get(parent.id))!.list_id).toBe(home.id)
    expect((await db.tasks.get(child.id))!.list_id).toBe(home.id)
  })

  it('brings back a subtask that an older move left behind', async () => {
    const work = await createList('Work')
    const home = await createList('Home')
    const parent = await createTask({ list_id: home.id })
    const stray = await createTask({ parent_task_id: parent.id, list_id: work.id })

    await moveTask(parent.id, home.id)

    expect((await db.tasks.get(stray.id))!.list_id).toBe(home.id)
  })

  it('queues one sync write per row that actually changed', async () => {
    const work = await createList('Work')
    const home = await createList('Home')
    const parent = await createTask({ list_id: work.id })
    await createTask({ parent_task_id: parent.id, list_id: work.id })
    await createTask({ parent_task_id: parent.id, list_id: home.id })
    await db.outbox.clear()

    await moveTask(parent.id, home.id)

    // The parent and the one child still in Work; the child already in Home is
    // left untouched.
    expect(await db.outbox.count()).toBe(2)
  })

  it('leaves deleted subtasks alone', async () => {
    const work = await createList('Work')
    const home = await createList('Home')
    const parent = await createTask({ list_id: work.id })
    const gone = await createTask({
      parent_task_id: parent.id,
      list_id: work.id,
      deleted_at: '2026-10-01T00:00:00.000Z',
    })

    await moveTask(parent.id, home.id)

    expect((await db.tasks.get(gone.id))!.list_id).toBe(work.id)
  })
})
