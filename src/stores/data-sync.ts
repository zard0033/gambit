import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { CompletedGame } from '@/stores/game-store'
import { UNSYNCED_QUEUE_MAX } from '@/config/sync-tuning'
import { HISTORY_LOAD_LIMIT } from '@/config/history-config'
import type { Cursor } from '@/types/game-history'
import type { ResumeSnapshot } from '@/types/resume'
import type { MemoryGameSummary } from '@/types/memory'
import { MEMORY_SUMMARY_SCHEMA_VERSION } from '@/config/memory-config'
import type { Theme } from '@/lib/theme'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

const UNSYNCED_PREFIX = 'chess:unsynced:'
/** Guest (logged-out) memory summaries — local-first 棋憶 (ADR-0014 §5). */
const MEMORY_SUMMARIES_KEY = 'chess:memory:summaries'
/** Logged-in summaries that failed to insert; keyed by game_id so retry is idempotent. */
const MEMORY_UNSYNCED_PREFIX = 'chess:memory:unsynced:'

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
 * Dynamically imports the assembler (→ chess.js) so it never lands in the eager-loaded
 * HomeView → data-sync startup chunk (B2).
 */
async function safePgn(game: QueuedGame): Promise<string> {
  try {
    const { buildPgn } = await import('@/modules/game-export/assembler')
    return buildPgn(game)
  } catch {
    return game.moves.join(' ')
  }
}

async function buildRow(game: QueuedGame, userId: string) {
  return {
    id: game.id,
    user_id: userId,
    played_at: new Date(game.completedAt).toISOString(),
    result: mapResult(game.result),
    player_color: game.playerColor,
    end_reason: mapEndReason(game.endReason),
    ai_difficulty: game.aiSkillLevel,
    pgn: await safePgn(game),
    move_count: game.moves.length,
    opening_eco: null as string | null,
    opening_name: null as string | null,
  }
}

/** Map a `memory_summaries` DB row to the in-app MemoryGameSummary (ADR-0014 §1). */
function memoryRowToSummary(r: Record<string, unknown>): MemoryGameSummary {
  const s = (r.summary ?? {}) as {
    stageCounts?: MemoryGameSummary['stageCounts']
    conceptCounts?: Record<string, number>
    anchorStage?: MemoryGameSummary['anchorStage']
  }
  return {
    schemaVersion: r.schema_version as number,
    gameId: r.game_id as string,
    createdAt: new Date(r.created_at as string).getTime(),
    stageCounts: s.stageCounts ?? { opening: 0, middlegame: 0, endgame: 0 },
    conceptCounts: s.conceptCounts ?? {},
    anchorStage: s.anchorStage ?? null,
  }
}

