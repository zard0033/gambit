import { ref, readonly } from 'vue'
import { createStockfishWorker, type IStockfishWorker } from '../../workers/stockfish-worker'
import { runHandshake, EngineUnavailableError } from './handshake'

export type { IStockfishWorker }
export { EngineUnavailableError }
export type WorkerFactory = () => IStockfishWorker

/** Injectable visibility event target (document-like). Injectable for unit testability. */
export type VisibilityEventTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & {
  readonly hidden: boolean
}

/** TR-chess-engine-009: app background ≥ this threshold → liveness probe fires. */
const BACKGROUND_THRESHOLD_MS = 60_000
/** TR-chess-engine-009: wait this long for readyok after probe before declaring Worker dead. */
const LIVENESS_PROBE_TIMEOUT_MS = 1_000

/** Nine engine states per ADR-0002 §5. */
export type EngineState =
  | 'UNINITIALIZED'
  | 'LOADING'
  | 'HANDSHAKING'
  | 'IDLE'
  | 'THINKING'
  | 'STOPPING'
  | 'CRASHED'
  | 'DISPOSED'
  | 'IDLE_TERMINATED'

/** ADR-0002 §5: AbortSignal cancellation API. */
export class CanceledError extends Error {
  constructor() {
    super('play() canceled via AbortSignal')
    this.name = 'CanceledError'
  }
}

/** ADR-0002 §5: stopDrainTimeout → Worker hung. */
export class EngineTimeoutError extends Error {
  constructor() {
    super('Stockfish did not emit bestmove within stopDrainTimeout')
    this.name = 'EngineTimeoutError'
  }
}

/** play() input. movetimeMs ∈ [3000,8000] per GDD tuning knobs (not enforced here — caller's responsibility). */
export interface PlayInput {
  fen: string
  skillLevel: number
  movetimeMs: number
  signal?: AbortSignal
}

/**
 * play() result per GDD AC-8 / ADR-0002 §4.
 * MUST NOT contain any emotive/evaluative fields (quality, label, judgment, brilliant, blunder, etc.)
 * This is enforced at the type level: only objective chess data.
 */
export interface PlayResult {
  bestMove: string
  kind?: 'move' | 'resign' | 'gameOver'
  evalCp?: number
  evalMate?: number
  depthReached?: number
  pv?: string[]
  ponder?: string
}

/** ADR-0002 §3: max wait for bestmove after UCI stop before CRASHED. */
const STOP_DRAIN_TIMEOUT_MS = 2_000

const defaultFactory: WorkerFactory = createStockfishWorker
const defaultEventTarget: VisibilityEventTarget | undefined =
  typeof document !== 'undefined' ? document : undefined

/**
 * Play Engine composable.
 * ADR-0001 (amended 2026-06-02): Stockfish 18 Lite single-threaded build. SF18 is
 * always-NNUE (no `Use NNUE` option), so no eval-mode switch is sent. Beginner
 * difficulty comes from Skill Level.
 * ADR-0002: postMessage-only IPC; nine-state machine.
 * TR-chess-engine-009: iOS visibility liveness probe (60s threshold, 1s readyok timeout).
 *
 * @param factory - Worker constructor, injectable for unit testing.
 * @param eventTarget - EventTarget for visibilitychange, injectable for unit testing.
 */
