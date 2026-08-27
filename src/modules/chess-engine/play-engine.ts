import { ref, readonly } from 'vue'
import { createStockfishWorker, type IStockfishWorker } from '../../workers/stockfish-worker'
import { runHandshake, EngineUnavailableError } from './handshake'
import { pickFallibleMove, type MoveCandidate } from './fallible-pick'
import type { FallibleConfig } from '../../config/difficulty-tuning'

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

/**
 * MultiPV width requested when a rung plays fallibly — we need the whole candidate list to pick a
 * mistake out of, and the tail is where the beginner-shaped moves are. Openings have 20-31 legal
 * moves and midgames ~40, so 50 covers them; the engine caps it at the legal move count anyway
 * (declared range is 1-256). Cost measured 2026-08-01 at depth 8: 156ms worst case on desktop.
 */
const WIDE_MULTIPV = 50

/**
 * Skill Level sent to the engine when picking mistakes ourselves. Skill Level's own jitter would
 * reorder the bestmove away from `multipv 1`, and the whole candidate list is scored relative to
 * that line — so we turn the engine's jitter off and own the weakening entirely.
 */
const FULL_SKILL = 20

/** play() input. Values come from the difficulty ladder (config/difficulty-tuning.ts). */
export interface PlayInput {
  fen: string
  skillLevel: number
  movetimeMs: number
  /**
   * Search depth cap. Omit to search until movetime runs out.
   * Deeper search spreads the candidate scores apart, which is what makes a mistake pickable —
   * a low cap does not weaken the engine, it stops it telling good moves from bad.
   * See design/quick-specs/difficulty-ladder-remake.md.
   */
  depth?: number
  /**
   * Deliberate-mistake tuning from the ladder. Omit to always play the engine's best move.
   * Present → the search runs wide (MultiPV) and the reply is picked from the loss window.
   */
  fallible?: FallibleConfig
  signal?: AbortSignal
}

/** UCI `go` line for a play request. */
function goCommand(input: PlayInput): string {
  return input.depth === undefined
    ? `go movetime ${input.movetimeMs}`
    : `go depth ${input.depth} movetime ${input.movetimeMs}`
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
 * always-NNUE (no `Use NNUE` option), so no eval-mode switch is sent. Beginner difficulty does
 * NOT come from Skill Level — no UCI knob makes Stockfish blunder like a beginner (measured
 * 2026-08-01, four knobs tried), so it is manufactured outside the engine: search wide and
 * substitute a worse move from the candidate list. See ./fallible-pick.ts.
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
  let _checkpoint: {
    fen: string
    skillLevel: number
    movetimeMs: number
    depth?: number
    fallible?: FallibleConfig
  } | null = null
  /**
   * Settlers for the play() promise the checkpoint belongs to. The liveness respawn uses these
   * so a terminated search always settles its caller instead of leaving it pending forever.
   */
  let _checkpointSettlers: {
    resolve: (result: PlayResult) => void
    reject: (err: Error) => void
  } | null = null
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
      const settlers = _checkpointSettlers
      _checkpoint = null
      _checkpointSettlers = null
      if (_worker) {
        _worker.onmessage = null
        _worker.terminate()
        _worker = null
      }
      state.value = 'UNINITIALIZED'
      // Respawn and hand the result back to the caller that is still awaiting the terminated
      // search. Leaving it pending deadlocks PlayView in AI_THINKING with no fallback.
      ;(async () => {
        try {
          await init()
          if (checkpoint && state.value === 'IDLE') {
            play(checkpoint).then(
              (result) => settlers?.resolve(result),
              (err: Error) => settlers?.reject(err),
            )
            return
          }
          settlers?.reject(new EngineTimeoutError())
        } catch {
          // init sets CRASHED; the caller's catch turns this into an AI resign.
          settlers?.reject(new EngineTimeoutError())
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

      /** MultiPV index → candidate, for fallible rungs. Empty when the rung plays its best move. */
      const candidates = new Map<number, MoveCandidate>()

      /**
       * MultiPV and Skill Level are set per search, not at handshake — handshake.ts pins
       * `MultiPV 1` and is shared with the review engine, which must never search wide.
       */
      function sendSearch(): void {
        worker.postMessage(`setoption name MultiPV value ${input.fallible ? WIDE_MULTIPV : 1}`)
        worker.postMessage(
          `setoption name Skill Level value ${input.fallible ? FULL_SKILL : input.skillLevel}`,
        )
        worker.postMessage(`position fen ${input.fen}`)
        worker.postMessage(goCommand(input))
      }

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
            _checkpointSettlers = null
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
        sendSearch()
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
      _checkpoint = {
        fen: input.fen,
        skillLevel: input.skillLevel,
        movetimeMs: input.movetimeMs,
        depth: input.depth,
        fallible: input.fallible,
      }
      _checkpointSettlers = { resolve, reject }
      sendSearch()

      worker.onmessage = (ev: MessageEvent<string>) => {
        _recordHeartbeat()
        const line = ev.data

        if (line.startsWith('info ') && !line.includes('lowerbound') && !line.includes('upperbound')) {
          const cpMatch = line.match(/\bscore cp (-?\d+)/)
          const mateMatch = line.match(/\bscore mate (-?\d+)/)
          const depthMatch = line.match(/\bdepth (\d+)/)
          const pvMatch = line.match(/\bpv (.+)$/)
          const ponderMatch = line.match(/\bponder (\S+)/)
          const mpvMatch = line.match(/\bmultipv (\d+)/)

          // Every depth reprints the whole MultiPV set, so later lines overwrite earlier ones and
          // what survives is the deepest iteration. If movetime cuts a search off mid-iteration the
          // tail can still hold the previous depth's scores; adjacent depths differ too little to
          // move a move in or out of the window, so keeping a per-depth snapshot is not worth it.
          if (mpvMatch && pvMatch) {
            candidates.set(parseInt(mpvMatch[1], 10), {
              move: pvMatch[1].trim().split(/\s+/)[0],
              cp: cpMatch ? parseInt(cpMatch[1], 10) : undefined,
              mate: mateMatch ? parseInt(mateMatch[1], 10) : undefined,
            })
          }

          // The fields below describe the engine's principal variation, so they may only be read
          // from `multipv 1` — under a wide search the last info line is the *worst* candidate.
          if (mpvMatch && mpvMatch[1] !== '1') return

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

          const engineBest = line.split(/\s+/)[1]
          const kind = engineBest === '0000' ? 'resign' : 'move'
          // 0000 signals resign/game-over, not a move — never substitute a mistake for it.
          const ordered = [...candidates.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c)
          const bestMoveToken =
            kind === 'move' ? (pickFallibleMove(ordered, input.fallible) ?? engineBest) : engineBest
          _checkpoint = null
          _checkpointSettlers = null
          state.value = 'IDLE'
          cleanup()
          resolve({
            bestMove: bestMoveToken,
            kind,
            // These four always describe the engine's principal variation and do NOT follow a
            // deliberate mistake — nothing on the play path consumes them (post-game analysis runs
            // through review-engine), so they keep the "how the engine reads this position" meaning.
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
