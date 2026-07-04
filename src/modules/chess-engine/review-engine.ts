/**
 * Review Engine composable — NNUE analysis with lazy-load and 30s auto-terminate.
 * ADR-0001: Stockfish 18 Lite (NNUE embedded in WASM; no `Use NNUE` switch).
 * ADR-0002: Worker lifecycle — IDLE_TERMINATED auto-respawns; DISPOSED rejects synchronously.
 * TR-chess-engine-005: lazy-create on first analyze(); auto-terminate after 30s idle.
 */
import { ref, readonly } from 'vue'
import { createStockfishWorker, type IStockfishWorker } from '../../workers/stockfish-worker'
import { runHandshake, EngineUnavailableError } from './handshake'

export { EngineUnavailableError }

// ---- Error types ----

export class EngineDisposedError extends Error {
  constructor() {
    super('reviewEngine is DISPOSED — create a new instance')
    this.name = 'EngineDisposedError'
  }
}

export class CanceledError extends Error {
  constructor() {
    super('analyze() canceled via AbortSignal')
    this.name = 'CanceledError'
  }
}

// ---- Types ----

export type ReviewEngineState =
  | 'UNINITIALIZED'
  | 'LOADING'
  | 'HANDSHAKING'
  | 'IDLE'
  | 'THINKING'
  | 'IDLE_TERMINATED'
  | 'DISPOSED'

export interface AnalyzeInput {
  fen: string
  targetDepth?: number
  movetimeMs?: number
  signal?: AbortSignal
}

/**
 * Analysis result per GDD Pillar 3 and ADR-0002 §5.
 * MUST NOT contain emotive/evaluative fields (quality, label, judgment, brilliant, blunder, etc.)
 */
export interface ReviewResult {
  readonly bestMove: string | null
  readonly evalCp?: number
  readonly evalMate?: number
  readonly depthReached: number
  readonly pv?: string[]
}

export type ProgressCallback = (depth: number) => void

// ---- Worker factory ----

export type WorkerFactory = () => IStockfishWorker

// ---- Constants ----

const STOP_DRAIN_TIMEOUT_MS = 2_000
const IDLE_TERMINATE_MS = 30_000

// ---- Composable ----

const defaultFactory: WorkerFactory = createStockfishWorker

/**
 * NNUE Review Engine composable.
 * Lazy-created on first analyze() call. Auto-terminates after 30s idle.
 * IDLE_TERMINATED → auto-respawns on next analyze().
 * DISPOSED (explicit dispose()) → synchronous rejection, no respawn.
 *
 * @param factory - Worker constructor, injectable for unit testing.
 */
