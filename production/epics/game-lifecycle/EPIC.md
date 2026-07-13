# Epic: Game Lifecycle

> **Layer**: Core
> **GDD**: design/gdd/game-lifecycle.md
> **Architecture Module**: GameLifecycle
> **Status**: Shipped (S3)
> **Stories**: 3 stories created

## Stories

| # | Story | Type | Status | Primary ADR |
|---|-------|------|--------|-------------|
| 001 | [Game State Machine and Terminal Detection](story-001-state-machine.md) | Logic | Complete | ADR-0005 |
| 002 | [CompletedGame Assembly and Pinia Transport](story-002-completed-game.md) | Logic | Complete | ADR-0005 |
| 003 | [PlayView.vue ← useGameLifecycle Integration](story-003-play-view-integration.md) | UI | Complete | ADR-0005 |

## Overview

Implements the `GameLifecycle` module: single `chess.js` instance as the sole authoritative
game state (board is a renderer only), 4-phase state machine (SETUP → PLAYER_TURN →
AI_THINKING → GAME_OVER), 5-priority terminal detection (checkmate → stalemate → threefold →
fifty-move → insufficient material), `playerMoveTimes[]` indexed against player moves only
(not global move index), `CompletedGame` assembly and write to Pinia `gameStore`, and the
`isGameInProgress = false` disarm-before-navigate ordering contract. Orchestrates ChessBoard
`move-made` events and ChessEngine `playEngine.play()` calls.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0005: Pinia Store Boundaries and CompletedGame Transport | `gameStore` owns `isGameInProgress` + `completedGame`; CompletedGame is the store-canonical transport (not event payload); disarm-before-navigate ordering is a typed invariant | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-game-lifecycle-001 | chess.js is sole authoritative state — board is renderer only | ADR-0005 ✅ |
| TR-game-lifecycle-002 | 5-priority terminal detection (checkmate → 50-move, priority order) | ADR-0005 ✅ |
| TR-game-lifecycle-003 | CompletedGame written to Pinia gameStore as canonical transport | ADR-0005 ✅ |
| TR-game-lifecycle-004 | isGameInProgress: set false BEFORE router.push('/review') | ADR-0005 ✅ |
| TR-game-lifecycle-005 | playerMoveTimes[]: indexed against player moves only (not global index) | ADR-0005 ✅ |

**Untraced Requirements**: None — 5/5 covered by ADR-0005.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/game-lifecycle.md` are verified
- Logic stories (state machine transitions, terminal detection, CompletedGame assembly, playerMoveTimes indexing) have passing unit tests in `tests/unit/game-lifecycle/`
- Integration test verifies a complete game round-trip: start → player move → AI move → terminal → CompletedGame in store
- Disarm-before-navigate ordering verified by test (isGameInProgress false before router.push)

## Next Step

Run `/create-stories game-lifecycle` to break this epic into implementable stories.
