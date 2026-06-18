import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { lessons } from '@/data/lessons'
import type { Lesson } from '@/types/lesson'
import { useDataSyncStore } from '@/stores/data-sync'

const STORAGE_KEY = 'pgr:lessons:progress'

interface ProgressShape {
  completed: string[]
  // Lessons learned out-of-order via the Concept tab's side-door (Learning Loop #20). Kept SEPARATE
  // from `completed` on purpose — mirrors the dungeon's practice-vs-solved split (GDD §3.2 D1): a
  // side-door learn lights the Concept Map's 已學 but must NOT feed `isUnlocked` / linear progression.
  sideLearned?: string[]
}

/** Read a persisted string[] field from STORAGE_KEY. Corrupt/absent → []; progress must never throw. */
function loadField(field: 'completed' | 'sideLearned'): string[] {
  if (typeof localStorage === 'undefined') return []
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as ProgressShape
    const arr = parsed?.[field]
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
  const completed = ref<Set<string>>(new Set(loadField('completed')))
  // Side-door learns (Concept tab). localStorage-only for now; not yet cloud-synced.
  const sideLearned = ref<Set<string>>(new Set(loadField('sideLearned')))

  function persist(): void {
    if (typeof localStorage === 'undefined') return
    const payload: ProgressShape = {
      completed: [...completed.value],
      sideLearned: [...sideLearned.value],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  function isCompleted(id: string): boolean {
    return completed.value.has(id)
  }

  /**
   * 已學 for the Concept Map: completed linearly OR learned via the Concept tab side-door. This is the
   * union that lights the map; `isUnlocked` deliberately does NOT consult `sideLearned` (no leak).
   */
  function isLearned(id: string): boolean {
    return completed.value.has(id) || sideLearned.value.has(id)
  }

  /** Record a side-door learn. No-op if already completed linearly (that's the stronger state). */
  function markSideLearned(id: string): void {
    if (completed.value.has(id) || sideLearned.value.has(id)) return
    sideLearned.value.add(id)
    sideLearned.value = new Set(sideLearned.value)
    persist()
    // Best-effort cloud write; no-ops when logged out (re-flushed on next login).
    void useDataSyncStore().upsertSideLearned([id])
  }

  function markComplete(id: string): void {
    if (completed.value.has(id)) return
    completed.value.add(id)
    completed.value = new Set(completed.value) // new ref so computed deps re-run
    persist()
    // Best-effort cloud write; no-ops when logged out (re-flushed on next login).
    void useDataSyncStore().upsertLessonProgress([id])
  }

  /** Pull cloud completions + side-door learns into the local sets (union). Called on login. */
  async function syncFromCloud(): Promise<void> {
    const dataSync = useDataSyncStore()
    const [cloudCompleted, cloudSideLearned] = await Promise.all([
      dataSync.loadLessonProgress(),
      dataSync.loadSideLearned(),
    ])
    let changed = false
    for (const id of cloudCompleted) {
      if (!completed.value.has(id)) {
        completed.value.add(id)
        changed = true
      }
    }
    // A side-door learn that has since been completed linearly is redundant — skip it.
    for (const id of cloudSideLearned) {
      if (!completed.value.has(id) && !sideLearned.value.has(id)) {
        sideLearned.value.add(id)
        changed = true
      }
    }
    if (changed) {
      completed.value = new Set(completed.value)
      sideLearned.value = new Set(sideLearned.value)
      persist()
    }
  }

  /**
   * Reconcile local and cloud on login: push local-only completions + side-door learns up,
   * then pull cloud-only ones down. Wire to the App.vue userId watch.
   */
  async function reconcileOnLogin(): Promise<void> {
    const dataSync = useDataSyncStore()
    if (completed.value.size > 0) {
      await dataSync.upsertLessonProgress([...completed.value])
    }
    if (sideLearned.value.size > 0) {
      await dataSync.upsertSideLearned([...sideLearned.value])
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
    sideLearned,
    isCompleted,
    isLearned,
    markComplete,
    markSideLearned,
    isUnlocked,
    reconcileOnLogin,
    completedCount,
    totalCount,
    progress,
    nextLesson,
  }
})
