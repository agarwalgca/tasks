import Dexie, { type Table } from 'dexie'
import type {
  Client,
  ConflictRecord,
  List,
  OutboxEntry,
  Profile,
  Reminder,
  SavedFilter,
  Tag,
  Task,
  TaskTag,
} from './types'

export interface MetaRow {
  key: string
  value: unknown
}

export const META_DEVICE_ID = 'device_id'
export const META_LAST_PULLED_AT = 'last_pulled_at'
export const META_USER_ID = 'user_id'

/**
 * The local working copy. Every table mirrors its Postgres counterpart
 * column-for-column; `outbox`, `conflicts` and `meta` are local-only.
 *
 * deleted_at is deliberately not indexed — IndexedDB skips null keys, so
 * "not deleted" is a filter rather than a lookup.
 */
export class AppDatabase extends Dexie {
  profiles!: Table<Profile, string>
  clients!: Table<Client, string>
  lists!: Table<List, string>
  tags!: Table<Tag, string>
  tasks!: Table<Task, string>
  task_tags!: Table<TaskTag, string>
  reminders!: Table<Reminder, string>
  saved_filters!: Table<SavedFilter, string>
  outbox!: Table<OutboxEntry, number>
  conflicts!: Table<ConflictRecord, string>
  meta!: Table<MetaRow, string>

  constructor(name = 'tasks') {
    super(name)
    this.version(1).stores({
      profiles: 'id, updated_at',
      clients: 'id, updated_at',
      lists: 'id, updated_at, parent_list_id, sort_order',
      tags: 'id, updated_at, name',
      tasks: 'id, updated_at, list_id, parent_task_id, status, due_date, sort_order',
      task_tags: 'id, updated_at, task_id, tag_id',
      reminders: 'id, updated_at, task_id',
      outbox: '++seq, table, [table+row_id], queued_at',
      conflicts: 'id, detected_at, reviewed_at',
      meta: 'key',
    })

    this.version(2).stores({
      saved_filters: 'id, updated_at, sort_order',
    })
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const row = await this.meta.get(key)
    return row?.value as T | undefined
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.meta.put({ key, value })
  }
}

export const db = new AppDatabase()
