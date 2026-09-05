import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppDatabase, META_LAST_PULLED_AT } from '@/lib/db'
import type { Task } from '@/lib/types'
import { FakeServer, FakeTransport } from '@/test/fakeServer'
import { SyncEngine } from './engine'
import { writeRow } from './writes'

const USER = '00000000-0000-4000-8000-000000000001'

function makeTask(id: string, at: string, patch: Partial<Task> = {}): Task {
  return {
    id,
    user_id: USER,
    list_id: null,
    parent_task_id: null,
    title: 'task',
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
    created_at: at,
    updated_at: at,
    deleted_at: null,
    ...patch,
  }
}

interface Device {
  db: AppDatabase
  engine: SyncEngine
  transport: FakeTransport
}

let server: FakeServer
const opened: AppDatabase[] = []

function device(name: string): Device {
  const db = new AppDatabase(name)
  opened.push(db)
  const transport = new FakeTransport(server)
  return { db, engine: new SyncEngine(db, transport), transport }
}

async function snapshot(db: AppDatabase) {
  return {
    tasks: await db.tasks.orderBy('id').toArray(),
    outbox: await db.outbox.orderBy('seq').toArray(),
    conflicts: await db.conflicts.count(),
    watermark: await db.getMeta<string>(META_LAST_PULLED_AT),
  }
}

beforeEach(() => {
  server = new FakeServer()
})

afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close()
    await Dexie.delete(db.name)
  }
})

describe('offline queue', () => {
  it('survives a reload and pushes once the network is back', async () => {
    const a = device('reload-test')
    a.transport.online = false

    await writeRow(a.db, 'tasks', makeTask('t1', '2026-09-06T10:00:00.000Z'))
    await writeRow(a.db, 'tasks', makeTask('t2', '2026-09-06T10:00:01.000Z'))
    await expect(a.engine.sync()).rejects.toThrow('offline')
    expect(await a.engine.pendingCount()).toBe(2)

    // Reopen the same IndexedDB database, as a page reload would.
    a.db.close()
    const reopened = new AppDatabase('reload-test')
    opened.push(reopened)
    const transport = new FakeTransport(server)
    const engine = new SyncEngine(reopened, transport)

    expect(await engine.pendingCount()).toBe(2)
    expect(await reopened.tasks.count()).toBe(2)

    const result = await engine.sync()
    expect(result.pushed).toBe(2)
    expect(await engine.pendingCount()).toBe(0)
    expect(server.get('tasks', 't1')).toBeTruthy()
    expect(server.get('tasks', 't2')).toBeTruthy()
  })

  it('coalesces repeated edits of one row into a single push', async () => {
    const a = device('coalesce-test')
    a.transport.online = false
    const base = makeTask('t1', '2026-09-06T10:00:00.000Z')
    await writeRow(a.db, 'tasks', base)
    await writeRow(a.db, 'tasks', {
      ...base,
      title: 'second',
      updated_at: '2026-09-06T10:00:05.000Z',
    })
    await writeRow(a.db, 'tasks', {
      ...base,
      title: 'third',
      updated_at: '2026-09-06T10:00:09.000Z',
    })
    expect(await a.engine.pendingCount()).toBe(1)

    a.transport.online = true
    const result = await a.engine.sync()
    expect(result.pushed).toBe(1)
    expect((server.get('tasks', 't1') as Task).title).toBe('third')
  })
})

