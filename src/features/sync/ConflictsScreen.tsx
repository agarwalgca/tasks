import { markConflictReviewed, restoreConflictLocal } from '@/lib/mutations'
import { useConflicts } from '@/lib/queries'
import { formatInstant } from '@/lib/time'
import type { AnyRow, ConflictRecord } from '@/lib/types'

const IGNORED_FIELDS = new Set(['updated_at', 'created_at', 'user_id', 'id'])

function differences(local: AnyRow, remote: AnyRow): [string, unknown, unknown][] {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  const rows: [string, unknown, unknown][] = []
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue
    const a = (local as unknown as Record<string, unknown>)[key]
    const b = (remote as unknown as Record<string, unknown>)[key]
    if (a !== b) rows.push([key, a, b])
  }
  return rows
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function ConflictCard({ record }: { record: ConflictRecord }) {
  const rows = differences(record.local, record.remote)

  return (
    <li
      className={`rounded-lg border border-line bg-surface p-3 ${
        record.reviewed_at ? 'opacity-55' : ''
      }`}
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{record.title}</p>
          <p className="font-mono text-2xs text-faint">
            {record.table} · {formatInstant(record.detected_at)}
          </p>
        </div>
        {!record.reviewed_at && (
          <span className="chip border-p2/40 bg-p2/10 text-p2">unreviewed</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-2xs">
          <thead className="text-faint">
            <tr className="text-left">
              <th className="py-1 pr-3 font-medium">field</th>
              <th className="py-1 pr-3 font-medium">your edit (discarded)</th>
              <th className="py-1 font-medium">kept</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map(([key, a, b]) => (
              <tr key={key} className="border-t border-line/70 align-top">
                <td className="py-1 pr-3 text-muted">{key}</td>
                <td className="py-1 pr-3 text-p1">{show(a)}</td>
                <td className="py-1 text-ink">{show(b)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-1 text-muted">
                  Same values, different timestamps.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn-outline text-xs"
          onClick={() => void restoreConflictLocal(record.id)}
        >
          Restore my version
        </button>
        {!record.reviewed_at && (
          <button
            type="button"
            className="btn-quiet text-xs"
            onClick={() => void markConflictReviewed(record.id)}
          >
            Mark reviewed
          </button>
        )}
      </div>
    </li>
  )
}

export function ConflictsScreen() {
  const conflicts = useConflicts()

  if (conflicts.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted">
        No conflicts. When two devices edit the same thing, the later edit wins and
        the one that lost shows up here.
      </p>
    )
  }

  return (
    <ul className="space-y-2 px-3 py-3">
      {conflicts.map((record) => (
        <ConflictCard key={record.id} record={record} />
      ))}
    </ul>
  )
}
