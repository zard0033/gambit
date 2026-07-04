import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useReviewEngine,
  EngineDisposedError,
  EngineUnavailableError,
} from '../../../src/modules/chess-engine/review-engine'
import type { IStockfishWorker } from '../../../src/modules/chess-engine/play-engine'

// -----------------------------------------------------------------------
// Mock worker
// -----------------------------------------------------------------------

class MockReviewWorker implements IStockfishWorker {
  onmessage: ((ev: MessageEvent<string>) => void) | null = null
  readonly sent: string[] = []
  terminated = false

  postMessage(data: string): void {
    this.sent.push(data)
  }
  terminate(): void {
    this.terminated = true
  }
  emit(line: string): void {
    this.onmessage?.({ data: line } as MessageEvent<string>)
  }
}

function factoryFor(mock: MockReviewWorker): () => IStockfishWorker {
  return () => mock
}

async function handshake(mock: MockReviewWorker): Promise<void> {
  mock.emit('uciok')
  mock.emit('readyok')
}

// -----------------------------------------------------------------------
// AC: init() — idempotent, spawns + handshakes to IDLE
// -----------------------------------------------------------------------

describe('useReviewEngine — init()', () => {
  it('test_reviewEngine_init_transitionsToIdle', async () => {
    // Arrange
    const mock = new MockReviewWorker()
    const { state, init } = useReviewEngine(factoryFor(mock))

    // Act
    const p = init()
    await handshake(mock)
    await p

    // Assert
    expect(state.value).toBe('IDLE')
  })

  it('test_reviewEngine_init_idempotent_whenAlreadyIdle', async () => {
    // Arrange
    const mock = new MockReviewWorker()
    const { init } = useReviewEngine(factoryFor(mock))
    const p = init()
    await handshake(mock)
    await p

    // Act — call init again
    const countBefore = mock.sent.length
    await init()

    // Assert — no new messages sent
    expect(mock.sent.length).toBe(countBefore)
  })

  it('test_reviewEngine_init_disposedThrows', async () => {
    // Arrange
    const mock = new MockReviewWorker()
    const { init, dispose } = useReviewEngine(factoryFor(mock))
    dispose()

    // Act + Assert
    await expect(init()).rejects.toThrow(EngineDisposedError)
  })
})

// -----------------------------------------------------------------------
// C2: concurrent init()/analyze() share one in-flight spawn (no Worker leak)
// -----------------------------------------------------------------------

describe('useReviewEngine — C2: concurrent spawn dedup', () => {
  it('test_reviewEngine_concurrentInit_spawnsOnlyOneWorker', async () => {
    // Arrange
    let callCount = 0
    const mocks: MockReviewWorker[] = []
    const factory = () => {
      const m = new MockReviewWorker()
      mocks.push(m)
      callCount++
      return m as unknown as IStockfishWorker
    }
    const { state, init } = useReviewEngine(factory)

    // Act — two overlapping init() calls before handshake resolves
    const p1 = init()
    const p2 = init()
    expect(callCount).toBe(1) // only one Worker spawned synchronously
    await handshake(mocks[0])
    await Promise.all([p1, p2])

    // Assert
    expect(callCount).toBe(1)
    expect(state.value).toBe('IDLE')
  })

  it('test_reviewEngine_concurrentAnalyze_spawnsOnlyOneWorker', async () => {
    // Arrange
    let callCount = 0
    const mocks: MockReviewWorker[] = []
    const factory = () => {
      const m = new MockReviewWorker()
      mocks.push(m)
      callCount++
      return m as unknown as IStockfishWorker
    }
    const { analyze } = useReviewEngine(factory)
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

    // Act — two overlapping analyze() calls before handshake resolves.
    // Both race to spawn the engine, but only one Worker is ever created —
    // that's the C2 fix under test. (The first call's continuation runs
    // first once the shared spawn resolves, so it wins the IDLE state
    // check and proceeds; the second finds the engine already THINKING
    // and rejects — a pre-existing, separate concern from spawn dedup.)
    const p1 = analyze({ fen, targetDepth: 1 })
    const p2 = analyze({ fen, targetDepth: 1 })
    expect(callCount).toBe(1) // only one Worker spawned synchronously
    await handshake(mocks[0])
    await Promise.resolve()
    await Promise.resolve()
    mocks[0].emit('info depth 1 score cp 10 pv e2e4')
    mocks[0].emit('bestmove e2e4')
    const result1 = await p1
    await expect(p2).rejects.toThrow(EngineUnavailableError)

    // Assert
    expect(callCount).toBe(1)
    expect(result1.bestMove).toBe('e2e4')
  })

  it('test_reviewEngine_spawnFailure_clearsInFlightPromiseForRetry', async () => {
    // Arrange — factory throws on first call, succeeds on second
    let callCount = 0
    let mock: MockReviewWorker | null = null
    const factory = () => {
      callCount++
      if (callCount === 1) throw new Error('spawn failed')
      mock = new MockReviewWorker()
      return mock as unknown as IStockfishWorker
    }
    const { state, init } = useReviewEngine(factory)

    // Act — first init() fails
    await expect(init()).rejects.toThrow('spawn failed')
    expect(state.value).toBe('UNINITIALIZED')

    // Retry — in-flight promise must have been cleared to allow a fresh spawn
    const p2 = init()
    expect(mock).not.toBeNull()
    await handshake(mock!)
    await p2

    // Assert
    expect(state.value).toBe('IDLE')
    expect(callCount).toBe(2)
  })
})

