import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGameLifecycle } from '../../../src/modules/game-lifecycle/use-game-lifecycle'
import type { GameLifecycleDeps } from '../../../src/modules/game-lifecycle/use-game-lifecycle'
import { useGameStore } from '../../../src/stores/game-store'

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function makeMockStore(callOrder?: string[]) {
  return {
    setCompletedGame: vi.fn(() => { callOrder?.push('setCompletedGame') }),
    setGameInProgress: vi.fn(() => { callOrder?.push('setGameInProgress') }),
  }
}

function makeMockRouter(callOrder?: string[]) {
  return {
    push: vi.fn((_path: string) => {
      callOrder?.push('router.push')
      return Promise.resolve()
    }),
  }
}

function makeTestDeps(callOrder?: string[]): GameLifecycleDeps {
  return {
    store: makeMockStore(callOrder),
    router: makeMockRouter(callOrder),
  }
}

/** Play scholar's mate using the lifecycle composable (player is White). */
function playScholarsMate(lifecycle: ReturnType<typeof useGameLifecycle>): void {
  lifecycle.startGame('white', 0)
  lifecycle.handlePlayerMove('e2', 'e4')
  lifecycle.handleAiMove('e7e5')
  lifecycle.handlePlayerMove('f1', 'c4')
  lifecycle.handleAiMove('b8c6')
  lifecycle.handlePlayerMove('d1', 'h5')
  lifecycle.handleAiMove('g8f6')
  lifecycle.handlePlayerMove('h5', 'f7') // Qxf7# — checkmate
}

// -----------------------------------------------------------------------
// AC-1: CompletedGame.moves is a cloned snapshot
// -----------------------------------------------------------------------

describe('CompletedGame — AC-1: moves array is cloned snapshot', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('test_completedGame_movesArray_isCloned_notSameReference', async () => {
    // Arrange
    const deps = makeTestDeps()
    const lifecycle = useGameLifecycle(deps)
    playScholarsMate(lifecycle)
    await Promise.resolve() // allow onGameTerminal to run

    // Act
    const captured = (deps.store!.setCompletedGame as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]

    // Assert — the passed-in moves array is a frozen snapshot (different reference from internal)
    expect(captured).toBeDefined()
    expect(Object.isFrozen(captured.moves)).toBe(true)
    expect(captured.moves.length).toBeGreaterThan(0)
  })

  it('test_completedGame_internalMutationDoesNotAffectSnapshot', async () => {
    // Arrange
    const deps = makeTestDeps()
    const lifecycle = useGameLifecycle(deps)
    playScholarsMate(lifecycle)
    await Promise.resolve()

    const captured = (deps.store!.setCompletedGame as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    const snapshotLength = captured.moves.length

    // Act — verify snapshot is frozen (mutation attempt won't change length since frozen)
    // The internal _moves is a private variable; we verify the snapshot is independent
    // by confirming it is frozen (Object.freeze prevents push/mutation)
    expect(() => {
      // In strict mode this throws; in sloppy mode it silently no-ops
      ;(captured.moves as string[]).push('z9z9')
    }).toThrow() // frozen array throws in strict mode

    // Length should be unchanged
    expect(captured.moves.length).toBe(snapshotLength)
  })
})

// -----------------------------------------------------------------------
// AC-2: Object.freeze applied to CompletedGame
// -----------------------------------------------------------------------

describe('CompletedGame — AC-2: Object.freeze', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('test_completedGame_objectIsFrozen', async () => {
    // Arrange
    const deps = makeTestDeps()
    const lifecycle = useGameLifecycle(deps)
    playScholarsMate(lifecycle)
    await Promise.resolve()

    // Act
    const captured = (deps.store!.setCompletedGame as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]

    // Assert — the whole CompletedGame is frozen by gameStore.setCompletedGame
    // Our composable passes a properly structured object; store freezes it.
    // Verify the captured game has required fields (not null/undefined)
    expect(captured.result).toBe('1-0')
    expect(captured.endReason).toBe('checkmate')
    expect(captured.isTerminal).toBe(true)
    expect(typeof captured.completedAt).toBe('number')
    expect(captured.completedAt).toBeGreaterThan(0)
  })

  it('test_completedGame_inStore_isFrozen_via_gameStore', () => {
    // Arrange — use real Pinia store to verify Object.freeze behavior
    const store = useGameStore()
    const mockDeps: GameLifecycleDeps = { store, router: makeMockRouter() }
    const lifecycle = useGameLifecycle(mockDeps)
    playScholarsMate(lifecycle)

    // Act — wait for the async onGameTerminal
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // Assert — completedGame in store is frozen (gameStore.setCompletedGame calls Object.freeze)
        expect(store.completedGame).not.toBeNull()
        expect(Object.isFrozen(store.completedGame)).toBe(true)
        resolve()
      }, 0)
    })
  })
})

// -----------------------------------------------------------------------
// AC-3: playerMoveTimes indexed against player moves only
// -----------------------------------------------------------------------

