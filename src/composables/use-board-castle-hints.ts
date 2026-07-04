import { computed, ref } from 'vue'
import { Chess } from 'chess.js'
import type { Square } from 'chess.js'
import type { Rect } from '../utils/board-geometry'

export interface CastleTarget {
  /** The rook square (h/a file) that gets a tappable dot while the king is selected. */
  rookSquare: string
  /** The king's two-square destination — chess.js only accepts e1→g1/c1, never e1→h1. */
  kingDest: string
}

/**
 * Pure: given a selected king square + FEN, the castling targets (rook square + king destination).
 * Returns [] when the square isn't a king, has no castling moves, or the FEN is invalid.
 *
 * chess.com / lichess-style castling: picking up the king reveals a dot on the rook square (h/a)
 * in addition to chessground's native two-square dot (g/c). Each rook square maps back to the
 * standard king two-square move.
 */
export function computeCastleTargets(fen: string, square: string): CastleTarget[] {
  try {
    const chess = new Chess(fen)
    const piece = chess.get(square as Square)
    if (!piece || piece.type !== 'k') return []
    const targets: CastleTarget[] = []
    for (const m of chess.moves({ square: square as Square, verbose: true })) {
      const kingside = m.flags.includes('k')
      const queenside = m.flags.includes('q')
      if (!kingside && !queenside) continue
      const rookSquare = (kingside ? 'h' : 'a') + square[1]
      targets.push({ rookSquare, kingDest: m.to })
    }
    return targets
  } catch {
    return []
  }
}

export interface CastleHint extends CastleTarget {
  rect: Rect
}

/**
 * Owns the chessground selection square (set by boardConfig.events.select, cleared on move /
 * disable) and derives the tappable castling hints from it. `triggerCastle` runs the standard
 * king two-square move via the injected requestMove.
 */
export function useBoardCastleHints(deps: {
  getFen: () => string
  isDisabled: () => boolean
  squareToRect: (square: string) => Rect | null
  requestMove: (from: string, to: string) => void
}): {
  selectedSquare: import('vue').Ref<string | null>
  castleHints: import('vue').ComputedRef<CastleHint[]>
  triggerCastle: (kingDest: string) => void
} {
  const selectedSquare = ref<string | null>(null)

  const castleHints = computed<CastleHint[]>(() => {
    const sq = selectedSquare.value
    if (!sq || deps.isDisabled()) return []
    const hints: CastleHint[] = []
    for (const t of computeCastleTargets(deps.getFen(), sq)) {
      const rect = deps.squareToRect(t.rookSquare)
      if (rect) hints.push({ rookSquare: t.rookSquare, kingDest: t.kingDest, rect })
    }
    return hints
  })

  function triggerCastle(kingDest: string): void {
    const from = selectedSquare.value
    if (!from || deps.isDisabled()) return
    selectedSquare.value = null
    deps.requestMove(from, kingDest)
  }

  return { selectedSquare, castleHints, triggerCastle }
}
