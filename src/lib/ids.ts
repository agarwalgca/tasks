export function newId(): string {
  return crypto.randomUUID()
}

/**
 * Fractional ordering: a row dropped between two neighbours takes the midpoint,
 * so a reorder writes one row rather than renumbering the list.
 */
export function orderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0
  if (before === null) return after! - 1
  if (after === null) return before + 1
  return (before + after) / 2
}
