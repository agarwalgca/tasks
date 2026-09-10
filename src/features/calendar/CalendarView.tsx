import { useMemo, useState } from 'react'
import { ChevronIcon } from '@/components/icons'
import { compareTasks, isOpen, useAllTasks } from '@/lib/queries'
import { MONTH_NAMES, WEEKDAY_NAMES, addDaysISO, todayISO, weekdayISO } from '@/lib/time'
import type { Task } from '@/lib/types'
import { useUi } from '@/store/ui'

const PRIORITY_DOT = ['bg-faint', 'bg-p1', 'bg-p2', 'bg-p3']

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

function addMonths(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** Six weeks always, so the grid never jumps height between months. */
function gridDays(month: string): string[] {
  const first = monthStart(month)
  const start = addDaysISO(first, -weekdayISO(first))
  return Array.from({ length: 42 }, (_, i) => addDaysISO(start, i))
}

export function CalendarView({ now }: { now: Date }) {
  const today = todayISO(now)
  const [month, setMonth] = useState(() => monthStart(today))
  const tasks = useAllTasks()
  const setOpenTask = useUi((s) => s.setOpenTask)

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      if (!task.due_date) continue
      map.set(task.due_date, [...(map.get(task.due_date) ?? []), task])
    }
    for (const [, rows] of map) rows.sort(compareTasks)
    return map
  }, [tasks])

  const days = useMemo(() => gridDays(month), [month])
  const [year, monthNumber] = month.split('-').map(Number)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        <button
          type="button"
          aria-label="Previous month"
          className="btn-quiet px-1.5 py-1"
          onClick={() => setMonth(addMonths(month, -1))}
        >
          <ChevronIcon size={15} className="rotate-180" />
        </button>
        <span className="min-w-[9rem] text-center text-sm font-semibold">
          {MONTH_NAMES[monthNumber - 1]} {year}
        </span>
        <button
          type="button"
          aria-label="Next month"
          className="btn-quiet px-1.5 py-1"
          onClick={() => setMonth(addMonths(month, 1))}
        >
          <ChevronIcon size={15} />
        </button>
        <button
          type="button"
          className="btn-quiet ml-auto px-2 py-1 text-2xs"
          onClick={() => setMonth(monthStart(today))}
        >
          Today
        </button>
      </div>

      <div className="grid shrink-0 grid-cols-7 border-b border-line">
        {WEEKDAY_NAMES.map((name) => (
          <div
            key={name}
            className="px-1 py-1 text-center text-2xs font-semibold uppercase tracking-wide text-faint"
          >
            {name.slice(0, 1)}
          </div>
        ))}
      </div>

      <div className="scroll-thin grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-y-auto">
        {days.map((day) => {
          const rows = byDay.get(day) ?? []
          const openRows = rows.filter(isOpen)
          const outside = day.slice(0, 7) !== month.slice(0, 7)
          return (
            <div
              key={day}
              className={`min-h-[4.5rem] border-b border-r border-line/70 p-1 ${
                outside ? 'bg-surface2/40' : ''
              }`}
            >
              <div
                className={`mb-0.5 flex h-5 w-5 items-center justify-center rounded-full font-mono text-2xs ${
                  day === today
                    ? 'bg-accent text-accent-fg'
                    : outside
                      ? 'text-faint'
                      : 'text-muted'
                }`}
              >
                {Number(day.slice(8, 10))}
              </div>
              <div className="space-y-0.5">
                {openRows.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setOpenTask(task.id)}
                    className="flex w-full items-center gap-1 rounded px-0.5 text-left text-2xs hover:bg-surface2"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        PRIORITY_DOT[task.priority]
                      }`}
                    />
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}
                {openRows.length > 3 && (
                  <span className="px-0.5 text-2xs text-faint">
                    +{openRows.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
