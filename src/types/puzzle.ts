/**
 * Puzzle types (GDD: design/gdd/dungeon-puzzle-mode.md — Appendix: Puzzle Data
 * Schema; §3.2。該 GDD 的關卡外殼已於 2026-08-05 刪除，解題本體仍有效)。
 *
 * Static, front-end-only data. A puzzle is one position (FEN, side-to-move = the
 * player) plus an authored `solution`: an alternating list of plies starting with the
 * player's move (even indices) and the scripted opponent reply (odd indices). A
 * well-formed solution has odd length (ends on a player ply). Validity (legal FEN with
 * both kings, fully-legal line, odd length, unique/contiguous order) is enforced by
 * tests/unit/data/puzzles.test.ts.
 */

/** A piece-promotion target for a solution move. */
export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

/** One half-move in a puzzle solution (origin → destination, optional promotion). */
export interface PuzzleMove {
  from: string
  to: string
  promotion?: PromotionPiece
}

/**
 * Puzzle theme. Drives the default prompt/success copy and the map node grouping
 * vocabulary; echoes the Lesson System tactics tier so concepts transfer.
 */
export type PuzzleMotif = 'capture' | 'fork' | 'pin' | 'mate-in-1' | 'mate-in-2'

/** A single authored puzzle. */
export interface Puzzle {
  id: string
  /** Display grouping on the map (1–3 for v0). Not a separate unlock gate. */
  level: 1 | 2 | 3
  /** Global position in the linear track (1-based, unique, contiguous). Drives unlock. */
  order: number
  motif: PuzzleMotif
  /** Short node label on the map, e.g.「棋子取奪」. */
  title: string
  /** The ask shown above the board, e.g.「白方走步，一步將死」. */
  prompt: string
  /**
   * One concrete sentence under the prompt that clarifies the goal (more explicit than
   * the terse `prompt`, less than `hint`). Restates the motif's aim; never names the
   * target square or the exact move — that stays the hint's job.
   */
  brief: string
  /** Start position; side-to-move = the player. Player orientation is derived from this. */
  fen: string
  /** Alternating player/opponent plies, player first, odd length. */
  solution: PuzzleMove[]
  /** Socratic hint — the idea / what to look for, never the move text. */
  hint: string
  /** Shown on solve: the transferable principle, never just「正確」. */
  successText: string
  /** mate-in-1 only: accept ANY legal checkmating move, not only `solution[0]`. */
  acceptAnyMate?: boolean
}
