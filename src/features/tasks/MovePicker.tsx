import { useMemo, useState } from 'react'
import { CheckIcon, InboxIcon, ListIcon } from '@/components/icons'
import { moveTask } from '@/lib/mutations'
import { useAllTasks, useLists } from '@/lib/queries'

interface Destination {
  id: string | null
  name: string
  /** "Parent / Child", so a nested list can be found by either name. */
  path: string
  depth: number
}

/**
 * Pick a list to move a task to. Type to narrow, arrows to choose, Enter to
 * move. The task's subtasks always come along.
 */
export function MovePicker({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const lists = useLists()
  const tasks = useAllTasks()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const task = tasks.find((t) => t.id === taskId)
  const root = task?.parent_task_id
    ? (tasks.find((t) => t.id === task.parent_task_id) ?? task)
    : task
  const subtaskCount = root
    ? tasks.filter((t) => t.parent_task_id === root.id).length
    : 0

  const destinations = useMemo(() => {
    const out: Destination[] = [{ id: null, name: 'Inbox', path: 'Inbox', depth: 0 }]
    for (const parent of lists.filter((l) => !l.parent_list_id)) {
      out.push({ id: parent.id, name: parent.name, path: parent.name, depth: 0 })
      for (const child of lists.filter((l) => l.parent_list_id === parent.id)) {
        out.push({
          id: child.id,
          name: child.name,
          path: `${parent.name} / ${child.name}`,
          depth: 1,
        })
      }
    }
    return out
  }, [lists])

  const needle = query.trim().toLowerCase()
  const shown = needle
    ? destinations.filter((d) => d.path.toLowerCase().includes(needle))
    : destinations
  const selected = Math.min(index, Math.max(0, shown.length - 1))

  if (!root) return null
  const current = root.list_id ?? null

  function choose(destination: Destination | undefined) {
    if (!destination || !root) return
    if (destination.id !== current) void moveTask(root.id, destination.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-start sm:pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-label="Move task to a list"
        className="safe-bottom w-full max-w-sm animate-slide-up overflow-hidden rounded-t-xl border border-line bg-surface shadow-xl sm:rounded-xl"
      >
        <div className="border-b border-line px-3 pb-2 pt-3">
          <p className="mb-2 truncate text-xs text-muted">
            Move <span className="font-medium text-ink">{root.title}</span>
            {subtaskCount > 0 &&
              ` and its ${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'}`}
          </p>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex(Math.min(selected + 1, shown.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex(Math.max(selected - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                choose(shown[selected])
              } else if (e.key === 'Escape') {
                // Close just this picker, not the task panel behind it.
                e.stopPropagation()
                onClose()
              }
            }}
            placeholder="Find a list"
            className="field py-1.5"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <ul className="scroll-thin max-h-[50vh] overflow-y-auto py-1 sm:max-h-80">
          {shown.map((destination, i) => {
            const isCurrent = destination.id === current
            return (
              <li key={destination.id ?? 'inbox'}>
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => choose(destination)}
                  className={`flex w-full items-center gap-2.5 py-3 pr-3 text-left text-sm sm:py-1.5 ${
                    i === selected ? 'bg-surface2' : ''
                  }`}
                  style={{ paddingLeft: `${12 + destination.depth * 18}px` }}
                >
                  <span className="shrink-0 text-faint">
                    {destination.id === null ? <InboxIcon size={15} /> : <ListIcon size={15} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {needle && destination.depth > 0 ? destination.path : destination.name}
                  </span>
                  {isCurrent && (
                    <span className="flex shrink-0 items-center gap-1 text-2xs text-accent">
                      <CheckIcon size={12} />
                      current
                    </span>
                  )}
                </button>
              </li>
            )
          })}
          {shown.length === 0 && (
            <li className="px-3 py-3 text-xs text-faint">No list matches “{query}”.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
