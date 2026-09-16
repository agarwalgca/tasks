import type { Table } from 'dexie'
import { db } from './db'
import { newId } from './ids'
import { requireUserId } from './session'
import { nowISO, todayISO } from './time'
import type {
  Client,
  List,
  RowTypes,
  SavedFilter,
  SyncTable,
  Tag,
  Task,
  TaskTag,
} from './types'
import { firstOccurrenceFrom, nextDueDate } from '@/features/recurrence/recurrence'
import type { ParsedQuickAdd } from '@/features/quickadd/parse'
import { deleteLocal, putLocal, putLocalMany, revise } from '@/sync/writes'

/**
 * New rows land at the top: one below the lowest sort_order in the table, read
 * straight off its index rather than by scanning the rows.
 */
async function topOrder<T extends { sort_order: number }>(
  table: Table<T, string>,
): Promise<number> {
  const lowest = await table.orderBy('sort_order').first()
  return lowest ? lowest.sort_order - 1 : 0
}

/** Applies one patch to every row in a single transaction; nothing for none. */
async function reviseMany<T extends SyncTable>(
  table: T,
  rows: RowTypes[T][],
  patch: Partial<RowTypes[T]>,
): Promise<void> {
  if (rows.length === 0) return
  await putLocalMany(table, rows.map((row) => revise(row, patch)))
}

export async function createTask(patch: Partial<Task> = {}): Promise<Task> {
  const at = nowISO()
  const task: Task = {
    id: newId(),
    user_id: requireUserId(),
    list_id: null,
    parent_task_id: null,
    title: 'Untitled',
    notes: null,
    status: 'todo',
    priority: 0,
    due_date: null,
    due_time: null,
    start_date: null,
    estimate_minutes: null,
    completed_at: null,
    sort_order: await topOrder(db.tasks),
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
  await putLocal('tasks', task)
  return task
}

export async function updateTask(task: Task, patch: Partial<Task>): Promise<Task> {
  return putLocal('tasks', revise(task, patch))
}

export async function setTaskStatus(task: Task, done: boolean): Promise<void> {
  // Spawning stamps a series id on the original, so carry that forward rather
  // than writing the stale copy back over it.
  const current =
    done && task.rrule && task.status !== 'done'
      ? await spawnNextOccurrence(task)
      : task

  await updateTask(current, {
    status: done ? 'done' : 'todo',
    completed_at: done ? nowISO() : null,
  })
}

/**
 * Completing a recurring task leaves it completed and creates the next one, so
 * Completed keeps a real history instead of a single row that keeps moving.
 * Tags come across, and subtasks are recreated unticked — a recurring checklist
 * is only useful if its steps come back.
 */
async function spawnNextOccurrence(task: Task): Promise<Task> {
  const completedOn = todayISO()
  const due = nextDueDate(
    task.rrule!,
    task.recurrence_anchor ?? 'due_date',
    task.due_date,
    completedOn,
  )
  if (!due) return task

  const at = nowISO()
  const seriesId = task.recurrence_series_id ?? task.id
  const next: Task = {
    ...task,
    id: newId(),
    status: 'todo',
    completed_at: null,
    due_date: due,
    start_date: shiftStart(task, due),
    source: 'recurrence',
    recurrence_series_id: seriesId,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  }

  await putLocal('tasks', next)

  // The originating task keeps the series id too, so the history stays linked.
  const origin = task.recurrence_series_id
    ? task
    : await putLocal('tasks', revise(task, { recurrence_series_id: seriesId }))

  const links = (await db.task_tags.where('task_id').equals(task.id).toArray()).filter(
    (link) => !link.deleted_at,
  )
  if (links.length > 0) {
    await putLocalMany(
      'task_tags',
      links.map((link) => ({
        ...link,
        id: newId(),
        task_id: next.id,
        created_at: at,
        updated_at: at,
      })),
    )
  }

  const children = (await db.tasks.where('parent_task_id').equals(task.id).toArray())
    .filter((child) => !child.deleted_at)
  if (children.length > 0) {
    await putLocalMany(
      'tasks',
      children.map((child) => ({
        ...child,
        id: newId(),
        parent_task_id: next.id,
        status: 'todo' as const,
        completed_at: null,
        source: 'recurrence' as const,
        created_at: at,
        updated_at: at,
        deleted_at: null,
      })),
    )
  }

  return origin
}

/** Keeps the lead time between start and due the same across occurrences. */
function shiftStart(task: Task, nextDue: string): string | null {
  if (!task.start_date || !task.due_date) return task.start_date
  const lead = Math.round(
    (Date.parse(`${task.due_date}T00:00:00Z`) -
      Date.parse(`${task.start_date}T00:00:00Z`)) /
      86_400_000,
  )
  const shifted = new Date(Date.parse(`${nextDue}T00:00:00Z`) - lead * 86_400_000)
  return shifted.toISOString().slice(0, 10)
}

export async function deleteTask(id: string): Promise<void> {
  const [task, children, links] = await Promise.all([
    db.tasks.get(id),
    db.tasks.where('parent_task_id').equals(id).toArray(),
    db.task_tags.where('task_id').equals(id).toArray(),
  ])
  const at = nowISO()
  const tasks = task ? [...children, task] : children
  await reviseMany('tasks', tasks.filter((t) => !t.deleted_at), { deleted_at: at })
  await reviseMany('task_tags', links.filter((l) => !l.deleted_at), { deleted_at: at })
}

export async function createList(
  name: string,
  parentListId: string | null = null,
): Promise<List> {
  const at = nowISO()
  const list: List = {
    id: newId(),
    user_id: requireUserId(),
    name: name.trim() || 'New list',
    color: null,
    icon: null,
    parent_list_id: parentListId,
    sort_order: await topOrder(db.lists),
    is_archived: false,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  }
  await putLocal('lists', list)
  return list
}

export async function updateList(list: List, patch: Partial<List>): Promise<void> {
  await putLocal('lists', revise(list, patch))
}

/** Deleting a list keeps its tasks; they fall back to the Inbox. */
export async function deleteList(id: string): Promise<void> {
  const [children, tasks] = await Promise.all([
    db.lists.where('parent_list_id').equals(id).toArray(),
    db.tasks.where('list_id').equals(id).toArray(),
  ])
  await reviseMany('lists', children.filter((l) => !l.deleted_at), { parent_list_id: null })
  await reviseMany('tasks', tasks.filter((t) => !t.deleted_at), { list_id: null })
  await deleteLocal('lists', id)
}

export async function createClient(name: string): Promise<Client> {
  const at = nowISO()
  const client: Client = {
    id: newId(),
    user_id: requireUserId(),
    name: name.trim() || 'New client',
    notes: null,
    is_active: true,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  }
  await putLocal('clients', client)
  return client
}

export async function updateClient(
  client: Client,
  patch: Partial<Client>,
): Promise<void> {
  await putLocal('clients', revise(client, patch))
}

/** Deleting a client leaves its tasks alone; they just lose the label. */
export async function deleteClient(id: string): Promise<void> {
  // client_id has no index, so this still walks the table, but only the
  // matching rows are materialised and they are written in one transaction.
  const tasks = await db.tasks.filter((t) => !t.deleted_at && t.client_id === id).toArray()
  await reviseMany('tasks', tasks, { client_id: null })
  await deleteLocal('clients', id)
}

export async function createSavedFilter(name: string): Promise<SavedFilter> {
  const at = nowISO()
  const filter: SavedFilter = {
    id: newId(),
    user_id: requireUserId(),
    name: name.trim() || 'New filter',
    criteria: {},
    sort_order: await topOrder(db.saved_filters),
    created_at: at,
    updated_at: at,
    deleted_at: null,
  }
  await putLocal('saved_filters', filter)
  return filter
}

export async function updateSavedFilter(
  filter: SavedFilter,
  patch: Partial<SavedFilter>,
): Promise<void> {
  await putLocal('saved_filters', revise(filter, patch))
}

export async function deleteSavedFilter(id: string): Promise<void> {
  await deleteLocal('saved_filters', id)
}

export async function ensureTags(names: string[]): Promise<Tag[]> {
  if (names.length === 0) return []
  const userId = requireUserId()
  const existing = (await db.tags.toArray()).filter((t) => !t.deleted_at)
  const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t]))
  const created: Tag[] = []
  const result: Tag[] = []

  for (const raw of names) {
    const name = raw.trim().toLowerCase()
    if (!name) continue
    const found = byName.get(name)
    if (found) {
      result.push(found)
      continue
    }
    const at = nowISO()
    const tag: Tag = {
      id: newId(),
      user_id: userId,
      name,
      color: null,
      created_at: at,
      updated_at: at,
      deleted_at: null,
    }
    byName.set(name, tag)
    created.push(tag)
    result.push(tag)
  }

  if (created.length > 0) await putLocalMany('tags', created)
  return result
}