describe('conflict resolution', () => {
  it('keeps the later updated_at and records the discarded local edit', async () => {
    const a = device('conflict-a')
    const b = device('conflict-b')

    await writeRow(a.db, 'tasks', makeTask('t1', '2026-09-06T10:00:00.000Z'))
    await a.engine.sync()
    await b.engine.sync()
    expect((await b.db.tasks.get('t1'))!.title).toBe('task')

    // Both devices edit the same row while apart.
    a.transport.online = false
    b.transport.online = false
    await writeRow(a.db, 'tasks', {
      ...(await a.db.tasks.get('t1'))!,
      title: 'edited on laptop',
      updated_at: '2026-09-06T11:00:00.000Z',
    })
    await writeRow(b.db, 'tasks', {
      ...(await b.db.tasks.get('t1'))!,
      title: 'edited on phone',
      updated_at: '2026-09-06T11:05:00.000Z',
    })

    // The phone's later edit reaches the server first, then the laptop syncs.
    b.transport.online = true
    await b.engine.sync()
    a.transport.online = true
    const result = await a.engine.sync()

    expect((server.get('tasks', 't1') as Task).title).toBe('edited on phone')
    expect((await a.db.tasks.get('t1'))!.title).toBe('edited on phone')
    expect(result.conflicts).toBe(1)

    const conflicts = await a.db.conflicts.toArray()
    expect(conflicts).toHaveLength(1)
    expect((conflicts[0].local as Task).title).toBe('edited on laptop')
    expect((conflicts[0].remote as Task).title).toBe('edited on phone')
    expect(conflicts[0].reviewed_at).toBeNull()
  })

  it('keeps the local edit when it is the later one, without a conflict', async () => {
    const a = device('conflict-newer-a')
    const b = device('conflict-newer-b')

    await writeRow(a.db, 'tasks', makeTask('t1', '2026-09-06T10:00:00.000Z'))
    await a.engine.sync()
    await b.engine.sync()

    await writeRow(b.db, 'tasks', {
      ...(await b.db.tasks.get('t1'))!,
      title: 'older remote edit',
      updated_at: '2026-09-06T11:00:00.000Z',
    })
    await b.engine.sync()

    await writeRow(a.db, 'tasks', {
      ...(await a.db.tasks.get('t1'))!,
      title: 'newer local edit',
      updated_at: '2026-09-06T12:00:00.000Z',
    })
    const result = await a.engine.sync()

    expect(result.conflicts).toBe(0)
    expect(await a.db.conflicts.count()).toBe(0)
    expect((await a.db.tasks.get('t1'))!.title).toBe('newer local edit')
    expect((server.get('tasks', 't1') as Task).title).toBe('newer local edit')

    await b.engine.sync()
    expect((await b.db.tasks.get('t1'))!.title).toBe('newer local edit')
  })

  it('ignores a stale push instead of clobbering the newer row', async () => {
    const a = device('stale-a')
    const b = device('stale-b')

    await writeRow(a.db, 'tasks', makeTask('t1', '2026-09-06T10:00:00.000Z'))
    await a.engine.sync()
    await b.engine.sync()

    await writeRow(b.db, 'tasks', {
      ...(await b.db.tasks.get('t1'))!,
      title: 'newer',
      updated_at: '2026-09-06T12:00:00.000Z',
    })
    await b.engine.sync()

    // The laptop was offline while it made an older edit, and pushes late.
    await writeRow(a.db, 'tasks', {
      ...(await a.db.tasks.get('t1'))!,
      title: 'stale',
      updated_at: '2026-09-06T11:00:00.000Z',
    })
    await a.engine.sync()

    expect((server.get('tasks', 't1') as Task).title).toBe('newer')
    expect((await a.db.tasks.get('t1'))!.title).toBe('newer')
  })
})

describe('soft delete', () => {
  it('propagates to the other device as a deletion', async () => {
    const a = device('delete-a')
    const b = device('delete-b')

    await writeRow(a.db, 'tasks', makeTask('t1', '2026-09-06T10:00:00.000Z'))
    await a.engine.sync()
    await b.engine.sync()
    expect((await b.db.tasks.get('t1'))!.deleted_at).toBeNull()

    await writeRow(a.db, 'tasks', {
      ...(await a.db.tasks.get('t1'))!,
      deleted_at: '2026-09-06T13:00:00.000Z',
      updated_at: '2026-09-06T13:00:00.000Z',
    })
    await a.engine.sync()
    await b.engine.sync()

    const onB = await b.db.tasks.get('t1')
    expect(onB!.deleted_at).toBe('2026-09-06T13:00:00.000Z')
    // The row is still there, which is what later syncs depend on.
    expect(await b.db.tasks.count()).toBe(1)
    expect(await b.db.tasks.filter((t) => !t.deleted_at).count()).toBe(0)
  })
})

describe('a pull with no changes', () => {
  it('is a no-op', async () => {
    const a = device('noop-a')
    const b = device('noop-b')

    await writeRow(a.db, 'tasks', makeTask('t1', '2026-09-06T10:00:00.000Z'))
    await a.engine.sync()
    await b.engine.sync()

    const before = await snapshot(b.db)
    const result = await b.engine.sync()
    const after = await snapshot(b.db)

    expect(result).toEqual({
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      watermark: before.watermark,
    })
    expect(after).toEqual(before)
  })
})
