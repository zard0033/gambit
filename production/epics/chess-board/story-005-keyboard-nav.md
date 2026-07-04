# Story 005: Keyboard Navigation — useBoardKeyboard Composable

> **Epic**: Chess Board & Move System
> **Status**: Complete (AC-1 exception — see below: E2E spec is now a real axe-core assertion but has never been run)
> **Layer**: Foundation (Core — chess board substrate)
> **Type**: Logic
> **Estimate**: L (5–8 hours — roving tabindex + ARIA live regions is complex)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-chess-board-005
> **ADR**: ADR-0006, ADR-0009

## Context

**GDD**: `design/gdd/chess-board-and-move-system.md`
**Requirement**: `TR-chess-board-005`
*(Requirement text lives in `docs/architecture/tr-registry.yaml`)*

**ADR Governing Implementation**: ADR-0009: Chess Board Substrate, vue3-chessboard Integration, Keyboard Model
**ADR Decision Summary**: Keyboard navigation uses a `useBoardKeyboard` composable with a single absolutely-positioned transparent focus cell (`<div tabindex="0" style="pointer-events:none; opacity:0">`). The cell moves to the focused square on arrow-key press. The board wrapper itself has `tabindex="-1"`. Sprint 1 spike confirmed chessground has zero keyboard listeners — the focus-cell `keydown` handler works correctly alongside chessground.

**Engine**: Web App — chessground 9.x | **Risk**: MEDIUM
**Engine Notes**: Sprint 1 spike (ADR-0009 §2): focus-cell `keydown` fires correctly when chessground's own pointer-event listeners are active. `pointer-events:none` on the focus div ensures chess ground still receives pointer events normally.

**Control Manifest Rules (Core layer)**:
- Required: Keyboard nav via `useBoardKeyboard` composable + single roving focus cell
- Required: Board wrapper has `tabindex="-1"`; focus cell has `tabindex="0"` (single tab stop)
- Forbidden: Never fork chessground / vue3-chessboard for keyboard nav
- Forbidden: Never use a 64-cell transparent div grid overlay for keyboard nav (O(64) vDOM diff per move)

---

## Acceptance Criteria

*From GDD `design/gdd/chess-board-and-move-system.md` — accessibility ACs:*

