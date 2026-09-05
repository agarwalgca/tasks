let userId: string | null = null

export function setCurrentUserId(id: string | null): void {
  userId = id
}

/** Every row is stamped with the owner; writes are impossible without one. */
export function requireUserId(): string {
  if (!userId) throw new Error('No signed-in user')
  return userId
}

export function currentUserId(): string | null {
  return userId
}
