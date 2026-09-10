import { useState } from 'react'
import { CloseIcon, TrashIcon } from '@/components/icons'
import { deleteSavedFilter, updateSavedFilter } from '@/lib/mutations'
import { useClients, useLists, useTags } from '@/lib/queries'
import type { FilterCriteria, SavedFilter } from '@/lib/types'

const DUE_OPTIONS: { value: NonNullable<FilterCriteria['due']>; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'next7', label: '7 days' },
  { value: 'none', label: 'No date' },
]

const PRIORITIES = [
  { value: 1, label: 'P1' },
  { value: 2, label: 'P2' },
  { value: 3, label: 'P3' },
  { value: 0, label: 'None' },
]

function Toggle({
  on,
  label,
  onClick,
}: {
  on: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn border px-2 py-1 text-2xs ${
        on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted'
      }`}
    >
      {label}
    </button>
  )
}

export function FilterEditor({
  filter,
  onClose,
}: {
  filter: SavedFilter
  onClose: () => void
}) {
  const lists = useLists()
  const clients = useClients()
  const tags = useTags()
  const [name, setName] = useState(filter.name)
  const criteria = filter.criteria ?? {}

  const set = (patch: Partial<FilterCriteria>) =>
    void updateSavedFilter(filter, { criteria: { ...criteria, ...patch } })

  const toggleIn = (key: 'priorities' | 'listIds' | 'clientIds' | 'tagIds', value: never) => {
    const current = (criteria[key] ?? []) as unknown[]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    set({ [key]: next } as Partial<FilterCriteria>)
  }

  return (
    <div className="space-y-4 border-b border-line px-3 py-3 md:px-4">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const next = name.trim()
            if (next && next !== filter.name) void updateSavedFilter(filter, { name: next })
          }}
          className="field font-medium"
        />
        <button
          type="button"
          className="btn-quiet px-2 py-1 text-p1"
          aria-label="Delete filter"
          onClick={() => {
            if (window.confirm(`Delete the "${filter.name}" filter?`)) {
              void deleteSavedFilter(filter.id)
              onClose()
            }
          }}
        >
          <TrashIcon size={15} />
        </button>
        <button
          type="button"
          className="btn-quiet px-2 py-1"
          aria-label="Close editor"
          onClick={onClose}
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <Row label="Due">
        {DUE_OPTIONS.map((option) => (
          <Toggle
            key={option.value}
            on={(criteria.due ?? 'any') === option.value}
            label={option.label}
            onClick={() => set({ due: option.value })}
          />
        ))}
      </Row>

      <Row label="Priority">
        {PRIORITIES.map((p) => (
          <Toggle
            key={p.value}
            on={(criteria.priorities ?? []).includes(p.value)}
            label={p.label}
            onClick={() => toggleIn('priorities', p.value as never)}
          />
        ))}
      </Row>

      {lists.length > 0 && (
        <Row label="Lists">
          {lists.map((list) => (
            <Toggle
              key={list.id}
              on={(criteria.listIds ?? []).includes(list.id)}
              label={list.name}
              onClick={() => toggleIn('listIds', list.id as never)}
            />
          ))}
        </Row>
      )}

      {clients.length > 0 && (
        <Row label="Clients">
          {clients.map((client) => (
            <Toggle
              key={client.id}
              on={(criteria.clientIds ?? []).includes(client.id)}
              label={client.name}
              onClick={() => toggleIn('clientIds', client.id as never)}
            />
          ))}
        </Row>
      )}

      {tags.length > 0 && (
        <Row label="Tags">
          {tags.map((tag) => (
            <Toggle
              key={tag.id}
              on={(criteria.tagIds ?? []).includes(tag.id)}
              label={`#${tag.name}`}
              onClick={() => toggleIn('tagIds', tag.id as never)}
            />
          ))}
        </Row>
      )}

      <Row label="Text">
        <input
          defaultValue={criteria.text ?? ''}
          onBlur={(e) => set({ text: e.target.value })}
          placeholder="Words in the title or notes"
          className="field max-w-xs px-2 py-1 text-xs"
        />
        <Toggle
          on={!!criteria.includeCompleted}
          label="Include completed"
          onClick={() => set({ includeCompleted: !criteria.includeCompleted })}
        />
      </Row>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 shrink-0 text-2xs font-semibold uppercase tracking-wide text-faint">
        {label}
      </span>
      {children}
    </div>
  )
}
