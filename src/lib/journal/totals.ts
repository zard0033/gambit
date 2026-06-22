/**
 * 棋誌 running totals — Neve's quiet companionship markers for the 棋誌 header (memory GDD Rule 24).
 *
 * These are PRESENCE markers (games remembered, days together, entries written), NOT performance
 * statistics. The journal GDD §Visual bars win-rate / rating / accuracy scorecards; companionship
 * totals are a different category and live here, rendered as one line of Neve's voice — never a
 * stats dashboard. "Days together" counts up from first appearance and never resets (not a streak).
 */

export interface JournalTotals {
  /** Games Neve remembers (all of game_sessions, not the loaded page). */
  games: number
  /** Journal entries written so far (= journal.entries.length, includes onset). */
  entries: number
  /** Calendar days since first appearance, inclusive. */
  days: number
}

const DAY_MS = 86_400_000

/** Calendar days from first appearance to `now`, inclusive (day 1 = first day). Normalised to local
 *  midnight; rounding absorbs the ±1h a DST transition adds/removes between two midnights, so only the
 *  whole-day delta counts in either direction. Clamped to ≥1 for clock skew (now before first). */
export function daysTogether(firstTs: number, now: number): number {
  const a = new Date(firstTs)
  a.setHours(0, 0, 0, 0)
  const b = new Date(now)
  b.setHours(0, 0, 0, 0)
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1)
}

/** Neve's first-person running-total line for the 棋誌 header. Returns null until there's a game to
 *  remember (games === 0) — the onset entry + the header's companion line already carry day one. */
export function totalsLine(t: JournalTotals): string | null {
  if (t.games <= 0) return null
  return `我們同行 ${t.days} 天了，我記得你的 ${t.games} 盤棋，也為你寫下了 ${t.entries} 篇。`
}
