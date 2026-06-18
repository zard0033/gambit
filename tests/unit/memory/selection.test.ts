import { describe, it, expect } from 'vitest'
import { selectMoments, type SelectMomentsInput } from '@/modules/memory/selection'
import type { StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'
import type { ClassifyResult } from '@/modules/learning-loop/classify'

// Player = White → player moves at even position indices.
const playerEven = (i: number) => i % 2 === 0

/** A deep, non-mate analysis entry with a given side-to-move evalCp. */
function E(evalCp: number, bestMove: string | null = 'a2a3'): StoredAnalysisEntry {
  return { bestMove, evalCp, depthReached: 22, pv: [], pass: 'deep' }
}
/** A mate-score entry (evalCp undefined) — getEvalCp maps it to ±MATE_CP; favAt treats it as -Infinity. */
function Emate(evalMate: number): StoredAnalysisEntry {
  return { bestMove: 'a2a3', evalMate, depthReached: 22, pv: [], pass: 'deep' }
}

// Frozen test constants (GDD AC preamble — independent of live tuning defaults).
const T = { gate: 60, anchorFloor: 0, brightGate: 120, conceptBonus: 100, max: 5 }

function input(
  analysisResults: ReadonlyArray<StoredAnalysisEntry | null>,
  concepts: ReadonlyArray<ClassifyResult>,
  biggestSwingCursor: number | null,
): SelectMomentsInput {
  return { analysisResults, isPlayerMove: playerEven, concepts, biggestSwingCursor }
}

describe('selectMoments (F1)', () => {
  it('AC-2: returns 1..MAX moments in ascending ply order', () => {
    // player i ∈ {0,2,4}: cpLoss = 0, 200, 90
    const r = [E(10), E(-10), E(100), E(100), E(45), E(45), E(0)]
    const m = selectMoments(input(r, ['none', 'none', 'none', 'none', 'none', 'none', 'none'], 2), T)
    expect(m.map((x) => x.ply)).toEqual([2, 4]) // i0 (cp0) gated out; ascending
    expect(m.length).toBeLessThanOrEqual(T.max)
  })

  it('AC-2b: force-includes a low-ranked anchor; result is exactly MAX', () => {
    // six tactical blunders (cp300 → score 400) at 0,2,4,6,8,10 + a small anchor (cp40) at 12
    const r: StoredAnalysisEntry[] = []
    for (let i = 0; i < 12; i++) r.push(E(150)) // each adjacent pair sums to 300
    r.push(E(20), E(20)) // ply 12: cp40
    const concepts: ClassifyResult[] = Array(14).fill('none')
    for (const i of [0, 2, 4, 6, 8, 10]) concepts[i] = 'material'
    const m = selectMoments(input(r, concepts, 12), T)
    expect(m).toHaveLength(T.max) // exactly MAX
    const anchor = m.find((x) => x.ply === 12)
    expect(anchor?.anchor).toBe(true) // anchor survived eviction
    expect(m.map((x) => x.ply)).toEqual([...m.map((x) => x.ply)].sort((a, b) => a - b)) // ascending
  })

  it('AC-2c: gate boundary — cp==GATE kept, cp==GATE-1 dropped', () => {
    const r = [E(30), E(30), E(30), E(29)] // i0 cp60, i2 cp59
    const m = selectMoments(input(r, ['none', 'none', 'none', 'none'], null), T)
    expect(m.map((x) => x.ply)).toEqual([0])
  })

  it('AC-2c: bright (fav>=BRIGHT_GATE) kept even when cp<GATE', () => {
    const r = [E(-60), E(-60)] // i0: cp = max(0,-120)=0, fav = 120
    const m = selectMoments(input(r, ['none', 'none'], null), T)
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ ply: 0, kind: 'bright' })
  })

  it('AC-2c: anchor kept when cp>=ANCHOR_FLOOR even if cp<GATE', () => {
    const r = [E(15), E(15)] // i0 cp30 (< gate 60)
    const m = selectMoments(input(r, ['none', 'none'], 0), T)
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ ply: 0, anchor: true, kind: 'bright' })
  })

  it('AC-2d: a ply matching tactical + anchor yields ONE card, kind=tactical, anchor flag', () => {
    const r = [E(145), E(145)] // i0 cp290
    const m = selectMoments(input(r, ['material', 'none'], 0), T)
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ ply: 0, kind: 'tactical', anchor: true, concept: 'material' })
  })

  it('AC-3: a steady game (nothing gated, no anchor) returns []', () => {
    const r = [E(10), E(-10), E(20), E(-20)] // cpLoss 0, 0
    expect(selectMoments(input(r, ['none', 'none', 'none', 'none'], null), T)).toEqual([])
  })

  it('AC-4: anchor flagged when biggestSwingCursor set; no anchor moment when null', () => {
    const r = [E(100), E(100), E(45), E(45)] // i0 cp200, i2 cp90
    const withAnchor = selectMoments(input(r, ['none', 'none', 'none', 'none'], 0), T)
    expect(withAnchor.find((x) => x.ply === 0)?.anchor).toBe(true)
    const noAnchor = selectMoments(input(r, ['none', 'none', 'none', 'none'], null), T)
    expect(noAnchor.every((x) => x.anchor === false)).toBe(true)
    expect(noAnchor.map((x) => x.ply)).toEqual([0, 2]) // still surfaced as plain swings
  })

  it('AC-5: a blunder then its forced reply (i, i+1) collapses to one card', () => {
    // i0 = player blunder (cp200); i1 = opponent forced reply (NOT a player move → not a candidate)
    const r = [E(100), E(100), E(0)]
    const m = selectMoments(input(r, ['none', 'none', 'none'], 0), T)
    expect(m).toHaveLength(1)
    expect(m[0].ply).toBe(0)
  })

  it('AC-6: classify=none large swing is plain, never tactical', () => {
    const r = [E(150), E(150)] // cp300, concept none
    const m = selectMoments(input(r, ['none', 'none'], null), T)
    expect(m[0].kind).toBe('plain')
  })

  it('AC-6/mate-guard: a mate-scored neighbour never produces a spurious bright moment', () => {
    // Without the guard, fav = -(E0 + E1) = -(-100 + -MATE_CP) ≈ +30000 → spurious bright.
    const r = [E(-100), Emate(-5)]
    const m = selectMoments(input(r, ['none', 'none'], null), T)
    expect(m.every((x) => x.kind !== 'bright')).toBe(true)
    expect(m).toEqual([]) // cp=0 (clamped), not anchor, bright guarded → nothing
  })
})
