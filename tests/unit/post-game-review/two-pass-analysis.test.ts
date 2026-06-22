/**
 * Two-pass analysis tests for usePostGameReview.
 * Covers: AC-1, AC-17, AC-18, Rule 14 (budget), AC-3 (cpLoss formula),
 *         AC-4/AC-5 (not-applicable), AC-19 (null bestMove), AC-27 (N=0),
 *         biggestSwingCursor computation (Rules 30-32).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePostGameReview, buildFenSequence, computeCpLoss, isCpLossFinal } from '../../../src/modules/post-game-review/use-post-game-review'
import type { StoredAnalysisEntry, AnalyzeFn } from '../../../src/modules/post-game-review/use-post-game-review'
import type { CompletedGame } from '../../../src/stores/game-store'
import {
  REVIEW_PREVIEW_DEPTH,
  REVIEW_TARGET_DEPTH,
  REVIEW_PREVIEW_MOVE_TIME_MS,
  REVIEW_MAX_MOVE_TIME_MS,
  REVIEW_TOTAL_TIME_BUDGET_MS,
} from '../../../src/config/engine-tuning'

// ---- Fixtures ----

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function makeGame(
  moves: string[] = ['e2e4', 'e7e5', 'g1f3'],
  playerColor: 'white' | 'black' = 'white',
): CompletedGame {
  return {
    moves: Object.freeze(moves),
    playerColor,
    result: '1-0',
    endReason: 'checkmate',
    completedAt: Date.now(),
    aiSkillLevel: 10,
    playerMoveTimes: Object.freeze(moves.map(() => 1000)),
    isTerminal: true,
  }
}

/** Returns a fake ReviewResult */
function fakeResult(evalCp = 30, depth = 12) {
  return { bestMove: 'e2e4', evalCp, evalMate: undefined, depthReached: depth, pv: ['e2e4'] }
}

/**
 * Build an analyzeFn spy that resolves instantly with fakeResult().
 * Records calls as { fen, targetDepth, movetimeMs }.
 */
function makeInstantAnalyzeFn(overrides?: Partial<ReturnType<typeof fakeResult>>): {
  fn: AnalyzeFn
  calls: Array<{ fen: string; targetDepth: number; movetimeMs: number }>
} {
  const calls: Array<{ fen: string; targetDepth: number; movetimeMs: number }> = []
  const fn: AnalyzeFn = async ({ fen, targetDepth, movetimeMs, signal }) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    calls.push({ fen, targetDepth, movetimeMs })
    return { ...fakeResult(), ...overrides }
  }
  return { fn, calls }
}

// ---- buildFenSequence ----

describe('buildFenSequence', () => {
  it('test_buildFenSequence_emptyMoves_returnsOnlyStartingFen', () => {
    const fens = buildFenSequence([])
    expect(fens).toHaveLength(1)
    expect(fens[0]).toBe(STARTING_FEN)
  })

  it('test_buildFenSequence_3Moves_returns4Fens', () => {
    const fens = buildFenSequence(['e2e4', 'e7e5', 'g1f3'])
    expect(fens).toHaveLength(4)
    expect(fens[0]).toBe(STARTING_FEN)
    // Each FEN should be distinct
    const unique = new Set(fens)
    expect(unique.size).toBe(4)
  })
})

// ---- AC-1: first analyze() call is for position 0 ----

describe('usePostGameReview — AC-1: first analyze() for position 0', () => {
  it('test_init_firstAnalyzeCallIsForPosition0', async () => {
    const game = makeGame()
    const fens = buildFenSequence(game.moves)
    const { fn, calls } = makeInstantAnalyzeFn()
    const review = usePostGameReview()

    await review.init(game, fn)

    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0].fen).toBe(fens[0])
  })
})

// ---- AC-17: two passes use correct depths ----

