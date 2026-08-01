import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePlayEngine, EngineUnavailableError } from '../../../src/modules/chess-engine/play-engine'
import type { IStockfishWorker } from '../../../src/modules/chess-engine/play-engine'
import { DIFFICULTY_LADDER } from '../../../src/config/difficulty-tuning'

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

// -----------------------------------------------------------------------
// Difficulty ladder — the `go` line must carry the depth cap.
// Spec: design/quick-specs/difficulty-ladder-remake.md
// -----------------------------------------------------------------------

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Fresh engine already past the handshake, with handshake chatter cleared from the log. */
async function idleEngine(): Promise<{
  mock: MockStockfishWorker
  engine: ReturnType<typeof usePlayEngine>
}> {
  const mock = new MockStockfishWorker()
  const engine = usePlayEngine(factoryFor(mock))
  const ready = engine.init()
  mock.simulateResponse('uciok')
  mock.simulateResponse('readyok')
  await ready
  mock.sentMessages.length = 0
  return { mock, engine }
}

describe('usePlayEngine — difficulty ladder depth cap', () => {
  it('test_playEngine_playWithDepth_sendsGoWithDepthAndMovetime', async () => {
    // Arrange
    const { mock, engine } = await idleEngine()

    // Act
    const promise = engine.play({ fen: START_FEN, skillLevel: 3, movetimeMs: 50, depth: 1 })
    mock.simulateResponse('bestmove e2e4')
    await promise

    // Assert
    expect(mock.sentMessages).toContain('go depth 1 movetime 50')
  })

  it('test_playEngine_playWithoutDepth_sendsGoWithMovetimeOnly', async () => {
    // Post-game review analyses deliberately search without a depth cap; that path must survive.
    const { mock, engine } = await idleEngine()

    const promise = engine.play({ fen: START_FEN, skillLevel: 20, movetimeMs: 3000 })
    mock.simulateResponse('bestmove e2e4')
    await promise

    expect(mock.sentMessages).toContain('go movetime 3000')
  })

  it('test_playEngine_everyLadderRung_sendsTheSettingsItsRungActuallyUses', async () => {
    // 呼叫形狀必須與 PlayView 一致（它一律帶 rung.fallible）——少傳 fallible 的話，
    // 這條會對 1-4 階斷言一件生產路徑已經放棄的事（送自己的 Skill Level），變成假信心。
    for (const rung of DIFFICULTY_LADDER) {
      // Arrange
      const { mock, engine } = await idleEngine()

      // Act
      const promise = engine.play({
        fen: START_FEN,
        skillLevel: rung.skillLevel,
        movetimeMs: rung.movetimeMs,
        depth: rung.depth,
        fallible: rung.fallible,
      })
      mock.simulateResponse('bestmove e2e4')
      await promise

      // Assert — 會犯錯的階把弱化交給挑手，所以引擎本身跑滿血＋全寬候選；
      // 頂階不挑手，維持窄搜尋與自己的 skill level。
      if (rung.fallible) {
        expect(mock.sentMessages).toContain('setoption name MultiPV value 50')
        expect(mock.sentMessages).toContain('setoption name Skill Level value 20')
      } else {
        expect(mock.sentMessages).toContain('setoption name MultiPV value 1')
        expect(mock.sentMessages).toContain(`setoption name Skill Level value ${rung.skillLevel}`)
      }
      expect(mock.sentMessages).toContain(`go depth ${rung.depth} movetime ${rung.movetimeMs}`)
    }
  })
})

// -----------------------------------------------------------------------
// 全寬 MultiPV：候選解析與替換。純函式那半在 fallible-pick.test.ts，
// 這裡驗的是「UCI 字串 → 候選清單 → 替換後的 bestMove」這段接線。
// -----------------------------------------------------------------------

