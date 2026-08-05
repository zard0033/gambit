import { Chess } from 'chess.js'
import type { GameHistoryEntry } from '@/types/game-history'
import type { CompletedGame } from '@/stores/game-store'

/**
 * Reconstruct the CompletedGame shape the post-game review engine needs from a stored history entry
 * (which keeps only the PGN, not the UCI move list). Lets 棋憶 review any past game by id, not just
 * the just-finished one. Returns null when the PGN can't be replayed (a malformed row must not crash
 * the view — the caller redirects).
 *
 * `completedAt` is set from `playedAt` so it equals the game's original completedAt — this keeps the
 * analysis cache key (`pgr:analysis:v<n>:<completedAt>`) and the memory summary game_id consistent with the
 * post-game pass, so re-opening a game is idempotent (no duplicate summary).
 */
export function historyEntryToCompletedGame(entry: GameHistoryEntry): CompletedGame | null {
  const chess = new Chess()
  try {
    chess.loadPgn(entry.pgn)
  } catch {
    return null
  }
  const moves = chess.history({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion ?? ''}`)
  if (moves.length === 0) return null
  // playedAt is the game's original completedAt; without it the summary game_id / analysis cache key
  // would collapse to "0" and collide across games — treat such an anomalous row as unreplayable.
  if (!entry.playedAt) return null

  return {
    moves,
    playerColor: entry.playerColor,
    result: resultFromPlayer(entry),
    endReason: endReasonFromDb(entry.endReason),
    completedAt: entry.playedAt.getTime(),
    aiSkillLevel: entry.aiDifficulty,
    playerMoveTimes: [],
    isTerminal: true,
  }
}

/**
 * Inverse of data-sync's `mapEndReason` (CompletedGame → DB). Until Game Export shipped, this
 * function returned a hardcoded 'resignation' placeholder — harmless while endReason only drove the
 * replay board's PGN `Termination` tag (always "normal" either way), but the export prompt states
 * the ending in words, so every past game claimed "my opponent resigned" even when it was mate.
 *
 * `draw_agreement` exists in the DB CHECK but has no CompletedGame member and is never written by
 * this app; it falls through to the default, which is safe because buildResultPlain decides
 * won/lost/draw from `result`, not from this value.
 */
function endReasonFromDb(dbValue: string): CompletedGame['endReason'] {
  const m: Record<string, CompletedGame['endReason']> = {
    checkmate: 'checkmate',
    stalemate: 'stalemate',
    resign: 'resignation',
    insufficient: 'insufficient-material',
    fifty_move: 'fifty-move',
    threefold: 'threefold',
  }
  return m[dbValue] ?? 'resignation'
}

/** Player-relative result (Win/Loss/Draw) + colour → standard PGN result. */
function resultFromPlayer(entry: GameHistoryEntry): CompletedGame['result'] {
  if (entry.playerResult === 'Win') return entry.playerColor === 'white' ? '1-0' : '0-1'
  if (entry.playerResult === 'Loss') return entry.playerColor === 'white' ? '0-1' : '1-0'
  return '1/2-1/2' // Draw or Unknown
}
