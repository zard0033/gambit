const STORAGE_KEY = 'chess:journal:lastSeenAt'

export function getLastSeenAt(): number {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? parseInt(raw, 10) : 0
}

export function isUnread(entry: { createdAt: number }, lastSeenAt: number): boolean {
  return entry.createdAt > lastSeenAt
}

export function markSeen(): void {
  localStorage.setItem(STORAGE_KEY, Date.now().toString())
}