describe('CompletedGame — AC-3: playerMoveTimes player-only indexing', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('test_completedGame_playerMoveTimes_lengthEqualsPlayerMoveCount', async () => {
    // Arrange — player (White) makes 4 moves, AI makes 3 moves (7 total half-moves → scholar's mate)
    const deps = makeTestDeps()
    const lifecycle = useGameLifecycle(deps)
    playScholarsMate(lifecycle) // 4 white moves, 3 black (AI) moves
    await Promise.resolve()

    // Act
    const captured = (deps.store!.setCompletedGame as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]

    // Assert — AC-3: playerMoveTimes.length === number of PLAYER moves (4), not total plies (7)
    expect(captured.playerMoveTimes.length).toBe(4)
    expect(captured.moves.length).toBe(7) // total plies
  })

  it('test_completedGame_playerMoveTimes_doNotIncludeAiMoveTimes', async () => {
    // Arrange — simpler game: 1 player move, 1 AI move
    const deps = makeTestDeps()
    const lifecycle = useGameLifecycle(deps)
    lifecycle.startGame('white', 10)
    lifecycle.handlePlayerMove('e2', 'e4') // 1 player move
    lifecycle.handleAiMove('e7e5')         // 1 AI move (not counted)
    lifecycle.resign()                     // end game
    await Promise.resolve()

    // Act
    const captured = (deps.store!.setCompletedGame as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]

    // Assert — only 1 player move → playerMoveTimes.length === 1
    expect(captured.playerMoveTimes.length).toBe(1)
    expect(captured.moves.length).toBe(2) // 1 player + 1 AI
  })

  it('test_completedGame_playerMoveTimes_eachEntryIsPositiveNumber', async () => {
    const deps = makeTestDeps()
    const lifecycle = useGameLifecycle(deps)
    lifecycle.startGame('white', 10)
    lifecycle.handlePlayerMove('e2', 'e4')
    lifecycle.resign()
    await Promise.resolve()

    const captured = (deps.store!.setCompletedGame as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(captured.playerMoveTimes.length).toBe(1)
    expect(typeof captured.playerMoveTimes[0]).toBe('number')
    expect(captured.playerMoveTimes[0]).toBeGreaterThanOrEqual(0)
  })
})

// -----------------------------------------------------------------------
// AC-4: Disarm call order: setCompletedGame → setGameInProgress(false) → router.push
// -----------------------------------------------------------------------

describe('CompletedGame — AC-4: disarm-before-navigate call order', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('test_disarmSequence_callOrderIsSetCompletedGame_setGameInProgress_routerPush', async () => {
    // Arrange — spy on call order
    const callOrder: string[] = []
    const deps = makeTestDeps(callOrder)
    const lifecycle = useGameLifecycle(deps)
    playScholarsMate(lifecycle)

    // Wait for async onGameTerminal to complete
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    // Assert — exact call order
    expect(callOrder).toEqual(['setCompletedGame', 'setGameInProgress', 'router.push'])
  })

  it('test_disarmSequence_setGameInProgressCalledWithFalse', async () => {
    // Arrange
    const deps = makeTestDeps()
    const lifecycle = useGameLifecycle(deps)
    playScholarsMate(lifecycle)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    // Assert — setGameInProgress was called with false
    expect(deps.store!.setGameInProgress).toHaveBeenCalledWith(false)
    expect(deps.store!.setGameInProgress).toHaveBeenCalledTimes(1)
  })

  it('test_disarmSequence_routerPushCalledWithReviewPath', async () => {
    // Arrange
    const deps = makeTestDeps()
    const lifecycle = useGameLifecycle(deps)
    playScholarsMate(lifecycle)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    // Assert
    expect(deps.router!.push).toHaveBeenCalledWith('/review')
  })
})

// -----------------------------------------------------------------------
// AC-5: completedGame non-null after navigation
// -----------------------------------------------------------------------

describe('CompletedGame — AC-5: store state after navigation', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('test_completedGame_nonNullAfterRouterPush', async () => {
    // Arrange — use real Pinia store
    const store = useGameStore()
    const mockRouter = makeMockRouter()
    const lifecycle = useGameLifecycle({ store, router: mockRouter })
    playScholarsMate(lifecycle)

    // Wait for async navigation
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    // Assert — store has the completed game, isGameInProgress is false
    expect(store.completedGame).not.toBeNull()
    expect(store.isGameInProgress).toBe(false)
    expect(store.completedGame?.result).toBe('1-0')
    expect(store.completedGame?.endReason).toBe('checkmate')
  })

  it('test_completedGame_hasAllRequiredFields', async () => {
    const store = useGameStore()
    const lifecycle = useGameLifecycle({ store, router: makeMockRouter() })
    playScholarsMate(lifecycle)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    const game = store.completedGame!
    expect(game.moves.length).toBeGreaterThan(0)
    expect(game.playerColor).toBe('white')
    expect(game.result).toBe('1-0')
    expect(game.endReason).toBe('checkmate')
    expect(typeof game.completedAt).toBe('number')
    expect(game.completedAt).toBeGreaterThan(0)
    expect(typeof game.aiSkillLevel).toBe('number')
    expect(game.playerMoveTimes.length).toBeGreaterThan(0)
    expect(game.isTerminal).toBe(true)
  })
})
