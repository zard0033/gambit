import { describe, it, expect } from 'vitest'
import { pickNeveLine } from '@/modules/memory/cross-game'
import type { MemoryGameSummary } from '@/types/memory'

// Frozen test constants (GDD AC preamble).
const T = { window: 10, minSample: 6, minStage: 3, improveDelta: 0.3, conceptFrac: 0.5 }

// Monotonic createdAt so summaries built left-to-right are chronological (older first).
let seq = 0
function S(opts: {
  opening?: number
  middlegame?: number
  endgame?: number
  concepts?: Record<string, number>
}): MemoryGameSummary {
  return {
    schemaVersion: 1,
    gameId: 'g',
    createdAt: seq++,
    stageCounts: { opening: opts.opening ?? 0, middlegame: opts.middlegame ?? 0, endgame: opts.endgame ?? 0 },
    conceptCounts: opts.concepts ?? {},
    anchorStage: null,
  }
}
const rep = (n: number, s: MemoryGameSummary) => Array.from({ length: n }, () => s)

describe('pickNeveLine (F4)', () => {
  it('AC-12: < OBS_MIN_SAMPLE games → first-or-few, never a fabricated trend', () => {
    const r = pickNeveLine(rep(5, S({ opening: 1 })), T)
    expect(r).toEqual({ kind: 'first-or-few', n: 5 })
  })

  it('AC-12: >= sample with no trend → exactly one (neutral) line', () => {
    const r = pickNeveLine(rep(6, S({ opening: 1 })), T)
    expect(r).toEqual({ kind: 'neutral', n: 6 })
  })

  it('AC-12b: improving wins over a co-occurring recurring concept', () => {
    // older half: high endgame + material; recent half: low endgame, same material
    const older = rep(3, S({ endgame: 4, concepts: { material: 2 } }))
    const recent = rep(3, S({ endgame: 1, concepts: { material: 2 } }))
    const r = pickNeveLine([...older, ...recent], T)
    expect(r).toEqual({ kind: 'improving', stage: 'endgame', n: 6 })
  })

  it('AC-12b: improve-delta boundary — drop == delta fires, drop < delta does not', () => {
    // older endgame sum 10 (4,3,3), recent sum 7 (3,2,2): drop = 3/10 = 0.30 → fires
    const fires = pickNeveLine(
      [S({ endgame: 4 }), S({ endgame: 3 }), S({ endgame: 3 }), S({ endgame: 3 }), S({ endgame: 2 }), S({ endgame: 2 })],
      T,
    )
    expect(fires).toMatchObject({ kind: 'improving', stage: 'endgame' })

    // older 10, recent 8: drop 0.20 < 0.30 → not improving (no concept → neutral)
    const below = pickNeveLine(
      [S({ endgame: 4 }), S({ endgame: 3 }), S({ endgame: 3 }), S({ endgame: 3 }), S({ endgame: 3 }), S({ endgame: 2 })],
      T,
    )
    expect(below.kind).not.toBe('improving')
  })

  it('AC-12b: a stage with < OBS_MIN_STAGE moments in a half is skipped (no trend, no div-by-zero)', () => {
    // opening older sum 2 (< minStage 3) though recent sum 6 — must NOT fire improving on opening
    const r = pickNeveLine(
      [S({ opening: 1 }), S({ opening: 1 }), S({ opening: 0 }), S({ opening: 2 }), S({ opening: 2 }), S({ opening: 2 })],
      T,
    )
    expect(r.kind).not.toBe('improving')
    expect(Number.isNaN((r as { n: number }).n)).toBe(false)
  })

  it('recurring: one concept >= OBS_CONCEPT_FRAC of gated concept-moments', () => {
    // no stage trend (flat), material is 100% of concepts
    const r = pickNeveLine(rep(6, S({ middlegame: 1, concepts: { material: 3 } })), T)
    expect(r).toEqual({ kind: 'recurring', concept: 'material', n: 6 })
  })
})
