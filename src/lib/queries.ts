import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { addDaysISO, todayISO } from './time'
import type { BaseRow, ConflictRecord, List, Tag, Task, TaskTag } from './types'
import type { View } from '@/store/ui'

const alive = <T extends BaseRow>(rows: T[]): T[] => rows.filter((r) => !r.deleted_at)

export const isOpen = (task: Task): boolean =>
  task.status === 'todo' || task.status === 'doing'

/** 1 is the most urgent; 0 means "no priority" and sorts last. */
export const priorityRank = (priority: number): number =>
  priority === 0 ? 4 : priority

export function compareTasks(a: Task, b: Task): number {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date < b.due_date ? -1 : 1
  }
  const rank = priorityRank(a.priority) - priorityRank(b.priority)
  if (rank !== 0) return rank
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
  return a.created_at.localeCompare(b.created_at)
}

export function useLists(): List[] {
  return (
    useLiveQuery(async () => {
      const rows = alive(await db.lists.toArray())
      return rows.sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
      )
    }, []) ?? []
  )
}

export function useTags(): Tag[] {
  return (
    useLiveQuery(async () => {
      const rows = alive(await db.tags.toArray())
      return rows.sort((a, b) => a.name.localeCompare(b.name))
    }, []) ?? []
  )
}

export function useTaskTags(): TaskTag[] {
  return useLiveQuery(async () => alive(await db.task_tags.toArray()), []) ?? []
}

export function useTask(id: string | null): Task | undefined {
  return useLiveQuery(async () => (id ? db.tasks.get(id) : undefined), [id])
}

export function useAllTasks(): Task[] {
  return useLiveQuery(async () => alive(await db.tasks.toArray()), []) ?? []
}

export function useOpenCounts(now: Date): Record<string, number> {
  const tasks = useAllTasks()
  const today = todayISO(now)
  const horizon = addDaysISO(today, 6)
  const counts: Record<string, number> = {
    inbox: 0,
    today: 0,
    next7: 0,
    all: 0,
  }
  for (const task of tasks) {
    if (!isOpen(task)) continue
    counts.all += 1
    if (!task.list_id) counts.inbox += 1
    if (task.due_date && task.due_date <= today) counts.today += 1
    if (task.due_date && task.due_date <= horizon) counts.next7 += 1
    if (task.list_id) counts[task.list_id] = (counts[task.list_id] ?? 0) + 1
  }
  return counts
}

export interface TaskGroup {
  key: string
  label: string
  tone?: 'overdue' | 'plain'
  tasks: Task[]
}

/**
 * Date-driven views list every matching task, subtasks included; the list-shaped
 * views show top-level tasks and nest their children underneath.
 */
export function selectGroups(tasks: Task[], view: View, now: Date): TaskGroup[] {
  const today = todayISO(now)
  const open = tasks.filter(isOpen)

  const overdue = (rows: Task[]) =>
    rows.filter((t) => t.due_date && t.due_date < today).sort(compareTasks)

  switch (view.kind) {
    case 'today': {
      const due = open.filter((t) => t.due_date === today).sort(compareTasks)
      const groups: TaskGroup[] = [
        { key: 'overdue', label: 'Overdue', tone: 'overdue', tasks: overdue(open) },
        { key: 'today', label: 'Today', tasks: due },
      ]
      return groups.filter((g) => g.tasks.length > 0)
    }

    case 'next7': {
      const groups: TaskGroup[] = [
        { key: 'overdue', label: 'Overdue', tone: 'overdue', tasks: overdue(open) },
      ]
      for (let i = 0; i < 7; i += 1) {
        const day = addDaysISO(today, i)
        const rows = open.filter((t) => t.due_date === day).sort(compareTasks)
        if (rows.length > 0) groups.push({ key: day, label: day, tasks: rows })
      }
      return groups.filter((g) => g.tasks.length > 0)
    }

    case 'completed': {
      const done = tasks
        .filter((t) => !isOpen(t))
        .sort((a, b) =>
          (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at),
        )
      return [{ key: 'completed', label: 'Completed', tasks: done }]
    }

    case 'inbox': {
      const rows = open
        .filter((t) => !t.list_id && !t.parent_task_id)
        .sort(compareTasks)
      return [{ key: 'inbox', label: 'Inbox', tasks: rows }]
    }

    case 'list': {
      const rows = open
        .filter((t) => t.list_id === view.listId && !t.parent_task_id)
        .sort(compareTasks)
      return [{ key: 'list', label: 'Tasks', tasks: rows }]
    }

    case 'all':
    default: {
      const rows = open.filter((t) => !t.parent_task_id).sort(compareTasks)
      return [{ key: 'all', label: 'All', tasks: rows }]
    }
  }
}

/** Children are shown under their parent in the list-shaped views only. */
export function childrenOf(tasks: Task[], parentId: string): Task[] {
  return tasks
    .filter((t) => t.parent_task_id === parentId && isOpen(t))
    .sort(compareTasks)
}

export function useConflicts(): ConflictRecord[] {
  return (
    useLiveQuery(
      async () => db.conflicts.orderBy('detected_at').reverse().toArray(),
      [],
    ) ?? []
  )
}

export function useUnreviewedConflictCount(): number {
  return (
    useLiveQuery(
      async () => (await db.conflicts.toArray()).filter((c) => !c.reviewed_at).length,
      [],
    ) ?? 0
  )
}