describe('usePlayEngine — 全寬 MultiPV 候選解析與替換', () => {
  const WINDOW = { probability: 1, minLossCp: 100, maxLossCp: 300 }
  const FALLIBLE_PLAY = {
    fen: START_FEN,
    skillLevel: 0,
    movetimeMs: 1000,
    depth: 8,
    fallible: WINDOW,
  }

  /** 一輪完整的 MultiPV 輸出：最佳手 e2e4，其後依序虧 50 / 150 / 250 / 500cp。 */
  function feedCandidates(mock: MockStockfishWorker): void {
    mock.simulateResponse('info depth 8 multipv 1 score cp 20 pv e2e4 e7e5')
    mock.simulateResponse('info depth 8 multipv 2 score cp -30 pv d2d4 d7d5')
    mock.simulateResponse('info depth 8 multipv 3 score cp -130 pv g2g4 e7e5')
    mock.simulateResponse('info depth 8 multipv 4 score cp -230 pv b1a3 e7e5')
    mock.simulateResponse('info depth 8 multipv 5 score cp -480 pv f2f3 e7e5')
  }

  it('test_playEngine_multipvStream_substitutesAMoveFromTheWindow', async () => {
    const { mock, engine } = await idleEngine()

    const promise = engine.play(FALLIBLE_PLAY)
    feedCandidates(mock)
    mock.simulateResponse('bestmove e2e4')
    const result = await promise

    // 窗口 100-300cp 只涵蓋 g2g4(-150) 與 b1a3(-250)。f2f3 虧 500 是掛子，必須被排除。
    expect(['g2g4', 'b1a3']).toContain(result.bestMove)
  })

  it('test_playEngine_noFallibleConfig_keepsEngineBestMove', async () => {
    const { mock, engine } = await idleEngine()

    const promise = engine.play({ fen: START_FEN, skillLevel: 17, movetimeMs: 1000, depth: 8 })
    feedCandidates(mock)
    mock.simulateResponse('bestmove e2e4')
    const result = await promise

    expect(result.bestMove).toBe('e2e4')
  })

  it('test_playEngine_resignToken_isNeverSubstituted', async () => {
    // 0000 是投降／終局訊號。把它換成一個走法，對局邏輯會以為棋還在下。
    const { mock, engine } = await idleEngine()

    const promise = engine.play(FALLIBLE_PLAY)
    feedCandidates(mock)
    mock.simulateResponse('bestmove 0000')
    const result = await promise

    expect(result.bestMove).toBe('0000')
    expect(result.kind).toBe('resign')
  })

  it('test_playEngine_evalFields_comeFromMultipvOne_notTheLastInfoLine', async () => {
    // 全寬搜尋的最後一行是最差的候選；抓錯行會讓局面評估變成爛手的分數。
    const { mock, engine } = await idleEngine()

    const promise = engine.play(FALLIBLE_PLAY)
    feedCandidates(mock)
    mock.simulateResponse('bestmove e2e4')
    const result = await promise

    expect(result.evalCp).toBe(20)
    expect(result.pv?.[0]).toBe('e2e4')
  })

  it('test_playEngine_deeperIteration_overwritesShallowerCandidates', async () => {
    // 每個 depth 都會重印整組 multipv，留下的必須是最深那一輪的分數。
    const { mock, engine } = await idleEngine()

    const promise = engine.play(FALLIBLE_PLAY)
    // 淺層：g2g4 只虧 20cp，在窗口外
    mock.simulateResponse('info depth 4 multipv 1 score cp 20 pv e2e4 e7e5')
    mock.simulateResponse('info depth 4 multipv 2 score cp 0 pv g2g4 e7e5')
    // 深層：同一手虧到 150cp，進入窗口
    mock.simulateResponse('info depth 8 multipv 1 score cp 20 pv e2e4 e7e5')
    mock.simulateResponse('info depth 8 multipv 2 score cp -130 pv g2g4 e7e5')
    mock.simulateResponse('bestmove e2e4')
    const result = await promise

    expect(result.bestMove).toBe('g2g4')
  })

  it('test_playEngine_windowEmpty_fallsBackToEngineBest', async () => {
    // 殘局常見：合法走法少、彼此又接近，窗口空無一物時必須走引擎的最佳手。
    const { mock, engine } = await idleEngine()

    const promise = engine.play(FALLIBLE_PLAY)
    mock.simulateResponse('info depth 8 multipv 1 score cp 20 pv e2e4 e7e5')
    mock.simulateResponse('info depth 8 multipv 2 score cp 10 pv d2d4 d7d5')
    mock.simulateResponse('bestmove e2e4')
    const result = await promise

    expect(result.bestMove).toBe('e2e4')
  })
})