// -----------------------------------------------------------------------
// AC-1: Auto-terminate after 30s idle
// -----------------------------------------------------------------------

describe('useReviewEngine — AC-1: 30s auto-terminate', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('test_reviewEngine_idleFor30s_terminatesWorkerAndTransitionsToIdleTerminated', async () => {
    // Arrange
    const mock = new MockReviewWorker()
    const { state, init } = useReviewEngine(factoryFor(mock))
    const p = init()
    mock.emit('uciok')
    mock.emit('readyok')
    await p

    // Act — advance 30s + 1ms
    vi.advanceTimersByTime(30_001)

    // Assert
    expect(state.value).toBe('IDLE_TERMINATED')
    expect(mock.terminated).toBe(true)
  })

  it('test_reviewEngine_idleTimerNotFiredBefore30s', async () => {
    // Arrange
    const mock = new MockReviewWorker()
    const { state, init } = useReviewEngine(factoryFor(mock))
    const p = init()
    mock.emit('uciok')
    mock.emit('readyok')
    await p

    // Act — advance only 29s
    vi.advanceTimersByTime(29_999)

    // Assert — still IDLE
    expect(state.value).toBe('IDLE')
    expect(mock.terminated).toBe(false)
  })
})

// -----------------------------------------------------------------------
// AC-2: Auto-respawn after IDLE_TERMINATED
// -----------------------------------------------------------------------

