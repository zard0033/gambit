import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { CompletedGame } from '@/stores/game-store'
import { UNSYNCED_QUEUE_MAX } from '@/config/sync-tuning'
import { HISTORY_LOAD_LIMIT } from '@/config/history-config'
import type { Cursor } from '@/types/game-history'
import type { ResumeSnapshot } from '@/types/resume'
import type { JournalEntry } from '@/types/journal'
import { buildPgn } from '@/modules/game-export/assembler'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

const UNSYNCED_PREFIX = 'chess:unsynced:'
/** Guest (logged-out) journal entries — the local-first 棋誌 (ADR-0013 §3). */
const JOURNAL_ENTRIES_KEY = 'chess:journal:entries'
/** Logged-in entries that failed to insert; keyed by source_ref_id so retry is idempotent. */
const JOURNAL_UNSYNCED_PREFIX = 'chess:journal:unsynced:'

/** CompletedGame extended with a stable client-generated UUID for idempotent DB inserts. */
interface QueuedGame extends CompletedGame {
  readonly id: string
}

function mapResult(r: CompletedGame['result']): 'white_wins' | 'black_wins' | 'draw' {
  if (r === '1-0') return 'white_wins'
  if (r === '0-1') return 'black_wins'
  return 'draw'
}

function mapEndReason(r: CompletedGame['endReason']): string {
  const m: Record<CompletedGame['endReason'], string> = {
    checkmate: 'checkmate',
    stalemate: 'stalemate',
    resignation: 'resign',
    'insufficient-material': 'insufficient',
    'fifty-move': 'fifty_move',
    threefold: 'threefold',
  }
  return m[r]
}

/**
 * Real standard PGN (S11-03): round-trips to chess.js and external tools (lichess).
 * Never throw on a malformed move list — persistence must not lose a completed game.
 * On replay failure, degrade to the raw UCI movetext (the pre-S11-03 behavior).
 */
function safePgn(game: QueuedGame): string {
  try {
    return buildPgn(game)
  } catch {
    return game.moves.join(' ')
  }
}

function buildRow(game: QueuedGame, userId: string) {
  return {
    id: game.id,
    user_id: userId,
    played_at: new Date(game.completedAt).toISOString(),
    result: mapResult(game.result),
    player_color: game.playerColor,
    end_reason: mapEndReason(game.endReason),
    ai_difficulty: game.aiSkillLevel,
    pgn: safePgn(game),
    move_count: game.moves.length,
    opening_eco: null as string | null,
    opening_name: null as string | null,
  }
}

/** Map a `journal_entries` DB row to the in-app JournalEntry (ADR-0013 §1). */
function journalRowToEntry(r: Record<string, unknown>): JournalEntry {
  return {
    id: r.id as string,
    type: r.type as JournalEntry['type'],
    sourceRefId: r.source_ref_id as string,
    volume: (r.volume ?? null) as JournalEntry['volume'],
    templateId: r.template_id as string,
    params: (r.params ?? {}) as Record<string, string>,
    body: r.body as string,
    createdAt: new Date(r.created_at as string).getTime(),
  }
}

/** Map a JournalEntry to a `journal_entries` insert row for the given user. */
function journalEntryToRow(e: JournalEntry, userId: string) {
  return {
    id: e.id,
    user_id: userId,
    type: e.type,
    source_ref_id: e.sourceRefId,
    volume: e.volume,
    template_id: e.templateId,
    params: e.params,
    body: e.body,
    created_at: new Date(e.createdAt).toISOString(),
  }
}

/**
 * Data sync store per ADR-0011.
 * Handles game_sessions persistence: immediate sync → localStorage fallback → flush on login.
 * No other store calls supabase.from() directly.
 * Wire up flushUnsyncedQueue via App.vue watch on useAuthStore().userId.
 */
