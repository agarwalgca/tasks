type Listener = () => void

const listeners = new Set<Listener>()

/** Fired after a local write, so the sync runtime can schedule a push. */
export function emitLocalChange(): void {
  for (const listener of listeners) listener()
}

export function onLocalChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
