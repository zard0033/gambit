// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { Chess } from 'chess.js'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useDataSyncStore } from '@/stores/data-sync'
import type { CompletedGame } from '@/stores/game-store'
import { HISTORY_LOAD_LIMIT } from '@/config/history-config'

function mockFrom(upsertResult: { error: unknown } = { error: null }) {
  const upsertFn = vi.fn().mockResolvedValueOnce(upsertResult)
  vi.mocked(supabase.from).mockReturnValueOnce({ upsert: upsertFn } as never)
  return upsertFn
}

function mockAuthSubscription() {
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue(
    { data: { subscription: { unsubscribe: vi.fn() } } } as unknown as ReturnType<
      typeof supabase.auth.onAuthStateChange
    >
  )
}

function makeGame(overrides: Partial<CompletedGame> = {}): CompletedGame {
  return {
    moves: ['e2e4', 'e7e5', 'g1f3'],
    playerColor: 'white',
    result: '1-0',
    endReason: 'checkmate',
    completedAt: 1_700_000_000_000,
    aiSkillLevel: 5,
    playerMoveTimes: [1000, 2000, 1500],
    isTerminal: true,
    ...overrides,
  }
}

describe('useDataSyncStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    mockAuthSubscription()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null }, error: null,
    } as never)
  })

  // ── syncGame — logged in ────────────────────────────────────────────────

  describe('syncGame — logged in', () => {
    it('SUPA-AC-06: transitions idle → syncing → synced and sets lastSyncedGameId', async () => {
      const upsertFn = mockFrom({ error: null })
      const authStore = useAuthStore()
      authStore.userId = 'uid-1'

      const store = useDataSyncStore()
      expect(store.syncStatus).toBe('idle')

      const promise = store.syncGame(makeGame())
      expect(store.syncStatus).toBe('syncing')

      await promise
      expect(store.syncStatus).toBe('synced')
      expect(store.lastSyncedGameId).not.toBeNull()
      expect(upsertFn).toHaveBeenCalledOnce()
    })

    it('SUPA-AC-06: upsert row contains correct result, player_color, pgn, move_count', async () => {
      mockFrom({ error: null })
      const authStore = useAuthStore()
      authStore.userId = 'uid-1'

      const store = useDataSyncStore()
      await store.syncGame(makeGame())

      const [row] = vi.mocked(supabase.from).mock.results[0].value.upsert.mock.calls[0]
      expect(row.result).toBe('white_wins')
      expect(row.player_color).toBe('white')
      expect(row.move_count).toBe(3)
      expect(row.user_id).toBe('uid-1')
    })

    it('S11-03: pgn column stores real standard PGN that round-trips via chess.js', async () => {
      mockFrom({ error: null })
      const authStore = useAuthStore()
      authStore.userId = 'uid-1'

      const store = useDataSyncStore()
      await store.syncGame(makeGame())

      const [row] = vi.mocked(supabase.from).mock.results[0].value.upsert.mock.calls[0]
      // Not raw UCI any more — it is movetext SAN inside a tagged PGN.
      expect(row.pgn).not.toBe('e2e4 e7e5 g1f3')
      expect(row.pgn).toContain('[Result "1-0"]')
      expect(row.pgn).toContain('1. e4 e5 2. Nf3')

      const chess = new Chess()
      expect(() => chess.loadPgn(row.pgn)).not.toThrow()
      expect(chess.history().length).toBe(3)
    })

    it('S11-03: malformed move list degrades to raw UCI, never throws / loses the game', async () => {
      mockFrom({ error: null })
      const authStore = useAuthStore()
      authStore.userId = 'uid-1'

      // An illegal move list would make chess.js.move() throw; sync must still persist.
      const bad = makeGame({ moves: ['e2e4', 'z9z9'] })
      const store = useDataSyncStore()
      await expect(store.syncGame(bad)).resolves.toBeUndefined()

      const [row] = vi.mocked(supabase.from).mock.results[0].value.upsert.mock.calls[0]
      expect(row.pgn).toBe('e2e4 z9z9') // fell back to raw UCI, row still written
      expect(store.syncStatus).toBe('synced')
    })

    it('SUPA-AC-09: uses ignoreDuplicates:true for ON CONFLICT DO NOTHING', async () => {
      mockFrom({ error: null })
      const authStore = useAuthStore()
      authStore.userId = 'uid-1'

      const store = useDataSyncStore()
      await store.syncGame(makeGame())

      const [, opts] = vi.mocked(supabase.from).mock.results[0].value.upsert.mock.calls[0]
      expect(opts).toMatchObject({ onConflict: 'id', ignoreDuplicates: true })
    })

    it('SUPA-AC-07: writes to localStorage and sets syncStatus=error when upsert fails', async () => {
      mockFrom({ error: { message: 'Network error' } })
      const authStore = useAuthStore()
      authStore.userId = 'uid-1'

      const store = useDataSyncStore()
      await store.syncGame(makeGame())

      expect(store.syncStatus).toBe('error')
      const keys = Object.keys(localStorage).filter(k => k.startsWith('chess:unsynced:'))
      expect(keys).toHaveLength(1)
    })
  })

  // ── syncGame — not logged in ───────────────────────────────────────────

  describe('syncGame — not logged in', () => {
    it('writes directly to localStorage without calling supabase (SUPA-AC-07)', async () => {
      const store = useDataSyncStore()
      await store.syncGame(makeGame())

      expect(supabase.from).not.toHaveBeenCalled()
      const keys = Object.keys(localStorage).filter(k => k.startsWith('chess:unsynced:'))
      expect(keys).toHaveLength(1)
    })

    it('keeps syncStatus as idle when not logged in', async () => {
      const store = useDataSyncStore()
      await store.syncGame(makeGame())
      expect(store.syncStatus).toBe('idle')
    })
  })

  // ── SUPA-AC-13 non-blocking ────────────────────────────────────────────

  describe('SUPA-AC-13: syncGame is non-blocking', () => {
    it('syncStatus becomes syncing immediately without awaiting', async () => {
      let resolveUpsert!: (v: unknown) => void
      const upsertFn = vi.fn().mockReturnValueOnce(new Promise(r => { resolveUpsert = r }))
      vi.mocked(supabase.from).mockReturnValueOnce({ upsert: upsertFn } as never)

      const authStore = useAuthStore()
      authStore.userId = 'uid-1'

      const store = useDataSyncStore()
      const syncPromise = store.syncGame(makeGame())

      // syncStatus transitions immediately, before await
      expect(store.syncStatus).toBe('syncing')

      resolveUpsert({ error: null })
      await syncPromise
      expect(store.syncStatus).toBe('synced')
    })
  })

  // ── flushUnsyncedQueue ─────────────────────────────────────────────────

  describe('flushUnsyncedQueue', () => {
    it('SUPA-AC-08: removes successfully uploaded games from localStorage', async () => {
      const authStore = useAuthStore()
      authStore.userId = 'uid-1'

      const game1 = makeGame({ completedAt: 1_000_000 })
      const game2 = makeGame({ completedAt: 2_000_000 })
      const id1 = 'aaaaaaaa-0000-0000-0000-000000000001'
      const id2 = 'aaaaaaaa-0000-0000-0000-000000000002'
      localStorage.setItem(`chess:unsynced:${id1}`, JSON.stringify({ ...game1, id: id1 }))
      localStorage.setItem(`chess:unsynced:${id2}`, JSON.stringify({ ...game2, id: id2 }))

      mockFrom({ error: null })
      mockFrom({ error: null })

      const store = useDataSyncStore()
      await store.flushUnsyncedQueue()

      expect(Object.keys(localStorage).filter(k => k.startsWith('chess:unsynced:'))).toHaveLength(0)
    })

    it('leaves failed games in localStorage for next retry', async () => {
      const authStore = useAuthStore()
      authStore.userId = 'uid-1'

      const id1 = 'aaaaaaaa-0000-0000-0000-000000000001'
      localStorage.setItem(`chess:unsynced:${id1}`, JSON.stringify({ ...makeGame(), id: id1 }))

      mockFrom({ error: { message: 'Server error' } })

      const store = useDataSyncStore()
      await store.flushUnsyncedQueue()

      expect(Object.keys(localStorage).filter(k => k.startsWith('chess:unsynced:'))).toHaveLength(1)
    })

    it('does nothing when not logged in', async () => {
      const id1 = 'aaaaaaaa-0000-0000-0000-000000000001'
      localStorage.setItem(`chess:unsynced:${id1}`, JSON.stringify({ ...makeGame(), id: id1 }))

      const store = useDataSyncStore()
      await store.flushUnsyncedQueue()

      expect(supabase.from).not.toHaveBeenCalled()
    })
  })

  // ── Queue overflow ─────────────────────────────────────────────────────

  describe('queue overflow', () => {
    it('drops oldest entry when writing the 51st game (UNSYNCED_QUEUE_MAX = 50)', async () => {
      const store = useDataSyncStore()

      // Fill queue to 50
      for (let i = 0; i < 50; i++) {
        const id = `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, '0')}`
        localStorage.setItem(`chess:unsynced:${id}`, JSON.stringify({ ...makeGame(), id }))
      }

      const oldestKey = Object.keys(localStorage)
        .filter(k => k.startsWith('chess:unsynced:'))
        .sort()[0]

      // syncGame while not logged in → writes to queue (51st)
      await store.syncGame(makeGame())

      const remaining = Object.keys(localStorage).filter(k => k.startsWith('chess:unsynced:'))
      expect(remaining).toHaveLength(50)
      expect(remaining).not.toContain(oldestKey)
    })
  })

  // ── result mapping ─────────────────────────────────────────────────────

  describe('result mapping', () => {
    it.each([
      ['1-0' as const, 'white_wins'],
      ['0-1' as const, 'black_wins'],
      ['1/2-1/2' as const, 'draw'],
    ])('maps %s → %s', async (result, expected) => {
      mockFrom({ error: null })
      const authStore = useAuthStore()
      authStore.userId = 'uid-1'

      const store = useDataSyncStore()
      await store.syncGame(makeGame({ result }))

      const [row] = vi.mocked(supabase.from).mock.results[0].value.upsert.mock.calls[0]
      expect(row.result).toBe(expected)
    })
  })

  // ── countGames (棋誌 running total, memory GDD Rule 24) ──────────────────

  describe('countGames', () => {
    it('returns the local queue length when logged out (no supabase call)', async () => {
      localStorage.setItem('chess:unsynced:a', JSON.stringify({ ...makeGame(), id: 'a' }))
      localStorage.setItem('chess:unsynced:b', JSON.stringify({ ...makeGame(), id: 'b' }))

      const store = useDataSyncStore()
      expect(await store.countGames()).toBe(2)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('returns the exact head count when logged in', async () => {
      const selectFn = vi.fn().mockResolvedValueOnce({ count: 42, error: null })
      vi.mocked(supabase.from).mockReturnValueOnce({ select: selectFn } as never)
      useAuthStore().userId = 'uid-1'

      const store = useDataSyncStore()
      expect(await store.countGames()).toBe(42)
    })

    it('returns 0 on error (a header marker must never surface a failure)', async () => {
      const selectFn = vi.fn().mockResolvedValueOnce({ count: null, error: { message: 'boom' } })
      vi.mocked(supabase.from).mockReturnValueOnce({ select: selectFn } as never)
      useAuthStore().userId = 'uid-1'

      const store = useDataSyncStore()
      expect(await store.countGames()).toBe(0)
    })
  })

  // ── lesson_progress (S12 cross-device) ──────────────────────────────────

  describe('loadLessonProgress', () => {
    it('returns [] when logged out without touching supabase', async () => {
      const store = useDataSyncStore()
      const result = await store.loadLessonProgress()
      expect(result).toEqual([])
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('maps rows to lesson_id strings when logged in', async () => {
      const selectFn = vi.fn().mockResolvedValueOnce({
        data: [{ lesson_id: 'pawn-basics' }, { lesson_id: 'rook-and-bishop' }],
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValueOnce({ select: selectFn } as never)
      useAuthStore().userId = 'uid-1'

      const store = useDataSyncStore()
      expect(await store.loadLessonProgress()).toEqual(['pawn-basics', 'rook-and-bishop'])
    })

    it('returns [] on error (degrades to local cache)', async () => {
      const selectFn = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
      vi.mocked(supabase.from).mockReturnValueOnce({ select: selectFn } as never)
      useAuthStore().userId = 'uid-1'

      const store = useDataSyncStore()
      expect(await store.loadLessonProgress()).toEqual([])
    })
  })

  describe('upsertLessonProgress', () => {
    it('no-ops (false) when logged out', async () => {
      const store = useDataSyncStore()
      expect(await store.upsertLessonProgress(['pawn-basics'])).toBe(false)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('no-ops (false) for an empty id list', async () => {
      useAuthStore().userId = 'uid-1'
      const store = useDataSyncStore()
      expect(await store.upsertLessonProgress([])).toBe(false)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('upserts user-scoped rows and returns true', async () => {
      const upsertFn = vi.fn().mockResolvedValueOnce({ error: null })
      vi.mocked(supabase.from).mockReturnValueOnce({ upsert: upsertFn } as never)
      useAuthStore().userId = 'uid-1'

      const store = useDataSyncStore()
      expect(await store.upsertLessonProgress(['pawn-basics'])).toBe(true)
      const [rows] = upsertFn.mock.calls[0]
      expect(rows).toEqual([{ user_id: 'uid-1', lesson_id: 'pawn-basics' }])
    })
  })

  // ── concept_deepened (concept deepening page) ───────────────────────────

  describe('loadDeepenedConcepts', () => {
    it('returns [] when logged out without touching supabase', async () => {
      const store = useDataSyncStore()
      expect(await store.loadDeepenedConcepts()).toEqual([])
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('maps rows to concept_id strings when logged in', async () => {
      const selectFn = vi.fn().mockResolvedValueOnce({
        data: [{ concept_id: 'pin' }, { concept_id: 'skewer' }],
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValueOnce({ select: selectFn } as never)
      useAuthStore().userId = 'uid-1'

      const store = useDataSyncStore()
      expect(await store.loadDeepenedConcepts()).toEqual(['pin', 'skewer'])
      expect(supabase.from).toHaveBeenCalledWith('concept_deepened')
    })

    it('returns [] on error (degrades to local cache)', async () => {
      const selectFn = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
      vi.mocked(supabase.from).mockReturnValueOnce({ select: selectFn } as never)
      useAuthStore().userId = 'uid-1'

      const store = useDataSyncStore()
      expect(await store.loadDeepenedConcepts()).toEqual([])
    })
  })

  describe('upsertDeepenedConcepts', () => {
    it('no-ops (false) when logged out', async () => {
      const store = useDataSyncStore()
      expect(await store.upsertDeepenedConcepts(['pin'])).toBe(false)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('no-ops (false) for an empty id list', async () => {
      useAuthStore().userId = 'uid-1'
      const store = useDataSyncStore()
      expect(await store.upsertDeepenedConcepts([])).toBe(false)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('upserts user-scoped rows to concept_deepened and returns true', async () => {
      const upsertFn = vi.fn().mockResolvedValueOnce({ error: null })
      vi.mocked(supabase.from).mockReturnValueOnce({ upsert: upsertFn } as never)
      useAuthStore().userId = 'uid-1'

      const store = useDataSyncStore()
      expect(await store.upsertDeepenedConcepts(['pin'])).toBe(true)
      expect(supabase.from).toHaveBeenCalledWith('concept_deepened')
      const [rows] = upsertFn.mock.calls[0]
      expect(rows).toEqual([{ user_id: 'uid-1', concept_id: 'pin' }])
    })
  })

  // ── dungeon_progress (S13 cross-device) ─────────────────────────────────

  describe('loadDungeonProgress', () => {
    it('returns [] when logged out without touching supabase', async () => {
      const store = useDataSyncStore()
      expect(await store.loadDungeonProgress()).toEqual([])
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('maps rows to {puzzleId, hintUsed} when logged in', async () => {
      const selectFn = vi.fn().mockResolvedValueOnce({
        data: [
          { puzzle_id: 'l1-capture-queen', hint_used: false },
          { puzzle_id: 'l2-knight-fork-rook', hint_used: true },
        ],
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValueOnce({ select: selectFn } as never)
      useAuthStore().userId = 'uid-1'

      const store = useDataSyncStore()
      expect(await store.loadDungeonProgress()).toEqual([
        { puzzleId: 'l1-capture-queen', hintUsed: false },
        { puzzleId: 'l2-knight-fork-rook', hintUsed: true },
      ])
    })

    it('returns [] on error (degrades to local cache)', async () => {
      const selectFn = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
      vi.mocked(supabase.from).mockReturnValueOnce({ select: selectFn } as never)
      useAuthStore().userId = 'uid-1'

      const store = useDataSyncStore()
      expect(await store.loadDungeonProgress()).toEqual([])
    })
  })

  describe('upsertDungeonProgress', () => {
    it('no-ops (false) when logged out', async () => {
      const store = useDataSyncStore()
      expect(await store.upsertDungeonProgress([{ puzzleId: 'l1-capture-queen', hintUsed: false }])).toBe(false)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('no-ops (false) for an empty list', async () => {
      useAuthStore().userId = 'uid-1'
      const store = useDataSyncStore()
      expect(await store.upsertDungeonProgress([])).toBe(false)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('upserts user-scoped rows with hint_used and returns true', async () => {
      const upsertFn = vi.fn().mockResolvedValueOnce({ error: null })
      vi.mocked(supabase.from).mockReturnValueOnce({ upsert: upsertFn } as never)
      useAuthStore().userId = 'uid-1'

      const store = useDataSyncStore()
      expect(
        await store.upsertDungeonProgress([{ puzzleId: 'l1-capture-queen', hintUsed: true }]),
      ).toBe(true)
      const [rows] = upsertFn.mock.calls[0]
      expect(rows).toEqual([{ user_id: 'uid-1', puzzle_id: 'l1-capture-queen', hint_used: true }])
    })
  })

  // ── loadGameHistory — guest reads the local unsynced queue (訪客完局紀錄) ──
  describe('loadGameHistory — guest (local unsynced queue)', () => {
    function queueGame(id: string, completedAt: number): void {
      localStorage.setItem(
        `chess:unsynced:${id}`,
        JSON.stringify({ ...makeGame({ completedAt }), id }),
      )
    }

    it('returns queued games as DB-shaped rows without touching supabase', async () => {
      queueGame('aaaaaaaa-0000-0000-0000-000000000001', 1_700_000_000_000)
      const store = useDataSyncStore()

      const rows = await store.loadGameHistory()

      expect(supabase.from).not.toHaveBeenCalled()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        id: 'aaaaaaaa-0000-0000-0000-000000000001',
        result: 'white_wins',
        player_color: 'white',
        move_count: 3,
      })
      expect(rows[0].played_at).toBe(new Date(1_700_000_000_000).toISOString())
      expect(rows[0].created_at).toBe(rows[0].played_at)
    })

    it('orders rows by played_at descending (newest first)', async () => {
      queueGame('aaaaaaaa-0000-0000-0000-000000000001', 1_000_000)
      queueGame('aaaaaaaa-0000-0000-0000-000000000002', 3_000_000)
      queueGame('aaaaaaaa-0000-0000-0000-000000000003', 2_000_000)
      const store = useDataSyncStore()

      const rows = await store.loadGameHistory()

      expect(rows.map((r) => r.id)).toEqual([
        'aaaaaaaa-0000-0000-0000-000000000002',
        'aaaaaaaa-0000-0000-0000-000000000003',
        'aaaaaaaa-0000-0000-0000-000000000001',
      ])
    })

    it('skips a corrupt queue entry instead of blanking the whole history', async () => {
      queueGame('aaaaaaaa-0000-0000-0000-000000000001', 1_000_000)
      localStorage.setItem('chess:unsynced:bad', '{not valid json')
      const store = useDataSyncStore()

      const rows = await store.loadGameHistory()
      expect(rows).toHaveLength(1)
    })

    it('paginates: first page caps at HISTORY_LOAD_LIMIT, cursor fetches the remainder with no overlap', async () => {
      const total = HISTORY_LOAD_LIMIT + 5
      for (let i = 0; i < total; i++) {
        const id = `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, '0')}`
        queueGame(id, 1_000_000 + i * 1000)
      }
      const store = useDataSyncStore()

      const page1 = await store.loadGameHistory()
      expect(page1).toHaveLength(HISTORY_LOAD_LIMIT)

      const last = page1[page1.length - 1]
      const cursor = {
        playedAt: last.played_at as string,
        createdAt: last.created_at as string,
        id: last.id as string,
      }
      const page2 = await store.loadGameHistory(cursor)
      expect(page2).toHaveLength(5)

      const page1Ids = new Set(page1.map((r) => r.id))
      expect(page2.every((r) => !page1Ids.has(r.id as string))).toBe(true)
    })
  })

  // ── in_progress_game (續玩對局 cross-device) ────────────────────────────
  describe('resume game CRUD', () => {
    const snapshot = {
      moves: ['e2e4', 'e7e5'],
      playerColor: 'white' as const,
      level: 7,
      playerMoveTimes: [1200],
      updatedAt: 1_700_000_000_000,
    }

    describe('loadResumeGame', () => {
      it('returns null when logged out without touching supabase', async () => {
        const store = useDataSyncStore()
        expect(await store.loadResumeGame()).toBeNull()
        expect(supabase.from).not.toHaveBeenCalled()
      })

      it('maps the row to a ResumeSnapshot when logged in', async () => {
        const maybeSingle = vi.fn().mockResolvedValueOnce({
          data: {
            moves: ['e2e4', 'e7e5'],
            player_color: 'white',
            level: 7,
            player_move_times: [1200],
            updated_at: new Date(1_700_000_000_000).toISOString(),
          },
          error: null,
        })
        const select = vi.fn().mockReturnValueOnce({ maybeSingle })
        vi.mocked(supabase.from).mockReturnValueOnce({ select } as never)
        useAuthStore().userId = 'uid-1'

        const store = useDataSyncStore()
        expect(await store.loadResumeGame()).toEqual(snapshot)
      })

      it('returns null on error (degrades to local cache)', async () => {
        const maybeSingle = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
        const select = vi.fn().mockReturnValueOnce({ maybeSingle })
        vi.mocked(supabase.from).mockReturnValueOnce({ select } as never)
        useAuthStore().userId = 'uid-1'

        const store = useDataSyncStore()
        expect(await store.loadResumeGame()).toBeNull()
      })
    })

    describe('upsertResumeGame', () => {
      it('no-ops (false) when logged out', async () => {
        const store = useDataSyncStore()
        expect(await store.upsertResumeGame(snapshot)).toBe(false)
        expect(supabase.from).not.toHaveBeenCalled()
      })

      it('upserts a user-scoped row on conflict user_id and returns true', async () => {
        const upsertFn = vi.fn().mockResolvedValueOnce({ error: null })
        vi.mocked(supabase.from).mockReturnValueOnce({ upsert: upsertFn } as never)
        useAuthStore().userId = 'uid-1'

        const store = useDataSyncStore()
        expect(await store.upsertResumeGame(snapshot)).toBe(true)
        const [row, opts] = upsertFn.mock.calls[0]
        expect(row).toMatchObject({
          user_id: 'uid-1',
          moves: ['e2e4', 'e7e5'],
          player_color: 'white',
          level: 7,
          player_move_times: [1200],
        })
        expect(opts).toMatchObject({ onConflict: 'user_id' })
      })
    })

    describe('deleteResumeGame', () => {
      it('no-ops (false) when logged out', async () => {
        const store = useDataSyncStore()
        expect(await store.deleteResumeGame()).toBe(false)
        expect(supabase.from).not.toHaveBeenCalled()
      })

      it('deletes the user-scoped row and returns true', async () => {
        const eq = vi.fn().mockResolvedValueOnce({ error: null })
        const del = vi.fn().mockReturnValueOnce({ eq })
        vi.mocked(supabase.from).mockReturnValueOnce({ delete: del } as never)
        useAuthStore().userId = 'uid-1'

        const store = useDataSyncStore()
        expect(await store.deleteResumeGame()).toBe(true)
        expect(eq).toHaveBeenCalledWith('user_id', 'uid-1')
      })
    })
  })
})
