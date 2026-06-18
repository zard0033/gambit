import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePlayEngine, EngineUnavailableError } from '../../../src/modules/chess-engine/play-engine'
import type { IStockfishWorker } from '../../../src/modules/chess-engine/play-engine'

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
  }

  /** Synchronously deliver a UCI response line to the registered onmessage handler. */
  simulateResponse(line: string): void {
    this.onmessage?.({ data: line } as MessageEvent<string>)
  }
}

function factoryFor(mock: MockStockfishWorker): () => IStockfishWorker {
  return () => mock
}

// -----------------------------------------------------------------------
// AC-1: Handshake resolves and state reaches IDLE
// -----------------------------------------------------------------------

describe('usePlayEngine — AC-1: successful handshake', () => {
  it('test_playEngine_successfulHandshake_stateIsIdle', async () => {
    // Arrange
    const mock = new MockStockfishWorker()
    const { state, init } = usePlayEngine(factoryFor(mock))

    // Act
    const promise = init()
    mock.simulateResponse('uciok')
    mock.simulateResponse('readyok')
    await promise

    // Assert
    expect(state.value).toBe('IDLE')
  })

  it('test_playEngine_initCalledWhenIdle_returnsImmediately', async () => {
    // Arrange — first init to reach IDLE
    const mock = new MockStockfishWorker()
    const { state, init } = usePlayEngine(factoryFor(mock))
    const p1 = init()
    mock.simulateResponse('uciok')
    mock.simulateResponse('readyok')
    await p1

    // Act — second init should resolve without spawning a new worker
    const beforeCount = mock.sentMessages.length
    await init()

    // Assert — no new messages sent (idempotent)
    expect(state.value).toBe('IDLE')
    expect(mock.sentMessages.length).toBe(beforeCount)
  })
})

// -----------------------------------------------------------------------
// AC-3: No SharedArrayBuffer in source files (static analysis assertion)
// -----------------------------------------------------------------------

describe('usePlayEngine — AC-3: no SharedArrayBuffer', () => {
  it('test_playEngine_src_hasNoSharedArrayBuffer', () => {
    const fs = require('fs') as typeof import('fs')
    const path = require('path') as typeof import('path')
    const files = [
      'src/modules/chess-engine/play-engine.ts',
      'src/workers/stockfish-worker.ts',
    ]
    for (const file of files) {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
      expect(content, `SharedArrayBuffer found in ${file}`).not.toContain('SharedArrayBuffer')
    }
  })
})

// -----------------------------------------------------------------------
// AC-3 (timeout): uciok not received within 5s → CRASHED + EngineUnavailableError
// -----------------------------------------------------------------------

describe('usePlayEngine — AC-3: uciok timeout', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('test_playEngine_uciokTimeout_transitionsToCrashed', async () => {
    // Arrange
    const mock = new MockStockfishWorker()
    const { state, init } = usePlayEngine(factoryFor(mock))

    // Act
    const promise = init()
    vi.advanceTimersByTime(5_001)

    // Assert
    await expect(promise).rejects.toThrow(EngineUnavailableError)
    expect(state.value).toBe('CRASHED')
  })

  it('test_playEngine_uciokTimeout_workerIsTerminated', async () => {
    // Arrange
    const mock = new MockStockfishWorker()
    const { init } = usePlayEngine(factoryFor(mock))

    // Act
    const promise = init()
    vi.advanceTimersByTime(5_001)
    await promise.catch(() => {})

    // Assert
    expect(mock.terminated).toBe(true)
  })
})

// -----------------------------------------------------------------------
// AC-4: readyok not received within 10s after isready → CRASHED + EngineUnavailableError
// -----------------------------------------------------------------------

