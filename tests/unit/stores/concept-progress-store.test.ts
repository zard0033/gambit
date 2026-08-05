// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: vi.fn() }, from: vi.fn() },
}))

import { useConceptProgressStore } from '@/stores/concept-progress'
import { useLessonProgressStore } from '@/stores/lesson-progress'

const STORAGE_KEY = 'pgr:concept:practice'

describe('useConceptProgressStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('test_markPracticed_addsToPracticeSolvedAndPersists', () => {
    const store = useConceptProgressStore()
    expect(store.isPracticeSolved('l2-some-fork')).toBe(false)

    store.markPracticed('l2-some-fork')

    expect(store.isPracticeSolved('l2-some-fork')).toBe(true)
    expect(store.practiceSolvedCount).toBe(1)
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.practiceSolved).toContain('l2-some-fork')
  })

  it('test_markPracticed_isIdempotent', () => {
    const store = useConceptProgressStore()
    store.markPracticed('p1')
    store.markPracticed('p1')
    expect(store.practiceSolvedCount).toBe(1)
  })

  it('test_load_corruptDataDegradesToEmpty', () => {
    localStorage.setItem(STORAGE_KEY, '{ not valid json')
    setActivePinia(createPinia())
    const store = useConceptProgressStore()
    expect(store.practiceSolvedCount).toBe(0)
  })

  it('test_load_rehydratesFromPersistedState', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ practiceSolved: ['a', 'b'] }))
    setActivePinia(createPinia())
    const store = useConceptProgressStore()
    expect(store.isPracticeSolved('a')).toBe(true)
    expect(store.isPracticeSolved('b')).toBe(true)
  })

  // ── Concept deepening (quick-spec concept-deepening-page §8 AC2) ──
  it('test_markDeepened_addsAndPersists', () => {
    const store = useConceptProgressStore()
    expect(store.isDeepened('fork')).toBe(false)

    store.markDeepened('fork')

    expect(store.isDeepened('fork')).toBe(true)
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.deepened).toContain('fork')
  })

  it('test_markDeepened_isIdempotent_forSet', () => {
    // deepenedConcepts Set deduplicates — calling twice should not add a second entry.
    const store = useConceptProgressStore()
    store.markDeepened('pin')
    store.markDeepened('pin')
    expect([...store.deepenedConcepts]).toEqual(['pin'])
  })

  it('test_deepened_rehydratesFromPersistedState', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ practiceSolved: [], deepened: ['mate'] }))
    setActivePinia(createPinia())
    const store = useConceptProgressStore()
    expect(store.isDeepened('mate')).toBe(true)
  })

  it('test_markDeepenedUnaided_addsAndPersists', () => {
    const store = useConceptProgressStore()
    store.markDeepenedUnaided('fork')
    expect([...store.deepenedUnaided]).toEqual(['fork'])
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.deepenedUnaided).toContain('fork')
  })

  it('test_markDeepenedUnaided_isIdempotent', () => {
    const store = useConceptProgressStore()
    store.markDeepenedUnaided('pin')
    store.markDeepenedUnaided('pin')
    expect([...store.deepenedUnaided]).toEqual(['pin'])
  })

  it('test_deepenedUnaided_rehydratesFromPersistedState', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ practiceSolved: [], deepenedUnaided: ['skewer'] }))
    setActivePinia(createPinia())
    const store = useConceptProgressStore()
    expect([...store.deepenedUnaided]).toEqual(['skewer'])
  })
})

// AC2: finishing a concept deepening writes ONLY the deepening signal — lesson `completed`,
// `isUnlocked`, and `nextLesson` are untouched (deepening never feeds linear progression).
describe('concept deepening — does not pollute lesson progress', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('test_markDeepened_leavesLessonProgressUntouched', () => {
    const lessons = useLessonProgressStore()
    const concept = useConceptProgressStore()

    const completedBefore = lessons.completedCount
    const nextBefore = lessons.nextLesson?.id

    concept.markDeepened('fork')

    expect(concept.isDeepened('fork')).toBe(true)
    expect(lessons.completedCount).toBe(completedBefore)
    expect(lessons.isCompleted('fork')).toBe(false)
    expect(lessons.nextLesson?.id).toBe(nextBefore)
  })
})

// D2 遷移：試煉外殼刪除後，舊的 `pgr:dungeon:progress` 沒有讀取端，裡面已解的題會讓概念地圖的
// 「已練」無聲退回未練。這組測試釘住三件事：真的併進來、真的寫進去（不是只留在記憶體）、
// 併完把來源鍵清掉且不重複遷移。
describe('D2 一次性遷移：舊試煉進度併入 practiceSolved', () => {
  const LEGACY = 'pgr:dungeon:progress'

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('test_legacyDungeonSolved_mergesIntoPracticeSolved_andPersists', () => {
    // Arrange
    localStorage.setItem(LEGACY, JSON.stringify({ solved: ['l1-capture-queen', 'l2-knight-fork-rook'], hinted: [] }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ practiceSolved: ['l3-existing'], deepened: [] }))

    // Act
    const store = useConceptProgressStore()

    // Assert — 記憶體有了
    expect(store.isPracticeSolved('l1-capture-queen')).toBe(true)
    expect(store.isPracticeSolved('l2-knight-fork-rook')).toBe(true)
    expect(store.isPracticeSolved('l3-existing')).toBe(true)
    // 而且真的落地了——沒 persist 的話來源鍵已刪，重載即失
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { practiceSolved: string[] }
    expect([...persisted.practiceSolved].sort()).toEqual(['l1-capture-queen', 'l2-knight-fork-rook', 'l3-existing'])
    // 來源鍵已清
    expect(localStorage.getItem(LEGACY)).toBeNull()
  })

  it('test_legacyKeyAbsent_isNoOp', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ practiceSolved: ['l3-existing'], deepened: [] }))
    const store = useConceptProgressStore()
    expect(store.isPracticeSolved('l3-existing')).toBe(true)
    expect(localStorage.getItem(LEGACY)).toBeNull()
  })

  it('test_corruptLegacyPayload_doesNotThrow_andStillClearsKey', () => {
    localStorage.setItem(LEGACY, '{ not json')
    expect(() => useConceptProgressStore()).not.toThrow()
    expect(localStorage.getItem(LEGACY)).toBeNull()
  })
})

