import { Chess } from 'chess.js'
import type { Move, Square } from 'chess.js'
import type { DrawShape, DrawBrushes } from 'chessground/draw'
import type { Key } from 'chessground/types'
import { PIECE_MOVE_ANIM_MS } from './use-board-renderer'
import type { MoveMadePayload } from './use-chess-board'

/** Chessground brush definitions — includes all required defaults plus custom overlays. */
export const BOARD_BRUSHES: DrawBrushes = {
  green:       { key: 'green',       color: '#15781B', opacity: 1,   lineWidth: 10 },
  red:         { key: 'red',         color: '#882020', opacity: 1,   lineWidth: 10 },
  blue:        { key: 'blue',        color: '#003088', opacity: 1,   lineWidth: 10 },
  yellow:      { key: 'yellow',      color: '#e68f00', opacity: 1,   lineWidth: 10 },
  legalDot:    { key: 'legalDot',    color: '#3e9c35', opacity: 0.5, lineWidth: 10 },
  captureRing: { key: 'captureRing', color: '#ee6644', opacity: 0.6, lineWidth: 10 },
}

/**
 * Pure function — builds DrawShape[] for all legal moves from a square.
 * Squares where a capture is possible use 'captureRing'; all others use 'legalDot'.
 * Returns [] when the square is empty or has no legal moves (e.g. wrong side to move).
 */
export function buildLegalMoveShapes(fromSquare: Key, fen: string): DrawShape[] {
  const chess = new Chess(fen)
  const moves = chess.moves({ square: fromSquare as Square, verbose: true }) as Move[]
  return moves.map((m) => ({
    orig: fromSquare,
    dest: m.to as Key,
    brush: m.captured !== undefined ? 'captureRing' : 'legalDot',
  }))
}

/**
 * Creates a Promise<void> that resolves when the moving piece animation finishes.
 * Primary: `transitionend` on `.cg-board piece` element.
 * Fallback: rAF-aligned setTimeout at PIECE_MOVE_ANIM_MS + 16ms (fires if no transitionend).
 */
export function buildAnimationDoneAt(boardRef: HTMLElement | null): Promise<void> {
  return new Promise<void>((resolve) => {
    const piece = boardRef?.querySelector<HTMLElement>('.cg-board piece') ?? null
    function handler(): void {
      clearTimeout(fallback)
      piece?.removeEventListener('transitionend', handler)
      requestAnimationFrame(() => resolve())
    }
    // Whichever fires first cleans up the other path, so a piece that never transitions (chessground
    // replaced the node mid-animation) still resolves without leaving a dangling listener.
    const fallback = setTimeout(() => {
      piece?.removeEventListener('transitionend', handler)
      requestAnimationFrame(() => resolve())
    }, PIECE_MOVE_ANIM_MS + 16)
    piece?.addEventListener('transitionend', handler)
  })
}

/**
 * Undo a rejected player move — the body of chess-board's `rejectMove`, kept pure so component
 * tests can bind it to a stub board. vue3-chessboard emits `move` BEFORE its own `board.move()`,
 * so the reset has to wait for the move's `animationDoneAt`; `stillValid` then re-checks the
 * caller's state, because the player may have switched cell/step or solved it during the wait.
 */
export async function rejectAfterMove(
  payload: Pick<MoveMadePayload, 'animationDoneAt'>,
  stillValid: () => boolean,
  reset: () => void,
): Promise<void> {
  await payload.animationDoneAt
  if (stillValid()) reset()
}