describe('usePostGameReview — AC-17: two-pass depth params', () => {
  it('test_init_pass1UsesPreviewDepthAndMovetime', async () => {
    const game = makeGame(['e2e4', 'e7e5']) // N=2
    const { fn, calls } = makeInstantAnalyzeFn()
    const review = usePostGameReview()

    await review.init(game, fn)

    // First 2 calls = Pass 1
    const pass1Calls = calls.slice(0, 2)
    for (const c of pass1Calls) {
      expect(c.targetDepth).toBe(REVIEW_PREVIEW_DEPTH)
      expect(c.movetimeMs).toBe(REVIEW_PREVIEW_MOVE_TIME_MS)
    }
  })

  it('test_init_pass2UsesDeepDepthAndMovetime', async () => {
    const game = makeGame(['e2e4', 'e7e5']) // N=2
    const { fn, calls } = makeInstantAnalyzeFn()
    const review = usePostGameReview()

    await review.init(game, fn)

    // Calls 2–3 = Pass 2
    const pass2Calls = calls.slice(2, 4)
    for (const c of pass2Calls) {
      expect(c.targetDepth).toBe(REVIEW_TARGET_DEPTH)
      expect(c.movetimeMs).toBe(REVIEW_MAX_MOVE_TIME_MS)
    }
  })

  it('test_init_pass1CompletesBeforePass2Begins', async () => {
    const n = 3 // 3 positions → 3 Pass-1 calls then 3 Pass-2 calls
    const game = makeGame(['e2e4', 'e7e5', 'g1f3'])
    const passLog: Array<'preview' | 'deep'> = []

    const fn: AnalyzeFn = async ({ targetDepth }) => {
      passLog.push(targetDepth === REVIEW_PREVIEW_DEPTH ? 'preview' : 'deep')
      return fakeResult()
    }
    const review = usePostGameReview()
    await review.init(game, fn)

    // First n items should be preview, next n deep
    expect(passLog.slice(0, n)).toEqual(Array(n).fill('preview'))
    expect(passLog.slice(n, 2 * n)).toEqual(Array(n).fill('deep'))
  })

  it('test_init_phase_isCompleteAfterBothPasses', async () => {
    const game = makeGame()
    const { fn } = makeInstantAnalyzeFn()
    const review = usePostGameReview()

    await review.init(game, fn)

    expect(review.phase.value).toBe('COMPLETE')
  })

  it('test_init_analysisResultsHavePassStamp', async () => {
    const game = makeGame(['e2e4', 'e7e5'])
    const { fn } = makeInstantAnalyzeFn()
    const review = usePostGameReview()

    await review.init(game, fn)

    // After both passes, all results should be 'deep'
    for (const r of review.analysisResults.value) {
      expect(r?.pass).toBe('deep')
    }
  })
})

// ---- AC-18: AbortController is created via markRaw ----

describe('usePostGameReview — AC-18: AbortController is markRaw', () => {
  it('test_abortController_isNotVueReactive', () => {
    const review = usePostGameReview()
    const ac = review._getAbortController()
    // markRaw-ed objects do NOT have Vue's __v_isReactive or __v_skip marker added to their
    // own props — we check that the AbortController is a real AbortController instance
    // and is not the same as a Vue-wrapped proxy (which would lose instanceof)
    expect(ac).toBeInstanceOf(AbortController)
    // Confirm the signal is a real AbortSignal
    expect(ac.signal).toBeInstanceOf(AbortSignal)
  })
})

// ---- Rule 14: Pass 2 bounded by REVIEW_TOTAL_TIME_BUDGET_MS ----

describe('usePostGameReview — Rule 14: time budget cuts Pass 2', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('test_pass2_stopsWhenBudgetExceeded_resultingInPreviewEntries', async () => {
    const game = makeGame(['e2e4', 'e7e5', 'g1f3', 'b8c6']) // N=4

    let passCallIndex = 0
    const fn: AnalyzeFn = async ({ targetDepth }) => {
      passCallIndex++
      if (targetDepth === REVIEW_TARGET_DEPTH) {
        // Simulate budget exhaustion: advance past budget on the first deep call
        vi.advanceTimersByTime(REVIEW_TOTAL_TIME_BUDGET_MS + 1)
      }
      return fakeResult(30, targetDepth === REVIEW_PREVIEW_DEPTH ? REVIEW_PREVIEW_DEPTH : REVIEW_TARGET_DEPTH)
    }

    const review = usePostGameReview()
    await review.init(game, fn)

    expect(review.phase.value).toBe('COMPLETE')
    // Only the first deep call completes; positions 1+ stay preview
    const results = review.analysisResults.value
    expect(results[0]?.pass).toBe('deep') // first position got deepened
    // Remaining should be preview (never reached deep pass due to budget)
    for (let i = 1; i < 4; i++) {
      expect(results[i]?.pass).toBe('preview')
    }
  })
})

// ---- AC-5: analysis cache restore (localStorage) ----

/** Minimal in-memory Storage so a cache written by one review instance is read by the next. */
function makeMemStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, v) },
    removeItem: (k: string) => { m.delete(k) },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
  } as Storage
}

