// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// dungeon-progress imports data-sync → supabase; stub it so the zero-mutation test can
// instantiate the dungeon store logged-out (cloud writes no-op).
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: vi.fn() }, from: vi.fn() },
}))

import { useConceptProgressStore } from '@/stores/concept-progress'
import { useDungeonProgressStore } from '@/stores/dungeon-progress'
import { useLessonProgressStore } from '@/stores/lesson-progress'
import { puzzles } from '@/data/puzzles'

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

  it('test_markDeepened_incrementsCountEachCall', () => {
    // deepenedCount always increments for variant rotation (spec §10 MINIMAL AC-V3).
    const store = useConceptProgressStore()
    expect(store.deepenedCount['fork']).toBeUndefined()
    store.markDeepened('fork')
    expect(store.deepenedCount['fork']).toBe(1)
    store.markDeepened('fork')
    expect(store.deepenedCount['fork']).toBe(2)
  })

  it('test_deepenedCount_persistsAndRehydrates', () => {
    const store = useConceptProgressStore()
    store.markDeepened('mate')
    store.markDeepened('mate')
    // Reload store from localStorage
    setActivePinia(createPinia())
    const store2 = useConceptProgressStore()
    expect(store2.deepenedCount['mate']).toBe(2)
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

// AC-03 (D1 zero-mutation invariant): a practice solve must leave the DUNGEON store's solved
// set, currentOrder, and every node's state byte-for-byte identical. This is the invariant the
// whole side-door rests on — practice progress lives in a separate store and never touches #19.
describe('D1 side-door — practice solve does not mutate dungeon progress', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('test_practiceSolve_leavesDungeonStoreIdentical', () => {
    const dungeon = useDungeonProgressStore()
    const concept = useConceptProgressStore()

    // Snapshot the dungeon's full observable state before any practice.
    const before = {
      solved: [...dungeon.solved].sort(),
      currentOrder: dungeon.currentOrder,
      solvedCount: dungeon.solvedCount,
      nodeStates: puzzles.map((p) => dungeon.nodeState(p)),
    }

    // Practice-solve a puzzle deep in the locked range (the flagship fork/pin case).
    const deepLocked = puzzles[puzzles.length - 1]
    concept.markPracticed(deepLocked.id)

    const after = {
      solved: [...dungeon.solved].sort(),
      currentOrder: dungeon.currentOrder,
      solvedCount: dungeon.solvedCount,
      nodeStates: puzzles.map((p) => dungeon.nodeState(p)),
    }

    expect(after).toEqual(before)
    // And the practice solve is recorded where it belongs.
    expect(concept.isPracticeSolved(deepLocked.id)).toBe(true)
    expect(dungeon.isSolved(deepLocked.id)).toBe(false)
  })
})
