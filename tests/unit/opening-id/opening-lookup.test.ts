import { describe, it, expect } from 'vitest'
import { identifyOpening, identifyPosition } from '../../../src/modules/opening-id/opening-index'
import type { OpeningResult } from '../../../src/modules/opening-id/opening-index'

// Italian Game moves in LAN notation (confirmed by probe: C50 at ply 5)
const ITALIAN_MOVES = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4']
// Known opening EPD after 1.e4 e5 2.Nf3 Nc6 3.Bc4
const ITALIAN_EPD = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -'
// After 1.a3 a6: ply-1 matches A00 Anderssen's, ply-2 exits ECO
const A00_THEN_EXIT_MOVES = ['a3', 'a6']

describe('identifyOpening', () => {
  // AC-1: identifies Italian Game
  it('test_identifyOpening_italianGame_returnsC50AtPly5', () => {
    // Arrange + Act
    const result = identifyOpening(ITALIAN_MOVES)

    // Assert
    expect(result.eco).toBe('C50')
    expect(result.matchedPly).toBe(5)
    expect(result.isUnknown).toBe(false)
    expect(result.name).toContain('Italian')
  })

  // AC-2: sequence that exits ECO after ply 1 — bestMatch is the last matched ply
  // Note: all 20 legal first moves are in ECO A00; isUnknown:true only happens with empty array
  it('test_identifyOpening_sequenceExitingEco_returnsLastMatchedPly', () => {
    // Arrange + Act — 1.a3 (A00 Anderssen's) then a6 (exits ECO)
    const result = identifyOpening(A00_THEN_EXIT_MOVES)

    // Assert — ply 1 (a3) matched A00; ply 2 (a6) not in ECO → bookExitPly=2
    expect(result.isUnknown).toBe(false)
    expect(result.eco).toBe('A00')
    expect(result.matchedPly).toBe(1)
    expect(result.bookExitPly).toBe(2)
  })

  it('test_identifyOpening_emptyMoves_returnsIsUnknownTrue', () => {
    // Arrange + Act
    const result = identifyOpening([])

    // Assert
    expect(result.isUnknown).toBe(true)
    expect(result.matchedPly).toBe(0)
  })

  // AC-4: completes without error for a full-length game. Wall-clock performance
  // (target ≤20ms) is not asserted here — a wall-clock threshold is non-deterministic
  // under test-environment load (coding-standards "no time-dependent assertions");
  // verified manually in Chrome DevTools instead.
  it('test_identifyOpening_40Plies_completesWithWellFormedResult', () => {
    // Arrange: 40 half-moves from the Ruy Lopez (verified valid SAN sequence)
    const moves = [
      'e4','e5','Nf3','Nc6','Bb5','a6','Ba4','Nf6','O-O','Be7',
      'Re1','b5','Bb3','d6','c3','O-O','h3','Nb8','d4','Nbd7',
      'Nbd2','Bb7','Bc2','Re8','Nf1','Bf8','Ng3','g6','a4','c5',
      'd5','c4','b4','cxb3','Bxb3','Nc5','Bc2','Rc8','Bb2','Qc7',
    ]

    // Act
    const result = identifyOpening(moves)

    // Assert — a 40-ply game completes without throwing and returns a well-formed result
    expect(result.matchedPly).toBeGreaterThan(0)
    expect(result.matchedPly).toBeLessThanOrEqual(moves.length)
    expect(typeof result.isUnknown).toBe('boolean')
  })

  // AC-5: OpeningResult type has no evaluative fields
  it('test_identifyOpening_result_hasNoEvaluativeFields', () => {
    const result: OpeningResult = identifyOpening(ITALIAN_MOVES)
    // TypeScript compile-time: property access on OpeningResult type
    // Runtime: verify the keys returned do not include forbidden names
    const keys = Object.keys(result)
    const forbidden = ['quality', 'score', 'winRate', 'recommendation', 'judgment', 'accuracy']
    for (const f of forbidden) {
      expect(keys).not.toContain(f)
    }
  })
})

describe('identifyPosition', () => {
  // AC-3: direct EPD lookup returns result
  it('test_identifyPosition_italianEpd_returnsC50', () => {
    // Arrange + Act
    const result = identifyPosition(ITALIAN_EPD)

    // Assert
    expect(result).not.toBeNull()
    expect(result?.eco).toBe('C50')
    expect(result?.name).toBeTruthy()
  })

  it('test_identifyPosition_unknownEpd_returnsNull', () => {
    // Arrange + Act — after 1.a3 a6 — not in database
    const result = identifyPosition('rnbqkbnr/1ppppppp/p7/8/8/P7/1PPPPPPP/RNBQKBNR w KQkq -')

    // Assert
    expect(result).toBeNull()
  })

  it('test_identifyPosition_startingPosition_returnsNullOrEntry', () => {
    // Starting position has no ECO code in chess-openings@0.1.1
    // Document actual behavior: returns null (confirmed by probe)
    const result = identifyPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -')
    expect(result).toBeNull()
  })
})
