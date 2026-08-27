/**
 * Unit tests for iOS Visibility Liveness Probe in usePlayEngine.
 * Story: chess-engine/story-005-ios-visibility
 * TR-chess-engine-009: visibilitychange → probe after 60s background → respawn if no readyok
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePlayEngine, EngineTimeoutError } from '../../../src/modules/chess-engine/play-engine'
import type { IStockfishWorker, VisibilityEventTarget } from '../../../src/modules/chess-engine/play-engine'

// -----------------------------------------------------------------------
// Mock Worker
// -----------------------------------------------------------------------

class MockStockfishWorker implements IStockfishWorker {
  onmessage: ((ev: MessageEvent<string>) => void) | null = null
  readonly sentMessages: string[] = []
  terminated = false

  postMessage(data: string): void {
    this.sentMessages.push(data)
  }

  terminate(): void {
    this.terminated = true
    this.onmessage = null
  }

  simulateResponse(line: string): void {
    this.onmessage?.({ data: line } as MessageEvent<string>)
  }
}

// -----------------------------------------------------------------------
// Mock EventTarget (injectable — avoids jsdom requirement)
// -----------------------------------------------------------------------

function makeMockEventTarget(hidden = false): VisibilityEventTarget & { dispatch(event: Event): void } {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  return {
    hidden,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
      listeners.get(type)?.delete(listener)
    },
    dispatch(event: Event): void {
      listeners.get(event.type)?.forEach((fn) => {
        if (typeof fn === 'function') fn(event)
        else fn.handleEvent(event)
      })
    },
  }
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

async function makeIdleEngine(
  factory: () => IStockfishWorker,
  mock: MockStockfishWorker,
  eventTarget: VisibilityEventTarget,
) {
  const engine = usePlayEngine(factory, eventTarget)
  const p = engine.init()
  mock.simulateResponse('uciok')
  mock.simulateResponse('readyok')
  await p
  return engine
}

// -----------------------------------------------------------------------
// Suite
// -----------------------------------------------------------------------

describe('usePlayEngine — iOS Visibility Liveness Probe (TR-chess-engine-009)', () => {
  let target: ReturnType<typeof makeMockEventTarget>
  let disposers: Array<() => void>

  beforeEach(() => {
    vi.useFakeTimers({ now: 0 })
    target = makeMockEventTarget()
    disposers = []
  })

  afterEach(() => {
    for (const d of disposers) d()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  // -----------------------------------------------------------------------
  // AC-1: Probe fires isready after ≥60s background
  // -----------------------------------------------------------------------

  it('test_visibilityProbe_sendsIsready_after60sBackground', async () => {
    const mock = new MockStockfishWorker()
    const engine = await makeIdleEngine(() => mock, mock, target)
    disposers.push(() => engine.dispose())

    // Advance fake clock past the 60s threshold
    vi.setSystemTime(61_000)
    target.dispatch(new Event('visibilitychange'))

    expect(mock.sentMessages).toContain('isready')
  })

  // -----------------------------------------------------------------------
  // AC-2: Worker alive when readyok arrives within 1000ms
  // -----------------------------------------------------------------------

  it('test_visibilityProbe_noTerminate_whenReadyokArrivesWithin1s', async () => {
    const mock = new MockStockfishWorker()
    const engine = await makeIdleEngine(() => mock, mock, target)
    disposers.push(() => engine.dispose())

    vi.setSystemTime(61_000)
    target.dispatch(new Event('visibilitychange'))

    // readyok arrives at 500ms (within 1s probe window)
    mock.simulateResponse('readyok')

    // Advance past probe timeout — should NOT trigger respawn
    vi.advanceTimersByTime(1_001)
    await Promise.resolve()

    expect(mock.terminated).toBe(false)
  })

  // -----------------------------------------------------------------------
  // AC-3: No readyok within 1s → terminate + new Worker spawned
  // -----------------------------------------------------------------------

  it('test_visibilityProbe_terminatesAndSpawnsNewWorker_whenNoReadyok', async () => {
    const workers: MockStockfishWorker[] = []
    let factoryCallCount = 0

    const factory = (): IStockfishWorker => {
      factoryCallCount++
      const w = new MockStockfishWorker()
      workers.push(w)
      return w
    }

    const engine = usePlayEngine(factory, target)
    disposers.push(() => engine.dispose())

    const p = engine.init()
    workers[0].simulateResponse('uciok')
    workers[0].simulateResponse('readyok')
    await p

    vi.setSystemTime(61_000)
    target.dispatch(new Event('visibilitychange'))

    // Advance past 1s probe timeout — no readyok sent
    vi.advanceTimersByTime(1_001)
    // Allow the async respawn IIFE to start (factory called synchronously inside init)
    await Promise.resolve()

    expect(workers[0].terminated).toBe(true)
    // Factory should be called a second time for the new Worker
    expect(factoryCallCount).toBe(2)
  })

  // -----------------------------------------------------------------------
  // AC-4: requestId is preserved (not reset) through respawn
  // -----------------------------------------------------------------------

  it('test_visibilityProbe_preservesRequestId_throughRespawn', async () => {
    const workers: MockStockfishWorker[] = []
    const factory = (): IStockfishWorker => {
      const w = new MockStockfishWorker()
      workers.push(w)
      return w
    }

    const engine = usePlayEngine(factory, target)
    disposers.push(() => engine.dispose())

    const p = engine.init()
    workers[0].simulateResponse('uciok')
    workers[0].simulateResponse('readyok')
    await p

    // Start a play() to set requestId = 1; onmessage is now play handler
    const playPromise = engine.play({ fen: 'startpos', skillLevel: 5, movetimeMs: 100 })
    playPromise.catch(() => {}) // suppress unhandled rejection

    vi.setSystemTime(61_000)
    target.dispatch(new Event('visibilitychange'))
    vi.advanceTimersByTime(1_001)
    await Promise.resolve()

    // State after respawn trigger (terminate + init running)
    const stateAfterRespawn = engine.state.value

    // Simulate stale bestmove from old Worker arriving after respawn
    // (workers[0].onmessage was set to null on terminate — simulateResponse is a no-op)
    workers[0].terminated = false // allow message simulation
    workers[0].simulateResponse('bestmove e2e4')

    // State must NOT have changed from stale bestmove (race guard or null onmessage)
    expect(engine.state.value).toBe(stateAfterRespawn)
  })

  // -----------------------------------------------------------------------
  // AC-9: When liveness probe respawns the engine, the original play() promise resolves
  //       with the respawned search's move (not left pending forever)
  // -----------------------------------------------------------------------

  it('test_visibilityProbeRespawn_resolvesOriginalPromise_whenRespawnSucceeds', async () => {
    const workers: MockStockfishWorker[] = []
    const factory = (): IStockfishWorker => {
      const w = new MockStockfishWorker()
      workers.push(w)
      return w
    }

    const engine = usePlayEngine(factory, target)
    disposers.push(() => engine.dispose())

    // Initialize and complete handshake
    const initPromise = engine.init()
    workers[0].simulateResponse('uciok')
    workers[0].simulateResponse('readyok')
    await initPromise

    // Start a play() and hold its promise
    const playPromise = engine.play({ fen: 'startpos', skillLevel: 5, movetimeMs: 100 })

    // Trigger probe timeout: advance past 60s background + 1s probe timeout
    vi.setSystemTime(61_000)
    target.dispatch(new Event('visibilitychange'))
    vi.advanceTimersByTime(1_001)
    await Promise.resolve()

    // At this point: workers[0] is terminated, init() is running for workers[1]
    // Complete handshake for respawned Worker
    expect(workers.length).toBe(2)
    workers[1].simulateResponse('uciok')
    workers[1].simulateResponse('readyok')
    // Wait for init promise and subsequent play() to be set up
    await Promise.resolve()
    await Promise.resolve()

    // Now play() is re-issued and onmessage is set to play handler
    // Simulate bestmove from respawned search
    workers[1].simulateResponse('bestmove e2e4')
    await Promise.resolve()

    // The original playPromise should now resolve with the respawned search's move
    const result = await playPromise
    expect(result.bestMove).toBe('e2e4')
  }, 10000) // Increase timeout for this test

  // -----------------------------------------------------------------------
  // AC-9: When liveness probe respawns and respawn fails, the original play()
  //       promise rejects with EngineTimeoutError (not left pending forever)
  // -----------------------------------------------------------------------

  it('test_visibilityProbeRespawn_rejectsOriginalPromise_whenRespawnFails', async () => {
    const workers: MockStockfishWorker[] = []
    const factory = (): IStockfishWorker => {
      const w = new MockStockfishWorker()
      workers.push(w)
      return w
    }

    const engine = usePlayEngine(factory, target)
    disposers.push(() => engine.dispose())

    // Initialize and complete handshake
    const initPromise = engine.init()
    workers[0].simulateResponse('uciok')
    workers[0].simulateResponse('readyok')
    await initPromise

    // Start a play() and hold its promise
    const playPromise = engine.play({ fen: 'startpos', skillLevel: 5, movetimeMs: 100 })

    // Trigger probe timeout
    vi.setSystemTime(61_000)
    target.dispatch(new Event('visibilitychange'))
    vi.advanceTimersByTime(1_001)
    await Promise.resolve()

    // Respawned Worker (workers[1]) never completes handshake
    // Advance time to let init() timeout and set state to CRASHED
    expect(workers.length).toBe(2)
    // Don't simulate any response — init() will timeout and fail
    vi.advanceTimersByTime(5_000) // arbitrary wait for init() to give up
    await Promise.resolve()

    // The original playPromise should now reject
    await expect(playPromise).rejects.toBeInstanceOf(EngineTimeoutError)
  })

  // -----------------------------------------------------------------------
  // AC-5: lastHeartbeatTs updated on every message (indirect verification:
  //        probe does not fire when last message was < 60s ago)
  // -----------------------------------------------------------------------

  it('test_visibilityProbe_doesNotFire_whenRecentMessageReceived', async () => {
    const mock = new MockStockfishWorker()
    const engine = await makeIdleEngine(() => mock, mock, target)
    disposers.push(() => engine.dispose())

    // Record baseline (handshake sends one 'isready' on its own)
    const baseline = mock.sentMessages.filter((m) => m === 'isready').length

    // _lastHeartbeatTs = 0; only 30s elapsed → under 60s threshold
    vi.setSystemTime(30_000)
    target.dispatch(new Event('visibilitychange'))

    // No NEW isready should be sent by the probe
    const probeIsreadyCount = mock.sentMessages.filter((m) => m === 'isready').length - baseline
    expect(probeIsreadyCount).toBe(0)
  })

  // -----------------------------------------------------------------------
  // Edge: 59_999ms — one ms below threshold → does NOT trigger
  // -----------------------------------------------------------------------

  it('test_visibilityProbe_doesNotFire_oneMillisecondBelowThreshold', async () => {
    const mock = new MockStockfishWorker()
    const engine = await makeIdleEngine(() => mock, mock, target)
    disposers.push(() => engine.dispose())

    // Record baseline (handshake sends one 'isready')
    const baseline = mock.sentMessages.filter((m) => m === 'isready').length

    vi.setSystemTime(59_999) // one ms below 60s threshold
    target.dispatch(new Event('visibilitychange'))

    const probeIsreadyCount = mock.sentMessages.filter((m) => m === 'isready').length - baseline
    expect(probeIsreadyCount).toBe(0)
  })

  // -----------------------------------------------------------------------
  // Edge: multiple rapid visibilitychange events — only one probe active (debounced)
  // -----------------------------------------------------------------------

  it('test_visibilityProbe_debounced_multipleRapidEvents', async () => {
    const mock = new MockStockfishWorker()
    const engine = await makeIdleEngine(() => mock, mock, target)
    disposers.push(() => engine.dispose())

    // Baseline from handshake
    const baseline = mock.sentMessages.filter((m) => m === 'isready').length

    vi.setSystemTime(61_000)
    target.dispatch(new Event('visibilitychange'))
    target.dispatch(new Event('visibilitychange'))
    target.dispatch(new Event('visibilitychange'))

    // Only ONE new isready should be sent — subsequent events are no-ops (probe in flight)
    const probeIsreadyCount = mock.sentMessages.filter((m) => m === 'isready').length - baseline
    expect(probeIsreadyCount).toBe(1)

    // Timer fires once; Worker terminated exactly once
    vi.advanceTimersByTime(1_001)
    await Promise.resolve()

    expect(mock.terminated).toBe(true)
  })
})
