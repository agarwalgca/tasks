import { addDaysISO, todayISO } from '@/lib/time'
import type { FilterCriteria, Task } from '@/lib/types'

export interface FilterContext {
  /** taskId -> tag ids on that task. */
  tagsByTask: Map<string, string[]>
  /** taskId -> lowercased title + notes. */
  textByTask: Map<string, string>
  now: Date
}

const isOpen = (task: Task) => task.status === 'todo' || task.status === 'doing'

function matchesDue(
  task: Task,
  due: FilterCriteria['due'],
  today: string,
): boolean {
  if (!due || due === 'any') return true
  if (due === 'none') return !task.due_date
  if (!task.due_date) return false
  if (due === 'overdue') return task.due_date < today
  if (due === 'today') return task.due_date <= today
  return task.due_date <= addDaysISO(today, 6)
}

/**
 * A criterion left empty means "don't care"; a criterion with entries matches
 * if any of them do. Empty criteria therefore match every open task.
 */
export function matchesFilter(
  task: Task,
  criteria: FilterCriteria,
  context: FilterContext,
): boolean {
  if (!criteria.includeCompleted && !isOpen(task)) return false

  const today = todayISO(context.now)
  if (!matchesDue(task, criteria.due, today)) return false

  if (criteria.priorities?.length && !criteria.priorities.includes(task.priority)) {
    return false
  }
  if (criteria.listIds?.length && !criteria.listIds.includes(task.list_id ?? '')) {
    return false
  }
  if (criteria.clientIds?.length && !criteria.clientIds.includes(task.client_id ?? '')) {
    return false
  }
  if (criteria.tagIds?.length) {
    const tags = context.tagsByTask.get(task.id) ?? []
    if (!criteria.tagIds.some((id) => tags.includes(id))) return false
  }
  const text = criteria.text?.trim().toLowerCase()
  if (text) {
    const haystack = context.textByTask.get(task.id) ?? task.title.toLowerCase()
    if (!haystack.includes(text)) return false
  }
  return true
}

const DUE_LABEL: Record<NonNullable<FilterCriteria['due']>, string> = {
  any: 'any date',
  overdue: 'overdue',
  today: 'due today or earlier',
  next7: 'due within 7 days',
  none: 'no date',
}

/** One-line summary shown under the filter name. */
export function describeCriteria(criteria: FilterCriteria): string {
  const parts: string[] = []
  if (criteria.due && criteria.due !== 'any') parts.push(DUE_LABEL[criteria.due])
  if (criteria.priorities?.length) {
    parts.push(
      criteria.priorities
        .map((p) => (p === 0 ? 'no priority' : `P${p}`))
        .join(' or '),
    )
  }
  if (criteria.listIds?.length) parts.push(`${criteria.listIds.length} list(s)`)
  if (criteria.clientIds?.length) parts.push(`${criteria.clientIds.length} client(s)`)
  if (criteria.tagIds?.length) parts.push(`${criteria.tagIds.length} tag(s)`)
  if (criteria.text?.trim()) parts.push(`"${criteria.text.trim()}"`)
  if (criteria.includeCompleted) parts.push('including completed')
  return parts.length > 0 ? parts.join(' · ') : 'everything open'
}
