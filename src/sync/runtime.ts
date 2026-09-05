import { db, META_DEVICE_ID, META_LAST_PULLED_AT } from '@/lib/db'
import { newId } from '@/lib/ids'
import { supabase } from '@/lib/supabase'
import { useSyncStore } from '@/store/sync'
import { onLocalChange } from './bus'
import { SyncEngine } from './engine'
import { subscribeToChanges } from './realtime'
import { SupabaseTransport } from './supabaseTransport'

const PERIODIC_MS = 60_000
const DEBOUNCE_MS = 500

let engine: SyncEngine | null = null
let currentUserId: string | null = null
let teardown: (() => void)[] = []
let debounce: ReturnType<typeof setTimeout> | null = null
let cycleRunning = false
let cycleQueued = false

async function deviceId(): Promise<string> {
  let id = await db.getMeta<string>(META_DEVICE_ID)
  if (!id) {
    id = newId()
    await db.setMeta(META_DEVICE_ID, id)
  }
  return id
}

async function refreshPending(): Promise<void> {
  useSyncStore.getState().set({ pending: await db.outbox.count() })
}

/** Bookkeeping only — a failure here must not affect syncing. */
async function recordDevice(): Promise<void> {
  if (!currentUserId) return
  await supabase.from('sync_state').upsert(
    {
      device_id: await deviceId(),
      user_id: currentUserId,
      last_pulled_at: (await db.getMeta<string>(META_LAST_PULLED_AT)) ?? null,
    },
    { onConflict: 'device_id' },
  )
}

/**
 * One cycle at a time. A change that arrives mid-cycle queues another rather
 * than being swallowed.
 */
async function runCycle(): Promise<void> {
  if (!engine) return
  if (cycleRunning) {
    cycleQueued = true
    return
  }

  if (!navigator.onLine) {
    useSyncStore.getState().set({ phase: 'offline' })
    await refreshPending()
    return
  }

  cycleRunning = true
  useSyncStore.getState().set({ phase: 'syncing' })
  try {
    await engine.sync()
    await refreshPending()
    useSyncStore.getState().set({
      phase: 'synced',
      error: null,
      lastSyncedAt: new Date().toISOString(),
      settledAt: Date.now(),
    })
    void recordDevice().catch(() => {})
  } catch (cause) {
    await refreshPending()
    useSyncStore.getState().set({
      phase: navigator.onLine ? 'error' : 'offline',
      error: cause instanceof Error ? cause.message : String(cause),
    })
  } finally {
    cycleRunning = false
  }

  if (cycleQueued) {
    cycleQueued = false
    void runCycle()
  }
}

export function requestSync(immediate = false): void {
  if (!engine) return
  if (debounce) {
    clearTimeout(debounce)
    debounce = null
  }
  if (immediate) {
    void runCycle()
    return
  }
  debounce = setTimeout(() => {
    debounce = null
    void runCycle()
  }, DEBOUNCE_MS)
}

export function startSync(userId: string): void {
  stopSync()
  currentUserId = userId
  engine = new SyncEngine(db, new SupabaseTransport(supabase))

  const onOnline = () => requestSync(true)
  const onOffline = () => useSyncStore.getState().set({ phase: 'offline' })
  const onVisible = () => {
    if (document.visibilityState === 'visible') requestSync(true)
  }

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)

  const unsubscribeWrites = onLocalChange(() => {
    void refreshPending()
    requestSync()
  })
  const unsubscribeRealtime = subscribeToChanges(supabase, engine)
  const timer = setInterval(() => requestSync(true), PERIODIC_MS)

  teardown = [
    () => window.removeEventListener('online', onOnline),
    () => window.removeEventListener('offline', onOffline),
    () => document.removeEventListener('visibilitychange', onVisible),
    unsubscribeWrites,
    unsubscribeRealtime,
    () => clearInterval(timer),
  ]

  requestSync(true)
}

export function stopSync(): void {
  for (const fn of teardown) fn()
  teardown = []
  if (debounce) clearTimeout(debounce)
  debounce = null
  cycleQueued = false
  engine = null
  currentUserId = null
}
