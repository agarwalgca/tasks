import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { SYNC_TABLES, type AnyRow } from '@/lib/types'
import type { SyncEngine } from './engine'

/**
 * Applies rows as they change on the server so a laptop edit lands on the
 * phone in seconds. The watermark is deliberately left alone: a realtime row
 * says nothing about rows this device has not pulled yet.
 */
export function subscribeToChanges(
  client: SupabaseClient,
  engine: SyncEngine,
  onStatus?: (connected: boolean) => void,
): () => void {
  const channel: RealtimeChannel = client.channel('sync-stream')

  for (const table of SYNC_TABLES) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        const row = payload.new as AnyRow | undefined
        if (!row?.id) return
        void engine.applyRemote(table, row)
      },
    )
  }

  channel.subscribe((status) => {
    onStatus?.(status === 'SUBSCRIBED')
  })

  return () => {
    void client.removeChannel(channel)
  }
}
