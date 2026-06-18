// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(), signInWithOAuth: vi.fn(), signOut: vi.fn(), onAuthStateChange: vi.fn() },
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useDataSyncStore } from '@/stores/data-sync'
import type { MemoryGameSummary } from '@/types/memory'

function mockUpsert(result: { error: unknown } = { error: null }) {
  const upsertFn = vi.fn().mockResolvedValueOnce(result)
  vi.mocked(supabase.from).mockReturnValueOnce({ upsert: upsertFn } as never)
  return upsertFn
}
function mockSelectEqOrder(result: { data: unknown; error: unknown }) {
  const orderFn = vi.fn().mockResolvedValueOnce(result)
  const eqFn = vi.fn().mockReturnValue({ order: orderFn })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
  vi.mocked(supabase.from).mockReturnValueOnce({ select: selectFn } as never)
  return { selectFn, eqFn, orderFn }
}
function mockUpsertMany(results: { error: unknown }[]) {
  const upsertFn = vi.fn()
  results.forEach((r) => upsertFn.mockResolvedValueOnce(r))
  vi.mocked(supabase.from).mockReturnValue({ upsert: upsertFn } as never)
  return upsertFn
}
function mockAuthSubscription() {
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue(
    { data: { subscription: { unsubscribe: vi.fn() } } } as never,
  )
}
function summary(o: Partial<MemoryGameSummary> = {}): MemoryGameSummary {
  return {
    schemaVersion: o.schemaVersion ?? 1,
    gameId: o.gameId ?? 'game-1',
    createdAt: o.createdAt ?? 1_700_000_000_000,
    stageCounts: o.stageCounts ?? { opening: 0, middlegame: 1, endgame: 0 },
    conceptCounts: o.conceptCounts ?? { material: 1 },
    anchorStage: o.anchorStage !== undefined ? o.anchorStage : 'middlegame',
  }
}

