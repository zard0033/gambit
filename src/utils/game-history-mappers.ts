import type { GameHistoryEntry, Cursor } from '@/types/game-history'

/** Formula 1 — map DB result + player color to display result */
export function mapPlayerResult(
  result: string,
  playerColor: string,
): { playerResult: GameHistoryEntry['playerResult']; playerResultPrefix: GameHistoryEntry['playerResultPrefix'] } {
  if (result === 'draw') return { playerResult: 'Draw', playerResultPrefix: '½' }
  if (result === 'white_wins') {
    return playerColor === 'white'
      ? { playerResult: 'Win', playerResultPrefix: 'W' }
      : { playerResult: 'Loss', playerResultPrefix: 'L' }
  }
  if (result === 'black_wins') {
    return playerColor === 'black'
      ? { playerResult: 'Win', playerResultPrefix: 'W' }
      : { playerResult: 'Loss', playerResultPrefix: 'L' }
  }
  // Unknown result (e.g. 'abandoned')
  console.warn(`[game-history] Unrecognised result value: "${result}"`)
  return { playerResult: 'Unknown', playerResultPrefix: '?' }
}

/**
 * Skill Level → label (GDD game-history Formula 2, revised 2026-07-29).
 * Bands are cut so each difficulty-ladder rung (skill 3/6/9/11/17, see config/difficulty-tuning.ts)
 * lands in a band of its own — under the previous bands rungs 3 and 4 both read 'Intermediate'
 * and the ladder looked flat in game history. Still covers 0–20 with no gaps: games recorded
 * before the ladder existed hold arbitrary Skill Levels and must keep resolving to a label.
 */
const DIFFICULTY_RANGES: Array<[number, number, string]> = [
  [0, 4, 'Beginner'],
  [5, 7, 'Easy'],
  [8, 10, 'Intermediate'],
  [11, 14, 'Hard'],
  [15, 20, 'Master'],
]

/** Formula 2 — map aiDifficulty number to label */
export function mapDifficultyLabel(aiDifficulty: unknown): string {
  if (aiDifficulty === null || aiDifficulty === undefined) return 'Unknown'
  if (typeof aiDifficulty !== 'number' || Number.isNaN(aiDifficulty)) return 'Unknown'
  for (const [min, max, label] of DIFFICULTY_RANGES) {
    if (aiDifficulty >= min && aiDifficulty <= max) return label
  }
  // finite out-of-range
  console.warn(`[game-history] aiDifficulty out of range: ${aiDifficulty}`)
  return 'Unknown'
}

/** Formula 3 — parse played_at into Date + display string */
export function mapDisplayDate(playedAt: string): { date: Date | null; displayDate: string } {
  const date = new Date(playedAt)
  if (isNaN(date.getTime())) return { date: null, displayDate: '—' }
  return {
    date,
    displayDate: date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
  }
}

const END_REASON_MAP: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  resign: 'Resignation',
  draw_agreement: 'Agreed draw',
  threefold: 'Threefold repetition',
  insufficient: 'Insufficient material',
  fifty_move: '50-move rule',
}

/** Formula 4 — map DB end_reason to display string */
export function mapEndReasonDisplay(endReason: string): string {
  const mapped = END_REASON_MAP[endReason]
  if (mapped) return mapped
  console.warn(`[game-history] Unrecognised end_reason value: "${endReason}"`)
  return endReason  // raw passthrough
}

/** Opening priority: opening_name > opening_eco > 'Unknown opening' */
export function mapOpeningDisplay(openingName: string | null, openingEco: string | null): string {
  if (openingName) return openingName
  if (openingEco) return openingEco
  return 'Unknown opening'
}

/** Map a raw game_sessions DB row to a GameHistoryEntry display model.
 *  Accepts Record<string, unknown> because Supabase returns untyped rows. */
export function mapRowToEntry(raw: Record<string, unknown>): GameHistoryEntry {
  const row = raw as {
    id: string; played_at: string; result: string; player_color: string
    end_reason: string; ai_difficulty: number; move_count: number
    opening_name: string | null; opening_eco: string | null; pgn: string
  }
  const { playerResult, playerResultPrefix } = mapPlayerResult(row.result, row.player_color)
  const { date, displayDate } = mapDisplayDate(row.played_at)
  return {
    id: row.id,
    playedAt: date,
    displayDate,
    playerResult,
    playerResultPrefix,
    playerColor: row.player_color as 'white' | 'black',
    endReason: row.end_reason,
    endReasonDisplay: mapEndReasonDisplay(row.end_reason),
    aiDifficulty: row.ai_difficulty,
    difficultyLabel: mapDifficultyLabel(row.ai_difficulty),
    moveCount: row.move_count,
    openingName: row.opening_name,
    openingEco: row.opening_eco,
    openingDisplay: mapOpeningDisplay(row.opening_name, row.opening_eco),
    pgn: row.pgn,
  }
}

/** Build the next cursor from the last row of a result set.
 *  Accepts Record<string, unknown> because Supabase returns untyped rows. */
export function buildCursor(raw: Record<string, unknown>): Cursor {
  const row = raw as { played_at: string; created_at: string; id: string }
  return { playedAt: row.played_at, createdAt: row.created_at, id: row.id }
}
