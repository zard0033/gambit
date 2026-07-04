import { computed } from 'vue'
import { Chess } from 'chess.js'
import type { Rect } from '../utils/board-geometry'

/**
 * Pure: the square of the king that is currently in check, or null if no check / invalid FEN.
 * The side in check is the side to move, so we look up that king (story-006-visual-feedback AC-2).
 */
export function findKingInCheckSquare(fen: string): string | null {
  try {
    const chess = new Chess(fen)
    if (!chess.inCheck()) return null
    const [square] = chess.findPiece({ type: 'k', color: chess.turn() })
    return square ?? null
  } catch {
    // Invalid FEN — no check
    return null
  }
}

/**
 * Check-ring geometry: exposes the checked-king square (drives the sr-only "將軍" live region)
 * and the board-local rect used to position the SVG glow + border overlay.
 */
export function useBoardCheckRing(deps: {
  getFen: () => string
  /** True once the board API is mounted — matches the original boardApi.value guard. */
  isReady: () => boolean
  squareToRect: (square: string) => Rect | null
}): {
  kingInCheckSquare: import('vue').ComputedRef<string | null>
  checkRingRect: import('vue').ComputedRef<Rect | null>
} {
  const kingInCheckSquare = computed<string | null>(() => {
    if (!deps.isReady()) return null
    return findKingInCheckSquare(deps.getFen())
  })

  const checkRingRect = computed<Rect | null>(() => {
    const sq = kingInCheckSquare.value
    // squareToRect returns null when the board isn't measurable yet, so the original
    // `!boardRef.value` guard is subsumed here.
    if (!sq) return null
    return deps.squareToRect(sq)
  })

  return { kingInCheckSquare, checkRingRect }
}
