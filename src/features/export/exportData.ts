import { db } from '@/lib/db'
import { todayISO } from '@/lib/time'
import { SYNC_TABLES, type AnyRow, type SyncTable } from '@/lib/types'

export interface ExportFile {
  name: string
  blob: Blob
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Columns are the union across rows, so a null-only column still appears. */
export function toCsv(rows: AnyRow[], columns: string[]): string {
  const lines = [columns.map(csvCell).join(',')]
  for (const row of rows) {
    lines.push(
      columns.map((col) => csvCell((row as unknown as Record<string, unknown>)[col])).join(','),
    )
  }
  return `${lines.join('\r\n')}\r\n`
}

function columnsOf(rows: AnyRow[]): string[] {
  const seen = new Set<string>()
  for (const row of rows) for (const key of Object.keys(row)) seen.add(key)
  return [...seen]
}

async function readAll(): Promise<Record<SyncTable, AnyRow[]>> {
  const out = {} as Record<SyncTable, AnyRow[]>
  for (const table of SYNC_TABLES) {
    out[table] = (await db.table(table).toArray()) as AnyRow[]
  }
  return out
}

export async function buildExport(now: Date = new Date()): Promise<ExportFile[]> {
  const stamp = todayISO(now)
  const data = await readAll()

  const bundle = {
    exported_at: now.toISOString(),
    schema_version: 1,
    tables: data,
  }

  const files: ExportFile[] = [
    {
      name: `tasks-export-${stamp}.json`,
      blob: new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      }),
    },
  ]

  for (const table of SYNC_TABLES) {
    files.push({
      name: `tasks-${stamp}-${table}.csv`,
      blob: new Blob([toCsv(data[table], columnsOf(data[table]))], {
        type: 'text/csv;charset=utf-8',
      }),
    })
  }
  return files
}

/**
 * One click, several files. Browsers ask once before allowing the batch, so the
 * downloads are spaced out rather than fired together.
 */
export async function downloadExport(now: Date = new Date()): Promise<number> {
  const files = await buildExport(now)
  for (const file of files) {
    const url = URL.createObjectURL(file.blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  return files.length
}