export const useDataSyncStore = defineStore('dataSync', () => {
  const syncStatus = ref<SyncStatus>('idle')
  const lastSyncedGameId = ref<string | null>(null)

  function _getUnsyncedKeys(): string[] {
    if (typeof localStorage === 'undefined') return []
    return Object.keys(localStorage)
      .filter(k => k.startsWith(UNSYNCED_PREFIX))
      .sort()
  }

  /**
   * Read the guest's locally-queued games as DB-shaped rows so the same mappers/cursor that serve
   * the cloud path work unchanged (訪客完局紀錄讀取). `created_at` is synthesised from `played_at`
   * (the queue has no separate insert time); ordering mirrors the cloud query — played_at desc, id asc.
   */
  function _readUnsyncedRows(): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = []
    for (const key of _getUnsyncedKeys()) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const game = JSON.parse(raw) as QueuedGame
        const playedAt = new Date(game.completedAt).toISOString()
        rows.push({ ...buildRow(game, ''), created_at: playedAt })
      } catch {
        // Skip a corrupt entry — a single bad row must not blank the whole history.
      }
    }
    rows.sort((a, b) => {
      const pa = a.played_at as string
      const pb = b.played_at as string
      if (pa !== pb) return pa < pb ? 1 : -1
      return (a.id as string) < (b.id as string) ? -1 : 1
    })
    return rows
  }

  function _writeToUnsyncedQueue(game: QueuedGame): void {
    if (typeof localStorage === 'undefined') return
    const keys = _getUnsyncedKeys()
    if (keys.length >= UNSYNCED_QUEUE_MAX) {
      localStorage.removeItem(keys[0])
    }
    localStorage.setItem(`${UNSYNCED_PREFIX}${game.id}`, JSON.stringify(game))
  }

  /** Sync a completed game to Supabase. Falls back to localStorage queue if offline or not logged in. */
  async function syncGame(game: CompletedGame): Promise<void> {
    const authStore = useAuthStore()
    const queued: QueuedGame = { ...game, id: crypto.randomUUID() }

    if (!authStore.userId) {
      _writeToUnsyncedQueue(queued)
      return
    }

    syncStatus.value = 'syncing'
    const { error } = await supabase
      .from('game_sessions')
      .upsert(buildRow(queued, authStore.userId), { onConflict: 'id', ignoreDuplicates: true })

    if (error) {
      _writeToUnsyncedQueue(queued)
      syncStatus.value = 'error'
    } else {
      lastSyncedGameId.value = queued.id
      syncStatus.value = 'synced'
      // Deferred import to avoid circular dependency (data-sync ↔ game-history)
      const { useGameHistoryStore } = await import('@/stores/game-history')
      useGameHistoryStore().invalidate()
    }
  }

  /** Upload all locally-queued games. Called from App.vue when userId becomes non-null. */
  async function flushUnsyncedQueue(): Promise<void> {
    const authStore = useAuthStore()
    if (!authStore.userId) return

    const keys = _getUnsyncedKeys()
    for (const key of keys) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      let game: QueuedGame
      try {
        game = JSON.parse(raw)
      } catch {
        // A single corrupt entry must not abort the whole flush (mirrors _readUnsyncedRows);
        // drop the poison pill and carry on so the rest still sync + history invalidates.
        localStorage.removeItem(key)
        continue
      }
      const { error } = await supabase
        .from('game_sessions')
        .upsert(buildRow(game, authStore.userId), { onConflict: 'id', ignoreDuplicates: true })
      if (!error) {
        localStorage.removeItem(key)
        lastSyncedGameId.value = game.id
      }
    }
    if (_getUnsyncedKeys().length === 0) {
      // All queued games flushed — invalidate history cache
      const { useGameHistoryStore } = await import('@/stores/game-history')
      useGameHistoryStore().invalidate()
    }
  }

  /**
   * Fetch game_sessions for the logged-in user, ordered by played_at desc.
   * Cursor-based pagination per GDD §4. All supabase.from() calls live here per ADR-0011.
   * AC-10: returns [] immediately if userId is null.
   */
  async function loadGameHistory(cursor?: Cursor): Promise<Record<string, unknown>[]> {
    const authStore = useAuthStore()
    if (!authStore.userId) {
      // Guest: serve the local queue (the same games that flush to cloud on login). Paginate in
      // JS to mirror the cloud cursor semantics, so a guest with >1 page still loads more correctly.
      let rows = _readUnsyncedRows()
      if (cursor) {
        rows = rows.filter((r) => {
          const pa = r.played_at as string
          if (pa < cursor.playedAt) return true
          return pa === cursor.playedAt && (r.id as string) > cursor.id
        })
      }
      return rows.slice(0, HISTORY_LOAD_LIMIT)
    }

    let query = supabase
      .from('game_sessions')
      .select('*')
      .order('played_at', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(HISTORY_LOAD_LIMIT)

    if (cursor) {
      query = query.or(
        `played_at.lt.${cursor.playedAt},` +
        `and(played_at.eq.${cursor.playedAt},created_at.lt.${cursor.createdAt}),` +
        `and(played_at.eq.${cursor.playedAt},created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`,
      )
    }

    const { data, error } = await query
    if (error) throw new Error(error.message ?? 'Failed to load game history')
    return data ?? []
  }

  /**
   * Fetch the user's completed lesson ids. Returns [] when not logged in or on error
   * (lesson progress degrades to the local cache; a read failure must never surface).
   * All lesson_progress supabase.from() calls live here per ADR-0011.
   */
  async function loadLessonProgress(): Promise<string[]> {
    const authStore = useAuthStore()
    if (!authStore.userId) return []
    const { data, error } = await supabase.from('lesson_progress').select('lesson_id')
    if (error) return []
    return (data ?? []).map((r) => r.lesson_id as string)
  }

  /**
   * Idempotently persist completed lesson ids for the logged-in user.
   * No-op (returns false) when not logged in — the caller keeps them in localStorage
   * and re-flushes on the next login. Duplicate completions are ignored by the PK.
   */
  async function upsertLessonProgress(lessonIds: string[]): Promise<boolean> {
    const authStore = useAuthStore()
    const userId = authStore.userId
    if (!userId || lessonIds.length === 0) return false
    const rows = lessonIds.map((lesson_id) => ({ user_id: userId, lesson_id }))
    const { error } = await supabase
      .from('lesson_progress')
      .upsert(rows, { onConflict: 'user_id,lesson_id', ignoreDuplicates: true })
    return !error
  }

  /**
   * Fetch the user's Concept side-door learns. Returns [] when not logged in or on error
   * (degrades to the local cache; a read failure must never surface). Kept separate from
   * lesson_progress so side-door learns never leak into linear unlock. ADR-0011.
   */
  async function loadSideLearned(): Promise<string[]> {
    const authStore = useAuthStore()
    if (!authStore.userId) return []
    const { data, error } = await supabase.from('lesson_side_learned').select('lesson_id')
    if (error) return []
    return (data ?? []).map((r) => r.lesson_id as string)
  }

  /**
   * Idempotently persist Concept side-door learns for the logged-in user. No-op (returns false)
   * when not logged in — the caller keeps them in localStorage and re-flushes on the next login.
   * Learning is monotonic, so duplicates are ignored by the PK.
   */
  async function upsertSideLearned(lessonIds: string[]): Promise<boolean> {
    const authStore = useAuthStore()
    const userId = authStore.userId
    if (!userId || lessonIds.length === 0) return false
    const rows = lessonIds.map((lesson_id) => ({ user_id: userId, lesson_id }))
    const { error } = await supabase
      .from('lesson_side_learned')
      .upsert(rows, { onConflict: 'user_id,lesson_id', ignoreDuplicates: true })
    return !error
  }

  /**
   * Fetch the user's solved puzzles (id + hint_used). Returns [] when not logged in or
   * on error (dungeon progress degrades to the local cache; a read failure must never
   * surface). All dungeon_progress supabase.from() calls live here per ADR-0011.
   */
  async function loadDungeonProgress(): Promise<{ puzzleId: string; hintUsed: boolean }[]> {
    const authStore = useAuthStore()
    if (!authStore.userId) return []
    const { data, error } = await supabase.from('dungeon_progress').select('puzzle_id, hint_used')
    if (error) return []
    return (data ?? []).map((r) => ({
      puzzleId: r.puzzle_id as string,
      hintUsed: Boolean(r.hint_used),
    }))
  }

  /**
   * Idempotently persist solved puzzles for the logged-in user. Row existence = solved;
   * `hint_used` is the flag captured at solve time. No-op (returns false) when not logged
   * in — the caller keeps progress in localStorage and re-flushes on the next login.
   * Solving is monotonic, so the first write per puzzle wins (ignoreDuplicates).
   */
  async function upsertDungeonProgress(
    entries: { puzzleId: string; hintUsed: boolean }[],
  ): Promise<boolean> {
    const authStore = useAuthStore()
    const userId = authStore.userId
    if (!userId || entries.length === 0) return false
    const rows = entries.map((e) => ({ user_id: userId, puzzle_id: e.puzzleId, hint_used: e.hintUsed }))
    const { error } = await supabase
      .from('dungeon_progress')
      .upsert(rows, { onConflict: 'user_id,puzzle_id', ignoreDuplicates: true })
    return !error
  }

  /**
   * Fetch the player's single in-progress game (續玩對局). Returns null when logged out or on error
   * (resume degrades to the local cache; a read failure must never surface). All in_progress_game
   * supabase.from() calls live here per ADR-0011.
   */
  async function loadResumeGame(): Promise<ResumeSnapshot | null> {
    const authStore = useAuthStore()
    if (!authStore.userId) return null
    const { data, error } = await supabase
      .from('in_progress_game')
      .select('moves, player_color, level, player_move_times, updated_at')
      .maybeSingle()
    if (error || !data) return null
    return {
      moves: (data.moves ?? []) as string[],
      playerColor: data.player_color as 'white' | 'black',
      level: data.level as number,
      playerMoveTimes: (data.player_move_times ?? []) as number[],
      updatedAt: new Date(data.updated_at as string).getTime(),
    }
  }

  /**
   * Persist the player's in-progress game (one row per user, replaced on conflict). No-op (false)
   * when logged out — the caller keeps it in localStorage and re-pushes on the next login.
   */
  async function upsertResumeGame(snapshot: ResumeSnapshot): Promise<boolean> {
    const authStore = useAuthStore()
    const userId = authStore.userId
    if (!userId) return false
    const { error } = await supabase.from('in_progress_game').upsert(
      {
        user_id: userId,
        moves: snapshot.moves,
        player_color: snapshot.playerColor,
        level: snapshot.level,
        player_move_times: snapshot.playerMoveTimes,
        updated_at: new Date(snapshot.updatedAt).toISOString(),
      },
      { onConflict: 'user_id' },
    )
    return !error
  }

  /** Delete the player's in-progress game (on completion or new game). No-op (false) when logged out. */
  async function deleteResumeGame(): Promise<boolean> {
    const authStore = useAuthStore()
    const userId = authStore.userId
    if (!userId) return false
    const { error } = await supabase.from('in_progress_game').delete().eq('user_id', userId)
    return !error
  }

  // ── Journal (棋誌) — ADR-0013. journal_entries is the only table with
  //    event-level idempotency (UNIQUE(user_id, source_ref_id)), NOT row-UUID. ──

  /**
   * Read locally-held journal entries: guest entries (`chess:journal:entries`) plus any
   * logged-in entries still queued after an insert failure (`chess:journal:unsynced:*`).
   * The store merges these with the cloud set. A single corrupt entry is skipped, never fatal.
   */
  function readLocalJournalEntries(): JournalEntry[] {
    if (typeof localStorage === 'undefined') return []
    const out: JournalEntry[] = []
    const guestRaw = localStorage.getItem(JOURNAL_ENTRIES_KEY)
    if (guestRaw) {
      try {
        out.push(...(JSON.parse(guestRaw) as JournalEntry[]))
      } catch {
        // skip corrupt guest blob
      }
    }
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(JOURNAL_UNSYNCED_PREFIX)) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        out.push(JSON.parse(raw) as JournalEntry)
      } catch {
        // skip corrupt queued entry
      }
    }
    return out
  }

  function _pushGuestJournalEntry(entry: JournalEntry): void {
    if (typeof localStorage === 'undefined') return
    let list: JournalEntry[] = []
    const raw = localStorage.getItem(JOURNAL_ENTRIES_KEY)
    if (raw) {
      try {
        list = JSON.parse(raw) as JournalEntry[]
      } catch {
        list = []
      }
    }
    if (list.some((e) => e.sourceRefId === entry.sourceRefId)) return // local idempotency by event key
    list.push(entry)
    localStorage.setItem(JOURNAL_ENTRIES_KEY, JSON.stringify(list))
  }

  function _queueJournalEntry(entry: JournalEntry): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(`${JOURNAL_UNSYNCED_PREFIX}${entry.sourceRefId}`, JSON.stringify(entry))
  }

  /**
   * Fetch the user's journal entries, newest first. Returns [] when logged out — the guest's
   * entries live in localStorage and are merged in by the store. All journal_entries
   * supabase.from() calls live here per ADR-0011.
   */
  async function loadJournalEntries(): Promise<JournalEntry[]> {
    const authStore = useAuthStore()
    if (!authStore.userId) return []
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message ?? 'Failed to load journal entries')
    return (data ?? []).map(journalRowToEntry)
  }

  /**
   * Append a journal entry. Logged in: insert with ON CONFLICT (user_id, source_ref_id) DO
   * NOTHING (event idempotency — a re-derived/duplicate event is a no-op); on failure queue to
   * `chess:journal:unsynced:*` for retry. Logged out: write to the guest local-first journal.
   */
  async function appendJournalEntry(entry: JournalEntry): Promise<void> {
    const authStore = useAuthStore()
    const userId = authStore.userId
    if (!userId) {
      _pushGuestJournalEntry(entry)
      return
    }
    try {
      const { error } = await supabase
        .from('journal_entries')
        .upsert(journalEntryToRow(entry, userId), {
          onConflict: 'user_id,source_ref_id',
          ignoreDuplicates: true,
        })
      if (error) {
        _queueJournalEntry(entry)
        return
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`${JOURNAL_UNSYNCED_PREFIX}${entry.sourceRefId}`)
      }
    } catch {
      _queueJournalEntry(entry)
    }
  }

  /**
   * On login, push all locally-held journal entries (guest blob + unsynced queue) to the cloud,
   * deduped by source_ref_id — the union reconcile (AC-guest-reconcile). Each insert is ON CONFLICT
   * DO NOTHING, so a re-derived event is a no-op (no duplicate); a failure re-queues to
   * chess:journal:unsynced for the next login (no loss). Clears the guest blob afterward.
   * No-op when logged out.
   */
  async function flushJournalQueue(): Promise<void> {
    const authStore = useAuthStore()
    if (!authStore.userId) return
    const seen = new Set<string>()
    const unique: JournalEntry[] = []
    for (const entry of readLocalJournalEntries()) {
      if (!seen.has(entry.sourceRefId)) {
        seen.add(entry.sourceRefId)
        unique.push(entry)
      }
    }
    for (const entry of unique) {
      await appendJournalEntry(entry)
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(JOURNAL_ENTRIES_KEY)
    }
  }

  return {
    syncStatus,
    lastSyncedGameId,
    syncGame,
    flushUnsyncedQueue,
    loadGameHistory,
    loadResumeGame,
    upsertResumeGame,
    deleteResumeGame,
    loadLessonProgress,
    upsertLessonProgress,
    loadSideLearned,
    upsertSideLearned,
    loadDungeonProgress,
    upsertDungeonProgress,
    loadJournalEntries,
    appendJournalEntry,
    readLocalJournalEntries,
    flushJournalQueue,
  }
})
