// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

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
import { useGameHistoryStore } from '@/stores/game-history'
import { useDataSyncStore } from '@/stores/data-sync'

function mockAuthSubscription() {
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue(
    { data: { subscription: { unsubscribe: vi.fn() } } } as unknown as ReturnType<
      typeof supabase.auth.onAuthStateChange
    >,
  )
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'row-id-1',
    played_at: '2024-03-15T10:00:00Z',
    created_at: '2024-03-15T10:00:00Z',
    result: 'white_wins',
    player_color: 'white',
    end_reason: 'checkmate',
    ai_difficulty: 10,
    move_count: 30,
    opening_name: 'Ruy Lopez',
    opening_eco: 'C65',
    ...overrides,
  }
}

/** Build a chainable Supabase query mock that resolves with the given rows */
function mockSupabaseSelect(rows: Record<string, unknown>[], errorObj: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    then: undefined as unknown,
  }
  // Make the chain thenable so `await query` works
  const promise = Promise.resolve({ data: rows, error: errorObj })
  Object.assign(chain, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  })
  vi.mocked(supabase.from).mockReturnValueOnce(chain as never)
  return chain
}

describe('useGameHistoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockAuthSubscription()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null }, error: null,
    } as never)
  })

  // ── AC-14: fetch success → cacheState valid ───────────────────────────

  it('AC-14: fetchHistory success sets cacheState=valid and isLoading=false', async () => {
    const authStore = useAuthStore()
    authStore.userId = 'uid-1'
    mockSupabaseSelect([makeRow()])

    const store = useGameHistoryStore()
    expect(store.cacheState).toBe('cold')

    await store.fetchHistory()

    expect(store.cacheState).toBe('valid')
    expect(store.isLoading).toBe(false)
    expect(store.entries).toHaveLength(1)
  })

  // ── AC-10: null userId → empty result, no Supabase call ──────────────

  it('AC-10: fetchHistory returns [] immediately when userId is null', async () => {
    // userId stays null (default)
    const store = useGameHistoryStore()
    await store.fetchHistory()

    expect(supabase.from).not.toHaveBeenCalled()
    expect(store.entries).toHaveLength(0)
  })

  // ── AC-15: move_count=0 renders without error ────────────────────────

  it('AC-15: move_count=0 row is mapped without error', async () => {
    const authStore = useAuthStore()
    authStore.userId = 'uid-1'
    mockSupabaseSelect([makeRow({ move_count: 0 })])

    const store = useGameHistoryStore()
    await store.fetchHistory()

    expect(store.entries[0].moveCount).toBe(0)
  })

  // ── AC-17: invalid date → '—' display, no JS error ──────────────────

  it('AC-17: played_at invalid → displayDate is em dash, no JS error', async () => {
    const authStore = useAuthStore()
    authStore.userId = 'uid-1'
    mockSupabaseSelect([makeRow({ played_at: 'not-a-date' })])

    const store = useGameHistoryStore()
    await store.fetchHistory()

    expect(store.entries[0].displayDate).toBe('—')
    expect(store.entries[0].playedAt).toBeNull()
  })

  // ── AC-18: entries order matches loadGameHistory return order ─────────

  it('AC-18: entries order matches the order returned by loadGameHistory (no re-sort)', async () => {
    const authStore = useAuthStore()
    authStore.userId = 'uid-1'

    const row1 = makeRow({ id: 'id-1', played_at: '2024-03-15T10:00:00Z' })
    const row2 = makeRow({ id: 'id-2', played_at: '2024-03-14T10:00:00Z' })
    const row3 = makeRow({ id: 'id-3', played_at: '2024-03-13T10:00:00Z' })
    mockSupabaseSelect([row1, row2, row3])

    const store = useGameHistoryStore()
    await store.fetchHistory()

    expect(store.entries.map(e => e.id)).toEqual(['id-1', 'id-2', 'id-3'])
  })

  // ── Error state ────────────────────────────────────────────────────────

  it('fetch error stores error message and does not change cacheState', async () => {
    const authStore = useAuthStore()
    authStore.userId = 'uid-1'
    // loadGameHistory throws new Error(error.message) — error.message is 'DB error'
    mockSupabaseSelect([], { message: 'DB error' })

    const store = useGameHistoryStore()
    await store.fetchHistory()

    expect(store.error).toContain('DB error')
    expect(store.cacheState).toBe('cold')  // unchanged from initial cold
    expect(store.isLoading).toBe(false)
  })

  // ── Deduplication guard ────────────────────────────────────────────────

  it('second concurrent fetchHistory call is a no-op (deduplication guard)', async () => {
    const authStore = useAuthStore()
    authStore.userId = 'uid-1'

    let resolveFirst!: (v: unknown) => void
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: undefined as unknown,
      catch: undefined as unknown,
    }
    const firstPromise = new Promise(r => { resolveFirst = r })
    Object.assign(chain, {
      then: firstPromise.then.bind(firstPromise),
      catch: firstPromise.catch.bind(firstPromise),
    })
    vi.mocked(supabase.from).mockReturnValueOnce(chain as never)

    const store = useGameHistoryStore()
    const p1 = store.fetchHistory()
    // isLoading is now true — second call should be a no-op
    const p2 = store.fetchHistory()

    // Resolve first and wait for both to settle
    resolveFirst({ data: [makeRow()], error: null })
    await Promise.all([p1, p2])

    // Only one supabase.from() call across both fetchHistory() invocations
    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(store.entries).toHaveLength(1)
  })

  // ── invalidate ─────────────────────────────────────────────────────────

  it('invalidate() sets cacheState=dirty and increments fetchGeneration', () => {
    const store = useGameHistoryStore()
    const gen = store.fetchGeneration
    store.invalidate()
    expect(store.cacheState).toBe('dirty')
    expect(store.fetchGeneration).toBe(gen + 1)
  })

  // ── AC-13 (Integration): syncGame success → gameHistory cacheState dirty ──

  it('AC-13: syncGame success triggers useGameHistoryStore.invalidate() (cacheState becomes dirty)', async () => {
    const authStore = useAuthStore()
    authStore.userId = 'uid-1'

    // Mock the upsert for syncGame
    const upsertFn = vi.fn().mockResolvedValueOnce({ error: null })
    vi.mocked(supabase.from).mockReturnValueOnce({ upsert: upsertFn } as never)

    const historyStore = useGameHistoryStore()
    // Seed as valid to confirm it becomes dirty
    historyStore.cacheState = 'valid'

    const dataSyncStore = useDataSyncStore()
    await dataSyncStore.syncGame({
      moves: ['e2e4', 'e7e5'],
      playerColor: 'white',
      result: '1-0',
      endReason: 'checkmate',
      completedAt: 1_700_000_000_000,
      aiSkillLevel: 5,
      playerMoveTimes: [1000, 2000],
      isTerminal: true,
    })

    expect(historyStore.cacheState).toBe('dirty')
  })

  // ── flushUnsyncedQueue success → gameHistory cacheState dirty (same syncVersion path as AC-13) ──

  it('flushUnsyncedQueue success (queue fully drained) triggers useGameHistoryStore.invalidate() (cacheState becomes dirty)', async () => {
    const authStore = useAuthStore()
    authStore.userId = 'uid-1'

    const id1 = 'aaaaaaaa-0000-0000-0000-000000000001'
    localStorage.setItem(
      `chess:unsynced:${id1}`,
      JSON.stringify({
        id: id1,
        moves: ['e2e4', 'e7e5'],
        playerColor: 'white',
        result: '1-0',
        endReason: 'checkmate',
        completedAt: 1_700_000_000_000,
        aiSkillLevel: 5,
        playerMoveTimes: [1000, 2000],
        isTerminal: true,
      }),
    )

    const upsertFn = vi.fn().mockResolvedValueOnce({ error: null })
    vi.mocked(supabase.from).mockReturnValueOnce({ upsert: upsertFn } as never)

    const historyStore = useGameHistoryStore()
    // Seed as valid to confirm it becomes dirty
    historyStore.cacheState = 'valid'

    const dataSyncStore = useDataSyncStore()
    await dataSyncStore.flushUnsyncedQueue()

    expect(historyStore.cacheState).toBe('dirty')

    localStorage.removeItem(`chess:unsynced:${id1}`)
  })

  // ── setExpandedRow (AC-12b single-row invariant) ──────────────────────

  it('setExpandedRow expands the given row', () => {
    const store = useGameHistoryStore()
    store.setExpandedRow('row-1')
    expect(store.expandedRowId).toBe('row-1')
  })

  it('setExpandedRow collapses when called with the already-expanded id', () => {
    const store = useGameHistoryStore()
    store.setExpandedRow('row-1')
    store.setExpandedRow('row-1')
    expect(store.expandedRowId).toBeNull()
  })

  it('setExpandedRow enforces single-row invariant — second call replaces first', () => {
    const store = useGameHistoryStore()
    store.setExpandedRow('row-1')
    store.setExpandedRow('row-2')
    expect(store.expandedRowId).toBe('row-2')
  })

  it('setExpandedRow(null) collapses any open row', () => {
    const store = useGameHistoryStore()
    store.setExpandedRow('row-1')
    store.setExpandedRow(null)
    expect(store.expandedRowId).toBeNull()
  })

  // ── resetHistory (ProfileView "重置對局記錄") ──────────────────────────

  it('resetHistory: success empties the list and leaves cacheState valid', async () => {
    const authStore = useAuthStore()
    authStore.userId = 'uid-1'
    mockSupabaseSelect([makeRow()])

    const store = useGameHistoryStore()
    await store.fetchHistory()
    expect(store.entries).toHaveLength(1)

    const eq = vi.fn().mockResolvedValueOnce({ error: null })
    const del = vi.fn().mockReturnValueOnce({ eq })
    vi.mocked(supabase.from).mockReturnValueOnce({ delete: del } as never)

    expect(await store.resetHistory()).toBe(true)
    expect(store.entries).toHaveLength(0)
    expect(store.hasMore).toBe(false)
    expect(store.nextCursor).toBeNull()
    expect(store.cacheState).toBe('valid')
  })

  it('resetHistory: cloud error returns false and leaves the list untouched', async () => {
    const authStore = useAuthStore()
    authStore.userId = 'uid-1'
    mockSupabaseSelect([makeRow()])

    const store = useGameHistoryStore()
    await store.fetchHistory()

    const eq = vi.fn().mockResolvedValueOnce({ error: { message: 'boom' } })
    const del = vi.fn().mockReturnValueOnce({ eq })
    vi.mocked(supabase.from).mockReturnValueOnce({ delete: del } as never)

    expect(await store.resetHistory()).toBe(false)
    expect(store.entries).toHaveLength(1)
  })
})
