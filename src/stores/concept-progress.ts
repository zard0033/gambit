import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useDataSyncStore } from '@/stores/data-sync'

const STORAGE_KEY = 'pgr:concept:practice'

interface ProgressShape {
  practiceSolved: string[]
  /** Concepts whose deepening page the player has completed (quick-specs/concept-deepening-page.md). */
  deepened?: string[]
  /** Concepts whose deepening silent gate was solved with no aid. 目前無消費端——見 store 檔頭。 */
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
 * Concept progress (Learning Loop #20 + concept deepening). Kept SEPARATE from lesson `completed`
 * (no leak into unlock):
 *  - `practiceSolved`: puzzles solved in practice mode. **自 2026-08-05（v2 的 D2）起這是「已練」的
 *    唯一來源**——試煉的線性 `solved` set 與 `dungeon_progress` 雲端表都隨外殼刪除了。副作用：已練
 *    從 cloud-synced 降級成 device-local，換裝置／清快取即失。舊的本機試煉進度由下方一次性遷移併入。
 *  - `deepenedConcepts`: concepts whose deepening page the player has finished.
 *  - `deepenedUnaided`: 無求助通關的概念。**目前沒有任何讀取端**（唯一消費端 epiphany 棋誌筆已於
 *    D1 刪除），仍持續寫入是因為它落在認知遷移軸上、是唯一的「無求助」持久訊號。
 *    登記在 technical-preferences 的 Deferred Cleanups，有日期與具名用途；不是忘了刪的死碼。
 * localStorage is the offline cache; `concept_deepened` (Supabase, via data-sync per ADR-0011) is the
 * cross-device source of truth for deepening once logged in. `practiceSolved` stays localStorage-only.
 */
const LEGACY_DUNGEON_KEY = 'pgr:dungeon:progress'

/**
 * 一次性遷移（2026-08-05，v2 的 D2）：試煉外殼刪除後 `pgr:dungeon:progress` 不再有讀取端，
 * 裡面已解的題會讓概念地圖的「已練」金幣無聲退回未練。這裡只**讀出**要併入的 id，
 * 真正的刪鍵在寫入成功之後才做（見 store 內的呼叫點）——順序反了就是資料遺失。
 * 只遷移本機那份：雲端 `dungeon_progress` 表刻意保留未 drop，但讀它的 data-sync 函式已隨 D2 移除，
 * 為了遷移把它加回來不划算——代價是只在別台裝置解過的試煉進度不會回來。
 */
function readLegacyDungeonSolved(): string[] {
  if (typeof localStorage === 'undefined') return []
  const raw = localStorage.getItem(LEGACY_DUNGEON_KEY)
  if (!raw) return []
  try {
    const solved = (JSON.parse(raw) as { solved?: unknown }).solved
    return Array.isArray(solved) ? solved.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return [] // 壞掉的舊資料不該擋住啟動
  }
}

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

  // 舊試煉進度併入：persist() 已就緒才做，寫成功後才刪來源鍵。無鍵時整段是 no-op。
  if (typeof localStorage !== 'undefined' && localStorage.getItem(LEGACY_DUNGEON_KEY) !== null) {
    for (const id of readLegacyDungeonSolved()) practiceSolved.value.add(id)
    practiceSolved.value = new Set(practiceSolved.value)
    persist()
    localStorage.removeItem(LEGACY_DUNGEON_KEY)
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