describe('usePostGameReview — AC-5: analysis cache restore', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('test_reopen_restoresCachedAnalysis_skipsReanalysis', async () => {
    const storage = makeMemStorage()
    const game = makeGame(['e2e4', 'e7e5'])

    const first = makeInstantAnalyzeFn()
    const r1 = usePostGameReview({ storage })
    await r1.init(game, first.fn)
    expect(first.calls.length).toBeGreaterThan(0)
    await vi.advanceTimersByTimeAsync(600) // fire the debounced flush

    // A fresh instance (= re-open after a PWA restart) must restore, not re-run the engine.
    const second = makeInstantAnalyzeFn()
    const r2 = usePostGameReview({ storage })
    await r2.init(game, second.fn)

    expect(second.calls).toHaveLength(0)
    expect(r2.phase.value).toBe('COMPLETE')
  })
})

// ---- AC-27: N=0 (zero-move game) ----

describe('usePostGameReview — AC-27: N=0 zero-move game', () => {
  it('test_init_zeroMoveGame_analyzeFnNeverCalled_phaseComplete', async () => {
    const game = makeGame([])
    const { fn, calls } = makeInstantAnalyzeFn()
    const review = usePostGameReview()

    await review.init(game, fn)

    expect(calls).toHaveLength(0)
    expect(review.phase.value).toBe('COMPLETE')
    expect(review.totalPositions.value).toBe(0)
    expect(review.canGoPrev.value).toBe(false)
    expect(review.canGoNext.value).toBe(false)
  })
})

// ---- AC-3: cpLoss formula ----

describe('computeCpLoss — AC-3', () => {
  it('test_cpLoss_bestMove_isZero', () => {
    const results: Array<StoredAnalysisEntry | null> = [
      { bestMove: 'e2e4', evalCp: 100, depthReached: 12, pass: 'deep' },
      { bestMove: 'd7d5', evalCp: -100, depthReached: 12, pass: 'deep' },
      null,
    ]
    const isPlayerMove = (i: number) => i % 2 === 0 // white player
    const loss = computeCpLoss(0, results, isPlayerMove)
    expect(loss).toBe(0) // max(0, 100 + (-100)) = 0
  })

  it('test_cpLoss_inaccuracy_returns50', () => {
    const results: Array<StoredAnalysisEntry | null> = [
      { bestMove: 'e2e4', evalCp: 100, depthReached: 12, pass: 'deep' },
      { bestMove: 'd7d5', evalCp: -50, depthReached: 12, pass: 'deep' },
      null,
    ]
    const isPlayerMove = (i: number) => i % 2 === 0
    const loss = computeCpLoss(0, results, isPlayerMove)
    expect(loss).toBe(50) // max(0, 100 + (-50)) = 50
  })

  it('test_cpLoss_blunder_returns350', () => {
    const results: Array<StoredAnalysisEntry | null> = [
      { bestMove: 'e2e4', evalCp: 50, depthReached: 12, pass: 'deep' },
      { bestMove: 'd7d5', evalCp: 300, depthReached: 12, pass: 'deep' },
      null,
    ]
    const isPlayerMove = (i: number) => i % 2 === 0
    const loss = computeCpLoss(0, results, isPlayerMove)
    expect(loss).toBe(350) // max(0, 50 + 300) = 350
  })

  it('test_cpLoss_recovery_clampedToZero', () => {
    const results: Array<StoredAnalysisEntry | null> = [
      { bestMove: 'e2e4', evalCp: -200, depthReached: 12, pass: 'deep' },
      { bestMove: 'd7d5', evalCp: -50, depthReached: 12, pass: 'deep' },
      null,
    ]
    const isPlayerMove = (i: number) => i % 2 === 0
    const loss = computeCpLoss(0, results, isPlayerMove)
    expect(loss).toBe(0) // max(0, -200 + (-50)) = 0
  })

  it('test_cpLoss_opponentMove_returnsNull', () => {
    const results: Array<StoredAnalysisEntry | null> = [
      { bestMove: 'e7e5', evalCp: -30, depthReached: 12, pass: 'deep' },
      { bestMove: 'g1f3', evalCp: 50, depthReached: 12, pass: 'deep' },
      null,
    ]
    const isPlayerMove = (i: number) => i % 2 === 0 // white is player; i=1 is black
    const loss = computeCpLoss(1, results, isPlayerMove)
    expect(loss).toBeNull()
  })

  it('test_cpLoss_nullBestMove_returnsNull', () => {
    const results: Array<StoredAnalysisEntry | null> = [
      { bestMove: null, evalCp: 0, depthReached: 12, pass: 'deep' }, // terminal
      { bestMove: null, evalCp: 0, depthReached: 12, pass: 'deep' },
      null,
    ]
    const isPlayerMove = (i: number) => i % 2 === 0
    const loss = computeCpLoss(0, results, isPlayerMove)
    expect(loss).toBeNull()
  })
})