/** Map a MemoryGameSummary to a `memory_summaries` insert row (id defaulted by the DB). */
function memorySummaryToRow(s: MemoryGameSummary, userId: string) {
  return {
    user_id: userId,
    game_id: s.gameId,
    schema_version: s.schemaVersion,
    summary: { stageCounts: s.stageCounts, conceptCounts: s.conceptCounts, anchorStage: s.anchorStage },
    created_at: new Date(s.createdAt).toISOString(),
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
  /** Bumped after every successful sync/flush — game-history watches this to invalidate its
   *  cache without data-sync importing game-history (keeps data-sync a dependency-free leaf). */
  const syncVersion = ref(0)

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
  async function _readUnsyncedRows(): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = []
    for (const key of _getUnsyncedKeys()) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const game = JSON.parse(raw) as QueuedGame
        const playedAt = new Date(game.completedAt).toISOString()
        rows.push({ ...(await buildRow(game, '')), created_at: playedAt })
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

  /**
   * The true oldest queued game by `completedAt`, not by key sort order — keys are
   * `chess:unsynced:<uuid>` and uuid v4 is random, unrelated to time (B1). A missing or
   * corrupt entry has no reliable completedAt and is treated as oldest (evict-first).
   */
  function _oldestUnsyncedKey(keys: string[]): string {
    let oldestKey = keys[0]
    let oldestTime = Number.POSITIVE_INFINITY
    for (const key of keys) {
      const raw = localStorage.getItem(key)
      let completedAt = Number.NEGATIVE_INFINITY
      if (raw) {
        try {
          const game = JSON.parse(raw) as QueuedGame
          if (typeof game.completedAt === 'number') completedAt = game.completedAt
        } catch {
          // corrupt entry — stays at -Infinity, evicted first
        }
      }
      if (completedAt < oldestTime) {
        oldestTime = completedAt
        oldestKey = key
      }
    }
    return oldestKey
  }

  function _writeToUnsyncedQueue(game: QueuedGame): void {
    if (typeof localStorage === 'undefined') return
    const keys = _getUnsyncedKeys()
    if (keys.length >= UNSYNCED_QUEUE_MAX) {
      localStorage.removeItem(_oldestUnsyncedKey(keys))
    }
    localStorage.setItem(`${UNSYNCED_PREFIX}${game.id}`, JSON.stringify(game))
  }

  /** Sync a completed game to Supabase. Falls back to localStorage queue if offline or not logged in. */
  async function syncGame(game: CompletedGame): Promise<void> {
    const authStore = useAuthStore()
    const queued: QueuedGame = { ...game, id: crypto.randomUUID() }

    if (!authStore.userId) {
      _writeToUnsyncedQueue(queued)
      // 訪客的 history 就是本地佇列——新局進佇列等同雲端 upsert 成功，須讓 game-history 快取失效
      syncVersion.value++
      return
    }

    syncStatus.value = 'syncing'
    const { error } = await supabase
      .from('game_sessions')
      .upsert(await buildRow(queued, authStore.userId), { onConflict: 'id', ignoreDuplicates: true })

    if (error) {
      _writeToUnsyncedQueue(queued)
      syncStatus.value = 'error'
    } else {
      lastSyncedGameId.value = queued.id
      syncStatus.value = 'synced'
      syncVersion.value++
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
        .upsert(await buildRow(game, authStore.userId), { onConflict: 'id', ignoreDuplicates: true })
      if (!error) {
        localStorage.removeItem(key)
        lastSyncedGameId.value = game.id
      }
    }
    if (_getUnsyncedKeys().length === 0) {
      // All queued games flushed — bump syncVersion so game-history invalidates its cache
      syncVersion.value++
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
      let rows = await _readUnsyncedRows()
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
   * Total game count for the 棋誌 running total (memory GDD Rule 24) — exact, not the paginated
   * page length. Guest: the local queue length. Logged-in: a head COUNT query. Returns 0 on error
   * (a header marker must never surface a failure). All supabase.from() lives here per ADR-0011.
   */
  async function countGames(): Promise<number> {
    const authStore = useAuthStore()
    // key 數即局數——別走 _readUnsyncedRows（它會對每局 chess.js 重放組 PGN，計數用不到）
    if (!authStore.userId) return _getUnsyncedKeys().length
    const { count, error } = await supabase
      .from('game_sessions')
      .select('*', { count: 'exact', head: true })
    if (error) return 0
    return count ?? 0
  }

  /**
   * Reset 對局記錄 (ProfileView "重置對局記錄"): delete every game_sessions row owned by this user
   * (RLS already scopes deletes to the caller; `.eq('user_id', userId)` mirrors deleteResumeGame's
   * belt-and-suspenders style). The local unsynced queue is dropped in BOTH branches: for a guest
   * it IS their history; for a logged-in user a residual chess:unsynced:* entry (left by a failed
   * upsert in syncGame) would otherwise be re-uploaded by flushUnsyncedQueue on the next app mount,
   * silently resurrecting a history the reset dialog promised was irreversibly gone.
   * Never touches journal_entries / memory_summaries / lesson or dungeon progress — those are
   * separate tables/keys, untouched by design. Returns false on a cloud error so the caller can
   * surface a retry, never throws (mirrors the other delete/upsert helpers here).
   */
  async function deleteGameHistory(): Promise<boolean> {
    const authStore = useAuthStore()
    const userId = authStore.userId
    for (const key of _getUnsyncedKeys()) localStorage.removeItem(key)
    if (!userId) return true
    const { error } = await supabase.from('game_sessions').delete().eq('user_id', userId)
    return !error
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
   * Fetch the concepts the user has deepened (concept deepening page). Returns [] when not logged
   * in or on error (degrades to the local cache; a read failure must never surface). Kept separate
   * from lesson_progress — deepening is its own quiet state, never feeds linear unlock. ADR-0011.
   */
  async function loadDeepenedConcepts(): Promise<string[]> {
    const authStore = useAuthStore()
    if (!authStore.userId) return []
    const { data, error } = await supabase.from('concept_deepened').select('concept_id')
    if (error) return []
    return (data ?? []).map((r) => r.concept_id as string)
  }

  /**
   * Idempotently persist deepened concepts for the logged-in user. No-op (returns false) when not
   * logged in — the caller keeps them in localStorage and re-flushes on the next login. Deepening is
   * monotonic, so duplicates are ignored by the PK.
   */
  async function upsertDeepenedConcepts(conceptIds: string[]): Promise<boolean> {
    const authStore = useAuthStore()
    const userId = authStore.userId
    if (!userId || conceptIds.length === 0) return false
    const rows = conceptIds.map((concept_id) => ({ user_id: userId, concept_id }))
    const { error } = await supabase
      .from('concept_deepened')
      .upsert(rows, { onConflict: 'user_id,concept_id', ignoreDuplicates: true })
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


  // ── 棋憶 (Memory) — ADR-0014. guest localStorage → login union reconcile,
  //    event-keyed on game_id, schema_version-filtered. ──

  /** Read locally-held memory summaries: guest blob (`chess:memory:summaries`) + unsynced queue. */
  function readLocalMemorySummaries(): MemoryGameSummary[] {
    if (typeof localStorage === 'undefined') return []
    const out: MemoryGameSummary[] = []
    const guestRaw = localStorage.getItem(MEMORY_SUMMARIES_KEY)
    if (guestRaw) {
      try {
        out.push(...(JSON.parse(guestRaw) as MemoryGameSummary[]))
      } catch {
        // skip corrupt guest blob
      }
    }
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(MEMORY_UNSYNCED_PREFIX)) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        out.push(JSON.parse(raw) as MemoryGameSummary)
      } catch {
        // skip corrupt queued summary
      }
    }
    return out
  }

  function _pushGuestMemorySummary(summary: MemoryGameSummary): void {
    if (typeof localStorage === 'undefined') return
    let list: MemoryGameSummary[] = []
    const raw = localStorage.getItem(MEMORY_SUMMARIES_KEY)
    if (raw) {
      try {
        list = JSON.parse(raw) as MemoryGameSummary[]
      } catch {
        list = []
      }
    }
    if (list.some((s) => s.gameId === summary.gameId)) return // local idempotency by game_id
    list.push(summary)
    localStorage.setItem(MEMORY_SUMMARIES_KEY, JSON.stringify(list))
  }

  function _queueMemorySummary(summary: MemoryGameSummary): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(`${MEMORY_UNSYNCED_PREFIX}${summary.gameId}`, JSON.stringify(summary))
  }

  /**
   * Fetch the user's memory summaries (current schema_version only), newest first. Returns [] when
   * logged out — the guest's summaries live in localStorage and are merged in by the store.
   */
  async function loadMemorySummaries(): Promise<MemoryGameSummary[]> {
    const authStore = useAuthStore()
    if (!authStore.userId) return []
    const { data, error } = await supabase
      .from('memory_summaries')
      .select('*')
      .eq('schema_version', MEMORY_SUMMARY_SCHEMA_VERSION)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message ?? 'Failed to load memory summaries')
    return (data ?? []).map(memoryRowToSummary)
  }

  /**
   * Append a memory summary. Logged in: upsert ON CONFLICT (user_id, game_id) DO NOTHING (one
   * summary per game — re-deriving is a no-op); on failure queue to `chess:memory:unsynced:*`.
   * Logged out: write to the guest local-first store.
   */
  async function appendMemorySummary(summary: MemoryGameSummary): Promise<void> {
    const authStore = useAuthStore()
    const userId = authStore.userId
    if (!userId) {
      _pushGuestMemorySummary(summary)
      return
    }
    try {
      const { error } = await supabase
        .from('memory_summaries')
        .upsert(memorySummaryToRow(summary, userId), {
          onConflict: 'user_id,game_id',
          ignoreDuplicates: true,
        })
      if (error) {
        _queueMemorySummary(summary)
        return
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`${MEMORY_UNSYNCED_PREFIX}${summary.gameId}`)
      }
    } catch {
      _queueMemorySummary(summary)
    }
  }

  /**
   * On login, push all locally-held summaries (guest blob + unsynced queue) to the cloud, deduped
   * by game_id — the union reconcile. Each insert is ON CONFLICT DO NOTHING (no duplicate); a
   * failure re-queues for the next login (no loss). Clears the guest blob afterward.
   */
  async function flushMemoryQueue(): Promise<void> {
    const authStore = useAuthStore()
    if (!authStore.userId) return
    const seen = new Set<string>()
    const unique: MemoryGameSummary[] = []
    for (const s of readLocalMemorySummaries()) {
      if (!seen.has(s.gameId)) {
        seen.add(s.gameId)
        unique.push(s)
      }
    }
    for (const s of unique) {
      await appendMemorySummary(s)
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(MEMORY_SUMMARIES_KEY)
    }
  }

  /**
   * Fetch the user's persisted theme preference (user_preferences, one row/user). Returns null
   * when logged out, on error, or before the migration is live — degrades cleanly to local-only.
   */
  async function loadThemePreference(): Promise<{ theme: Theme; updatedAt: number } | null> {
    const authStore = useAuthStore()
    if (!authStore.userId) return null
    const { data, error } = await supabase
      .from('user_preferences')
      .select('theme, updated_at')
      .maybeSingle()
    if (error || !data) return null
    return { theme: data.theme as Theme, updatedAt: new Date(data.updated_at as string).getTime() }
  }

  /** Persist the user's theme (replaced on conflict). No-op (false) when logged out or on error. */
  async function upsertThemePreference(theme: Theme, updatedAt: number): Promise<boolean> {
    const authStore = useAuthStore()
    const userId = authStore.userId
    if (!userId) return false
    const { error } = await supabase.from('user_preferences').upsert(
      { user_id: userId, theme, updated_at: new Date(updatedAt).toISOString() },
      { onConflict: 'user_id' },
    )
    return !error
  }

  return {
    syncStatus,
    lastSyncedGameId,
    syncVersion,
    syncGame,
    flushUnsyncedQueue,
    loadGameHistory,
    countGames,
    deleteGameHistory,
    loadResumeGame,
    upsertResumeGame,
    deleteResumeGame,
    loadLessonProgress,
    upsertLessonProgress,
    loadDeepenedConcepts,
    upsertDeepenedConcepts,
    loadDungeonProgress,
    upsertDungeonProgress,
    loadMemorySummaries,
    appendMemorySummary,
    readLocalMemorySummaries,
    flushMemoryQueue,
    loadThemePreference,
    upsertThemePreference,
  }
})