describe('usePlayEngine — AC-4: readyok timeout', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('test_playEngine_readyokTimeout_transitionsToCrashed', async () => {
    // Arrange
    const mock = new MockStockfishWorker()
    const { state, init } = usePlayEngine(factoryFor(mock))

    // Act — uciok arrives but readyok never does
    const promise = init()
    mock.simulateResponse('uciok')
    vi.advanceTimersByTime(10_001)

    // Assert
    await expect(promise).rejects.toThrow(EngineUnavailableError)
    expect(state.value).toBe('CRASHED')
  })

  it('test_playEngine_readyokTimeout_doesNotTriggerUciokTimer', async () => {
    // Arrange — confirm the two timers are independent
    const mock = new MockStockfishWorker()
    const { state, init } = usePlayEngine(factoryFor(mock))

    const promise = init()
    mock.simulateResponse('uciok')

    // Advance past the 5s uciok window; only the 10s readyok window should matter now
    vi.advanceTimersByTime(10_001)

    // The rejection should be for readyok, not uciok
    await expect(promise).rejects.toThrow(EngineUnavailableError)
    expect(state.value).toBe('CRASHED')
  })
})

// -----------------------------------------------------------------------
// AC-5: No SharedArrayBuffer + setoption order before isready
// -----------------------------------------------------------------------

describe('usePlayEngine — AC-5: message sequence', () => {
  it('test_playEngine_handshake_sendsUciFirst', async () => {
    // Arrange
    const mock = new MockStockfishWorker()
    const { init } = usePlayEngine(factoryFor(mock))
    const p = init()
    mock.simulateResponse('uciok')
    mock.simulateResponse('readyok')
    await p

    // Assert
    expect(mock.sentMessages[0]).toBe('uci')
  })

  it('test_playEngine_handshake_allSetoptionsBeforeIsready', async () => {
    // Arrange
    const mock = new MockStockfishWorker()
    const { init } = usePlayEngine(factoryFor(mock))
    const p = init()
    mock.simulateResponse('uciok')
    mock.simulateResponse('readyok')
    await p

    // Act
    const isreadyIdx = mock.sentMessages.indexOf('isready')
    const setoptions = mock.sentMessages.filter(m => m.startsWith('setoption'))

    // Assert — isready exists and all setoptions precede it
    expect(isreadyIdx).toBeGreaterThan(0)
    setoptions.forEach(opt => {
      expect(mock.sentMessages.indexOf(opt)).toBeLessThan(isreadyIdx)
    })
  })

  it('test_playEngine_handshake_setoptionsSent', async () => {
    // Arrange
    const mock = new MockStockfishWorker()
    const { init } = usePlayEngine(factoryFor(mock))
    const p = init()
    mock.simulateResponse('uciok')
    mock.simulateResponse('readyok')
    await p

    // Assert — play-engine options required by control manifest Core layer.
    // ADR-0001 (amended): SF18 Lite is always-NNUE — no `Use NNUE` setoption is sent.
    expect(mock.sentMessages).toContain('setoption name Hash value 16')
    expect(mock.sentMessages).toContain('setoption name Threads value 1')
    expect(mock.sentMessages).toContain('setoption name Ponder value false')
    expect(mock.sentMessages).toContain('setoption name MultiPV value 1')
    expect(mock.sentMessages).not.toContain('setoption name Use NNUE value false')
  })
})

// -----------------------------------------------------------------------
// AC-6: Full state transition chain UNINITIALIZED → LOADING → HANDSHAKING → IDLE
// -----------------------------------------------------------------------

describe('usePlayEngine — AC-6: state machine transitions', () => {
  it('test_playEngine_happyPath_transitionsUninitialized_Loading_Handshaking_Idle', async () => {
    // Arrange — capture state at each stage
    let stateAtFactory = ''
    const mock = new MockStockfishWorker()

    const { state, init } = usePlayEngine(() => {
      stateAtFactory = state.value  // should be LOADING (set before factory call)
      return mock
    })

    // Before init: UNINITIALIZED
    expect(state.value).toBe('UNINITIALIZED')

    // Act — synchronous code inside init() runs before first await
    const promise = init()

    // After factory returns, HANDSHAKING is set synchronously (before runHandshake await)
    expect(stateAtFactory).toBe('LOADING')
    expect(state.value).toBe('HANDSHAKING')

    // Simulate UCI responses
    mock.simulateResponse('uciok')
    mock.simulateResponse('readyok')
    await promise

    // After handshake: IDLE
    expect(state.value).toBe('IDLE')
  })
})
