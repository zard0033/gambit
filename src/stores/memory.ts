import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MemoryGameSummary } from '@/types/memory'
import { useDataSyncStore } from '@/stores/data-sync'
import { MEMORY_SUMMARY_SCHEMA_VERSION } from '@/config/memory-config'

/**
 * 棋憶 (Memory) store — owns the durable cross-game window ONLY (ADR-0005, ADR-0014). Per-game
 * moment selection is pure functions in `src/modules/memory`. Never imports supabase — persistence
 * routes through useDataSyncStore (ADR-0011).
 */
export const useMemoryStore = defineStore('memory', () => {
  /** Merged (cloud ∪ local), deduped by gameId, current schema_version only. */
  const summaries = ref<MemoryGameSummary[]>([])

  function mergeCurrentSchema(...lists: MemoryGameSummary[][]): MemoryGameSummary[] {
    const byGame = new Map<string, MemoryGameSummary>()
    for (const list of lists) {
      for (const s of list) {
        if (s.schemaVersion !== MEMORY_SUMMARY_SCHEMA_VERSION) continue // ignore-on-mismatch (ADR-0014 §5)
        if (!byGame.has(s.gameId)) byGame.set(s.gameId, s) // cloud listed first → wins over local
      }
    }
    return [...byGame.values()]
  }

  /** Load + merge the cloud set with locally-held summaries (guest + unsynced). */
  async function load(): Promise<void> {
    const dataSync = useDataSyncStore()
    const cloud = await dataSync.loadMemorySummaries()
    const local = dataSync.readLocalMemorySummaries()
    summaries.value = mergeCurrentSchema(cloud, local)
  }

  /** Persist this game's summary (write-once; re-deriving is a no-op), then reload the window. */
  async function recordGame(summary: MemoryGameSummary): Promise<void> {
    const dataSync = useDataSyncStore()
    await dataSync.appendMemorySummary(summary)
    await load()
  }

  /** On login: flush locally-held summaries to the cloud (union by game_id), then reload. */
  async function reconcileOnLogin(): Promise<void> {
    const dataSync = useDataSyncStore()
    await dataSync.flushMemoryQueue()
    await load()
  }

  return { summaries, load, recordGame, reconcileOnLogin }
})
