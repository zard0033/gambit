# Story 002: CompletedGame Assembly and Pinia Transport

> **Epic**: Game Lifecycle
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Estimate**: S (2–3 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-29
> **TR**: TR-game-lifecycle-003, TR-game-lifecycle-004, TR-game-lifecycle-005
> **ADR**: ADR-0005

## Context

**GDD**: `design/gdd/game-lifecycle.md`
**Requirements**: `TR-game-lifecycle-003`, `TR-game-lifecycle-004`, `TR-game-lifecycle-005`

**ADR Governing Implementation**: ADR-0005: Pinia Store Boundaries and CompletedGame Transport
**ADR Decision Summary**: `CompletedGame` is assembled from chess.js state at terminal detection, frozen with `Object.freeze()`, stored as `shallowRef<CompletedGame | null>` in `gameStore`. `isGameInProgress` is set to `false` BEFORE `router.push('/review')`. `playerMoveTimes[]` is indexed against player moves ONLY (not global ply index). Cross-route transport is always via `gameStore.completedGame`, never via Vue Router state or EventBus.

**Control Manifest Rules**:
- Required: `completedGame` stored as `shallowRef<CompletedGame | null>` + `Object.freeze` at write time
- Required: `CompletedGame.moves` MUST be a cloned snapshot (not a reference to the live internal array)
- Required: Disarm-before-navigate order: `setCompletedGame()` → `setGameInProgress(false)` → `router.push('/review')`
- Required: `playerMoveTimes[j]` indexed against j-th PLAYER move (not j-th ply)
- Forbidden: Never pass CompletedGame via Vue Router payload
- Forbidden: Never use a global EventBus as the transport for CompletedGame

---

## Acceptance Criteria

- [ ] At terminal detection, `CompletedGame` is assembled with `{ moves, playerColor, result, endReason, completedAt, aiSkillLevel, playerMoveTimes, isTerminal: true }`.
- [ ] `CompletedGame.moves` is a cloned array (not a live reference to the internal moves array).
- [ ] `Object.freeze(completedGame)` is called before writing to `gameStore`.
- [ ] `gameStore.completedGame` is a `shallowRef<CompletedGame | null>`.
- [ ] `playerMoveTimes[j]` is the elapsed time for the j-th PLAYER move only (opponent moves are excluded from the index).
- [ ] Disarm sequence is enforced: `gameStore.completedGame` is set → `gameStore.isGameInProgress = false` → `router.push('/review')` — all three in this exact order with no sync gap.
- [ ] After `router.push('/review')`, `gameStore.completedGame` is non-null and `gameStore.isGameInProgress === false`.

---

## Implementation Notes

- Timer for `playerMoveTimes`: start a `playerMoveStart = Date.now()` timer whenever phase transitions to PLAYER_TURN. On each player move: push `Date.now() - playerMoveStart` to `playerMoveTimes[]`. Reset timer. AI moves do NOT push to `playerMoveTimes`.
- `assembleCompletedGame()`: `{ moves: [...internalMoves], playerColor, result, endReason, completedAt: Date.now(), aiSkillLevel, playerMoveTimes: [...playerMoveTimes], isTerminal: true as const }`.
- `gameStore.setCompletedGame(game)`: `completedGame.value = Object.freeze(game)`.
- Disarm sequence in `onGameTerminal()`:
  ```ts
  gameStore.setCompletedGame(assembleCompletedGame())
  gameStore.setGameInProgress(false)
  await router.push('/review')
  ```
- No `await` between the first two calls — they must be synchronous relative to each other.

---

## QA Test Cases

- **AC-1**: Moves array is cloned
  - Given: internal moves array = ['e2e4', 'e7e5']
  - When: CompletedGame assembled
  - Then: `completedGame.moves !== internalMoves` (different reference); mutating internal array does NOT change completedGame.moves

- **AC-2**: Object.freeze applied
  - Given: CompletedGame assembled and stored
  - When: `Object.isFrozen(gameStore.completedGame.value)`
  - Then: returns `true`

- **AC-3**: playerMoveTimes indexed against player moves only
  - Given: game with alternating moves: player-e2e4 (3s), AI-e7e5, player-g1f3 (2s), AI-b8c6
  - When: game ends
  - Then: `playerMoveTimes === [3000, 2000]` (length 2 — AI moves excluded)

- **AC-4**: Disarm order (call sequence verification)
  - Given: spy on setCompletedGame, setGameInProgress, router.push
  - When: game reaches terminal state
  - Then: call order is [setCompletedGame, setGameInProgress, router.push] — confirmed by spy call indices

- **AC-5**: completedGame non-null after navigation
  - Given: post-navigate state check
  - When: `router.push('/review')` resolves
  - Then: `gameStore.completedGame.value !== null` AND `gameStore.isGameInProgress === false`

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/game-lifecycle/completed-game.test.ts`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 must be DONE (state machine and chess.js exist)
- Unlocks: Epic post-game-review (reads gameStore.completedGame); Epic game-export (reads same)

## Completion Notes
**Completed**: 2026-05-29
**Criteria**: 5/5 passing (AC-1 through AC-5)
**Deviations**: `setCompletedGame()` in game-store.ts updated to copy all CompletedGame fields (playerColor, completedAt, aiSkillLevel, isTerminal) — necessary to fulfil the complete interface spec in ADR-0005
**Test Evidence**: Logic — `tests/unit/game-lifecycle/completed-game.test.ts` — 12 tests pass
**Code Review**: Skipped (Lean mode)