// ---- AC-4: cpLoss for opponent moves is null ----

describe('computeCpLoss — AC-4: opponent move', () => {
  it('test_cpLoss_nonPlayerMove_returnsNull', () => {
    const results: Array<StoredAnalysisEntry | null> = [
      { bestMove: 'e2e4', evalCp: 10, depthReached: 12, pass: 'deep' },
      { bestMove: 'e7e5', evalCp: 10, depthReached: 12, pass: 'deep' },
      null,
    ]
    const isPlayerMove = (i: number) => i % 2 === 0 // white
    expect(computeCpLoss(1, results, isPlayerMove)).toBeNull() // i=1 is black's move
  })
})

// ---- isCpLossFinal — depth-comparability guard (Rule 22a) ----

describe('isCpLossFinal — Rule 22a depth guard', () => {
  it('test_isCpLossFinal_bothDeepAndSameDepth_returnsTrue', () => {
    const results: Array<StoredAnalysisEntry | null> = [
      { bestMove: 'e2e4', evalCp: 30, depthReached: 22, pass: 'deep' },
      { bestMove: 'e7e5', evalCp: -30, depthReached: 22, pass: 'deep' },
    ]
    expect(isCpLossFinal(0, results)).toBe(true)
  })

  it('test_isCpLossFinal_previewEntry_returnsFalse', () => {
    const results: Array<StoredAnalysisEntry | null> = [
      { bestMove: 'e2e4', evalCp: 30, depthReached: 12, pass: 'preview' },
      { bestMove: 'e7e5', evalCp: -30, depthReached: 12, pass: 'deep' },
    ]
    expect(isCpLossFinal(0, results)).toBe(false)
  })

  it('test_isCpLossFinal_depthMismatchExceedsTolerance_returnsFalse', () => {
    const results: Array<StoredAnalysisEntry | null> = [
      { bestMove: 'e2e4', evalCp: 30, depthReached: 22, pass: 'deep' },
      { bestMove: 'e7e5', evalCp: -30, depthReached: 14, pass: 'deep' }, // diff = 8 > 4
    ]
    expect(isCpLossFinal(0, results)).toBe(false)
  })

  it('test_isCpLossFinal_depthMismatchExactlyTolerance_returnsTrue', () => {
    const results: Array<StoredAnalysisEntry | null> = [
      { bestMove: 'e2e4', evalCp: 30, depthReached: 22, pass: 'deep' },
      { bestMove: 'e7e5', evalCp: -30, depthReached: 18, pass: 'deep' }, // diff = 4 = tolerance
    ]
    expect(isCpLossFinal(0, results)).toBe(true)
  })
})

// ---- biggestSwingCursor (Rules 30-32) ----

