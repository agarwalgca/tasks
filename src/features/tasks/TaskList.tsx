import { useMemo } from 'react'
import {
  childrenOf,
  compareTasks,
  selectGroups,
  useAllTasks,
  useLists,
  useSavedFilters,
  useTags,
  useTaskTags,
} from '@/lib/queries'
import { matchesFilter } from '@/features/filters/filters'
import { formatDateLabel } from '@/lib/time'
import type { Task } from '@/lib/types'
import { useUi, type View } from '@/store/ui'
import { TaskRow } from './TaskRow'

const NESTED_VIEWS = new Set(['inbox', 'list', 'all', 'client'])
const EMPTY: Record<string, string> = {
  today: 'Nothing due today.',
  next7: 'Nothing in the next seven days.',
  inbox: 'Inbox is empty.',
  all: 'No open tasks.',
  completed: 'Nothing completed yet.',
  list: 'This list is empty.',
  client: 'Nothing for this client.',
  search: 'No matches.',
  filter: 'Nothing matches this filter.',
}

export function TaskList({ view, now }: { view: View; now: Date }) {
  const tasks = useAllTasks()
  const lists = useLists()
  const tags = useTags()
  const taskTags = useTaskTags()
  const searchQuery = useUi((s) => s.searchQuery)
  const savedFilters = useSavedFilters()
  const focusedTaskId = useUi((s) => s.focusedTaskId)
  const setFocusedTask = useUi((s) => s.setFocusedTask)
  const setOpenTask = useUi((s) => s.setOpenTask)

  const searchIndex = useMemo(() => {
    if (view.kind !== 'search') return undefined
    const byTask = new Map<string, string[]>()
    for (const link of taskTags) {
      const tag = tags.find((t) => t.id === link.tag_id)
      if (!tag) continue
      byTask.set(link.task_id, [...(byTask.get(link.task_id) ?? []), tag.name])
    }
    return new Map(
      tasks.map((t) => [
        t.id,
        [t.title, t.notes ?? '', ...(byTask.get(t.id) ?? [])].join(' ').toLowerCase(),
      ]),
    )
  }, [view.kind, tasks, taskTags, tags])

  const groups = useMemo(() => {
    if (view.kind === 'filter') {
      const filter = savedFilters.find((f) => f.id === view.filterId)
      if (!filter) return []
      const tagsByTask = new Map<string, string[]>()
      for (const link of taskTags) {
        tagsByTask.set(link.task_id, [
          ...(tagsByTask.get(link.task_id) ?? []),
          link.tag_id,
        ])
      }
      const textByTask = new Map(
        tasks.map((t) => [t.id, `${t.title} ${t.notes ?? ''}`.toLowerCase()]),
      )
      const rows = tasks
        .filter((t) => matchesFilter(t, filter.criteria ?? {}, { tagsByTask, textByTask, now }))
        .sort(compareTasks)
      return rows.length > 0 ? [{ key: 'filter', label: filter.name, tasks: rows }] : []
    }
    return selectGroups(tasks, view, now, searchIndex, searchQuery)
  }, [tasks, view, now, searchIndex, searchQuery, savedFilters, taskTags])
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists])
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])
  const tagsForTask = useMemo(() => {
    const map = new Map<string, typeof tags>()
    for (const link of taskTags) {
      const tag = tagById.get(link.tag_id)
      if (!tag) continue
      const bucket = map.get(link.task_id) ?? []
      bucket.push(tag)
      map.set(link.task_id, bucket)
    }
    return map
  }, [taskTags, tagById])

  const nested = NESTED_VIEWS.has(view.kind)
  const showList = view.kind !== 'list'

  if (groups.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted">
        {view.kind === 'search' && !searchQuery.trim()
          ? 'Type to search titles, notes and tags.'
          : (EMPTY[view.kind] ?? 'Nothing here.')}
      </p>
    )
  }

  const renderRow = (task: Task, depth: number) => (
    <TaskRow
      key={task.id}
      task={task}
      depth={depth}
      tags={tagsForTask.get(task.id) ?? []}
      list={showList && task.list_id ? listById.get(task.list_id) : undefined}
      focused={focusedTaskId === task.id}
      showDue={view.kind !== 'next7'}
      onOpen={setOpenTask}
      onFocus={setFocusedTask}
    />
  )

  return (
    <div>
      {groups.map((group) => (
        <section key={group.key}>
          {groups.length > 1 && (
            <h2
              className={`sticky top-0 z-10 bg-bg/95 px-3 py-1.5 text-2xs font-semibold
                uppercase tracking-wide backdrop-blur ${
                  group.tone === 'overdue' ? 'text-p1' : 'text-faint'
                }`}
            >
              {group.key.match(/^\d{4}-/)
                ? formatDateLabel(group.key, now)
                : group.label}
              <span className="ml-2 font-mono font-normal normal-case tracking-normal">
                {group.tasks.length}
              </span>
            </h2>
          )}
          {group.tasks.map((task) => (
            <div key={task.id}>
              {renderRow(task, 0)}
              {nested &&
                childrenOf(tasks, task.id).map((child) => renderRow(child, 1))}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
