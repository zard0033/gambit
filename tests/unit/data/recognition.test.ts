import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import { recognitionSets, getRecognitionSet } from '../../../src/data/concept-deepening/recognition'

// Recognition-gate content-validity gate (quick-specs/concept-deepening-page.md §15.7 gate ①).
// chess.js-level checks only — Stockfish uniqueness/refutation (gate ②) is the @spike, adversarial
// review (gate ③) is manual. Every board: legal FEN (both kings), white to move, white not in check.
// real: expectedMove legal. decoy: temptMove is a legal check; refutation legal + captures the bait.

const sets = Object.values(recognitionSets).filter((s) => s !== undefined)
const allBoards = sets.flatMap((s) => s.boards.map((b) => ({ conceptId: s.conceptId, b })))

describe('recognition-gate catalog', () => {
  it('test_catalog_conceptIdMatchesKey', () => {
    for (const [key, s] of Object.entries(recognitionSets)) {
      expect(s?.conceptId, `key ${key} mismatches conceptId`).toBe(key)
    }
  })

  it('test_catalog_hasIntroMissedHintAndBoards', () => {
    for (const s of sets) {
      expect(s.intro.trim(), `${s.conceptId}: empty intro`).toBeTruthy()
      expect(s.missedHint.trim(), `${s.conceptId}: empty missedHint`).toBeTruthy()
      expect(s.boards.length, `${s.conceptId}: needs ≥2 boards`).toBeGreaterThanOrEqual(2)
    }
  })

  it('test_catalog_hasBothRealAndDecoy', () => {
    // No decoy → can't train "recognise it's NOT here"; no real → can't train "recognise it IS here".
    for (const s of sets) {
      expect(s.boards.some((b) => b.kind === 'real'), `${s.conceptId}: no real board`).toBe(true)
      expect(s.boards.some((b) => b.kind === 'decoy'), `${s.conceptId}: no decoy board`).toBe(true)
    }
  })

  it('test_getRecognitionSet', () => {
    expect(getRecognitionSet('fork')).toBe(recognitionSets.fork)
    expect(getRecognitionSet('no-such-concept')).toBeUndefined()
  })
})

describe('recognition-gate chess-validity', () => {
  it('test_everyBoard_fenLegal_whiteToMove_whiteNotInCheck', () => {
    for (const { conceptId, b } of allBoards) {
      const chess = new Chess(b.fen) // throws on illegal FEN → fails loudly
      expect(chess.turn(), `${conceptId} "${b.fen}": side-to-move must be white`).toBe('w')
      expect(chess.inCheck(), `${conceptId} "${b.fen}": white must not be in check`).toBe(false)
    }
  })

  it('test_realBoard_expectedMoveIsLegal', () => {
    for (const { conceptId, b } of allBoards) {
      if (b.kind !== 'real') continue
      const chess = new Chess(b.fen)
      expect(
        () => chess.move({ from: b.expectedMove.from, to: b.expectedMove.to }),
        `${conceptId}: illegal expectedMove ${b.expectedMove.from}${b.expectedMove.to}`,
      ).not.toThrow()
    }
  })

  it('test_decoyBoard_temptIsLegalCheck_refutationCapturesBait', () => {
    for (const { conceptId, b } of allBoards) {
      if (b.kind !== 'decoy') continue
      const chess = new Chess(b.fen)
      const tempt = chess.move({ from: b.temptMove.from, to: b.temptMove.to })
      expect(tempt.san.includes('+'), `${conceptId}: temptMove ${tempt.san} should be a check (the bait)`).toBe(true)
      const refute = chess.move({ from: b.refutation.from, to: b.refutation.to })
      expect(refute.captured, `${conceptId}: refutation must capture a piece`).toBeTruthy()
      expect(refute.to, `${conceptId}: refutation must capture on the tempt square`).toBe(b.temptMove.to)
    }
  })
})