export async function setTaskTags(taskId: string, tagIds: string[]): Promise<void> {
  const userId = requireUserId()
  const links = await db.task_tags.where('task_id').equals(taskId).toArray()
  const wanted = new Set(tagIds)
  const at = nowISO()
  const writes: TaskTag[] = []

  for (const link of links) {
    const shouldExist = wanted.has(link.tag_id)
    if (shouldExist && link.deleted_at) {
      writes.push({ ...link, deleted_at: null, updated_at: at })
    } else if (!shouldExist && !link.deleted_at) {
      writes.push({ ...link, deleted_at: at, updated_at: at })
    }
    wanted.delete(link.tag_id)
  }

  for (const tagId of wanted) {
    writes.push({
      id: newId(),
      user_id: userId,
      task_id: taskId,
      tag_id: tagId,
      created_at: at,
      updated_at: at,
      deleted_at: null,
    })
  }

  if (writes.length > 0) await putLocalMany('task_tags', writes)
}

export async function createTaskFromQuickAdd(
  parsed: ParsedQuickAdd,
  listId: string | null,
): Promise<Task> {
  const tags = await ensureTags(parsed.tags)
  // "every monday" with no date given should land on the coming Monday.
  const due =
    parsed.due_date ?? (parsed.rrule ? firstOccurrenceFrom(parsed.rrule, todayISO()) : null)

  const task = await createTask({
    title: parsed.title,
    list_id: listId,
    due_date: due,
    due_time: parsed.due_time ? `${parsed.due_time}:00` : null,
    priority: parsed.priority,
    rrule: parsed.rrule,
    recurrence_anchor: parsed.rrule ? 'due_date' : null,
  })
  if (tags.length > 0) await setTaskTags(task.id, tags.map((t) => t.id))
  return task
}

export async function markConflictReviewed(id: string): Promise<void> {
  const record = await db.conflicts.get(id)
  if (record) await db.conflicts.put({ ...record, reviewed_at: nowISO() })
}

/** Puts the discarded version back as the current one, as a fresh edit. */
export async function restoreConflictLocal(id: string): Promise<void> {
  const record = await db.conflicts.get(id)
  if (!record) return
  await putLocal(record.table, { ...record.local, updated_at: nowISO() } as never)
  await markConflictReviewed(id)
}
