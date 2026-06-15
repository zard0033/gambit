# Story 001: Game State Machine and Terminal Detection

> **Epic**: Game Lifecycle
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Estimate**: M (4–5 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-29
> **TR**: TR-game-lifecycle-001, TR-game-lifecycle-002
> **ADR**: ADR-0005

## Context

**GDD**: `design/gdd/game-lifecycle.md`
**Requirements**: `TR-game-lifecycle-001`, `TR-game-lifecycle-002`

**ADR Governing Implementation**: ADR-0005: Pinia Store Boundaries and CompletedGame Transport
**ADR Decision Summary**: `chess.js` is the sole authoritative game state. The board is a renderer only. 5-priority terminal detection in fixed order: `isCheckmate()` → `isStalemate()` → `isThreefoldRepetition()` → `isInsufficientMaterial()` → `isDraw()` (fallthrough = fifty-move).

**Control Manifest Rules (Foundation/Core)**:
- Required: `chess.js` is sole authoritative state; `ChessBoard.vue` receives only `fen`/`playerColor`/`disabled` props
- Required: Terminal detection priority (5-stage, fixed): `isCheckmate()` → `isStalemate()` → `isThreefoldRepetition()` → `isInsufficientMaterial()` → `isDraw()`
- Required: chess.js instance lives as a non-reactive `const` inside the GameLifecycle composable
- Forbidden: Never wrap chess.js instance in `ref()` / `reactive()` / Pinia ref

---

## Acceptance Criteria

- [ ] `chess.js` instance is a non-reactive `const` — not wrapped in `ref()`, `reactive()`, or a Pinia store.
- [ ] After each move (player or AI), terminal detection runs in priority order: `isCheckmate()` → `isStalemate()` → `isThreefoldRepetition()` → `isInsufficientMaterial()` → `isDraw()`. First truthy result determines `endReason`.
- [ ] Phase state machine transitions correctly: SETUP → PLAYER_TURN → AI_THINKING → GAME_OVER (on terminal detection).
- [ ] `endReason` maps `isCheckmate()` → `'checkmate'`, `isStalemate()` → `'stalemate'`, `isThreefoldRepetition()` → `'threefold'`, `isInsufficientMaterial()` → `'insufficient-material'`, `isDraw()` → `'fifty-move'`.
- [ ] When the player's move is applied, `chess.move({ from, to, promotion? })` is called on the non-reactive chess.js instance. The returned move is null (illegal) → caller's move is rejected (no state change).
- [ ] Result field: `isCheckmate()` after white's move → `'1-0'`; after black's → `'0-1'`; any draw → `'1/2-1/2'`.

---

## Implementation Notes

- Create `src/composables/useGameLifecycle.ts` (or `src/modules/game-lifecycle/`).
- `const chess = new Chess()` — plain, non-reactive. Internal to the composable.
- Phase state: `const phase = ref<'SETUP' | 'PLAYER_TURN' | 'AI_THINKING' | 'GAME_OVER'>('SETUP')`.
- `detectTerminal()` function: checks the 5 conditions in order, returns `{ isTerminal: true, result, endReason }` or `{ isTerminal: false }`.
- Call `detectTerminal()` after every chess.js move (player and AI). If terminal → call `assembleCompletedGame()` (Story 002) and transition to GAME_OVER.
- Resignation: external call to `resign()` → set `endReason: 'resignation'`, `result: player === 'white' ? '0-1' : '1-0'` → GAME_OVER.

---

## QA Test Cases

- **AC-1**: chess.js instance is not reactive
  - When: inspect the module's internal `chess` variable type
  - Then: `isRef(chess) === false`, `isReactive(chess) === false`

- **AC-2**: Terminal detection priority — checkmate
  - Given: FEN where it's checkmate (scholar's mate position)
  - When: detectTerminal() called
  - Then: `endReason === 'checkmate'`, `result === '0-1'` (black checkmated)

- **AC-3**: Terminal detection priority — stalemate
  - Given: FEN where it's stalemate
  - When: detectTerminal() called
  - Then: `endReason === 'stalemate'`, `result === '1/2-1/2'`

- **AC-4**: Phase machine: PLAYER_TURN → AI_THINKING → PLAYER_TURN
  - Given: game in PLAYER_TURN phase
  - When: player move applied → phase transitions to AI_THINKING
  - When: AI move applied → phase transitions to PLAYER_TURN
  - Then: phase sequence is correct

- **AC-5**: Illegal move rejected
  - Given: white's turn, starting FEN
  - When: `chess.move({ from: 'e2', to: 'e5' })` (illegal — knight jump for pawn)
  - Then: returns null; chess.js state is unchanged

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/game-lifecycle/state-machine.test.ts`

**Status**: ✅ Created — 25 tests, all pass

---

## Dependencies

- Depends on: Epic chess-board Story 001 must be DONE (ChessBoard exists); Epic chess-engine Story 001 must be DONE (playEngine exists)
- Unlocks: Story 002 (CompletedGame assembly depends on chess.js state)

## Completion Notes
**Completed**: 2026-05-29
**Criteria**: 6/6 passing
**Deviations**: (1) Implementation at `src/modules/game-lifecycle/use-game-lifecycle.ts` not `src/composables/useGameLifecycle.ts` — consistent with module structure; (2) `detectTerminal()` returns `TerminalState | null` (cleaner union vs `{isTerminal:bool}` shape in notes)
**Test Evidence**: Logic — `tests/unit/game-lifecycle/state-machine.test.ts` — 25 tests pass
**Code Review**: Skipped (Lean mode)
