import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createSharedQuery } from './live'
import type { Tag } from './types'

const USER = '00000000-0000-4000-8000-000000000001'

function tag(id: string): Tag {
  const at = '2026-09-06T10:00:00.000Z'
  return { id, user_id: USER, name: id, color: null, created_at: at, updated_at: at, deleted_at: null }
}

async function until(check: () => boolean, ms = 2_000): Promise<void> {
  const deadline = Date.now() + ms
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out waiting')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50))

beforeEach(() => db.tags.clear())
afterEach(() => db.tags.clear())

describe('createSharedQuery', () => {
  it('runs the query once per change for any number of subscribers', async () => {
    let runs = 0
    const query = createSharedQuery(async () => {
      runs += 1
      return (await db.tags.toArray()).map((t) => t.id).sort()
    }, [] as string[])

    const notified: string[][] = []
    const stopA = query.subscribe(() => notified.push(query.getSnapshot()))
    const stopB = query.subscribe(() => {})
    await until(() => runs === 1)
    await settle()
    expect(runs).toBe(1)

    await db.tags.add(tag('work'))
    await until(() => query.getSnapshot().includes('work'))
    expect(notified.at(-1)).toEqual(['work'])
    expect(runs).toBe(2)

    stopA()
    stopB()
  })

  it('stops observing once the last subscriber leaves, but keeps the last value', async () => {
    let runs = 0
    const query = createSharedQuery(async () => {
      runs += 1
      return db.tags.count()
    }, -1)

    const stop = query.subscribe(() => {})
    await until(() => query.getSnapshot() === 0)
    stop()

    await db.tags.add(tag('home'))
    await settle()
    expect(runs).toBe(1)
    expect(query.getSnapshot()).toBe(0)

    // A fresh subscriber gets the stale value immediately and a fresh one soon after.
    const stopAgain = query.subscribe(() => {})
    expect(query.getSnapshot()).toBe(0)
    await until(() => query.getSnapshot() === 1)
    stopAgain()
  })
})
