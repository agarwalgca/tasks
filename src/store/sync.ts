import { create } from 'zustand'

export type SyncPhase = 'synced' | 'syncing' | 'offline' | 'error'

interface SyncStore {
  phase: SyncPhase
  pending: number
  lastSyncedAt: string | null
  error: string | null
  /** Bumped when a cycle finishes clean, so the indicator can animate once. */
  settledAt: number
  set: (patch: Partial<Omit<SyncStore, 'set'>>) => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  phase: navigator.onLine ? 'synced' : 'offline',
  pending: 0,
  lastSyncedAt: null,
  error: null,
  settledAt: 0,
  set: (patch) => set(patch),
}))
