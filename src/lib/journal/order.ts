import type { JournalEntry } from '@/types/journal'

/**
 * Timeline order (R2): newest first by `createdAt`, but `onset` is always pinned
 * last — it is the book's first page (oldest), regardless of timestamp.
 */
export function compareForTimeline(a: JournalEntry, b: JournalEntry): number {
  const aOnset = a.type === 'onset'
  const bOnset = b.type === 'onset'
  if (aOnset !== bOnset) return aOnset ? 1 : -1
  return b.createdAt - a.createdAt
}

/**
 * Merge entry lists, dedup by `sourceRefId` (first occurrence wins — pass cloud
 * before local so the cloud copy wins), then order for the timeline.
 */
export function mergeAndOrder(...lists: JournalEntry[][]): JournalEntry[] {
  const byRef = new Map<string, JournalEntry>()
  for (const list of lists) {
    for (const entry of list) {
      if (!byRef.has(entry.sourceRefId)) byRef.set(entry.sourceRefId, entry)
    }
  }
  return [...byRef.values()].sort(compareForTimeline)
}
