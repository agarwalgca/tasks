import { useState } from 'react'
import { CheckIcon, NoteIcon, RepeatIcon } from '@/components/icons'
import { setTaskStatus } from '@/lib/mutations'
import { formatDue, isOverdue } from '@/lib/time'
import type { List, Tag, Task } from '@/lib/types'

const PRIORITY_BAR = ['bg-transparent', 'bg-p1', 'bg-p2', 'bg-p3']
const PRIORITY_RING = [
  'border-line',
  'border-p1/70',
  'border-p2/70',
  'border-p3/70',
]

interface TaskRowProps {
  task: Task
  tags: Tag[]
  list?: List
  depth?: number
  focused?: boolean
  showDue?: boolean
  onOpen: (id: string) => void
  onFocus: (id: string) => void
}

export function TaskRow({
  task,
  tags,
  list,
  depth = 0,
  focused = false,
  showDue = true,
  onOpen,
  onFocus,
}: TaskRowProps) {
  const [popping, setPopping] = useState(false)
  const done = task.status === 'done' || task.status === 'cancelled'
  const overdue = !done && isOverdue(task.due_date, task.due_time)

  function toggle() {
    if (!done) setPopping(true)
    void setTaskStatus(task, !done)
  }

  return (
    <div
      data-task-row={task.id}
      onMouseEnter={() => onFocus(task.id)}
      className={`group relative flex items-start gap-2.5 border-b border-line/70
        pr-2 transition-colors sm:pr-3 ${
          focused ? 'bg-surface2' : 'hover:bg-surface2/60'
        }`}
      style={{ paddingLeft: `${10 + depth * 22}px` }}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r ${
          PRIORITY_BAR[task.priority]
        }`}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
        className="-ml-1 flex h-11 w-9 shrink-0 items-center justify-center sm:h-9"
      >
        <span
          className={`flex h-[18px] w-[18px] items-center justify-center rounded-full
            border-2 transition-colors ${
              done
                ? 'border-accent bg-accent text-accent-fg'
                : `${PRIORITY_RING[task.priority]} text-transparent group-hover:border-accent`
            } ${popping ? 'animate-pop-check' : ''}`}
          onAnimationEnd={() => setPopping(false)}
        >
          <CheckIcon size={12} />
        </span>
      </button>

      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className="flex min-w-0 flex-1 items-start gap-2 py-2.5 text-left sm:py-2"
      >
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate ${done ? 'text-faint line-through' : ''}`}
          >
            {task.title}
          </span>
          {(tags.length > 0 || task.notes || task.rrule) && (
            <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-faint">
              {task.notes && <NoteIcon size={11} />}
              {task.rrule && <RepeatIcon size={11} />}
              {tags.map((tag) => (
                <span key={tag.id} className="truncate">
                  #{tag.name}
                </span>
              ))}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-2 pt-0.5 text-2xs">
          {showDue && task.due_date && (
            <span
              className={`font-mono ${overdue ? 'text-p1' : 'text-muted'}`}
            >
              {formatDue(task.due_date, task.due_time)}
            </span>
          )}
          {list && (
            <span className="hidden max-w-[9rem] truncate text-faint sm:inline">
              {list.name}
            </span>
          )}
        </span>
      </button>
    </div>
  )
}
