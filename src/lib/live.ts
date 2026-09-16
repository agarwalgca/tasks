import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'

export interface SharedQuery<T> {
  subscribe(listener: () => void): () => void
  getSnapshot(): T
}

/**
 * One Dexie live query shared by every subscriber. The table is read and
 * sorted once per change, however many components are showing it, instead of
 * once per `useLiveQuery` call site.
 *
 * The last value is kept after the final unsubscribe, so a remount shows the
 * previous rows straight away and refreshes as soon as the query re-runs.
 */
export function createSharedQuery<T>(querier: () => Promise<T>, initial: T): SharedQuery<T> {
  let value = initial
  let upstream: { unsubscribe(): void } | null = null
  const listeners = new Set<() => void>()

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (!upstream) {
        upstream = liveQuery(querier).subscribe({
          next: (next) => {
            value = next
            for (const notify of listeners) notify()
          },
          error: (cause) => console.error(cause),
        })
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          upstream?.unsubscribe()
          upstream = null
        }
      }
    },
    getSnapshot: () => value,
  }
}

/** A hook over one shared query; every component that calls it reads the same run. */
export function sharedLiveQuery<T>(querier: () => Promise<T>, initial: T): () => T {
  const query = createSharedQuery(querier, initial)
  return () => useSyncExternalStore(query.subscribe, query.getSnapshot)
}
