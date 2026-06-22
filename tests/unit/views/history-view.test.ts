// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import HistoryView from '@/views/HistoryView.vue'
import { useGameHistoryStore } from '@/stores/game-history'
import { HISTORY_SKELETON_ROWS, HISTORY_LOAD_LIMIT } from '@/config/history-config'
import type { GameHistoryEntry } from '@/types/game-history'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/play', component: { template: '<div/>' } },
      { path: '/history', component: HistoryView },
      { path: '/review', name: 'review', component: { template: '<div/>' } },
      { path: '/sign-in', component: { template: '<div/>' } },
    ],
  })
}

function makeEntry(id: string, overrides: Partial<GameHistoryEntry> = {}): GameHistoryEntry {
  return {
    id,
    playedAt: new Date('2024-03-15T10:00:00Z'),
    displayDate: 'Mar 15, 2024',
    playerResult: 'Win',
    playerResultPrefix: 'W',
    playerColor: 'white',
    endReason: 'checkmate',
    endReasonDisplay: 'Checkmate',
    aiDifficulty: 10,
    difficultyLabel: 'Intermediate',
    moveCount: 34,
    openingName: 'Ruy Lopez',
    openingEco: 'C65',
    openingDisplay: 'Ruy Lopez',
    pgn: '1. e4 e5 *',
    ...overrides,
  }
}

/** Mount HistoryView with the SAME pinia instance used in the test body */
function mountView(pinia: ReturnType<typeof createPinia>) {
  const router = makeRouter()
  return mount(HistoryView, {
    global: { plugins: [pinia, router] },
  })
}

/** Create pinia, set active, return store + pinia tuple */
function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGameHistoryStore()
  return { pinia, store }
}

// ── AC-01: Loading state ──────────────────────────────────────────────────

describe('AC-01: loading state', () => {
  it('shows HISTORY_SKELETON_ROWS skeleton rows with aria-busy when isLoading is true', async () => {
    const { pinia, store } = setup()
    vi.spyOn(store, 'fetchHistory').mockImplementation(() => new Promise(() => {}))

    const wrapper = mountView(pinia)
    await wrapper.vm.$nextTick()

    // fetchHistory is hanging so isLoading was set to true
    store.isLoading = true
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
    const skeletonRows = wrapper.findAll('[aria-hidden="true"]')
    expect(skeletonRows.length).toBe(HISTORY_SKELETON_ROWS)
    skeletonRows.forEach(row => {
      expect(row.attributes('style')).toContain('pointer-events: none')
    })
  })
})

// ── AC-02: 5 rows rendered ────────────────────────────────────────────────

describe('AC-02: list state with rows', () => {
  it('renders 5 history-row elements when store has 5 entries', async () => {
    const { pinia, store } = setup()
    vi.spyOn(store, 'fetchHistory').mockResolvedValue()
    store.entries = Array.from({ length: 5 }, (_, i) => makeEntry(`id-${i}`))
    store.cacheState = 'valid'
    store.isLoading = false

    const wrapper = mountView(pinia)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="history-row"]').length).toBe(5)
    expect(store.fetchHistory).not.toHaveBeenCalled()
  })
})

// ── AC-03: Empty state ────────────────────────────────────────────────────

describe('AC-03: empty state', () => {
  it('shows "No games recorded yet." and /play link when entries is empty', async () => {
    const { pinia, store } = setup()
    vi.spyOn(store, 'fetchHistory').mockResolvedValue()
    store.entries = []
    store.cacheState = 'valid'
    store.isLoading = false

    const wrapper = mountView(pinia)
    await flushPromises()

    expect(wrapper.text()).toContain('還沒有對局紀錄')
    expect(wrapper.find('a[href="#/play"]').exists()).toBe(true)
  })
})

// ── AC-04: Error state (initial, no cached entries) ───────────────────────

describe('AC-04: error state', () => {
  it('shows error message and "Try again" button when error is set with no entries', async () => {
    const { pinia, store } = setup()
    vi.spyOn(store, 'fetchHistory').mockResolvedValue()
    store.entries = []
    store.error = 'network failure'
    store.cacheState = 'cold'
    store.isLoading = false

    const wrapper = mountView(pinia)
    await flushPromises()

    expect(wrapper.text()).toContain('再試一次')
    expect(wrapper.findAll('[data-testid="history-row"]').length).toBe(0)
  })
})

// ── AC-05: Retry calls fetchHistory ──────────────────────────────────────