describe('useDataSyncStore — memory', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    mockAuthSubscription()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)
  })

  describe('appendMemorySummary — logged in', () => {
    it('upserts with event-level idempotency (onConflict user_id,game_id, ignoreDuplicates)', async () => {
      const upsertFn = mockUpsert({ error: null })
      useAuthStore().userId = 'uid-1'
      const store = useDataSyncStore()

      await store.appendMemorySummary(summary({ gameId: 'g9' }))

      expect(supabase.from).toHaveBeenCalledWith('memory_summaries')
      const [row, opts] = upsertFn.mock.calls[0]
      expect(opts).toEqual({ onConflict: 'user_id,game_id', ignoreDuplicates: true })
      expect(row).toMatchObject({ user_id: 'uid-1', game_id: 'g9', schema_version: 1 })
      expect(row.summary).toMatchObject({ stageCounts: { middlegame: 1 }, anchorStage: 'middlegame' })
    })

    it('queues to chess:memory:unsynced on insert error', async () => {
      mockUpsert({ error: { message: 'offline' } })
      useAuthStore().userId = 'uid-1'
      const store = useDataSyncStore()

      await store.appendMemorySummary(summary({ gameId: 'g7' }))

      expect(localStorage.getItem('chess:memory:unsynced:g7')).toBeTruthy()
    })
  })

  describe('appendMemorySummary — guest', () => {
    it('writes to chess:memory:summaries with no supabase call', async () => {
      const store = useDataSyncStore()
      await store.appendMemorySummary(summary({ gameId: 'g1' }))

      expect(supabase.from).not.toHaveBeenCalled()
      expect(JSON.parse(localStorage.getItem('chess:memory:summaries') as string)).toHaveLength(1)
    })

    it('is idempotent locally by gameId', async () => {
      const store = useDataSyncStore()
      await store.appendMemorySummary(summary({ gameId: 'g1' }))
      await store.appendMemorySummary(summary({ gameId: 'g1' }))

      expect(JSON.parse(localStorage.getItem('chess:memory:summaries') as string)).toHaveLength(1)
    })
  })

  describe('loadMemorySummaries', () => {
    it('returns [] with no supabase call when logged out', async () => {
      const store = useDataSyncStore()
      expect(await store.loadMemorySummaries()).toEqual([])
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('filters to the current schema_version and maps rows', async () => {
      const { eqFn } = mockSelectEqOrder({
        data: [
          {
            game_id: 'g1', schema_version: 1,
            summary: { stageCounts: { opening: 0, middlegame: 1, endgame: 0 }, conceptCounts: { material: 1 }, anchorStage: 'middlegame' },
            created_at: '2026-06-18T00:00:00.000Z',
          },
        ],
        error: null,
      })
      useAuthStore().userId = 'uid-1'
      const store = useDataSyncStore()

      const out = await store.loadMemorySummaries()
      expect(eqFn).toHaveBeenCalledWith('schema_version', 1)
      expect(out).toHaveLength(1)
      expect(out[0]).toMatchObject({ gameId: 'g1', schemaVersion: 1, anchorStage: 'middlegame' })
      expect(out[0].createdAt).toBe(new Date('2026-06-18T00:00:00.000Z').getTime())
    })

    it('throws on a read error', async () => {
      mockSelectEqOrder({ data: null, error: { message: 'boom' } })
      useAuthStore().userId = 'uid-1'
      const store = useDataSyncStore()
      await expect(store.loadMemorySummaries()).rejects.toThrow(/boom/)
    })
  })

  describe('readLocalMemorySummaries', () => {
    it('reads guest blob and unsynced queue', () => {
      const store = useDataSyncStore()
      localStorage.setItem('chess:memory:summaries', JSON.stringify([summary({ gameId: 'g1' })]))
      localStorage.setItem('chess:memory:unsynced:g2', JSON.stringify(summary({ gameId: 'g2' })))

      const ids = store.readLocalMemorySummaries().map((s) => s.gameId).sort()
      expect(ids).toEqual(['g1', 'g2'])
    })

    it('skips a corrupt blob without throwing', () => {
      const store = useDataSyncStore()
      localStorage.setItem('chess:memory:summaries', '{not json')
      expect(store.readLocalMemorySummaries()).toEqual([])
    })
  })

  describe('flushMemoryQueue — guest→login reconcile', () => {
    it('pushes guest summaries to the cloud and clears the guest blob', async () => {
      const store = useDataSyncStore()
      await store.appendMemorySummary(summary({ gameId: 'g1' }))
      await store.appendMemorySummary(summary({ gameId: 'g2' }))
      expect(JSON.parse(localStorage.getItem('chess:memory:summaries') as string)).toHaveLength(2)

      const upsertFn = mockUpsertMany([{ error: null }, { error: null }])
      useAuthStore().userId = 'uid-1'
      await store.flushMemoryQueue()

      expect(upsertFn).toHaveBeenCalledTimes(2)
      expect(localStorage.getItem('chess:memory:summaries')).toBeNull()
    })

    it('dedups by gameId across guest blob and unsynced queue', async () => {
      const store = useDataSyncStore()
      localStorage.setItem('chess:memory:summaries', JSON.stringify([summary({ gameId: 'g1' })]))
      localStorage.setItem('chess:memory:unsynced:g1', JSON.stringify(summary({ gameId: 'g1' })))

      const upsertFn = mockUpsertMany([{ error: null }])
      useAuthStore().userId = 'uid-1'
      await store.flushMemoryQueue()

      expect(upsertFn).toHaveBeenCalledTimes(1)
    })

    it('no loss: a failed summary re-queues to unsynced, the guest blob is cleared', async () => {
      const store = useDataSyncStore()
      localStorage.setItem(
        'chess:memory:summaries',
        JSON.stringify([summary({ gameId: 'g1' }), summary({ gameId: 'g2' })]),
      )

      mockUpsertMany([{ error: null }, { error: { message: 'offline' } }])
      useAuthStore().userId = 'uid-1'
      await store.flushMemoryQueue()

      expect(localStorage.getItem('chess:memory:summaries')).toBeNull()
      expect(localStorage.getItem('chess:memory:unsynced:g2')).toBeTruthy()
      expect(localStorage.getItem('chess:memory:unsynced:g1')).toBeNull()
    })
  })
})
