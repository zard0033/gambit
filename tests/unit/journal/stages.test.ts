import { describe, expect, it } from 'vitest'
import { lessons } from '@/data/lessons'
import { completedStages, unaidedDeepenedConcepts } from '@/lib/journal/stages'

const rulesIds = lessons.filter((l) => l.category === 'rules').map((l) => l.id)

describe('completedStages', () => {
  it('returns no stages when nothing is completed', () => {
    expect(completedStages(new Set())).toEqual([])
  })

  it('marks a category complete only when every lesson in it is completed', () => {
    const stages = completedStages(new Set(rulesIds))
    const rules = stages.find((s) => s.stageId === 'rules')
    expect(rules).toBeDefined()
    expect(rules?.volume).toBe('卷一規則')
    expect(rules?.params['卷名']).toBe('規則')
  })

  it('does not mark a category complete when one lesson is missing', () => {
    expect(rulesIds.length).toBeGreaterThan(1)
    const partial = new Set(rulesIds.slice(1)) // drop one
    expect(completedStages(partial).some((s) => s.stageId === 'rules')).toBe(false)
  })
})

describe('unaidedDeepenedConcepts', () => {
  it('derives volume from the teaching lesson category and uses the concept label as 概念', () => {
    const out = unaidedDeepenedConcepts(new Set(['fork']))
    expect(out).toEqual([{ conceptId: 'fork', volume: '卷二戰術', params: { 概念: '捉雙' } }])
  })

  it('skips unknown ids (no concept → nowhere to file)', () => {
    expect(unaidedDeepenedConcepts(new Set(['not-a-concept']))).toEqual([])
  })

  it('returns one entry per known concept', () => {
    const out = unaidedDeepenedConcepts(new Set(['fork', 'center']))
    expect(out.map((c) => c.conceptId).sort()).toEqual(['center', 'fork'])
    expect(out.find((c) => c.conceptId === 'center')?.volume).toBe('卷三開局')
  })
})
