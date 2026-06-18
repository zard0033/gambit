/**
 * Shared Stockfish UCI two-phase handshake (ADR-0002 §7).
 * Phase 1: send `uci`, await `uciok` within UCIOK_TIMEOUT_MS.
 * Phase 2: send setoptions + `isready`, await `readyok` within READYOK_TIMEOUT_MS.
 * Rejects with EngineUnavailableError on either timeout.
 *
 * Play and review engines run the same single-threaded build (ADR-0001) with the
 * same options, so they share one handshake.
 */
import type { IStockfishWorker } from '../../workers/stockfish-worker'

/** Emitted when the engine fails to initialise or crashes during handshake. */
export class EngineUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EngineUnavailableError'
  }
}

/** ADR-0002 §7: maximum wait for uciok before failing. */
export const UCIOK_TIMEOUT_MS = 5_000

/** ADR-0002 §7: maximum wait for readyok after isready before failing. WASM first-load needs up to ~8s. */
export const READYOK_TIMEOUT_MS = 10_000

/**
 * Engine UCI options per ADR-0002 §7 / control manifest Core layer.
 * All setoption lines are sent BEFORE isready (AC-5 invariant).
 * ADR-0001 (amended 2026-06-02): SF18 Lite is always-NNUE — no `Use NNUE` option is sent.
 */
export const ENGINE_OPTIONS = [
  'setoption name Hash value 16',
  'setoption name Threads value 1',
  'setoption name Ponder value false',
  'setoption name MultiPV value 1',
] as const

/**
 * Runs the strict two-phase UCI handshake against an already-spawned worker.
 * State transitions are the caller's responsibility; this only drives the protocol.
 */
export function runHandshake(worker: IStockfishWorker): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let uciokSeen = false
    let uciokTimer: ReturnType<typeof setTimeout>
    let readyokTimer: ReturnType<typeof setTimeout> | undefined

    const fail = (message: string): void => {
      worker.onmessage = null
      clearTimeout(uciokTimer)
      clearTimeout(readyokTimer)
      reject(new EngineUnavailableError(message))
    }

    uciokTimer = setTimeout(
      () => fail(`uciok not received within ${UCIOK_TIMEOUT_MS}ms`),
      UCIOK_TIMEOUT_MS,
    )

    worker.onmessage = (ev: MessageEvent<string>) => {
      const line = ev.data.trim()

      if (!uciokSeen && line === 'uciok') {
        clearTimeout(uciokTimer)
        uciokSeen = true
        for (const opt of ENGINE_OPTIONS) worker.postMessage(opt)
        worker.postMessage('isready')
        readyokTimer = setTimeout(
          () => fail(`readyok not received within ${READYOK_TIMEOUT_MS}ms`),
          READYOK_TIMEOUT_MS,
        )
        return
      }

      if (uciokSeen && line === 'readyok') {
        clearTimeout(readyokTimer)
        worker.onmessage = null
        resolve()
      }
    }

    worker.postMessage('uci')
  })
}
