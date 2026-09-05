import type { AnyRow, SyncTable } from '@/lib/types'

/**
 * The narrow surface the sync engine needs from the server, so the engine can
 * be exercised against an in-memory stand-in in tests.
 */
export interface SyncTransport {
  /**
   * Upsert rows by primary key and return what the server actually stored.
   * A row whose returned updated_at is newer than the one sent was rejected by
   * the stale-write guard — the engine turns that into a visible conflict
   * rather than losing the edit.
   */
  push(table: SyncTable, rows: AnyRow[]): Promise<AnyRow[]>
  /**
   * Rows with `updated_at >= since`, oldest first. `since` of null means
   * everything. Boundary rows repeat across cycles; merging is idempotent.
   */
  pull(
    table: SyncTable,
    since: string | null,
    limit: number,
    offset: number,
  ): Promise<AnyRow[]>
}
