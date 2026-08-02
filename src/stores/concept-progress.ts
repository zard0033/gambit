import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useDataSyncStore } from '@/stores/data-sync'

const STORAGE_KEY = 'pgr:concept:practice'

interface ProgressShape {
  practiceSolved: string[]
  /** Concepts whose deepening page the player has completed (quick-specs/concept-deepening-page.md). */
  deepened?: string[]
  /** Concepts whose deepening silent gate was solved with no aid — triggers the epiphany journal pen. */
  deepenedUnaided?: string[]
}

/** Read a persisted string[] field from STORAGE_KEY. Corrupt/absent → []; progress must never throw. */
function loadField(field: 'practiceSolved' | 'deepened' | 'deepenedUnaided'): string[] {
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
 * Concept progress (Learning Loop #20 + concept deepening). Two independent quiet signals, both kept
 * SEPARATE from the dungeon's linear `solved` set and from lesson `completed` (no leak into unlock):
 *  - `practiceSolved`: puzzles solved from a lesson's Bridge-1 CTA in practice mode (D1 side-door).
 *  - `deepenedConcepts`: concepts whose deepening page the player has finished.
 * localStorage is the offline cache; `concept_deepened` (Supabase, via data-sync per ADR-0011) is the
 * cross-device source of truth for deepening once logged in. `practiceSolved` stays localStorage-only.
 */
export const useConceptProgressStore = defineStore('conceptProgress', () => {
  const practiceSolved = ref<Set<string>>(new Set(loadField('practiceSolved')))
  const deepenedConcepts = ref<Set<string>>(new Set(loadField('deepened')))
  const deepenedUnaided = ref<Set<string>>(new Set(loadField('deepenedUnaided')))

  function persist(): void {
    if (typeof localStorage === 'undefined') return
    const payload: ProgressShape = {
      practiceSolved: [...practiceSolved.value],
      deepened: [...deepenedConcepts.value],
      deepenedUnaided: [...deepenedUnaided.value],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  function isPracticeSolved(puzzleId: string): boolean {
    return practiceSolved.value.has(puzzleId)
  }

  /** Record a puzzle solved in practice mode. Idempotent; persists to localStorage. */
  function markPracticed(puzzleId: string): void {
    if (practiceSolved.value.has(puzzleId)) return
    practiceSolved.value.add(puzzleId)
    practiceSolved.value = new Set(practiceSolved.value) // new ref so computed deps re-run
    persist()
  }

  function isDeepened(conceptId: string): boolean {
    return deepenedConcepts.value.has(conceptId)
  }

  /** Record a concept's deepening as completed. Idempotent (Set deduplication). */
  function markDeepened(conceptId: string): void {
    const isNew = !deepenedConcepts.value.has(conceptId)
    if (isNew) {
      deepenedConcepts.value.add(conceptId)
      deepenedConcepts.value = new Set(deepenedConcepts.value)
      // Best-effort cloud write; no-ops when logged out (re-flushed on next login).
      void useDataSyncStore().upsertDeepenedConcepts([conceptId])
    }
    persist()
  }

  /**
   * Record that a concept's deepening silent gate was solved with no aid. Idempotent; localStorage
   * only — the epiphany journal entry it triggers is the cross-device source of truth (it cloud-syncs
   * via the journal queue). The journal's settle dedups, so re-marking never double-writes.
   */
  function markDeepenedUnaided(conceptId: string): void {
    if (deepenedUnaided.value.has(conceptId)) return
    deepenedUnaided.value.add(conceptId)
    deepenedUnaided.value = new Set(deepenedUnaided.value)
    persist()
  }

  /** Pull cloud-only deepened concepts into the local set (union). Called on login. */
  async function syncFromCloud(): Promise<void> {
    const cloud = await useDataSyncStore().loadDeepenedConcepts()
    let changed = false
    for (const id of cloud) {
      if (!deepenedConcepts.value.has(id)) {
        deepenedConcepts.value.add(id)
        changed = true
      }
    }
    if (changed) {
      deepenedConcepts.value = new Set(deepenedConcepts.value)
      persist()
    }
  }

  /** Reconcile on login: push local-only deepened concepts up, then pull cloud-only ones down. */
  async function reconcileOnLogin(): Promise<void> {
    if (deepenedConcepts.value.size > 0) {
      await useDataSyncStore().upsertDeepenedConcepts([...deepenedConcepts.value])
    }
    await syncFromCloud()
  }

  const practiceSolvedCount = computed(() => practiceSolved.value.size)

  return {
    practiceSolved,
    practiceSolvedCount,
    isPracticeSolved,
    markPracticed,
    deepenedConcepts,
    isDeepened,
    markDeepened,
    deepenedUnaided,
    markDeepenedUnaided,
    reconcileOnLogin,
  }
})
