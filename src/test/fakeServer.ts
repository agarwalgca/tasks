import type { SyncTransport } from '@/sync/transport'
import { SYNC_TABLES, type AnyRow, type SyncTable } from '@/lib/types'

/**
 * Stands in for Postgres + PostgREST: upsert by primary key, read back by
 * updated_at, and the same stale-write guard the updated_at trigger applies.
 */
export class FakeServer {
  readonly tables = new Map<SyncTable, Map<string, AnyRow>>()
  pushes = 0
  pulls = 0

  constructor() {
    for (const table of SYNC_TABLES) this.tables.set(table, new Map())
  }

  private store(table: SyncTable): Map<string, AnyRow> {
    return this.tables.get(table)!
  }

  /** Returns the stored rows, as `upsert(...).select()` does. */
  upsert(table: SyncTable, rows: AnyRow[]): AnyRow[] {
    const stored: AnyRow[] = []
    for (const row of rows) {
      const existing = this.store(table).get(row.id)
      if (!existing || Date.parse(row.updated_at) >= Date.parse(existing.updated_at)) {
        this.store(table).set(row.id, structuredClone(row))
      }
      stored.push(structuredClone(this.store(table).get(row.id)!))
    }
    return stored
  }

  select(
    table: SyncTable,
    since: string | null,
    limit: number,
    offset: number,
  ): AnyRow[] {
    const rows = [...this.store(table).values()]
      .filter((row) => !since || row.updated_at >= since)
      .sort(
        (a, b) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id),
      )
    return rows.slice(offset, offset + limit).map((row) => structuredClone(row))
  }

  get(table: SyncTable, id: string): AnyRow | undefined {
    return this.store(table).get(id)
  }
}

export class FakeTransport implements SyncTransport {
  online = true

  constructor(private readonly server: FakeServer) {}

  private guard(): void {
    if (!this.online) throw new Error('offline')
  }

  async push(table: SyncTable, rows: AnyRow[]): Promise<AnyRow[]> {
    this.guard()
    this.server.pushes += 1
    return this.server.upsert(table, rows)
  }

  async pull(
    table: SyncTable,
    since: string | null,
    limit: number,
    offset: number,
  ): Promise<AnyRow[]> {
    this.guard()
    this.server.pulls += 1
    return this.server.select(table, since, limit, offset)
  }
}