export function useReviewEngine(factory: WorkerFactory = defaultFactory) {
  const state = ref<ReviewEngineState>('UNINITIALIZED')
  let _worker: IStockfishWorker | null = null
  let _requestId = 0
  let _idleTimer: ReturnType<typeof setTimeout> | null = null
  let _ucinewgameNeeded = true // send ucinewgame before first analyze() of each new session
  let _spawnPromise: Promise<void> | null = null // in-flight spawn — shared so concurrent callers don't double-spawn

  // ---- Idle timer ----

  function resetIdleTimer(): void {
    if (_idleTimer !== null) clearTimeout(_idleTimer)
    _idleTimer = setTimeout(() => {
      if (state.value === 'IDLE' && _worker) {
        _worker.terminate()
        _worker = null
        state.value = 'IDLE_TERMINATED'
      }
      _idleTimer = null
    }, IDLE_TERMINATE_MS)
  }

  function clearIdleTimer(): void {
    if (_idleTimer !== null) {
      clearTimeout(_idleTimer)
      _idleTimer = null
    }
  }

  // ---- Init / Spawn ----

  async function spawnAndHandshake(): Promise<void> {
    state.value = 'LOADING'
    try {
      _worker = factory()
    } catch (err) {
      state.value = 'UNINITIALIZED'
      throw err
    }
    state.value = 'HANDSHAKING'
    try {
      await runHandshake(_worker)
      state.value = 'IDLE'
      _ucinewgameNeeded = true
      resetIdleTimer()
    } catch (err) {
      state.value = 'UNINITIALIZED'
      _worker?.terminate()
      _worker = null
      throw err
    }
  }

  /**
   * Spawn + handshake, sharing an in-flight promise across concurrent callers
   * so two overlapping init()/analyze() calls never spawn a second Worker.
   * Returns the raw spawnAndHandshake() promise (not a wrapped derivative) so
   * callers observe the same resolution timing as calling it directly; the
   * in-flight cache is cleared via a side-chain that doesn't affect callers.
   */
  function ensureSpawned(): Promise<void> {
    if (_spawnPromise) return _spawnPromise
    const spawning = spawnAndHandshake()
    _spawnPromise = spawning
    spawning.then(
      () => {
        if (_spawnPromise === spawning) _spawnPromise = null
      },
      () => {
        if (_spawnPromise === spawning) _spawnPromise = null
      },
    )
    return spawning
  }

  /**
   * Explicitly initialise the engine (idempotent — safe to call multiple times).
   * Can be used to show a loading state before the first analyze() call.
   */
  async function init(): Promise<void> {
    if (state.value === 'DISPOSED') throw new EngineDisposedError()
    if (state.value === 'IDLE' || state.value === 'THINKING') return
    await ensureSpawned()
  }

  // ---- Analyze ----

  /**
   * Analyze a position. Lazy-spawns the engine if not yet running.
   * Sends `ucinewgame` before the first analyze() of a new session.
   * After 30s idle, auto-terminates and auto-respawns on the next call.
   */
  async function analyze(
    input: AnalyzeInput,
    onProgress?: ProgressCallback,
  ): Promise<ReviewResult> {
    if (state.value === 'DISPOSED') throw new EngineDisposedError()

    // Spawn if not running
    if (state.value === 'UNINITIALIZED' || state.value === 'IDLE_TERMINATED') {
      await ensureSpawned()
    }

    // Wait if handshake in progress (shares the same in-flight spawn promise)
    if (state.value === 'LOADING' || state.value === 'HANDSHAKING') {
      await ensureSpawned()
    }

    if (state.value !== 'IDLE') {
      throw new EngineUnavailableError(`analyze() called in state ${state.value}`)
    }

    clearIdleTimer()

    const worker = _worker!
    const localId = ++_requestId

    // Send ucinewgame before the first analyze() of a session (clears transposition table)
    if (_ucinewgameNeeded) {
      worker.postMessage('ucinewgame')
      _ucinewgameNeeded = false
    }

    return new Promise<ReviewResult>((resolve, reject) => {
      let lastEvalCp: number | undefined
      let lastEvalMate: number | undefined
      let lastDepth = 0
      let lastPv: string[] | undefined
      let abortHandler: (() => void) | null = null
      let drainTimer: ReturnType<typeof setTimeout> | null = null

      function cleanup(): void {
        if (abortHandler && input.signal) {
          input.signal.removeEventListener('abort', abortHandler)
          abortHandler = null
        }
      }

      function startDrain(): void {
        state.value = 'THINKING' // stays THINKING until bestmove arrives
        worker.postMessage('stop')
        drainTimer = setTimeout(() => {
          worker.onmessage = null
          worker.terminate()
          _worker = null
          state.value = 'UNINITIALIZED'
          cleanup()
          // drain timeout — engine hung
        }, STOP_DRAIN_TIMEOUT_MS)
        worker.onmessage = (ev: MessageEvent<string>) => {
          if (ev.data.startsWith('bestmove ')) {
            clearTimeout(drainTimer!)
            drainTimer = null
            worker.onmessage = null
            state.value = 'IDLE'
            resetIdleTimer()
          }
        }
      }

      if (input.signal?.aborted) {
        reject(new CanceledError())
        return
      }

      if (input.signal) {
        abortHandler = () => {
          cleanup()
          reject(new CanceledError())
          startDrain()
        }
        input.signal.addEventListener('abort', abortHandler)
      }

      state.value = 'THINKING'
      worker.postMessage(`position fen ${input.fen}`)

      const goArgs: string[] = []
      if (input.targetDepth !== undefined) goArgs.push(`depth ${input.targetDepth}`)
      if (input.movetimeMs !== undefined) goArgs.push(`movetime ${input.movetimeMs}`)
      if (!goArgs.length) {
        reject(new EngineUnavailableError('analyze() requires targetDepth or movetimeMs'))
        return
      }
      worker.postMessage(`go ${goArgs.join(' ')}`)

      worker.onmessage = (ev: MessageEvent<string>) => {
        const line = ev.data

        if (
          line.startsWith('info ') &&
          !line.includes('string') &&
          !line.includes('lowerbound') &&
          !line.includes('upperbound')
        ) {
          const depthMatch = line.match(/\bdepth (\d+)/)
          const cpMatch = line.match(/\bscore cp (-?\d+)/)
          const mateMatch = line.match(/\bscore mate (-?\d+)/)
          const pvMatch = line.match(/\bpv (.+)$/)
          if (depthMatch) {
            const depth = parseInt(depthMatch[1], 10)
            if (cpMatch) lastEvalCp = parseInt(cpMatch[1], 10)
            if (mateMatch) lastEvalMate = parseInt(mateMatch[1], 10)
            if (pvMatch) lastPv = pvMatch[1].trim().split(/\s+/)
            if (depth > lastDepth) {
              lastDepth = depth
              onProgress?.(depth)
            }
          }
          return
        }

        if (line.startsWith('bestmove ')) {
          worker.onmessage = null
          if (_requestId !== localId) return // stale response — drop

          const token = line.split(/\s+/)[1]
          const bestMove = token === '0000' || token === '(none)' ? null : token
          state.value = 'IDLE'
          cleanup()
          resetIdleTimer()
          resolve({
            bestMove,
            evalCp: lastEvalCp,
            evalMate: lastEvalMate,
            depthReached: lastDepth,
            pv: lastPv,
          })
        }
      }
    })
  }

  /**
   * Explicitly dispose the engine. Subsequent analyze() calls reject with EngineDisposedError.
   * Unlike IDLE_TERMINATED, DISPOSED does NOT auto-respawn.
   */
  function dispose(): void {
    clearIdleTimer()
    if (_worker) {
      _worker.terminate()
      _worker = null
    }
    state.value = 'DISPOSED'
  }

  return {
    state: readonly(state),
    init,
    analyze,
    dispose,
  }
}
