// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Logged-out by default → cloud writes no-op; we only test the local-cache + unlock logic here.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: vi.fn() }, from: vi.fn() },
}))

import { useLessonProgressStore } from '@/stores/lesson-progress'
import { lessons } from '@/data/lessons'

const STORAGE_KEY = 'pgr:lessons:progress'

function lessonByOrder(order: number) {
  const lesson = lessons.find((l) => l.order === order)
  if (!lesson) throw new Error(`no lesson with order ${order}`)
  return lesson
}

describe('useLessonProgressStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('test_unlock_first_lesson_is_always_unlocked', () => {
    const store = useLessonProgressStore()
    expect(store.isUnlocked(lessonByOrder(1))).toBe(true)
  })

  it('test_unlock_second_lesson_locked_until_first_complete', () => {
    const store = useLessonProgressStore()
    const second = lessonByOrder(2)
    expect(store.isUnlocked(second)).toBe(false)

    store.markComplete(lessonByOrder(1).id)
    expect(store.isUnlocked(second)).toBe(true)
  })

  it('test_mark_complete_persists_to_localStorage', () => {
    const store = useLessonProgressStore()
    store.markComplete(lessonByOrder(1).id)

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toEqual({ completed: [lessonByOrder(1).id] })
  })

  it('test_mark_complete_is_idempotent', () => {
    const store = useLessonProgressStore()
    const id = lessonByOrder(1).id
    store.markComplete(id)
    store.markComplete(id)
    expect(store.completedCount).toBe(1)
  })

  it('test_progress_is_completed_over_total', () => {
    const store = useLessonProgressStore()
    expect(store.progress).toBe(0)
    store.markComplete(lessonByOrder(1).id)
    expect(store.progress).toBeCloseTo(1 / lessons.length)
  })

  it('test_corrupt_localStorage_treated_as_empty', () => {
    localStorage.setItem(STORAGE_KEY, '{ not valid json')
    setActivePinia(createPinia())
    const store = useLessonProgressStore()
    expect(store.completedCount).toBe(0)
    expect(store.isUnlocked(lessonByOrder(1))).toBe(true)
  })

  it('test_hydrates_completed_from_localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: [lessonByOrder(1).id] }))
    setActivePinia(createPinia())
    const store = useLessonProgressStore()
    expect(store.isCompleted(lessonByOrder(1).id)).toBe(true)
    expect(store.isUnlocked(lessonByOrder(2))).toBe(true)
  })
})
