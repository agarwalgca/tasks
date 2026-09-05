import type { Table } from 'dexie'
import { type AppDatabase, db as defaultDb } from '@/lib/db'
import { nowISO } from '@/lib/time'
import { emitLocalChange } from './bus'
import type { AnyRow, RowTypes, SyncTable } from '@/lib/types'

/**
 * One queued entry per row: a later edit replaces the earlier one, so a row
 * edited ten times offline still pushes once.
 */
export async function enqueue(
  db: AppDatabase,
  table: SyncTable,
  row: AnyRow,
): Promise<void> {
  await db.outbox.where('[table+row_id]').equals([table, row.id]).delete()
  await db.outbox.add({ table, row_id: row.id, row, queued_at: nowISO() })
}

/** Write locally and queue for push. The caller never waits on the network. */
export async function writeRow<T extends SyncTable>(
  db: AppDatabase,
  table: T,
  row: RowTypes[T],
): Promise<RowTypes[T]> {
  await db.transaction('rw', db.table(table) as Table, db.outbox, async () => {
    await (db.table(table) as Table).put(row)
    await enqueue(db, table, row)
  })
  emitLocalChange()
  return row
}

export async function writeRows<T extends SyncTable>(
  db: AppDatabase,
  table: T,
  rows: RowTypes[T][],
): Promise<void> {
  await db.transaction('rw', db.table(table) as Table, db.outbox, async () => {
    for (const row of rows) {
      await (db.table(table) as Table).put(row)
      await enqueue(db, table, row)
    }
  })
  emitLocalChange()
}

/** Stamps the edit time that last-write-wins is resolved on. */
export function revise<T extends AnyRow>(row: T, patch: Partial<T>): T {
  return { ...row, ...patch, updated_at: nowISO() }
}

export async function softDelete<T extends SyncTable>(
  db: AppDatabase,
  table: T,
  id: string,
): Promise<void> {
  const row = (await (db.table(table) as Table).get(id)) as RowTypes[T] | undefined
  if (!row) return
  const at = nowISO()
  await writeRow(db, table, { ...row, deleted_at: at, updated_at: at })
}

export const putLocal = <T extends SyncTable>(table: T, row: RowTypes[T]) =>
  writeRow(defaultDb, table, row)

export const putLocalMany = <T extends SyncTable>(table: T, rows: RowTypes[T][]) =>
  writeRows(defaultDb, table, rows)

export const deleteLocal = <T extends SyncTable>(table: T, id: string) =>
  softDelete(defaultDb, table, id)
