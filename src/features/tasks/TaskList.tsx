import { useMemo } from 'react'
import {
  childrenByParent,
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
import type { Tag, Task } from '@/lib/types'
import { useIsDesktop } from '@/lib/useIsDesktop'
import { useUi, type View } from '@/store/ui'
import { TaskRow } from './TaskRow'

const NESTED_VIEWS = new Set(['inbox', 'list', 'all', 'client'])
/** One shared empty array, so an untagged row keeps a stable prop. */
const NO_TAGS: Tag[] = []
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
  const desktop = useIsDesktop()

  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists])

  const tagsForTask = useMemo(() => {
    const tagById = new Map(tags.map((t) => [t.id, t]))
    const map = new Map<string, Tag[]>()
    for (const link of taskTags) {
      const tag = tagById.get(link.tag_id)
      if (!tag) continue
      let bucket = map.get(link.task_id)
      if (!bucket) map.set(link.task_id, (bucket = []))
      bucket.push(tag)
    }
    return map
  }, [taskTags, tags])

  const searchIndex = useMemo(() => {
    if (view.kind !== 'search') return undefined
    return new Map(
      tasks.map((t) => [
        t.id,
        [
          t.title,
          t.notes ?? '',
          ...(tagsForTask.get(t.id) ?? NO_TAGS).map((tag) => tag.name),
        ]
          .join(' ')
          .toLowerCase(),
      ]),
    )
  }, [view.kind, tasks, tagsForTask])

  const groups = useMemo(() => {
    if (view.kind === 'filter') {
      const filter = savedFilters.find((f) => f.id === view.filterId)
      if (!filter) return []
      const tagsByTask = new Map<string, string[]>()
      for (const [taskId, rows] of tagsForTask) {
        tagsByTask.set(taskId, rows.map((tag) => tag.id))
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
  }, [tasks, view, now, searchIndex, searchQuery, savedFilters, tagsForTask])

  const nested = NESTED_VIEWS.has(view.kind)
  const children = useMemo(
    () => (nested ? childrenByParent(tasks) : null),
    [nested, tasks],
  )
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
      draggable={desktop && depth === 0 && !task.parent_task_id}
      tags={tagsForTask.get(task.id) ?? NO_TAGS}
      list={showList && task.list_id ? listById.get(task.list_id) : undefined}
      focused={focusedTaskId === task.id}
      showDue={view.kind !== 'next7'}
      now={now}
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
              {children?.get(task.id)?.map((child) => renderRow(child, 1))}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
