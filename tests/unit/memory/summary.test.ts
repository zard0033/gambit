import { describe, it, expect } from 'vitest'
import { buildGameSummary } from '@/modules/memory/summary'
import type { Moment, Stage } from '@/types/memory'
import type { ClassifyResult } from '@/modules/learning-loop/classify'

function M(ply: number, concept: ClassifyResult): Moment {
  return { ply, kind: 'plain', anchor: false, concept, cp: 100, fav: -100 }
}

describe('buildGameSummary (F4 Step 1)', () => {
  const stageMap: Record<number, Stage> = { 2: 'opening', 6: 'middlegame', 10: 'endgame' }
  const stageOf = (ply: number) => stageMap[ply]

  it('counts pre-cap gated candidates by stage and concept; tags anchor stage', () => {
    const gated = [M(2, 'material'), M(6, 'none'), M(10, 'material')]
    const s = buildGameSummary({ gameId: 'g1', createdAt: 100, gated, stageOf, anchorPly: 6, schemaVersion: 1 })
    expect(s.stageCounts).toEqual({ opening: 1, middlegame: 1, endgame: 1 })
    expect(s.conceptCounts).toEqual({ material: 2 }) // 'none' not counted
    expect(s.anchorStage).toBe('middlegame')
    expect(s.schemaVersion).toBe(1)
    expect(s.gameId).toBe('g1')
    expect(s.createdAt).toBe(100)
  })

  it('anchorStage is null when anchorPly is null', () => {
    const s = buildGameSummary({ gameId: 'g2', createdAt: 200, gated: [M(2, 'none')], stageOf, anchorPly: null, schemaVersion: 1 })
    expect(s.anchorStage).toBeNull()
  })

  it('a steady game (no gated candidates) yields zero counts', () => {
    const s = buildGameSummary({ gameId: 'g3', createdAt: 300, gated: [], stageOf, anchorPly: null, schemaVersion: 1 })
    expect(s.stageCounts).toEqual({ opening: 0, middlegame: 0, endgame: 0 })
    expect(s.conceptCounts).toEqual({})
  })
})
