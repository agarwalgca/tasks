import { useLiveQuery } from 'dexie-react-hooks'
import { PlusIcon, TrashIcon } from '@/components/icons'
import { db } from '@/lib/db'
import { createReminder, deleteReminder } from '@/lib/mutations'
import { formatInstant } from '@/lib/time'
import type { Reminder, Task } from '@/lib/types'

const PRESETS: { label: string; offset: number }[] = [
  { label: 'At the time', offset: 0 },
  { label: '10m before', offset: 10 },
  { label: '1h before', offset: 60 },
  { label: '1 day before', offset: 24 * 60 },
]

function describe(reminder: Reminder): string {
  if (reminder.absolute_at) return formatInstant(reminder.absolute_at)
  const minutes = reminder.offset_minutes ?? 0
  if (minutes === 0) return 'At the due time'
  if (minutes % (24 * 60) === 0) return `${minutes / (24 * 60)} day(s) before`
  if (minutes % 60 === 0) return `${minutes / 60}h before`
  return `${minutes}m before`
}

export function ReminderList({ task }: { task: Task }) {
  const reminders =
    useLiveQuery(
      async () =>
        (await db.reminders.where('task_id').equals(task.id).toArray()).filter(
          (r) => !r.deleted_at,
        ),
      [task.id],
    ) ?? []

  return (
    <div className="space-y-1.5">
      {reminders.length > 0 && (
        <ul className="space-y-0.5">
          {reminders.map((reminder) => (
            <li key={reminder.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">
                {describe(reminder)}
                {reminder.fired_at && (
                  <span className="ml-1.5 text-2xs text-faint">sent</span>
                )}
              </span>
              <button
                type="button"
                aria-label="Remove reminder"
                className="text-faint hover:text-p1"
                onClick={() => void deleteReminder(reminder.id)}
              >
                <TrashIcon size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {task.due_date ? (
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="btn border border-line px-2 py-0.5 text-2xs text-muted hover:text-ink"
              onClick={() => void createReminder(task.id, preset.offset)}
            >
              <PlusIcon size={11} />
              {preset.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-2xs text-faint">Set a due date to add a reminder.</p>
      )}
    </div>
  )
}
