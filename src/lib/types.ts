export type TaskStatus = 'todo' | 'doing' | 'done' | 'cancelled'
export type RecurrenceAnchor = 'due_date' | 'completion_date'
export type TaskSource = 'manual' | 'recurrence'
export type ReminderChannel = 'push' | 'email'

/** Columns every synced table carries. */
export interface BaseRow {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Profile extends BaseRow {
  display_name: string | null
  timezone: string
}

export interface Client extends BaseRow {
  user_id: string
  name: string
  notes: string | null
  is_active: boolean
}

export interface List extends BaseRow {
  user_id: string
  name: string
  color: string | null
  icon: string | null
  parent_list_id: string | null
  sort_order: number
  is_archived: boolean
}

export interface Tag extends BaseRow {
  user_id: string
  name: string
  color: string | null
}

export interface Task extends BaseRow {
  user_id: string
  list_id: string | null
  parent_task_id: string | null
  title: string
  notes: string | null
  status: TaskStatus
  priority: number
  /** 'YYYY-MM-DD', read in Asia/Kolkata. */
  due_date: string | null
  /** 'HH:MM:SS', read in Asia/Kolkata. */
  due_time: string | null
  start_date: string | null
  estimate_minutes: number | null
  completed_at: string | null
  sort_order: number
  rrule: string | null
  recurrence_anchor: RecurrenceAnchor | null
  recurrence_series_id: string | null
  client_id: string | null
  source: TaskSource
}

export interface TaskTag extends BaseRow {
  user_id: string
  task_id: string
  tag_id: string
}

export interface Reminder extends BaseRow {
  user_id: string
  task_id: string
  offset_minutes: number | null
  absolute_at: string | null
  channel: ReminderChannel
  fired_at: string | null
}

/** Criteria are read and written only here, so they live in one jsonb blob. */
export interface FilterCriteria {
  text?: string
  /** 'any' | 'overdue' | 'today' | 'next7' | 'none' */
  due?: 'any' | 'overdue' | 'today' | 'next7' | 'none'
  priorities?: number[]
  listIds?: string[]
  clientIds?: string[]
  tagIds?: string[]
  includeCompleted?: boolean
}

export interface SavedFilter extends BaseRow {
  user_id: string
  name: string
  criteria: FilterCriteria
  sort_order: number
}

export interface RowTypes {
  profiles: Profile
  clients: Client
  lists: List
  tags: Tag
  tasks: Task
  task_tags: TaskTag
  reminders: Reminder
  saved_filters: SavedFilter
}

export type SyncTable = keyof RowTypes
export type AnyRow = RowTypes[SyncTable]

/**
 * Pull order matters on a first sync: parents land before the rows that
 * reference them.
 */
export const SYNC_TABLES: SyncTable[] = [
  'profiles',
  'clients',
  'lists',
  'tags',
  'tasks',
  'task_tags',
  'reminders',
  'saved_filters',
]

/** Rows waiting to be pushed. Coalesced by (table, row_id) at push time. */
export interface OutboxEntry {
  seq?: number
  table: SyncTable
  row_id: string
  row: AnyRow
  queued_at: string
}

/** A local edit that lost to a newer remote one. Surfaced, never dropped. */
export interface ConflictRecord {
  id: string
  table: SyncTable
  row_id: string
  title: string
  local: AnyRow
  remote: AnyRow
  detected_at: string
  reviewed_at: string | null
}
