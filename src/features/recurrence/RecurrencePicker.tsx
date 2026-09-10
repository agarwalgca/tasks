import { useMemo } from 'react'
import { WEEKDAY_NAMES } from '@/lib/time'
import type { RecurrenceAnchor, Task } from '@/lib/types'
import {
  buildRrule,
  describeRrule,
  parseRrule,
  type Frequency,
  type RecurrenceSpec,
} from './recurrence'

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'yearly', label: 'Year' },
]

const ANCHORS: { value: RecurrenceAnchor; label: string; hint: string }[] = [
  { value: 'due_date', label: 'Due date', hint: 'Next one is measured from the due date, however late you tick it off.' },
  { value: 'completion_date', label: 'Completion', hint: 'Next one is measured from the day you actually finish it.' },
]

interface Props {
  task: Task
  onChange: (patch: Partial<Task>) => void
}

export function RecurrencePicker({ task, onChange }: Props) {
  const spec = useMemo(
    () => (task.rrule ? parseRrule(task.rrule) : null),
    [task.rrule],
  )

  function update(next: Partial<RecurrenceSpec>) {
    const merged: RecurrenceSpec = {
      frequency: next.frequency ?? spec?.frequency ?? 'weekly',
      interval: next.interval ?? spec?.interval ?? 1,
      weekdays: next.weekdays ?? spec?.weekdays ?? [],
    }
    if (merged.frequency !== 'weekly') merged.weekdays = []
    onChange({
      rrule: buildRrule(merged),
      recurrence_anchor: task.recurrence_anchor ?? 'due_date',
    })
  }

  if (!spec) {
    return (
      <button
        type="button"
        className="btn-outline text-xs"
        onClick={() => update({ frequency: 'weekly', interval: 1, weekdays: [] })}
      >
        Repeat…
      </button>
    )
  }

  const anchor = task.recurrence_anchor ?? 'due_date'

  return (
    <div className="space-y-2 rounded-md border border-line bg-surface2/50 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted">Every</span>
        <input
          type="number"
          min={1}
          max={365}
          value={spec.interval}
          onChange={(e) => update({ interval: Math.max(1, Number(e.target.value) || 1) })}
          className="field w-14 px-2 py-1 text-xs"
        />
        <select
          value={spec.frequency}
          onChange={(e) => update({ frequency: e.target.value as Frequency })}
          className="field w-auto flex-1 px-2 py-1 text-xs"
        >
          {FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {spec.interval === 1 ? f.label : `${f.label}s`}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Stop repeating"
          className="btn-quiet px-2 py-1 text-xs"
          onClick={() =>
            onChange({ rrule: null, recurrence_anchor: null })
          }
        >
          Off
        </button>
      </div>

      {spec.frequency === 'weekly' && (
        <div className="flex gap-1">
          {WEEKDAY_NAMES.map((name, index) => {
            const on = spec.weekdays.includes(index)
            return (
              <button
                key={name}
                type="button"
                onClick={() =>
                  update({
                    weekdays: on
                      ? spec.weekdays.filter((d) => d !== index)
                      : [...spec.weekdays, index].sort(),
                  })
                }
                className={`h-7 flex-1 rounded border text-2xs ${
                  on
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-line text-muted hover:text-ink'
                }`}
              >
                {name.slice(0, 2)}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex gap-1.5">
        {ANCHORS.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.hint}
            onClick={() => onChange({ recurrence_anchor: option.value })}
            className={`btn flex-1 border px-2 py-1 text-2xs ${
              anchor === option.value
                ? 'border-accent text-accent'
                : 'border-line text-muted'
            }`}
          >
            From {option.label}
          </button>
        ))}
      </div>

      <p className="text-2xs text-faint">
        {describeRrule(task.rrule!, task.due_date)}
        {anchor === 'completion_date' && ', from when it is done'}
      </p>
      {anchor === 'due_date' && !task.due_date && (
        <p className="text-2xs text-p2">
          Set a due date, or this cannot work out the next one.
        </p>
      )}
    </div>
  )
}
