import { SESSION_IDLE_TIMEOUT_MIN } from '@/config/journal-config'

/**
 * Device-local session tracking for the journal — used ONLY for ⑤ solace cooldown
 * counting and ④ carryover semantics (ADR-0013 §5). Never synced; not load-bearing
 * for onset/arrival correctness. A new session begins after SESSION_IDLE_TIMEOUT idle.
 */

const SESSION_KEY = 'chess:journal:session'
const LAST_SOLACE_KEY = 'chess:journal:lastSolaceOrdinal'

interface SessionState {
  ordinal: number
  lastActivityAt: number
}

function readSession(): SessionState | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as SessionState
    if (typeof s.ordinal === 'number' && typeof s.lastActivityAt === 'number') return s
  } catch {
    // corrupt — treat as no session
  }
  return null
}

/**
 * Record activity and return the current session ordinal, bumping it when the idle gap
 * since last activity exceeds SESSION_IDLE_TIMEOUT. First ever call returns 1.
 */
export function touchSession(now: number): number {
  const idleMs = SESSION_IDLE_TIMEOUT_MIN * 60_000
  const prev = readSession()
  const ordinal = !prev || now - prev.lastActivityAt > idleMs ? (prev?.ordinal ?? 0) + 1 : prev.ordinal
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ordinal, lastActivityAt: now }))
  }
  return ordinal
}

/** Sessions since the last solace was written (∞ if never) — drives SOLACE_COOLDOWN. */
export function sessionsSinceLastSolace(currentOrdinal: number): number {
  if (typeof localStorage === 'undefined') return Number.POSITIVE_INFINITY
  const raw = localStorage.getItem(LAST_SOLACE_KEY)
  if (raw === null) return Number.POSITIVE_INFINITY
  const last = Number(raw)
  return Number.isNaN(last) ? Number.POSITIVE_INFINITY : currentOrdinal - last
}

/** Remember the session ordinal a solace was written in (for the cooldown window). */
export function recordSolaceSession(currentOrdinal: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LAST_SOLACE_KEY, String(currentOrdinal))
}
