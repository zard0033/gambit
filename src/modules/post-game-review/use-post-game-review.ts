/**
 * Post-Game Review composable.
 * GDD Post-Game Review — two-pass analysis (preview → deep), sequential per position.
 * AC-1: first analyze() call is for position 0.
 * AC-17: Pass 1 completes before Pass 2 begins; depth params asserted per pass.
 * AC-18: AbortController stored via markRaw, not Vue reactive.
 * Rule 14: Pass 2 is bounded by REVIEW_TOTAL_TIME_BUDGET_MS; Pass 1 is never cut.
 */
import { ref, shallowRef, computed, readonly, markRaw } from 'vue'
import { Chess } from 'chess.js'
import type { CompletedGame } from '../../stores/game-store'
import type { ReviewResult } from '../chess-engine/review-engine'
import {
  REVIEW_PREVIEW_DEPTH,
  REVIEW_PREVIEW_MOVE_TIME_MS,
  REVIEW_TARGET_DEPTH,
  REVIEW_MAX_MOVE_TIME_MS,
  REVIEW_TOTAL_TIME_BUDGET_MS,
  DEPTH_MISMATCH_TOLERANCE,
  MATE_CP,
} from '../../config/engine-tuning'
import { computeCpLoss as computeCpLossFormula } from './cploss'

// ---- Types ----

export type ReviewPhase = 'LOADING' | 'ANALYZING' | 'COMPLETE' | 'CANCELLED'

export type AnalysisPass = 'preview' | 'deep'

export interface StoredAnalysisEntry extends ReviewResult {
  readonly pass: AnalysisPass
}

/** Slim interface for the analyze() function — injectable for unit testing. */
export interface AnalyzeFn {
  (input: { fen: string; targetDepth: number; movetimeMs: number; signal: AbortSignal }): Promise<ReviewResult>
}

export interface PostGameReviewDeps {
  analyzeFn?: AnalyzeFn
  /** Injectable storage for unit testing; defaults to globalThis.sessionStorage. */
  storage?: Storage
}

/** Persisted form of StoredAnalysisEntry — pv stripped to save space. */
export type PersistedResult = Omit<StoredAnalysisEntry, 'pv'>

// ---- Analysis cache (localStorage) ----
// The per-ply analysis is cached so re-opening a game's 棋憶 skips re-analysis (AC-5). It lives in
// localStorage (survives PWA restarts) — sessionStorage was cleared on every cold start, so iOS users
// re-analyzed on every visit. Versioned so an engine-tuning change invalidates stale caches (mirrors
// MEMORY_SUMMARY_SCHEMA_VERSION); FIFO-capped so our own footprint stays bounded (≤ cap games). A write
// that still hits quota (from other localStorage usage) degrades gracefully — it does not reclaim space.
// v2 (2026-06-25): REVIEW_TARGET_DEPTH 22→16 etc. (OQ-5) — bump invalidates stale depth-22 caches
// so a returning user re-analyzes at the new settings instead of mixing depth-22 and depth-16 evals.
const ANALYSIS_CACHE_VERSION = 2
const ANALYSIS_CACHE_MAX_GAMES = 30
const ANALYSIS_KEY_PREFIX = `pgr:analysis:v${ANALYSIS_CACHE_VERSION}:`
const ANALYSIS_INDEX_KEY = `pgr:analysis:index:v${ANALYSIS_CACHE_VERSION}`

// ---- FEN sequence builder ----

/**
 * Given a CompletedGame's UCI moves, returns the FEN for each of the N+1 positions
 * (position 0 = starting position; position i = state after move i).
 */
export function buildFenSequence(moves: readonly string[]): string[] {
  const chess = new Chess()
  const fens: string[] = [chess.fen()]
  for (const uci of moves) {
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promo = uci.length === 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined
    try {
      chess.move({ from, to, promotion: promo })
    } catch {
      // Malformed UCI — stop sequence here
      break
    }
    fens.push(chess.fen())
  }
  return fens
}

// ---- cpLoss helpers ----

function evalToCp(evalMate: number): number {
  return evalMate > 0 ? MATE_CP : -MATE_CP
}

