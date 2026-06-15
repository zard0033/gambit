# Story 004: squareToRect() Geometry Contract

> **Epic**: Chess Board & Move System
> **Status**: Complete
> **Layer**: Foundation (Core — chess board substrate)
> **Type**: Logic
> **Estimate**: S (2 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-chess-board-004
> **ADR**: ADR-0006, ADR-0009

## Context

**GDD**: `design/gdd/chess-board-and-move-system.md`
**Requirement**: `TR-chess-board-004`
*(Requirement text lives in `docs/architecture/tr-registry.yaml`)*

**ADR Governing Implementation**: ADR-0009: Chess Board Substrate, vue3-chessboard Integration, Keyboard Model
**ADR Decision Summary**: `squareToRect(square)` returns **board-local** coordinates relative to `boardRef`'s top-left corner, orientation-aware (already corrected for Black perspective). It is NEVER viewport-relative. Consumers (MoveAnnotationDisplay) must use the same board-local origin when positioning their SVG overlay.

**Engine**: Web App — vue3-chessboard ^1.x | **Risk**: MEDIUM
**Engine Notes**: Sprint 1 spike (ADR-0009 §4) confirmed: `boardRef` is exposed via `config.events.insert(elements)` where `elements.wrap` is `.cg-wrap`. Board-local coordinates are derived from `boardRef.getBoundingClientRect()` minus overlay container's `getBoundingClientRect()` — but since consumers must use the SAME origin, board-local = relative to `boardRef.getBoundingClientRect().top-left`.

**Control Manifest Rules (Core layer)**:
- Required: `squareToRect(square)` returns BOARD-LOCAL coordinates relative to `boardRef`'s top-left, orientation-aware
- Forbidden: Never expose `squareToRect()` as viewport-relative; never subtract `boardRef.getBoundingClientRect()` in consumers — board-local convention is authoritative

---

## Acceptance Criteria

*From GDD `design/gdd/chess-board-and-move-system.md` — squareToRect ACs:*

- [x] **GIVEN** a valid algebraic square (e.g., `'e4'`), **WHEN** `squareToRect('e4')` is called, **THEN** it returns `{ x, y, width, height }` relative to `boardRef`'s top-left AND `width === height` (square cells are equal-sided).
- [x] **GIVEN** a valid square with `playerColor='black'`, **WHEN** `squareToRect('a1')` is called vs. `playerColor='white'`, **THEN** the returned `x` position differs (orientation-aware: a1 is at top-right for Black).
- [x] **GIVEN** an invalid square identifier (e.g., `'z9'`), **WHEN** `squareToRect('z9')` is called, **THEN** it returns `null`.
- [x] **GIVEN** the board is in any state (IDLE, DISABLED, MOVING, etc.), **WHEN** `squareToRect` is called, **THEN** it returns the **current** pixel rect — values are live (not cached from a previous render).

---

## Implementation Notes

*Derived from ADR-0009 §4:*

- **Board size derivation**: The board is always square. `boardRef.getBoundingClientRect()` gives the current pixel size. Each cell = `boardRect.width / 8` × `boardRect.height / 8` (they are equal for a square board).
- **Square-to-index mapping (White perspective)**: file 'a'=0, 'b'=1…'h'=7; rank '8'=0, '7'=1…'1'=7. Cell `{ col: fileIndex, row: rankIndex }`.
- **Black perspective flip**: when `orientation === 'black'`, col = `7 - fileIndex`, row = `7 - rankIndex`.
- **Return value**: `{ x: col * cellSize, y: row * cellSize, width: cellSize, height: cellSize }`.
- **`null` on invalid input**: validate that the square string matches `/^[a-h][1-8]$/`. Return `null` for anything else.
- **Live values**: call `boardRef.getBoundingClientRect()` inside the function body on every invocation (not cached). This ensures values are correct after window resize, board resize, or orientation change.
- **Exposed via**: `defineExpose({ squareToRect, boardRef })` in `ChessBoard.vue`.

---

## Out of Scope

*Handled by neighbouring stories:*

- [Epic: move-annotation]: MoveAnnotationDisplay consuming `squareToRect()` to position the SVG overlay
- [Story 001]: Board rendering and `boardRef` DOM anchor setup

---

## QA Test Cases

*Logic story — automated test specs.*

- **AC-1**: Valid square → {x, y, width, height} with width === height
  - Given: ChessBoard mounted (mocked boardRef with width=400, height=400)
  - When: `squareToRect('e4')` called (e=col4, 4=row4 from bottom → row3 from top in White orientation)
  - Then: returns `{ x: 4 * 50, y: 4 * 50, width: 50, height: 50 }` (cellSize = 400/8 = 50); `width === height` is true
  - Edge cases: corner squares 'a1', 'a8', 'h1', 'h8'; center squares 'd4', 'e5'

- **AC-2**: Orientation-aware — Black perspective
  - Given: playerColor='black', boardRef width=400
  - When: `squareToRect('a1')` vs. `squareToRect('a1')` with playerColor='white'
  - Then: Black returns `{ x: 7*50, y: 7*50, ... }` (a1 is at bottom-right in White view → top-left in Black view: `7 - 0 = 7` → wait, let me verify: in Black orientation, a1 is top-right: col = 7-0=7, row = 7-7=0 → `{ x: 350, y: 0 }`). White: col=0, row=7 → `{ x: 0, y: 350 }`.
  - Edge cases: h8 in both orientations

- **AC-3**: Invalid square → null
  - Given: any board state
  - When: `squareToRect('z9')` called
  - Then: returns `null`
  - Edge cases: `squareToRect('')`, `squareToRect('e')`, `squareToRect('44')`, `squareToRect(null as any)`

- **AC-4**: Live values (not cached)
  - Given: boardRef initially reports width=400; then width changes to 600 (simulated resize)
  - When: `squareToRect('e4')` called after resize
  - Then: cellSize = 600/8 = 75; `width: 75` is returned (not the old 50)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- `tests/unit/chess-board/square-to-rect.test.ts` — must exist and all tests pass

**Status**: [x] Created and passing (19 tests)

---

## Completion Notes
**Completed**: 2026-05-29
**Criteria**: 4/4 passing
**Deviations**:
- ADVISORY: `boardWidth=0` guard added during code-review (fix applied before close)
- ADVISORY: `Rect` not re-exported from chess-board.vue — future consumers import from board-geometry.ts directly
**Test Evidence**: `tests/unit/chess-board/square-to-rect.test.ts` — 19 tests, all passing
**Code Review**: Complete — APPROVE with 2 advisory findings (both addressed)

---

## Dependencies

- Depends on: Story 001 must be DONE (`boardRef` DOM anchor exists)
- Unlocks: Epic move-annotation (MoveAnnotationDisplay consumes squareToRect)
