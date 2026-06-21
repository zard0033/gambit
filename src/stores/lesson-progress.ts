import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { lessons } from '@/data/lessons'
import type { Lesson } from '@/types/lesson'
import { useDataSyncStore } from '@/stores/data-sync'

const STORAGE_KEY = 'pgr:lessons:progress'

interface ProgressShape {
  completed: string[]
}

/** Read the persisted completed[] from STORAGE_KEY. Corrupt/absent → []; progress must never throw. */
function loadCompleted(): string[] {
  if (typeof localStorage === 'undefined') return []
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as ProgressShape
    const arr = parsed?.completed
    if (!Array.isArray(arr)) return []
    return arr.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

/**
 * Lesson progress store (S12-02). localStorage is the offline cache for instant
 * paint and unauthenticated play; Supabase (`lesson_progress`, via the data-sync
 * store per ADR-0011) is the cross-device source of truth once logged in.
 * Completion is monotonic, so reconciliation is a union — local and cloud never conflict.
 */
export const useLessonProgressStore = defineStore('lessonProgress', () => {
  const completed = ref<Set<string>>(new Set(loadCompleted()))

  function persist(): void {
    if (typeof localStorage === 'undefined') return
    const payload: ProgressShape = { completed: [...completed.value] }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  function isCompleted(id: string): boolean {
    return completed.value.has(id)
  }

  function markComplete(id: string): void {
    if (completed.value.has(id)) return
    completed.value.add(id)
    completed.value = new Set(completed.value) // new ref so computed deps re-run
    persist()
    // Best-effort cloud write; no-ops when logged out (re-flushed on next login).
    void useDataSyncStore().upsertLessonProgress([id])
  }

  /** Pull cloud completions into the local set (union). Called on login. */
  async function syncFromCloud(): Promise<void> {
    const cloudCompleted = await useDataSyncStore().loadLessonProgress()
    let changed = false
    for (const id of cloudCompleted) {
      if (!completed.value.has(id)) {
        completed.value.add(id)
        changed = true
      }
    }
    if (changed) {
      completed.value = new Set(completed.value)
      persist()
    }
  }

  /** Reconcile local and cloud on login: push local-only completions up, then pull cloud-only down. */
  async function reconcileOnLogin(): Promise<void> {
    if (completed.value.size > 0) {
      await useDataSyncStore().upsertLessonProgress([...completed.value])
    }
    await syncFromCloud()
  }

  /**
   * A lesson is unlocked iff it is first in the curriculum (`order === 1`) or the
   * immediately-preceding lesson by `order` has been completed. Catalog orders are
   * contiguous; a missing predecessor is treated as unlocked (defensive, no lock-out).
   */
  function isUnlocked(lesson: Lesson): boolean {
    if (lesson.order === 1) return true
    const prev = lessons.find((l) => l.order === lesson.order - 1)
    if (!prev) return true
    return completed.value.has(prev.id)
  }

  const completedCount = computed(() => completed.value.size)
  const totalCount = lessons.length
  const progress = computed(() => (totalCount === 0 ? 0 : completedCount.value / totalCount))

  /** First unlocked, not-yet-completed lesson in curriculum order — the "continue learning" target. */
  const nextLesson = computed(
    () => lessons.find((l) => isUnlocked(l) && !completed.value.has(l.id)) ?? null,
  )

  return {
    completed,
    isCompleted,
    markComplete,
    isUnlocked,
    reconcileOnLogin,
    completedCount,
    totalCount,
    progress,
    nextLesson,
  }
})