describe('useReviewEngine — AC-2: auto-respawn after IDLE_TERMINATED', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('test_reviewEngine_analyzeAfterIdleTerminated_respawnsAndCompletes', async () => {
    // Arrange — reach IDLE via init(), then advance to IDLE_TERMINATED
    let callCount = 0
    const mocks: MockReviewWorker[] = []
    const factory = () => {
      const m = new MockReviewWorker()
      mocks.push(m)
      callCount++
      return m as unknown as IStockfishWorker
    }
    const { state, init, analyze } = useReviewEngine(factory)

    // First: init → IDLE
    const initP = init()
    const mock0 = mocks[0]
    mock0.emit('uciok')
    mock0.emit('readyok')
    await initP
    expect(state.value).toBe('IDLE')

    // Advance to IDLE_TERMINATED
    vi.advanceTimersByTime(30_001)
    expect(state.value).toBe('IDLE_TERMINATED')

    // Act — call analyze() after IDLE_TERMINATED
    // The engine auto-respawns via a second spawnAndHandshake()
    const p2 = analyze({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', targetDepth: 1 })
    const mock1 = mocks[1]
    // Handshake for second worker
    mock1.emit('uciok')
    mock1.emit('readyok')
    // Flush microtasks so analyze() resumes and installs its worker.onmessage
    await Promise.resolve()
    await Promise.resolve()
    // Now emit analyze results
    mock1.emit('info depth 1 score cp 30 pv e2e4')
    mock1.emit('bestmove e2e4')
    const result = await p2

    // Assert
    expect(state.value).toBe('IDLE')
    expect(result.bestMove).toBe('e2e4')
    expect(callCount).toBe(2) // second worker was spawned
  })
})

// -----------------------------------------------------------------------
// AC-3: DISPOSED rejects synchronously
// -----------------------------------------------------------------------

describe('useReviewEngine — AC-3: DISPOSED rejects', () => {
  it('test_reviewEngine_analyzAfterDispose_rejectsWithDisposedError', async () => {
    // Arrange
    const mock = new MockReviewWorker()
    const { dispose, analyze } = useReviewEngine(factoryFor(mock))
    dispose()

    // Act + Assert
    await expect(
      analyze({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', targetDepth: 1 }),
    ).rejects.toThrow(EngineDisposedError)
  })

  it('test_reviewEngine_dispose_doesNotAutoRespawn', async () => {
    // Arrange — disposed engine does NOT respawn (unlike IDLE_TERMINATED)
    const mock = new MockReviewWorker()
    const { state, dispose } = useReviewEngine(factoryFor(mock))
    dispose()
    expect(state.value).toBe('DISPOSED')

    // State should remain DISPOSED (no auto-respawn)
    expect(state.value).toBe('DISPOSED')
  })
})

// -----------------------------------------------------------------------
// AC-4: onProgress fires per info depth
// -----------------------------------------------------------------------

describe('useReviewEngine — AC-4: onProgress callback', () => {
  it('test_reviewEngine_onProgress_firesForEachDepth', async () => {
    // Arrange — init first so the engine is IDLE before analyze()
    const mock = new MockReviewWorker()
    const { init, analyze } = useReviewEngine(factoryFor(mock))
    const initP = init()
    mock.emit('uciok')
    mock.emit('readyok')
    await initP

    const depths: number[] = []

    // Act — engine is IDLE, analyze() installs its handler synchronously before we emit
    const p = analyze(
      { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', targetDepth: 3 },
      (d) => depths.push(d),
    )
    // Flush microtasks so analyze() runs synchronously and sets worker.onmessage
    await Promise.resolve()
    mock.emit('info depth 1 score cp 23 pv e2e4')
    mock.emit('info depth 2 score cp 31 pv e2e4 e7e5')
    mock.emit('bestmove e2e4')
    const result = await p

    // Assert
    expect(depths).toEqual([1, 2])
    expect(result.bestMove).toBe('e2e4')
    expect(result.depthReached).toBe(2)
  })

  it('test_reviewEngine_analyze_requiresDepthOrMovetime', async () => {
    // Arrange
    const mock = new MockReviewWorker()
    const { analyze } = useReviewEngine(factoryFor(mock))

    // Act — no targetDepth or movetimeMs → should reject
    const p = analyze({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' })
    mock.emit('uciok')
    mock.emit('readyok')

    // Assert — rejected due to missing go args
    await expect(p).rejects.toThrow(EngineUnavailableError)
  })
})

// -----------------------------------------------------------------------
// C1: lowerbound/upperbound info lines must not pollute the final eval
// -----------------------------------------------------------------------

describe('useReviewEngine — C1: aspiration-window bound filtering', () => {
  it('test_reviewEngine_analyze_ignoresLowerboundUpperboundInfoLines', async () => {
    // Arrange
    const mock = new MockReviewWorker()
    const { init, analyze } = useReviewEngine(factoryFor(mock))
    const initP = init()
    mock.emit('uciok')
    mock.emit('readyok')
    await initP

    // Act — a provisional lowerbound line arrives first (aspiration-window re-search),
    // then the real depth-3 line, then movetime cuts off before a deeper line lands.
    const p = analyze({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', movetimeMs: 100 })
    await Promise.resolve()
    mock.emit('info depth 3 score cp 9999 lowerbound pv e2e4')
    mock.emit('info depth 3 score cp 42 pv e2e4')
    mock.emit('info depth 4 score cp -9999 upperbound pv e2e4')
    mock.emit('bestmove e2e4')
    const result = await p

    // Assert — bound lines did not overwrite the real eval or depth
    expect(result.evalCp).toBe(42)
    expect(result.depthReached).toBe(3)
  })
})

// -----------------------------------------------------------------------
// ReviewResult type structural check
// -----------------------------------------------------------------------

describe('ReviewResult — structural: no emotive fields', () => {
  it('test_reviewResult_doesNotContainEmotiveFields', async () => {
    // Arrange — init first, then analyze
    const mock = new MockReviewWorker()
    const { init, analyze } = useReviewEngine(factoryFor(mock))
    const initP = init()
    mock.emit('uciok')
    mock.emit('readyok')
    await initP

    const p = analyze({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', targetDepth: 1 })
    await Promise.resolve()
    mock.emit('info depth 1 score cp 30 pv e2e4')
    mock.emit('bestmove e2e4')
    const result = await p

    // Assert — ReviewResult only has neutral fields
    const forbiddenFields = ['quality', 'label', 'judgment', 'brilliant', 'blunder', 'mistake', 'inaccuracy', 'rating', 'classification']
    for (const field of forbiddenFields) {
      expect(result).not.toHaveProperty(field)
    }

    // Allowed fields
    expect(result).toHaveProperty('bestMove')
    expect(result).toHaveProperty('depthReached')
  })
})
