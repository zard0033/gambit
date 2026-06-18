import { describe, it, expect } from 'vitest'
import { classifyStage, nonPawnMaterial } from '@/modules/memory/stage'
import { ENDGAME_MATERIAL, OPENING_MATERIAL } from '@/config/memory-config'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const TWO_ROOKS = '4k3/8/8/8/8/8/8/R3K2R w - - 0 1' // non-pawn = 10
const Q_AND_N = '4k3/8/8/8/8/8/8/Q3K1N1 w - - 0 1' // non-pawn = 12 (== ENDGAME_MATERIAL boundary)
const MID_40 = 'k7/8/8/8/8/8/8/QQRRBBNN w - - 0 1' // non-pawn = 40

// Frozen test constants (GDD AC preamble).
const T = { endgameMaterial: 12, openingPlyMax: 16, openingMaterial: 56 }

describe('nonPawnMaterial (F5)', () => {
  it('full board = 62; counts only non-pawn non-king pieces', () => {
    expect(nonPawnMaterial(START)).toBe(62)
    expect(nonPawnMaterial(TWO_ROOKS)).toBe(10)
    expect(nonPawnMaterial(Q_AND_N)).toBe(12)
    expect(nonPawnMaterial(MID_40)).toBe(40)
  })
})

describe('classifyStage (F5, AC-13)', () => {
  it('endgame at the material boundary (nonPawnMaterial == ENDGAME_MATERIAL)', () => {
    expect(classifyStage(30, Q_AND_N, 8, T)).toBe('endgame')
  })

  it('opening via the in-book path (ply <= bookExitPly)', () => {
    // mat 40 (< OPENING_MATERIAL) so only the in-book branch can make it opening
    expect(classifyStage(5, MID_40, 8, T)).toBe('opening')
  })

  it('opening via the out-of-book path (ply <= OPENING_PLY_MAX && material >= OPENING_MATERIAL)', () => {
    expect(classifyStage(10, START, null, T)).toBe('opening')
  })

  it('unknown opening (no bookExitPly) falls back to the ply+material path (EC-8)', () => {
    expect(classifyStage(10, START, null, T)).toBe('opening')
    // out of the opening window with full material but high ply → middlegame, not opening
    expect(classifyStage(20, START, null, T)).toBe('middlegame')
  })

  it('endgame-first: low material at low ply is endgame, not opening', () => {
    expect(classifyStage(2, TWO_ROOKS, 8, T)).toBe('endgame')
  })

  it('middlegame is the catch-all', () => {
    expect(classifyStage(20, MID_40, 8, T)).toBe('middlegame')
  })
})

describe('F5 invariant', () => {
  it('ENDGAME_MATERIAL < OPENING_MATERIAL', () => {
    expect(ENDGAME_MATERIAL).toBeLessThan(OPENING_MATERIAL)
  })
})