export function usePlayEngine(
  factory: WorkerFactory = defaultFactory,
  eventTarget: VisibilityEventTarget | undefined = defaultEventTarget,
) {
  const state = ref<EngineState>('UNINITIALIZED')
  let _worker: IStockfishWorker | null = null

  // ---- iOS liveness probe state (TR-chess-engine-009) ----
  let _lastHeartbeatTs = 0
  let _probePending = false
  let _probeTimer: ReturnType<typeof setTimeout> | null = null
  let _checkpoint: { fen: string; skillLevel: number; movetimeMs: number } | null = null
  let _livenessRegistered = false

  function _recordHeartbeat(): void {
    _lastHeartbeatTs = Date.now()
  }

  function _onVisibilityChange(): void {
    if (eventTarget?.hidden !== false) return
    if (!_worker) return
    if (_probeTimer !== null) return // probe already in flight — debounce
    if (
      state.value === 'DISPOSED' ||
      state.value === 'UNINITIALIZED' ||
      state.value === 'LOADING' ||
      state.value === 'HANDSHAKING'
    )
      return
    if (Date.now() - _lastHeartbeatTs < BACKGROUND_THRESHOLD_MS) return

    // Install a wrapper handler so readyok can be intercepted regardless of engine state
    const worker = _worker
    const existingHandler = worker.onmessage

    _probePending = true

    worker.onmessage = (ev: MessageEvent<string>) => {
      _recordHeartbeat()
      if (_probePending && ev.data.trim() === 'readyok') {
        _probePending = false
        if (_probeTimer !== null) {
          clearTimeout(_probeTimer)
          _probeTimer = null
        }
        // Restore the original handler
        if (_worker === worker) _worker.onmessage = existingHandler
        return
      }
      existingHandler?.(ev)
    }

    worker.postMessage('isready')

    _probeTimer = setTimeout(() => {
      _probeTimer = null
      _probePending = false
      // Worker unresponsive — terminate and respawn
      const checkpoint = _checkpoint
      _checkpoint = null
      if (_worker) {
        _worker.onmessage = null
        _worker.terminate()
        _worker = null
      }
      state.value = 'UNINITIALIZED'
      // Best-effort respawn; original play() Promise is orphaned but engine stays operational
      ;(async () => {
        try {
          await init()
          if (checkpoint && state.value === 'IDLE') {
            play(checkpoint).catch(() => {})
          }
        } catch {
          // init sets CRASHED; nothing more to do
        }
      })()
    }, LIVENESS_PROBE_TIMEOUT_MS)
  }

  /**
   * Spawns the HCE worker and completes the UCI handshake.
   * Idempotent: IDLE returns immediately. Concurrent calls during LOADING or
   * HANDSHAKING are no-ops; callers should observe state to know when ready.
   * State transitions: UNINITIALIZED → LOADING → HANDSHAKING → IDLE (happy path)
   *                    HANDSHAKING → CRASHED (timeout, either phase)
   * Also registers the iOS visibilitychange liveness probe on first call.
   */
  async function init(): Promise<void> {
    if (state.value !== 'UNINITIALIZED' && state.value !== 'CRASHED') return

    if (!_livenessRegistered && eventTarget) {
      eventTarget.addEventListener('visibilitychange', _onVisibilityChange)
      _livenessRegistered = true
    }

    state.value = 'LOADING'
    try {
      _worker = factory()
    } catch (err) {
      state.value = 'CRASHED'
      throw err
    }
    state.value = 'HANDSHAKING'

    try {
      await runHandshake(_worker)
      state.value = 'IDLE'
    } catch (err) {
      state.value = 'CRASHED'
      _worker.terminate()
      _worker = null
      throw err
    }
  }

  /**
   * Remove the visibilitychange listener and terminate the Worker.
   * Call this when the engine is no longer needed (e.g., component unmount).
   */
  function dispose(): void {
    eventTarget?.removeEventListener('visibilitychange', _onVisibilityChange)
    _livenessRegistered = false
    if (_probeTimer !== null) {
      clearTimeout(_probeTimer)
      _probeTimer = null
    }
    if (_worker) {
      _worker.terminate()
      _worker = null
    }
    state.value = 'DISPOSED'
  }

  let _requestId = 0

  /**
   * Request the HCE engine to find the best move for the given position.
   * ADR-0002: cancel-replace pattern — concurrent call cancels any in-flight search.
   * State transitions: IDLE → THINKING → IDLE (bestmove received)
   *                    THINKING → STOPPING → IDLE → THINKING (cancel-replace)
   *                    STOPPING → CRASHED (stopDrainTimeout)
   */
  function play(input: PlayInput): Promise<PlayResult> {
    if (state.value !== 'IDLE') {
      throw new EngineUnavailableError(`play() called in state ${state.value} — must be IDLE`)
    }

    const worker = _worker!
    const localId = ++_requestId

    // Combined promise: resolves with PlayResult or rejects with CanceledError/EngineTimeoutError.
    // Built as a single promise so that abort handler can immediately switch worker.onmessage
    // to the drain handler (synchronously on abort), avoiding the race where simulateResponse
    // fires before the cancelSearch handler is installed.
    return new Promise<PlayResult>((resolve, reject) => {
      let abortHandler: (() => void) | null = null
      let drainTimer: ReturnType<typeof setTimeout> | null = null

      let lastEvalCp: number | undefined
      let lastEvalMate: number | undefined
      let lastDepth: number | undefined
      let lastPv: string[] | undefined
      let lastPonder: string | undefined

      function cleanup(): void {
        if (abortHandler && input.signal) {
          input.signal.removeEventListener('abort', abortHandler)
          abortHandler = null
        }
      }

      function startDrain(): void {
        // Transition THINKING → STOPPING, send stop, install drain handler
        state.value = 'STOPPING'
        worker.postMessage('stop')

        drainTimer = setTimeout(() => {
          worker.onmessage = null
          worker.terminate()
          _worker = null
          state.value = 'CRASHED'
          cleanup()
          reject(new EngineTimeoutError())
        }, STOP_DRAIN_TIMEOUT_MS)

        worker.onmessage = (ev: MessageEvent<string>) => {
          _recordHeartbeat()
          if (ev.data.startsWith('bestmove ')) {
            clearTimeout(drainTimer!)
            drainTimer = null
            worker.onmessage = null
            _checkpoint = null
            state.value = 'IDLE'
            // cancelSearch completed — but we still reject with CanceledError (already set)
            // resolve/reject already called above; the drain is a side-effect only.
            // The promise was rejected in the abort handler; nothing more to do here.
          }
        }
      }

      // Set up abort handling — synchronously installs drain machinery on abort
      if (input.signal?.aborted) {
        // Already aborted before play() was called: send UCI commands anyway for clean state,
        // then immediately start drain and reject.
        state.value = 'THINKING'
        worker.postMessage(`setoption name Skill Level value ${input.skillLevel}`)
        worker.postMessage(`position fen ${input.fen}`)
        worker.postMessage(`go movetime ${input.movetimeMs}`)
        reject(new CanceledError())
        startDrain()
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
      // Store checkpoint for liveness probe respawn (TR-chess-engine-009)
      _checkpoint = { fen: input.fen, skillLevel: input.skillLevel, movetimeMs: input.movetimeMs }
      worker.postMessage(`setoption name Skill Level value ${input.skillLevel}`)
      worker.postMessage(`position fen ${input.fen}`)
      worker.postMessage(`go movetime ${input.movetimeMs}`)

      worker.onmessage = (ev: MessageEvent<string>) => {
        _recordHeartbeat()
        const line = ev.data

        if (line.startsWith('info ') && !line.includes('lowerbound') && !line.includes('upperbound')) {
          const cpMatch = line.match(/\bscore cp (-?\d+)/)
          const mateMatch = line.match(/\bscore mate (-?\d+)/)
          const depthMatch = line.match(/\bdepth (\d+)/)
          const pvMatch = line.match(/\bpv (.+)$/)
          const ponderMatch = line.match(/\bponder (\S+)/)
          if (cpMatch) lastEvalCp = parseInt(cpMatch[1], 10)
          if (mateMatch) lastEvalMate = parseInt(mateMatch[1], 10)
          if (depthMatch) lastDepth = parseInt(depthMatch[1], 10)
          if (pvMatch) lastPv = pvMatch[1].trim().split(/\s+/)
          if (ponderMatch) lastPonder = ponderMatch[1]
          return
        }

        if (line.startsWith('bestmove ')) {
          worker.onmessage = null
          // Race guard: drop if stale requestId (superseded by newer play() call)
          if (_requestId !== localId) return

          const bestMoveToken = line.split(/\s+/)[1]
          const kind = bestMoveToken === '0000' ? 'resign' : 'move'
          _checkpoint = null
          state.value = 'IDLE'
          cleanup()
          resolve({
            bestMove: bestMoveToken,
            kind,
            evalCp: lastEvalCp,
            evalMate: lastEvalMate,
            depthReached: lastDepth,
            pv: lastPv,
            ponder: lastPonder,
          })
        }
      }
    })
  }

  return {
    /** Reactive engine state — readonly on the outside. */
    state: readonly(state),
    init,
    play,
    /** Remove liveness listener and terminate Worker. Call on component unmount. */
    dispose,
  }
}