describe('AC-05: retry behavior', () => {
  it('tap "Try again" calls fetchHistory', async () => {
    const { pinia, store } = setup()
    let resolveFetch!: () => void
    const fetchSpy = vi.spyOn(store, 'fetchHistory').mockImplementation(
      () => new Promise<void>(r => { resolveFetch = r }),
    )
    store.entries = []
    store.error = 'network failure'
    store.isLoading = false

    const wrapper = mountView(pinia)
    await flushPromises()
    fetchSpy.mockClear()

    const retryBtn = wrapper.findAll('button').find(b => b.text().includes('再試一次'))
    expect(retryBtn?.exists()).toBe(true)
    await retryBtn!.trigger('click')

    expect(fetchSpy).toHaveBeenCalledOnce()
    resolveFetch()
  })
})

// ── AC-05b: Retry success shows rows ─────────────────────────────────────

describe('AC-05b: retry success', () => {
  it('after retry succeeds rows appear and error is gone', async () => {
    const { pinia, store } = setup()
    // Set cacheState=valid to prevent onMounted from calling fetchHistory automatically
    store.cacheState = 'valid'
    store.entries = []
    store.error = 'network failure'
    store.isLoading = false

    vi.spyOn(store, 'fetchHistory').mockImplementation(() => {
      store.entries = [makeEntry('row-1')]
      store.error = null
      store.cacheState = 'valid'
      return Promise.resolve()
    })

    const wrapper = mountView(pinia)
    await flushPromises()

    const retryBtn = wrapper.findAll('button').find(b => b.text().includes('再試一次'))
    expect(retryBtn?.exists()).toBe(true)
    await retryBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="history-row"]').length).toBe(1)
    expect(wrapper.text()).not.toContain('再試一次')
  })
})

// ── AC-09: Cache valid — no re-fetch ─────────────────────────────────────