function getEvalCp(entry: StoredAnalysisEntry): number | undefined {
  if (entry.evalMate !== undefined) return evalToCp(entry.evalMate)
  return entry.evalCp
}

/**
 * Compute cpLoss for position i using the F2 formula.
 * Returns null when preconditions are not met (missing entries, non-player move, terminal).
 */
export function computeCpLoss(
  i: number,
  analysisResults: ReadonlyArray<StoredAnalysisEntry | null>,
  isPlayerMove: (index: number) => boolean,
): number | null {
  if (!isPlayerMove(i)) return null
  const curr = analysisResults[i]
  const next = analysisResults[i + 1]
  if (!curr || !next) return null
  if (curr.bestMove === null) return null // EC-8: terminal position

  const ei = getEvalCp(curr)
  const ei1 = getEvalCp(next)
  if (ei === undefined || ei1 === undefined) return null

  return computeCpLossFormula(ei, ei1)
}

/**
 * Returns true when the cpLoss at position i is a final (not preliminary) value.
 * Preliminary = either result is pass:'preview' OR depth-comparability guard fails.
 */
export function isCpLossFinal(
  i: number,
  analysisResults: ReadonlyArray<StoredAnalysisEntry | null>,
): boolean {
  const curr = analysisResults[i]
  const next = analysisResults[i + 1]
  if (!curr || !next) return false
  if (curr.pass === 'preview' || next.pass === 'preview') return false
  return Math.abs(curr.depthReached - next.depthReached) <= DEPTH_MISMATCH_TOLERANCE
}

// ---- biggestSwingCursor pure computation ----

/**
 * Compute the biggest-swing cursor from final analysis results.
 * Eligibility: isPlayerMove[i] AND both adjacent results are pass:'deep' AND next.bestMove !== null.
 * Returns the index with the highest cpLoss value; tie-break: lowest index. Returns null if no eligible position.
 */
export function computeBiggestSwingCursor(
  analysisResults: ReadonlyArray<StoredAnalysisEntry | null>,
  isPlayerMove: (index: number) => boolean,
  cpLossValues: ReadonlyArray<number | null>,
): number | null {
  let bestIdx: number | null = null
  let bestLoss = -1

  for (let i = 0; i < analysisResults.length - 1; i++) {
    if (!isPlayerMove(i)) continue
    const curr = analysisResults[i]
    const next = analysisResults[i + 1]
    if (!curr || !next) continue
    if (curr.pass !== 'deep' || next.pass !== 'deep') continue
    if (next.bestMove === null) continue

    const loss = cpLossValues[i]
    if (loss === null || loss <= 0) continue

    if (loss > bestLoss || bestIdx === null) {
      bestLoss = loss
      bestIdx = i
    }
  }
  return bestIdx
}

// ---- Composable ----

/**
 * Post-Game Review state machine composable.
 * Injectable analyzeFn for unit testing.
 */
