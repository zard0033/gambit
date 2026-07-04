/**
 * Unit tests for the pure helpers extracted from chess-board.vue during the god-component split:
 *   - findKingInCheckSquare (use-board-check-ring) — check-ring geometry source
 *   - computeCastleTargets  (use-board-castle-hints) — chess.com-style castling dot mapping
 * These paths previously lived inline in the component with no unit coverage.
 */
import { describe, it, expect } from 'vitest'
import { findKingInCheckSquare } from '../../../src/composables/use-board-check-ring'
import { computeCastleTargets } from '../../../src/composables/use-board-castle-hints'

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
// Both sides can castle either way (files between king and rooks are clear).
const BOTH_CASTLES_FEN = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1'
// Black rook on g1 checks the white king along rank 1 (white to move).
const WHITE_IN_CHECK_FEN = '4k3/8/8/8/8/8/8/4K1r1 w - - 0 1'
// White rook on g8 checks the black king along rank 8 (black to move).
const BLACK_IN_CHECK_FEN = '4k1R1/8/8/8/8/8/8/4K3 b - - 0 1'

describe('findKingInCheckSquare', () => {
  it('test_findKingInCheckSquare_startingPosition_returnsNull', () => {
    expect(findKingInCheckSquare(STARTING_FEN)).toBeNull()
  })

  it('test_findKingInCheckSquare_whiteKingInCheck_returnsWhiteKingSquare', () => {
    expect(findKingInCheckSquare(WHITE_IN_CHECK_FEN)).toBe('e1')
  })

  it('test_findKingInCheckSquare_blackKingInCheck_returnsBlackKingSquare', () => {
    expect(findKingInCheckSquare(BLACK_IN_CHECK_FEN)).toBe('e8')
  })

  it('test_findKingInCheckSquare_invalidFen_returnsNull', () => {
    expect(findKingInCheckSquare('not-a-fen')).toBeNull()
  })
})

describe('computeCastleTargets', () => {
  it('test_computeCastleTargets_whiteKingBothSides_returnsHAndARookTargets', () => {
    const targets = computeCastleTargets(BOTH_CASTLES_FEN, 'e1')
    // chess.js only accepts the two-square king move (e1→g1 / e1→c1); the rook square is the hint dot.
    expect(targets).toContainEqual({ rookSquare: 'h1', kingDest: 'g1' })
    expect(targets).toContainEqual({ rookSquare: 'a1', kingDest: 'c1' })
    expect(targets).toHaveLength(2)
  })

  it('test_computeCastleTargets_startingPositionKing_returnsEmpty', () => {
    // King boxed in at the start — no castling moves.
    expect(computeCastleTargets(STARTING_FEN, 'e1')).toEqual([])
  })

  it('test_computeCastleTargets_nonKingSquare_returnsEmpty', () => {
    // a1 rook is not a king — no castling hints.
    expect(computeCastleTargets(BOTH_CASTLES_FEN, 'a1')).toEqual([])
  })

  it('test_computeCastleTargets_emptySquare_returnsEmpty', () => {
    expect(computeCastleTargets(BOTH_CASTLES_FEN, 'd4')).toEqual([])
  })

  it('test_computeCastleTargets_invalidFen_returnsEmpty', () => {
    expect(computeCastleTargets('not-a-fen', 'e1')).toEqual([])
  })
})
