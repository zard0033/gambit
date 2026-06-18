import { describe, it, expect } from 'vitest'
import { evalWhiteSeries } from '@/modules/memory/derive'
import { EVAL_CHART_CLAMP_CP } from '@/config/memory-config'
import type { StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'

function E(evalCp: number): StoredAnalysisEntry {
  return { bestMove: 'a2a3', evalCp, depthReached: 22, pv: [], pass: 'deep' }
}
function Emate(evalMate: number): StoredAnalysisEntry {
  return { bestMove: 'a2a3', evalMate, depthReached: 22, pv: [], pass: 'deep' }
}

describe('evalWhiteSeries (F2)', () => {
  it('keeps even-index evals, negates odd-index (White normalization)', () => {
    expect(evalWhiteSeries([E(100), E(100), E(-40)])).toEqual([100, -100, -40])
  })

  it('clamps to ±EVAL_CHART_CLAMP_CP', () => {
    expect(evalWhiteSeries([E(9999), E(-9999)])).toEqual([EVAL_CHART_CLAMP_CP, EVAL_CHART_CLAMP_CP])
    // i1 odd: -9999 → clamp -400 → negate → +400
  })

  it('maps mate scores to the clamp bound by sign (not ±MATE_CP on the chart)', () => {
    expect(evalWhiteSeries([Emate(3)])).toEqual([EVAL_CHART_CLAMP_CP]) // even, White mating
    expect(evalWhiteSeries([Emate(-3)])).toEqual([-EVAL_CHART_CLAMP_CP]) // even, Black mating
    expect(evalWhiteSeries([E(0), Emate(3)])[1]).toBe(-EVAL_CHART_CLAMP_CP) // odd index negates
  })

  it('returns null where no analysis entry exists (chart gap)', () => {
    expect(evalWhiteSeries([null, E(50)])).toEqual([null, -50])
  })
})
