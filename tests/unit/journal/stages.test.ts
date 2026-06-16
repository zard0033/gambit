import { describe, expect, it } from 'vitest'
import { lessons } from '@/data/lessons'
import { completedStages } from '@/lib/journal/stages'

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
