import { useMemo } from 'react'
import {
  childrenOf,
  selectGroups,
  useAllTasks,
  useLists,
  useTags,
  useTaskTags,
} from '@/lib/queries'
import { formatDateLabel } from '@/lib/time'
import type { Task } from '@/lib/types'
import { useUi, type View } from '@/store/ui'
import { TaskRow } from './TaskRow'

const NESTED_VIEWS = new Set(['inbox', 'list', 'all'])
const EMPTY: Record<string, string> = {
  today: 'Nothing due today.',
  next7: 'Nothing in the next seven days.',
  inbox: 'Inbox is empty.',
  all: 'No open tasks.',
  completed: 'Nothing completed yet.',
  list: 'This list is empty.',
}

export function TaskList({ view, now }: { view: View; now: Date }) {
  const tasks = useAllTasks()
  const lists = useLists()
  const tags = useTags()
  const taskTags = useTaskTags()
  const focusedTaskId = useUi((s) => s.focusedTaskId)
  const setFocusedTask = useUi((s) => s.setFocusedTask)
  const setOpenTask = useUi((s) => s.setOpenTask)

  const groups = useMemo(() => selectGroups(tasks, view, now), [tasks, view, now])
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
        {EMPTY[view.kind] ?? 'Nothing here.'}
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