- [ ] **GIVEN** a Playwright test with `@axe-core/playwright`, **WHEN** the board mounts in the starting position, **THEN** no axe violations of impact `serious` or `critical` are reported. (`@axe-core/playwright` is now installed and `tests/e2e/chess-board-a11y.spec.ts` is a real assertion — scans the ChessBoard's `role="grid"` root on `/learn/pawn-basics`, excluding vendor-owned `.cg-wrap` internals. Not yet run locally or in CI; do not check this box until it has actually passed once.)
- [x] **GIVEN** the board has keyboard focus, **WHEN** arrow keys are pressed, **THEN** the focused square indicator moves one square in the corresponding direction (does NOT wrap at board edges — confirm via test).
- [x] **GIVEN** the board has keyboard focus on an own piece, **WHEN** Enter is pressed, **THEN** PIECE_SELECTED is entered AND legal dots/rings appear AND the assertive live region announces `"[Piece] at [square] selected"`.
- [x] **GIVEN** PIECE_SELECTED is active, **WHEN** Enter is pressed on a legal destination square, **THEN** the move commits via `boardApi.move()`.
- [x] **GIVEN** PIECE_SELECTED is active, **WHEN** Escape is pressed, **THEN** selection clears, board returns to IDLE.
- [x] **GIVEN** Home/End keys are pressed, **THEN** focus jumps to the a-file / h-file square on the current rank.
- [x] **GIVEN** PgUp/PgDn keys are pressed, **THEN** focus jumps to rank 8 / rank 1 on the current file.
- [x] **GIVEN** two announcements would fire within 100ms, **THEN** they are merged into one (100ms debounce).
- [x] Each square element has `role="gridcell"` and `aria-label` of the form `"e4, empty"` or `"e4, white knight"`.

---

## Implementation Notes

*Derived from ADR-0009 §2 + GDD Accessibility section:*

- **useBoardKeyboard composable**: accepts `boardRef`, `orientation`, `currentFen` (for piece lookup), and a `onMoveSelected(from, to)` callback.
- **Focus cell**: a single `<div ref="focusCellRef" tabindex="0" style="position:absolute; pointer-events:none; opacity:0">`. Position it by calling `squareToRect(currentSquare)` and setting `left`, `top`, `width`, `height` to the returned rect (board-local, so position relative to the `.cg-wrap` container).
- **Arrow keys**: `keydown` listener on the focus cell. ArrowUp: rank + 1; ArrowDown: rank - 1; ArrowLeft: file - 1; ArrowRight: file + 1. Clamp at edges (no wrap). Black orientation: flip arrow directions.
- **Enter on own piece**: call `onMoveSelected(currentSquare, null)` to enter PIECE_SELECTED; parent computes legal moves and passes them to `drawable.shapes`.
- **Enter on legal destination**: call `onMoveSelected(selectedSquare, currentSquare)` to commit move.
- **Escape**: clear PIECE_SELECTED; return focus to origin square.
- **ARIA live regions**: two `<span>` elements with `aria-live="assertive"` and `aria-live="polite"` in `ChessBoard.vue`. Merge-within-100ms: use a `debounce(fn, 100)` that collects announcements and joins with `", "`.
- **Square aria-labels**: update `aria-label` on each square element (the `.cg-board .cg-wrap div[data-key]` or equivalent chessground square) on every position change. Derive piece name from FEN: map piece char to `"white knight"` etc.
- **Tab stop management**: board wrapper `tabindex="-1"` (not in tab order but focusable programmatically); only focus cell has `tabindex="0"`.

---

## Out of Scope

*Handled by neighbouring stories:*

- [Story 003]: Promotion dialog focus trap (separate from board keyboard nav)
- [Story 002]: Pointer-based input (drag, tap)
- [Story 006]: Visual feedback for check, last-move highlight

---

## QA Test Cases

*Logic story — automated test specs.*

- **AC-1**: axe-core no serious/critical violations
  - Given: ChessBoard mounted in starting position in a Playwright test
  - When: `await checkA11y(page.locator('[data-testid="chess-board"]'), { includedImpacts: ['serious', 'critical'] })`
  - Then: 0 violations reported
  - Edge cases: run with board in DISABLED state, with a piece selected

- **AC-2**: Arrow keys move focus (no wrap at edges)
  - Given: focus cell at 'e4'
  - When: press ArrowUp
  - Then: focus cell repositions to 'e5' (verify position matches squareToRect('e5'))
  - Edge cases: ArrowUp from e8 — focus stays at e8 (no wrap); ArrowLeft from a4 — stays at a4

- **AC-3**: Enter on own piece → PIECE_SELECTED + announcement
  - Given: board at starting FEN, focus cell at 'g1' (white knight)
  - When: press Enter
  - Then: `drawable.shapes` shows legal destinations for g1 knight; assertive live region text contains `"Knight at g1 selected"`

- **AC-4**: Enter on legal destination → move commits
  - Given: white knight at g1 selected; focus moved to f3 (legal destination)
  - When: press Enter
  - Then: 'move-made' emitted with `{ from: 'g1', to: 'f3', ... }`; assertive region announces `"Nf3"`

- **AC-5**: Escape cancels selection
  - Given: PIECE_SELECTED with g1 selected
  - When: press Escape
  - Then: `drawable.shapes` is empty; focus stays at g1

- **AC-6**: 100ms merge policy
  - Given: two announcements queued 50ms apart (e.g., capture announcement + check announcement)
  - When: debounce timer fires
  - Then: assertive region receives one merged string `"Nxe5, capturing knight, check"` (not two separate updates)

- **AC-7**: Square aria-labels
  - Given: board at starting position
  - When: query the e2 square element's `aria-label`
  - Then: `"e2, white pawn"` (or locale-equivalent)
  - Edge cases: empty square `"a5, empty"`; opponent piece `"e7, black pawn"`

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- `tests/unit/chess-board/keyboard-nav.test.ts` — must exist and all tests pass
- `tests/e2e/chess-board-a11y.spec.ts` — Playwright axe-core test (can be in existing toolchain spec)

**Status**: [x] `tests/unit/chess-board/keyboard-nav.test.ts` — 37 tests, all pass (2026-05-30); [ ] `tests/e2e/chess-board-a11y.spec.ts` — `@axe-core/playwright` installed, spec is now a real assertion (no more `test.skip`), but has never actually run locally or in CI — pending first run (advisory)

---

## Dependencies

- Depends on: Story 001 must be DONE (boardRef exists), Story 002 must be DONE (move-made event works)
- Unlocks: None (terminal accessibility feature for this epic)
