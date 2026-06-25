/**
 * Unit tests for the analysis-cache persistence in usePostGameReview (now localStorage-backed so the
 * cache survives PWA restarts; tests inject an in-memory Storage so the backend is irrelevant here).
 * Story: post-game-review/story-004-sessionstorage
 * AC-1..AC-5
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePostGameReview } from '../../../src/modules/post-game-review/use-post-game-review'
import type { AnalyzeFn } from '../../../src/modules/post-game-review/use-post-game-review'
import type { CompletedGame } from '../../../src/stores/game-store'

// ---- In-memory Storage mock ----

function makeMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, val: string) => { data.set(key, val) },
    removeItem: (key: string) => { data.delete(key) },
    clear: () => { data.clear() },
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() { return data.size },
  }
}

// ---- Fixtures ----

function makeGame(completedAt = 1716900000000): CompletedGame {
  const moves = ['e2e4', 'e7e5']
  return {
    moves: Object.freeze(moves),
    playerColor: 'white',
    result: '1-0',
    endReason: 'checkmate',
    completedAt,
    aiSkillLevel: 10,
    playerMoveTimes: Object.freeze([1000, 1000]),
    isTerminal: true,
  }
}

function makeInstantFn(): AnalyzeFn {
  return async ({ targetDepth }) => ({
    bestMove: 'e2e4',
    evalCp: 30,
    depthReached: targetDepth,
    pv: ['e2e4', 'e7e5'],
  })
}

// ---- AC-1: key format ----

describe('sessionStorage — AC-1: key format', () => {
  it('test_storageKey_usesCompletedAt_asGameId', async () => {
    const storage = makeMemoryStorage()
    const game = makeGame(1716900000000)
    const review = usePostGameReview({ storage })
    await review.init(game, makeInstantFn())

    // Wait for debounce (500ms) using fake timers
    await new Promise(r => setTimeout(r, 600))

    const keys = [...Array(storage.length)].map((_, i) => storage.key(i))
    expect(keys).toContain('pgr:analysis:v2:1716900000000')
  })
})

// ---- AC-2: pv stripped from persisted data ----

describe('sessionStorage — AC-2: pv stripped', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('test_persistedData_doesNotContain_pvField', async () => {
    const storage = makeMemoryStorage()
    const game = makeGame()
    const review = usePostGameReview({ storage })

    const p = review.init(game, makeInstantFn())
    await p

    // Advance fake timers to fire the 500ms debounce
    await vi.runAllTimersAsync()

    const saved = storage.getItem('pgr:analysis:v2:1716900000000')
    expect(saved).not.toBeNull()

    const parsed = JSON.parse(saved!) as Record<string, unknown>[]
    for (const record of parsed) {
      if (record !== null) {
        expect(record).not.toHaveProperty('pv')
      }
    }
  })

  it('test_persistedData_containsRequiredFields', async () => {
    const storage = makeMemoryStorage()
    const game = makeGame()
    const review = usePostGameReview({ storage })

    await review.init(game, makeInstantFn())
    await vi.runAllTimersAsync()

    const saved = storage.getItem('pgr:analysis:v2:1716900000000')
    const parsed = JSON.parse(saved!) as Record<string, unknown>[]
    const record = parsed.find(r => r !== null)!
    expect(record).toHaveProperty('bestMove')
    expect(record).toHaveProperty('depthReached')
    expect(record).toHaveProperty('pass')
  })
})

// ---- AC-3: debounce coalesces writes ----

describe('sessionStorage — AC-3: debounced writes', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('test_multipleResultUpdates_coalescedIntoOneSetItem', async () => {
    const storage = makeMemoryStorage()
    const setItemSpy = vi.spyOn(storage, 'setItem')

    const game = makeGame()
    const review = usePostGameReview({ storage })

    // Start analysis — N=2 positions means 4 calls (2 preview + 2 deep)
    const p = review.init(game, makeInstantFn())
    await p

    // Before timer fires: should have 0 setItem calls (all debounced)
    expect(setItemSpy).toHaveBeenCalledTimes(0)

    // Fire the debounce timer
    await vi.runAllTimersAsync()

    // After timer: the data key is written exactly once (coalesced). The cache index is also written
    // once per flush, so assert on the data key specifically rather than the total setItem count.
    const dataWrites = setItemSpy.mock.calls.filter((c) => c[0] === 'pgr:analysis:v2:1716900000000')
    expect(dataWrites).toHaveLength(1)
  })
})

// ---- AC-4: QuotaExceededError handled silently ----

describe('sessionStorage — AC-4: QuotaExceededError silently handled', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('test_quotaExceededError_setsPeristenceAvailableFalse_noUserError', async () => {
    const storage = makeMemoryStorage()
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })

    const game = makeGame()
    const review = usePostGameReview({ storage })

    await review.init(game, makeInstantFn())

    // Should not throw
    await expect(vi.runAllTimersAsync()).resolves.not.toThrow()

    expect(review.persistenceAvailable.value).toBe(false)
  })
})

// ---- AC-5: Restore on remount — skips re-analysis if all deep ----

describe('sessionStorage — AC-5: restore on remount', () => {
  it('test_priorDeepAnalysis_restored_analysisNotRerun', async () => {
    const storage = makeMemoryStorage()
    const game = makeGame()

    // First session: run analysis and flush to storage
    const firstReview = usePostGameReview({ storage })
    await firstReview.init(game, makeInstantFn())
    // Manually flush (bypass 500ms debounce)
    await new Promise(r => setTimeout(r, 600))

    // Verify storage has data
    const saved = storage.getItem('pgr:analysis:v2:1716900000000')
    expect(saved).not.toBeNull()

    // Second session: should restore from storage
    const analyzeFnSpy = vi.fn(makeInstantFn())
    const secondReview = usePostGameReview({ storage })
    await secondReview.init(game, analyzeFnSpy)

    // Since all results were deep, analysis should be skipped
    expect(analyzeFnSpy).not.toHaveBeenCalled()
    expect(secondReview.phase.value).toBe('COMPLETE')
    expect(secondReview.analysisResults.value.every(r => r !== null)).toBe(true)
  })

  it('test_noStoredData_analysisRunsNormally', async () => {
    const storage = makeMemoryStorage()
    const game = makeGame()

    const analyzeFnSpy = vi.fn(makeInstantFn())
    const review = usePostGameReview({ storage })
    await review.init(game, analyzeFnSpy)

    // Storage empty — analysis must run (N=2 positions, 2 passes = 4 calls)
    expect(analyzeFnSpy).toHaveBeenCalledTimes(4)
    expect(review.phase.value).toBe('COMPLETE')
  })

  it('test_differentGameId_doesNotRestore_fromPriorGame', async () => {
    const storage = makeMemoryStorage()
    const gameA = makeGame(1000)
    const gameB = makeGame(2000) // different completedAt

    // Store analysis for game A
    const firstReview = usePostGameReview({ storage })
    await firstReview.init(gameA, makeInstantFn())
    await new Promise(r => setTimeout(r, 600))

    // Open game B — should not restore game A's data
    const analyzeFnSpy = vi.fn(makeInstantFn())
    const secondReview = usePostGameReview({ storage })
    await secondReview.init(gameB, analyzeFnSpy)

    // Game B has no stored data → must re-analyze
    expect(analyzeFnSpy).toHaveBeenCalled()
  })
})
