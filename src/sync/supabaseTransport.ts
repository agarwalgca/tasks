import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnyRow, SyncTable } from '@/lib/types'
import type { SyncTransport } from './transport'

export class SupabaseTransport implements SyncTransport {
  constructor(private readonly client: SupabaseClient) {}

  async push(table: SyncTable, rows: AnyRow[]): Promise<AnyRow[]> {
    // `select()` returns the row as it stands after the updated_at trigger, so
    // a write the server refused as stale comes back with its own timestamp.
    const { data, error } = await this.client
      .from(table)
      .upsert(rows, { onConflict: 'id' })
      .select()
    if (error) throw new Error(`push ${table}: ${error.message}`)
    return (data ?? []) as AnyRow[]
  }

  async pull(
    table: SyncTable,
    since: string | null,
    limit: number,
    offset: number,
  ): Promise<AnyRow[]> {
    let query = this.client
      .from(table)
      .select('*')
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1)
    if (since) query = query.gte('updated_at', since)

    const { data, error } = await query
    if (error) throw new Error(`pull ${table}: ${error.message}`)
    return (data ?? []) as AnyRow[]
  }
}
