import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { JournalEntry, Volume } from '@/types/journal'
import { useDataSyncStore } from '@/stores/data-sync'
import { useLessonProgressStore } from '@/stores/lesson-progress'
import { useGameHistoryStore } from '@/stores/game-history'
import { mergeAndOrder } from '@/lib/journal/order'
import { completedStages } from '@/lib/journal/stages'
import { recordSolaceSession, sessionsSinceLastSolace, touchSession } from '@/lib/journal/session'
import { outcomeFromResult, planEntries, type PlayedGame, type SettleSnapshot } from '@/lib/journal/settle'

/**
 * Journal (棋誌) store — owns the merged, timeline-ordered view (ADR-0005, ADR-0013).
 * Derivation/settle logic is story-002; this store loads and presents. It never imports
 * supabase — persistence routes through useDataSyncStore (ADR-0011).
 */
export const useJournalStore = defineStore('journal', () => {
  /** Merged (cloud ∪ local), deduped by sourceRefId, ordered newest-first with onset pinned last. */
  const entries = ref<JournalEntry[]>([])

  /** Load + merge the cloud set with locally-held entries (guest + unsynced). */
  async function load(): Promise<void> {
    const dataSync = useDataSyncStore()
    const cloud = await dataSync.loadJournalEntries()
    const local = dataSync.readLocalJournalEntries()
    entries.value = mergeAndOrder(cloud, local)
  }

  /**
   * Settle: derive eligible candidates from persistent state (F1), select ≤cap by priority
   * (F2), write them, reload. Idempotent — safe to call on any trigger (app-start / journal-open
   * / stage-complete / game-end); duplicates are no-ops via the event-key unique constraint.
   * `now` is injectable for tests.
   */
  async function evaluate(now: number = Date.now()): Promise<void> {
    const dataSync = useDataSyncStore()
    const lessonProgress = useLessonProgressStore()
    const gameHistory = useGameHistoryStore()

    await load()
    if (gameHistory.entries.length === 0) {
      try {
        await gameHistory.fetchHistory()
      } catch {
        // No history → solace simply won't fire. Onset/arrival are unaffected.
      }
    }

    const ordinal = touchSession(now)
    const recentGames: PlayedGame[] = gameHistory.entries.map((g) => ({
      id: g.id,
      outcome: outcomeFromResult(g.playerResult),
    }))

    const snapshot: SettleSnapshot = {
      hasOnset: entries.value.some((e) => e.type === 'onset'),
      completedStages: completedStages(lessonProgress.completed),
      recordedStageIds: new Set(
        entries.value.filter((e) => e.type === 'arrival').map((e) => e.sourceRefId),
      ),
      recentGames,
      sessionsSinceLastSolace: sessionsSinceLastSolace(ordinal),
      now,
      newId: () => crypto.randomUUID(),
    }

    const planned = planEntries(snapshot)
    if (planned.length === 0) return

    for (const entry of planned) {
      await dataSync.appendJournalEntry(entry)
      if (entry.type === 'solace') recordSolaceSession(ordinal)
    }
    await load()
  }

  /**
   * On login: flush locally-held entries to the cloud (union by source_ref_id — no dup, no loss),
   * then reload the merged view. Wired from App.vue's userId watch (mirrors the other stores).
   */
  async function reconcileOnLogin(): Promise<void> {
    const dataSync = useDataSyncStore()
    await dataSync.flushJournalQueue()
    await load()
  }

  /** The most recent `n` entries (homepage peek — HOMEPAGE_PEEK_COUNT). */
  function recent(n: number): JournalEntry[] {
    return entries.value.slice(0, n)
  }

  /** Entries grouped by volume for the overview (onset, volume=null, is excluded). */
  function byVolume(): Record<Volume, JournalEntry[]> {
    const groups: Record<Volume, JournalEntry[]> = { 卷一規則: [], 卷二戰術: [], 卷三開局: [], 卷四殘局: [] }
    for (const entry of entries.value) {
      if (entry.volume) groups[entry.volume].push(entry)
    }
    return groups
  }

  return { entries, load, evaluate, reconcileOnLogin, recent, byVolume }
})
