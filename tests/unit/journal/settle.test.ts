import { describe, expect, it } from 'vitest'
import type { Volume } from '@/types/journal'
import {
  deriveCandidates,
  leadingLossRun,
  outcomeFromResult,
  planEntries,
  selectCandidates,
  type Candidate,
  type CompletedStage,
  type PlayedGame,
  type SettleSnapshot,
} from '@/lib/journal/settle'

function stage(stageId: string, volume: Volume): CompletedStage {
  return { stageId, volume, params: { 卷名: stageId } }
}

function losses(n: number): PlayedGame[] {
  return Array.from({ length: n }, (_, i) => ({ id: `g${i}`, outcome: 'loss' as const }))
}

function snap(o: Partial<SettleSnapshot> = {}): SettleSnapshot {
  return {
    hasOnset: o.hasOnset ?? false,
    completedStages: o.completedStages ?? [],
    recordedStageIds: o.recordedStageIds ?? new Set<string>(),
    recentGames: o.recentGames ?? [],
    sessionsSinceLastSolace: o.sessionsSinceLastSolace ?? Number.POSITIVE_INFINITY,
    now: o.now ?? 1000,
    newId: o.newId ?? (() => 'id'),
  }
}

describe('leadingLossRun', () => {
  it('counts the leading run of losses, newest-first', () => {
    const games: PlayedGame[] = [
      { id: 'a', outcome: 'loss' },
      { id: 'b', outcome: 'loss' },
      { id: 'c', outcome: 'win' },
      { id: 'd', outcome: 'loss' },
    ]
    expect(leadingLossRun(games)).toEqual({ count: 2, triggeringGameId: 'a' })
  })

  it('returns 0 / null when the newest game is not a loss', () => {
    expect(leadingLossRun([{ id: 'a', outcome: 'win' }])).toEqual({ count: 0, triggeringGameId: null })
  })
})

describe('outcomeFromResult', () => {
  it('maps Win/Loss to win/loss and everything else to draw', () => {
    expect(outcomeFromResult('Win')).toBe('win')
    expect(outcomeFromResult('Loss')).toBe('loss')
    expect(outcomeFromResult('Draw')).toBe('draw')
    expect(outcomeFromResult('Unknown')).toBe('draw')
  })
})

describe('deriveCandidates — onset (R6 once-only)', () => {
  it('AC-onset-1: yields onset when none exists', () => {
    const c = deriveCandidates(snap({ hasOnset: false }))
    expect(c).toEqual([{ pen: 'onset', sourceRefId: 'onset', volume: null, params: {} }])
  })

  it('AC-onset-2: no onset when one already exists', () => {
    expect(deriveCandidates(snap({ hasOnset: true }))).toEqual([])
  })
})

describe('deriveCandidates — arrival', () => {
  it('AC-arrival-1: yields arrival for a completed, not-yet-recorded stage', () => {
    const c = deriveCandidates(
      snap({ hasOnset: true, completedStages: [stage('rules', '卷一規則')] }),
    )
    expect(c).toEqual([{ pen: 'arrival', sourceRefId: 'rules', volume: '卷一規則', params: { 卷名: 'rules' } }])
  })

  it('AC-arrival-2: skips a stage that already has an arrival', () => {
    const c = deriveCandidates(
      snap({
        hasOnset: true,
        completedStages: [stage('rules', '卷一規則')],
        recordedStageIds: new Set(['rules']),
      }),
    )
    expect(c).toEqual([])
  })

  it('AC-arrival-3: with one of two stages recorded, only the un-recorded one remains', () => {
    const c = deriveCandidates(
      snap({
        hasOnset: true,
        completedStages: [stage('rules', '卷一規則'), stage('tactics', '卷二戰術')],
        recordedStageIds: new Set(['rules']),
      }),
    )
    expect(c.map((x) => x.sourceRefId)).toEqual(['tactics'])
  })
})

describe('deriveCandidates — solace', () => {
  it('AC-solace-1: yields solace at streak with cooldown satisfied', () => {
    const c = deriveCandidates(
      snap({ hasOnset: true, recentGames: losses(3), sessionsSinceLastSolace: 3 }),
    )
    expect(c).toEqual([{ pen: 'solace', sourceRefId: 'g0', volume: '卷二戰術', params: {} }])
  })

  it('AC-solace-2: no solace below the loss streak', () => {
    expect(deriveCandidates(snap({ hasOnset: true, recentGames: losses(2), sessionsSinceLastSolace: 9 }))).toEqual([])
  })

  it('AC-solace-2: no solace within the cooldown window', () => {
    expect(deriveCandidates(snap({ hasOnset: true, recentGames: losses(3), sessionsSinceLastSolace: 2 }))).toEqual([])
  })
})

describe('selectCandidates — F2 priority + cap', () => {
  const onset: Candidate = { pen: 'onset', sourceRefId: 'onset', volume: null, params: {} }
  const arrival = (id: string): Candidate => ({ pen: 'arrival', sourceRefId: id, volume: '卷一規則', params: {} })
  const solace: Candidate = { pen: 'solace', sourceRefId: 'g0', volume: '卷二戰術', params: {} }

  it('AC-priority-2: arrival and solace both kept; arrival sorts above solace', () => {
    const out = selectCandidates([solace, arrival('rules')])
    expect(out.map((c) => c.pen)).toEqual(['arrival', 'solace'])
  })

  it('AC-priority-1: never writes more than the cap', () => {
    const out = selectCandidates([onset, arrival('a'), arrival('b'), arrival('c'), solace])
    expect(out).toHaveLength(3)
  })

  it('AC-priority-3: when over cap, keeps the highest-priority cap (onset + arrivals, drops solace)', () => {
    const out = selectCandidates([solace, arrival('a'), arrival('b'), onset])
    expect(out.map((c) => c.pen)).toEqual(['onset', 'arrival', 'arrival'])
    expect(out.some((c) => c.pen === 'solace')).toBe(false)
  })
})

describe('planEntries', () => {
  it('builds a rendered, immutable entry per selected candidate', () => {
    let n = 0
    const entries = planEntries(
      snap({ hasOnset: false, now: 5000, newId: () => `id-${n++}` }),
    )
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ type: 'onset', sourceRefId: 'onset', volume: null, createdAt: 5000 })
    expect(entries[0].templateId).toMatch(/^onset\./)
    expect(entries[0].body.length).toBeGreaterThan(0)
    expect(entries[0].id).toBe('id-0')
  })

  it('AC-priority-1: writes at most SESSION_ENTRY_CAP entries', () => {
    const entries = planEntries(
      snap({
        hasOnset: false,
        completedStages: [stage('rules', '卷一規則'), stage('tactics', '卷二戰術')],
        recentGames: losses(3),
        sessionsSinceLastSolace: 9,
      }),
    )
    expect(entries.length).toBeLessThanOrEqual(3)
  })
})