export function usePostGameReview(deps?: PostGameReviewDeps) {
  const phase = ref<ReviewPhase>('LOADING')
  const cursor = ref(0)
  const progressPass = ref<AnalysisPass>('preview')
  const progressCount = ref(0)

  // analysisResults[i] covers position i (before move i is played).
  // Length = N (positions 0..N-1 are analyzed; position N is not).
  const analysisResults = ref<Array<StoredAnalysisEntry | null>>([])

  // AbortController is created fresh per init(); stored via markRaw (AC-18).
  let _abortController: AbortController = markRaw(new AbortController())

  // shallowRef (not a plain let): totalPositions / canGoNext / biggestSwingCursor
  // are computeds that read this — a non-reactive source would cache their first
  // value forever (read as 0 before init → frozen at 0).
  const _completedGame = shallowRef<CompletedGame | null>(null)
  let _fenSequence: string[] = []

  // ---- localStorage persistence: analysis cache (AC-5) ----

  const _storage = deps?.storage ?? (typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null)
  const persistenceAvailable = ref(true)
  let _debounceTimer: ReturnType<typeof setTimeout> | null = null

  function _storageKey(game: CompletedGame): string {
    return `${ANALYSIS_KEY_PREFIX}${game.completedAt.toString()}`
  }

  /** FIFO-bound the cache: keep the key index most-recent-last, evicting the oldest beyond the cap. */
  function _recordInIndex(key: string): void {
    if (!_storage) return
    try {
      const raw = _storage.getItem(ANALYSIS_INDEX_KEY)
      const idx: string[] = raw ? JSON.parse(raw) : []
      const next = idx.filter((k) => k !== key)
      next.push(key)
      while (next.length > ANALYSIS_CACHE_MAX_GAMES) {
        const evicted = next.shift()
        if (evicted) _storage.removeItem(evicted)
      }
      _storage.setItem(ANALYSIS_INDEX_KEY, JSON.stringify(next))
    } catch {
      // best-effort: a stale index only over-retains, never corrupts a cache hit
    }
  }

  function _flushToStorage(): void {
    if (!persistenceAvailable.value || !_completedGame.value || !_storage) return
    if (_debounceTimer) clearTimeout(_debounceTimer)
    _debounceTimer = setTimeout(() => {
      try {
        const key = _storageKey(_completedGame.value!)
        const stripped: Array<PersistedResult | null> = analysisResults.value.map(r =>
          r ? { bestMove: r.bestMove, evalCp: r.evalCp, evalMate: r.evalMate, depthReached: r.depthReached, pass: r.pass } : null,
        )
        _storage!.setItem(key, JSON.stringify(stripped))
        _recordInIndex(key)
      } catch {
        persistenceAvailable.value = false
      }
    }, 500)
  }

  function _tryRestoreFromStorage(game: CompletedGame): boolean {
    if (!_storage) return false
    try {
      const saved = _storage.getItem(_storageKey(game))
      if (!saved) return false
      const parsed = JSON.parse(saved) as Array<PersistedResult | null>
      analysisResults.value = parsed.map(r => (r ? markRaw({ ...r }) : null))
      return true
    } catch {
      return false
    }
  }

  // ---- Computed ----

  const totalPositions = computed(() => _completedGame.value?.moves.length ?? 0)

  const currentFen = computed(() => _fenSequence[cursor.value] ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')

  /** Whether position i is a player move (F3). */
  function isPlayerMove(i: number): boolean {
    if (!_completedGame.value) return false
    const color = _completedGame.value.playerColor
    return color === 'white' ? i % 2 === 0 : i % 2 === 1
  }

  // ---- Navigation (Rules 15-18) ----

  const canGoNext = computed(() => cursor.value < totalPositions.value)
  const canGoPrev = computed(() => cursor.value > 0)

  function goNext(): void {
    if (canGoNext.value) cursor.value++
  }

  function goPrev(): void {
    if (canGoPrev.value) cursor.value--
  }

  function goTo(index: number): void {
    const n = totalPositions.value
    if (index >= 0 && index <= n) cursor.value = index
  }

  // ---- Biggest swing (Rules 30-32) ----

  const biggestSwingCursor = computed<number | null>(() => {
    if (phase.value !== 'COMPLETE') return null
    const n = totalPositions.value
    if (n === 0) return null

    const cpLossValues = Array.from({ length: n }, (_, i) =>
      computeCpLoss(i, analysisResults.value, isPlayerMove),
    )
    return computeBiggestSwingCursor(analysisResults.value, isPlayerMove, cpLossValues)
  })

  // ---- Analysis loop ----

  /**
   * Run both passes of the analysis loop.
   * Resolves when analysis completes (COMPLETE) or is aborted (CANCELLED).
   */
  async function _runAnalysis(
    game: CompletedGame,
    fenSeq: string[],
    analyzeFn: AnalyzeFn,
  ): Promise<void> {
    const n = game.moves.length
    const signal = _abortController.signal

    if (n === 0) {
      phase.value = 'COMPLETE'
      return
    }

    phase.value = 'ANALYZING'

    // --- Pass 1: Preview ---
    progressPass.value = 'preview'
    progressCount.value = 0

    for (let i = 0; i < n; i++) {
      if (signal.aborted) {
        phase.value = 'CANCELLED'
        return
      }
      try {
        const result = await analyzeFn({
          fen: fenSeq[i],
          targetDepth: REVIEW_PREVIEW_DEPTH,
          movetimeMs: REVIEW_PREVIEW_MOVE_TIME_MS,
          signal,
        })
        analysisResults.value[i] = markRaw({ ...result, pass: 'preview' as const })
        _flushToStorage()
      } catch {
        // Aborted or engine error — leave entry null and continue
        if (signal.aborted) {
          phase.value = 'CANCELLED'
          return
        }
      }
      progressCount.value = i + 1
    }

    // --- Pass 2: Deep ---
    progressPass.value = 'deep'
    progressCount.value = 0

    const budgetStart = Date.now()

    for (let i = 0; i < n; i++) {
      if (signal.aborted) {
        phase.value = 'CANCELLED'
        return
      }
      if (Date.now() - budgetStart >= REVIEW_TOTAL_TIME_BUDGET_MS) {
        // Budget exhausted — stop Pass 2; un-deepened entries keep preview results (Rule 14)
        break
      }
      try {
        const result = await analyzeFn({
          fen: fenSeq[i],
          targetDepth: REVIEW_TARGET_DEPTH,
          movetimeMs: REVIEW_MAX_MOVE_TIME_MS,
          signal,
        })
        analysisResults.value[i] = markRaw({ ...result, pass: 'deep' as const })
        _flushToStorage()
      } catch {
        if (signal.aborted) {
          phase.value = 'CANCELLED'
          return
        }
      }
      progressCount.value = i + 1
    }

    phase.value = 'COMPLETE'
  }

  // ---- Public API ----

  /**
   * Initialize the review session with a completed game.
   * Creates a fresh AbortController, resets state, and starts the analysis loop.
   * Returns a promise that resolves when analysis finishes or is aborted.
   */
  function init(game: CompletedGame, analyzeFn: AnalyzeFn): Promise<void> {
    // Abort any in-flight analysis
    _abortController.abort()
    _abortController = markRaw(new AbortController())

    _completedGame.value = game
    _fenSequence = buildFenSequence(game.moves)
    cursor.value = 0
    phase.value = 'LOADING'
    progressCount.value = 0
    progressPass.value = 'preview'

    const n = game.moves.length

    // Try restoring prior session; if all results are deep, skip re-analysis (AC-5). A budget-truncated
    // cache (tail still 'preview' from a Rule 14 cut) fails the all-deep gate and re-runs both passes.
    const restored = _tryRestoreFromStorage(game)
    if (restored && analysisResults.value.length === n && analysisResults.value.every(r => r?.pass === 'deep')) {
      phase.value = 'COMPLETE'
      return Promise.resolve()
    }

    // Initialize any missing null slots (restored may be partial)
    if (!restored || analysisResults.value.length !== n) {
      analysisResults.value = Array.from({ length: n }, () => null)
    }

    return _runAnalysis(game, _fenSequence, analyzeFn)
  }

  /** Abort analysis and transition to CANCELLED. */
  function abort(): void {
    _abortController.abort()
    // Drop any pending debounced flush so it can't fire (and hold a closure) after unmount.
    if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null }
    if (phase.value === 'ANALYZING') {
      phase.value = 'CANCELLED'
    }
  }

  return {
    phase: readonly(phase),
    cursor: readonly(cursor),
    progressPass: readonly(progressPass),
    progressCount: readonly(progressCount),
    analysisResults: readonly(analysisResults),
    persistenceAvailable: readonly(persistenceAvailable),
    totalPositions,
    currentFen,
    canGoNext,
    canGoPrev,
    biggestSwingCursor,
    isPlayerMove,
    computeCpLoss: (i: number) => computeCpLoss(i, analysisResults.value, isPlayerMove),
    isCpLossFinal: (i: number) => isCpLossFinal(i, analysisResults.value),
    goNext,
    goPrev,
    goTo,
    init,
    abort,
    /** Exposed for unit testing only. */
    _getAbortController: () => _abortController,
  }
}