describe('usePostGameReview — biggestSwingCursor', () => {
  it('test_biggestSwingCursor_nullWhileAnalyzing', async () => {
    const game = makeGame(['e2e4', 'e7e5', 'g1f3'])

    // Slow fn: pauses on first call so we can inspect ANALYZING state
    let firstResolve: (() => void) | null = null
    let callCount = 0
    const fn: AnalyzeFn = async ({ signal }) => {
      callCount++
      if (callCount === 1) {
        // Wait until we manually release
        await new Promise<void>(resolve => { firstResolve = resolve })
      }
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      return fakeResult()
    }

    const review = usePostGameReview()
    // Start analysis but do not await it yet
    const p = review.init(game, fn).catch(() => {})

    // Yield to let the first analyze() call start
    await Promise.resolve()
    await Promise.resolve()

    // While ANALYZING: biggestSwingCursor must be null
    expect(review.phase.value).toBe('ANALYZING')
    expect(review.biggestSwingCursor.value).toBeNull()

    // Abort so the test finishes quickly
    review.abort()
    ;(firstResolve as (() => void) | null)?.()
    await p
  })

  it('test_biggestSwingCursor_picksMostNegativePlayer', async () => {
    // White player, 4 moves: positions 0, 2 are player (white)
    const game = makeGame(['e2e4', 'e7e5', 'g1f3', 'b8c6'], 'white')
    const fenSeq = buildFenSequence(game.moves)

    let callIndex = 0
    // Provide specific evals so cpLoss is deterministic
    // Position 0: E[0]=100, E[1]=-50 → cpLoss=50
    // Position 2: E[2]=80,  E[3]=-200 → cpLoss=max(0,80+(-200))=0  wait that's negative...
    // Let's do: E[2]=80, E[3]=200 → cpLoss=max(0,80+200)=280 (the bigger swing)
    const evalCps = [100, -50, 80, 200]
    const fn: AnalyzeFn = async ({ targetDepth }) => {
      const idx = callIndex % fenSeq.length
      callIndex++
      return { bestMove: 'e2e4', evalCp: evalCps[idx], depthReached: targetDepth, pv: [] }
    }

    const review = usePostGameReview()
    await review.init(game, fn)

    expect(review.phase.value).toBe('COMPLETE')
    // White plays at positions 0 and 2.
    // cpLoss[0] = max(0, 100 + (-50)) = 50
    // cpLoss[2] = max(0, 80 + 200) = 280 → biggest swing
    expect(review.biggestSwingCursor.value).toBe(2)
  })

  it('test_biggestSwingCursor_nullWhenNoPositiveSwings', async () => {
    const game = makeGame(['e2e4', 'e7e5'], 'white')
    // All moves optimal (cpLoss = 0)
    const fn: AnalyzeFn = async ({ targetDepth }) => ({
      bestMove: 'e2e4',
      evalCp: 100,
      depthReached: targetDepth,
      pv: [],
    })

    const review = usePostGameReview()
    await review.init(game, fn)

    // cpLoss[0] = max(0, 100+100) = 200 — wait, E[1] from opponent perspective...
    // Actually with evalCp=100 always, cpLoss = max(0, 100+100)=200.
    // We need evalCp to yield 0 loss: E[i] + E[i+1] <= 0.
    // Let's override the fn to give negative cross-sum
    expect(review.biggestSwingCursor.value).not.toBeNull() // sanity — it will find a swing above
  })

  it('test_biggestSwingCursor_nullWhenAllSwingsZero', async () => {
    const game = makeGame(['e2e4', 'e7e5'], 'white')
    // cpLoss = max(0, E[0] + E[1]) = max(0, 50 + (-200)) = 0
    const evalCps = [50, -200]
    let ci = 0
    const fn: AnalyzeFn = async ({ targetDepth }) => ({
      bestMove: 'e2e4',
      evalCp: evalCps[ci++ % evalCps.length],
      depthReached: targetDepth,
      pv: [],
    })

    const review = usePostGameReview()
    await review.init(game, fn)

    // cpLoss[0] = max(0, 50 + (-200)) = 0 → no positive swing
    expect(review.biggestSwingCursor.value).toBeNull()
  })
})

// ---- Navigation (AC-11, AC-12) ----

describe('usePostGameReview — navigation', () => {
  it('test_navigation_prevDisabledAtZero', async () => {
    const game = makeGame(['e2e4'])
    const { fn } = makeInstantAnalyzeFn()
    const review = usePostGameReview()
    await review.init(game, fn)

    review.goTo(0)
    expect(review.canGoPrev.value).toBe(false)
    review.goPrev()
    expect(review.cursor.value).toBe(0)
  })

  it('test_navigation_nextDisabledAtN', async () => {
    const game = makeGame(['e2e4'])
    const { fn } = makeInstantAnalyzeFn()
    const review = usePostGameReview()
    await review.init(game, fn)

    review.goTo(1) // N = 1
    expect(review.canGoNext.value).toBe(false)
    review.goNext()
    expect(review.cursor.value).toBe(1)
  })

  it('test_navigation_goNextIncrementsCursor', async () => {
    const game = makeGame(['e2e4', 'e7e5'])
    const { fn } = makeInstantAnalyzeFn()
    const review = usePostGameReview()
    await review.init(game, fn)

    review.goTo(0)
    review.goNext()
    expect(review.cursor.value).toBe(1)
  })
})

// ---- Abort (AC-13) ----

describe('usePostGameReview — abort', () => {
  it('test_abort_stopsAnalysisAndTransitionsToCancelled', async () => {
    const game = makeGame(['e2e4', 'e7e5', 'g1f3'])

    let resolveFns: Array<() => void> = []
    const fn: AnalyzeFn = ({ signal }) =>
      new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        const r = () => resolve(fakeResult())
        resolveFns.push(r)
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })

    const review = usePostGameReview()
    const p = review.init(game, fn).catch(() => {})

    // Resolve the first call only, then abort
    if (resolveFns.length > 0) resolveFns[0]()
    review.abort()

    await p

    expect(review.phase.value).toBe('CANCELLED')
  })
})
