import type { Table } from 'dexie'
import { type AppDatabase, META_LAST_PULLED_AT } from '@/lib/db'
import { newId } from '@/lib/ids'
import { nowISO } from '@/lib/time'
import { SYNC_TABLES, type AnyRow, type SyncTable } from '@/lib/types'
import type { SyncTransport } from './transport'

export type MergeOutcome = 'applied' | 'conflict' | 'kept-local' | 'unchanged'

export interface SyncResult {
  pushed: number
  pulled: number
  conflicts: number
  watermark: string | null
}

export interface SyncEngineOptions {
  pageSize?: number
  /** Called after any local change, so the UI can refresh. */
  onChange?: () => void
}

function describeRow(table: SyncTable, row: AnyRow): string {
  const named = row as { title?: string; name?: string; display_name?: string }
  return named.title ?? named.name ?? named.display_name ?? table
}

/**
 * Push the queue, pull everything changed since the watermark, resolve
 * row-level conflicts by last-write-wins. A local edit that loses is recorded
 * rather than dropped.
 */
export class SyncEngine {
  private inFlight: Promise<SyncResult> | null = null
  private readonly pageSize: number

  constructor(
    private readonly db: AppDatabase,
    private readonly transport: SyncTransport,
    private readonly options: SyncEngineOptions = {},
  ) {
    this.pageSize = options.pageSize ?? 500
  }

  /** Concurrent callers share one cycle rather than racing each other. */
  sync(): Promise<SyncResult> {
    if (!this.inFlight) {
      this.inFlight = this.run().finally(() => {
        this.inFlight = null
      })
    }
    return this.inFlight
  }

  pendingCount(): Promise<number> {
    return this.db.outbox.count()
  }

  private async run(): Promise<SyncResult> {
    const push = await this.pushQueue()
    const pull = await this.pullChanges()
    if (push.pushed || pull.pulled) this.options.onChange?.()
    return {
      pushed: push.pushed,
      pulled: pull.pulled,
      conflicts: push.conflicts + pull.conflicts,
      watermark: pull.watermark,
    }
  }

  /**
   * Tables push in dependency order so a task never lands before its list.
   * Entries are only cleared once the server has taken them; a failure leaves
   * the queue intact for the next attempt.
   *
   * The server may reject a write as stale — it holds a newer version of the
   * row. That is a lost local edit, so it is recorded before the server's
   * version is merged in.
   */
  private async pushQueue(): Promise<{ pushed: number; conflicts: number }> {
    let pushed = 0
    let conflicts = 0

    for (const table of SYNC_TABLES) {
      const entries = await this.db.outbox.where('table').equals(table).sortBy('seq')
      if (entries.length === 0) continue

      const latest = new Map<string, (typeof entries)[number]>()
      for (const entry of entries) latest.set(entry.row_id, entry)
      const batch = [...latest.values()].sort((a, b) => a.seq! - b.seq!)

      const stored = await this.transport.push(table, batch.map((e) => e.row))
      await this.db.outbox.bulkDelete(batch.map((e) => e.seq!))
      pushed += batch.length

      const byId = new Map(stored.map((row) => [row.id, row]))
      for (const entry of batch) {
        const server = byId.get(entry.row_id)
        if (!server) continue
        if (Date.parse(server.updated_at) > Date.parse(entry.row.updated_at)) {
          await this.recordConflict(table, entry.row, server)
          await this.applyRemote(table, server)
          conflicts += 1
        }
      }
    }
    return { pushed, conflicts }
  }

  private async recordConflict(
    table: SyncTable,
    local: AnyRow,
    remote: AnyRow,
  ): Promise<void> {
    await this.db.conflicts.put({
      id: newId(),
      table,
      row_id: local.id,
      title: describeRow(table, local),
      local,
      remote,
      detected_at: nowISO(),
      reviewed_at: null,
    })
  }

  private async pullChanges(): Promise<Omit<SyncResult, 'pushed'>> {
    const since = (await this.db.getMeta<string>(META_LAST_PULLED_AT)) ?? null
    let watermark = since
    let pulled = 0
    let conflicts = 0

    for (const table of SYNC_TABLES) {
      for (let offset = 0; ; ) {
        const rows = await this.transport.pull(table, since, this.pageSize, offset)
        if (rows.length === 0) break
        for (const row of rows) {
          const outcome = await this.applyRemote(table, row)
          if (outcome === 'applied' || outcome === 'conflict') pulled += 1
          if (outcome === 'conflict') conflicts += 1
          if (!watermark || row.updated_at > watermark) watermark = row.updated_at
        }
        if (rows.length < this.pageSize) break
        offset += rows.length
      }
    }

    if (watermark && watermark !== since) {
      await this.db.setMeta(META_LAST_PULLED_AT, watermark)
    }
    return { pulled, conflicts, watermark }
  }

  /**
   * Merge one server row. Also the entry point for realtime events, so the
   * same resolution runs whether a row arrived by poll or by push.
   */
  async applyRemote(table: SyncTable, remote: AnyRow): Promise<MergeOutcome> {
    const store = this.db.table(table) as Table<AnyRow, string>
    const outcome = await this.db.transaction(
      'rw',
      store,
      this.db.outbox,
      this.db.conflicts,
      async (): Promise<MergeOutcome> => {
        const local = await store.get(remote.id)
        if (!local) {
          await store.put(remote)
          return 'applied'
        }

        const remoteAt = Date.parse(remote.updated_at)
        const localAt = Date.parse(local.updated_at)

        if (remoteAt > localAt) {
          const pending = await this.db.outbox
            .where('[table+row_id]')
            .equals([table, remote.id])
            .toArray()
          await store.put(remote)
          if (pending.length > 0) {
            await this.db.outbox.bulkDelete(pending.map((e) => e.seq!))
            await this.db.conflicts.put({
              id: newId(),
              table,
              row_id: remote.id,
              title: describeRow(table, local),
              local: pending[pending.length - 1].row,
              remote,
              detected_at: nowISO(),
              reviewed_at: null,
            })
            return 'conflict'
          }
          return 'applied'
        }

        if (remoteAt < localAt) return 'kept-local'

        // Same timestamp: the server already has this exact revision.
        await this.db.outbox
          .where('[table+row_id]')
          .equals([table, remote.id])
          .delete()
        return 'unchanged'
      },
    )

    if (outcome === 'applied' || outcome === 'conflict') this.options.onChange?.()
    return outcome
  }
}