describe('AC-09: cache valid', () => {
  it('does not call fetchHistory when cacheState is valid on mount', async () => {
    const { pinia, store } = setup()
    const fetchSpy = vi.spyOn(store, 'fetchHistory').mockResolvedValue()
    store.entries = [makeEntry('cached-1')]
    store.cacheState = 'valid'
    store.isLoading = false

    mountView(pinia)
    await flushPromises()

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ── AC-09b: Cache valid with 0 entries ───────────────────────────────────

describe('AC-09b: cache valid empty', () => {
  it('shows empty state immediately when cacheState=valid and entries empty', async () => {
    const { pinia, store } = setup()
    const fetchSpy = vi.spyOn(store, 'fetchHistory').mockResolvedValue()
    store.entries = []
    store.cacheState = 'valid'
    store.isLoading = false

    const wrapper = mountView(pinia)
    await flushPromises()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('還沒有對局紀錄')
  })
})

// ── AC-11: Load more button exists when hasMore=true ─────────────────────

describe('AC-11: load more button', () => {
  it('load-more button exists when hasMore is true', async () => {
    const { pinia, store } = setup()
    vi.spyOn(store, 'fetchHistory').mockResolvedValue()
    store.entries = Array.from({ length: HISTORY_LOAD_LIMIT }, (_, i) => makeEntry(`id-${i}`))
    store.hasMore = true
    store.cacheState = 'valid'
    store.isLoading = false

    const wrapper = mountView(pinia)
    await flushPromises()

    expect(wrapper.find('[data-testid="load-more-button"]').exists()).toBe(true)
  })
})

// ── AC-11b: No load more button when hasMore=false ────────────────────────

describe('AC-11b: no load more button', () => {
  it('no load-more button when hasMore is false', async () => {
    const { pinia, store } = setup()
    vi.spyOn(store, 'fetchHistory').mockResolvedValue()
    store.entries = [makeEntry('id-1')]
    store.hasMore = false
    store.cacheState = 'valid'
    store.isLoading = false

    const wrapper = mountView(pinia)
    await flushPromises()

    expect(wrapper.find('[data-testid="load-more-button"]').exists()).toBe(false)
  })
})

// ── AC-11c: Tap load more appends rows ───────────────────────────────────

describe('AC-11c: load more appends rows', () => {
  it('tapping load more appends 5 more rows to existing entries', async () => {
    const { pinia, store } = setup()
    vi.spyOn(store, 'fetchHistory').mockResolvedValue()
    store.entries = Array.from({ length: HISTORY_LOAD_LIMIT }, (_, i) => makeEntry(`id-${i}`))
    store.hasMore = true
    store.cacheState = 'valid'
    store.isLoading = false

    vi.spyOn(store, 'loadMore').mockImplementation(() => {
      const extra = Array.from({ length: 5 }, (_, i) => makeEntry(`extra-${i}`))
      store.entries = [...store.entries, ...extra]
      store.hasMore = false
      return Promise.resolve()
    })

    const wrapper = mountView(pinia)
    await flushPromises()

    await wrapper.find('[data-testid="load-more-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="history-row"]').length).toBe(HISTORY_LOAD_LIMIT + 5)
    expect(wrapper.find('[data-testid="load-more-button"]').exists()).toBe(false)
  })
})

// ── AC-12 (BLOCKING): Expanded panel shows correct fields ────────────────

describe('AC-12: expanded row panel fields', () => {
  it('expanded row shows moveCount, endReasonDisplay, difficultyLabel, playerColor', async () => {
    const { pinia, store } = setup()
    vi.spyOn(store, 'fetchHistory').mockResolvedValue()

    store.entries = [makeEntry('row-1', {
      moveCount: 34,
      endReasonDisplay: 'Checkmate',
      difficultyLabel: 'Intermediate',
      playerColor: 'white',
    })]
    store.cacheState = 'valid'
    store.isLoading = false

    const wrapper = mountView(pinia)
    await flushPromises()

    // Row click now navigates to /review?gameId; expand via store directly
    store.expandedRowId = 'row-1'
    await wrapper.vm.$nextTick()

    const text = wrapper.text()
    expect(text).toContain('34')
    expect(text).toContain('Checkmate')
    expect(text).toContain('Intermediate')
    expect(text).toContain('white')
  })
})

// ── AC-16a: Refresh sets cacheState=dirty and calls fetchHistory ──────────

describe('AC-16a: refresh button', () => {
  it('tap Refresh calls invalidate() and fetchHistory()', async () => {
    const { pinia, store } = setup()
    vi.spyOn(store, 'fetchHistory').mockResolvedValue()
    store.entries = [makeEntry('row-1')]
    store.cacheState = 'valid'
    store.isLoading = false

    const wrapper = mountView(pinia)
    await flushPromises()

    const invalidateSpy = vi.spyOn(store, 'invalidate')
    const fetchSpy = vi.spyOn(store, 'fetchHistory').mockResolvedValue()

    const refreshBtn = wrapper.find('[aria-label="重新整理對局紀錄"]')
    expect(refreshBtn.exists()).toBe(true)
    await refreshBtn.trigger('click')

    expect(invalidateSpy).toHaveBeenCalledOnce()
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})

// ── AC-25: isLoading=true — fetchHistory does not double-fetch ────────────

describe('AC-25: no double-fetch while loading', () => {
  it('while isLoading is true, fetchHistory dedup guard does not increment fetchGeneration', async () => {
    const { store } = setup()
    const gen = store.fetchGeneration
    store.isLoading = true
    await store.fetchHistory()
    expect(store.fetchGeneration).toBe(gen)
  })
})

// ── AC-26: isLoadingMore spinner replaces button ──────────────────────────

describe('AC-26: load more spinner', () => {
  it('shows spinner and hides load-more button while isLoadingMore is true', async () => {
    const { pinia, store } = setup()
    vi.spyOn(store, 'fetchHistory').mockResolvedValue()
    store.entries = [makeEntry('id-1')]
    store.hasMore = true
    store.isLoadingMore = true
    store.cacheState = 'valid'
    store.isLoading = false

    const wrapper = mountView(pinia)
    await flushPromises()

    expect(wrapper.find('[data-testid="load-more-button"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="載入更多對局中"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="history-row"]').length).toBe(1)
  })
})

// ── AC-27: Load more error shows toast, entries unchanged ────────────────

describe('AC-27: load more error toast', () => {
  it('load more failure shows error toast and entries remain unchanged', async () => {
    const { pinia, store } = setup()
    vi.spyOn(store, 'fetchHistory').mockResolvedValue()
    store.entries = [makeEntry('id-1')]
    store.hasMore = true
    store.cacheState = 'valid'
    store.isLoading = false

    vi.spyOn(store, 'loadMore').mockRejectedValue(new Error('Load more failed'))

    const wrapper = mountView(pinia)
    await flushPromises()

    await wrapper.find('[data-testid="load-more-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('無法載入更多對局，請再試一次。')
    expect(wrapper.findAll('[data-testid="history-row"]').length).toBe(1)
  })
})
