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
    // History stores no structured endReason; placeholder → buildPgn's Termination tag is "normal"
    // (correct for every non-abandoned end). The pgn only renders the replay board, never exported.
    endReason: 'resignation',
    completedAt: entry.playedAt.getTime(),
    aiSkillLevel: entry.aiDifficulty,
    playerMoveTimes: [],
    isTerminal: true,
  }
}

/** Player-relative result (Win/Loss/Draw) + colour → standard PGN result. */
function resultFromPlayer(entry: GameHistoryEntry): CompletedGame['result'] {
  if (entry.playerResult === 'Win') return entry.playerColor === 'white' ? '1-0' : '0-1'
  if (entry.playerResult === 'Loss') return entry.playerColor === 'white' ? '0-1' : '1-0'
  return '1/2-1/2' // Draw or Unknown
}
