# Story 002: Dual Input — Drag-and-Drop, Tap-Tap, and move-made Event

> **Epic**: Chess Board & Move System
> **Status**: Complete
> **Layer**: Foundation (Core — chess board substrate)
> **Type**: Logic
> **Estimate**: M (4–6 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-29
> **TR**: TR-chess-board-002
> **ADR**: ADR-0006, ADR-0009

## Context

**GDD**: `design/gdd/chess-board-and-move-system.md`
**Requirement**: `TR-chess-board-002`
*(Requirement text lives in `docs/architecture/tr-registry.yaml`)*

**ADR Governing Implementation**: ADR-0009: Chess Board Substrate, vue3-chessboard Integration, Keyboard Model
**ADR Decision Summary**: `ChessBoard.vue` delegates drag + tap-tap input to vue3-chessboard's built-in handlers. `move-made` is emitted with the exact payload `{ from, to, promotion?, fen, animationDoneAt: Promise<void> }`. `animationDoneAt` resolves via a CSS `transitionend` listener on the moving piece element with a rAF-aligned `setTimeout` fallback (`pieceMoveAnimationMs + 16ms buffer`).

**Engine**: Web App — vue3-chessboard ^1.x | **Risk**: MEDIUM
**Engine Notes**: chessground handles pointer input for drag + tap-tap natively. The `config.events.move` callback fires after a legal move — use it to emit `move-made`. `animationDoneAt`: Sprint 1 spike (ADR-0009) confirmed no built-in hook — use `transitionend` + rAF setTimeout fallback.

**Control Manifest Rules (Core layer)**:
- Required: `move-made` event payload shape (exact): `{ from, to, promotion?, fen, animationDoneAt: Promise<void> }`
- Required: `chess.js` is sole authoritative state — board is renderer only
- Required: Selection overlays (legal-move dots + capture rings) MUST use `config.drawable.shapes`
- Forbidden: Never render legal-move dots / capture rings as Vue-reactive SVG `<circle>` elements
- Forbidden: Never expose chessground config API to parent components

---

## Acceptance Criteria

*From GDD `design/gdd/chess-board-and-move-system.md` — input ACs:*

- [ ] **GIVEN** it is the player's turn, **WHEN** the player drags their own piece to a legal destination, **THEN** the piece animates to the destination and a `move-made` event is emitted with `{ from, to, fen }`.
- [ ] **GIVEN** it is the player's turn, **WHEN** the player drags their own piece to an illegal destination, **THEN** the piece snaps back to its origin within `snapBackAnimationMs` and no `move-made` event is emitted.
- [ ] **GIVEN** it is the opponent's turn (`disabled=true`), **WHEN** the player attempts to drag any piece, **THEN** no drag interaction starts (input ignored).
- [ ] **GIVEN** it is the player's turn and no piece is selected, **WHEN** the player taps their own piece, **THEN** the piece enters PIECE_SELECTED state and all legal destinations show dots/rings (via `drawable.shapes`).
- [ ] **GIVEN** a piece is selected, **WHEN** the player taps a legal destination, **THEN** the piece animates to that square and a `move-made` event is emitted.
- [ ] **GIVEN** a piece is selected, **WHEN** the player taps the same piece again, **THEN** selection is cancelled and dots/rings disappear (return to IDLE).
- [ ] **GIVEN** a piece is selected, **WHEN** the player taps a different own-color piece, **THEN** the new piece becomes selected and old selection clears.
- [ ] **GIVEN** a non-promotion move completes, **WHEN** the `move-made` event fires, **THEN** the payload has `promotion: undefined` (not `null`, not a string).
- [ ] **GIVEN** any move completes, **WHEN** the `move-made` event fires, **THEN** the `fen` field equals the position *after* the move is applied (verified by re-feeding into `chess.js`).
- [ ] **GIVEN** the board is in DISABLED state, **WHEN** an external system updates the FEN, **THEN** no `move-made` event fires.
- [ ] **GIVEN** it is the player's turn, **WHEN** the player taps an opponent's piece, **THEN** no state change occurs and no visual feedback is shown.
- [ ] **GIVEN** PIECE_SELECTED is active, **WHEN** the player taps outside the board, **THEN** selection clears and the board returns to IDLE.
- [ ] **GIVEN** PIECE_SELECTED is active, **WHEN** the selected piece can capture an opponent piece on a square, **THEN** that square renders a capturable ring (NOT a dot) AND the ring count equals `chess.js.moves({square, verbose:true})` capture count.
- [ ] **GIVEN** the player is dragging a piece, **WHEN** a second touch begins on any piece, **THEN** the second touch is ignored until the first releases.

---

## Implementation Notes

*Derived from ADR-0009 §1 + §3 + GDD Core Rules:*

- **Input delegation**: vue3-chessboard handles drag + tap-tap via chessground. Configure `movable.color` based on `playerColor` and `disabled` props: `disabled=true` → `'none'`; player's turn → `playerColor`.
- **Legal move dots**: use `drawable.shapes` with the chessground brush API. On piece selection, call `ground.set({ drawable: { shapes: legalMoves.map(m => ...) } })`. Empty `shapes` array clears selection.
- **move-made event**: hook into chessground's `config.events.move(from, to, capturedPiece)`. After chess.js validates the move, emit `'move-made'` with `{ from, to, fen: chess.fen(), animationDoneAt }`.
- **animationDoneAt**: create a `Promise<void>` that resolves when the piece animation completes. Use a `transitionend` listener on the `.cg-board piece[style*="translate"]` element; if no `transitionend` fires within `pieceMoveAnimationMs + 16`, resolve via rAF-aligned setTimeout. Never resolve from a fixed `setTimeout` alone.
- **Illegal move handling**: chessground fires `config.events.dropNewPiece` on illegal drop — do not emit `move-made`, let chessground handle snap-back.
- **Second-touch guard**: chessground handles this natively in pointer event model — verify in integration test; do not add a manual touch-count guard unless chessground fails.
- **`promotion: undefined`**: when calling `emit('move-made', payload)`, use `promotion: undefined` for non-promotion moves. TypeScript will enforce this via the `Partial<{ promotion: 'q' | 'r' | 'b' | 'n' }>` type.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- [Story 001]: FEN rendering, board mount, position sync
- [Story 003]: Promotion dialog flow (MOVING_PROMOTION → PROMOTING)
- [Story 004]: `squareToRect()` geometry
- [Story 005]: Keyboard navigation
- [Story 006]: Visual feedback (check glow, last-move highlight)

---

## QA Test Cases

*Logic story — automated test specs.*

- **AC-1**: Legal drag emits move-made with correct payload
  - Given: ChessBoard mounted, playerColor='white', disabled=false, starting FEN
  - When: simulate chessground's `events.move('e2', 'e4')` callback
  - Then: 'move-made' emitted with `{ from: 'e2', to: 'e4', promotion: undefined, fen: '...e4...', animationDoneAt: Promise }`
  - Edge cases: capture move (en passant, regular), fen field verified via `new Chess().load(fen)` — no error

- **AC-2**: Illegal drag — no event, snap-back
  - Given: starting FEN
  - When: player drags e2 to e5 (knight jump — illegal for pawn)
  - Then: no 'move-made' event emitted; chessground visually snaps piece back (verify by querying position after)
  - Note: snap-back is chessground native behavior — verify it doesn't require explicit code

- **AC-3**: DISABLED blocks input
  - Given: disabled=true, starting FEN
  - When: simulate pointer-down on a piece element
  - Then: chessground `movable.color === 'none'` — no 'move-made' fires; confirm via event spy

- **AC-4**: PIECE_SELECTED shows dots via drawable.shapes
  - Given: starting FEN, white's turn
  - When: tap e2 (white pawn)
  - Then: `ground.state.drawable.shapes` contains objects with `orig: 'e3'` and `orig: 'e4'` (legal destinations)

- **AC-5**: Capture ring on capturable squares
  - Given: FEN with white pawn d4, black pawn e5 (`rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2`)
  - When: tap e4 (white pawn)
  - Then: drawable.shapes contains a shape with `orig: 'd5'` that uses a capture-ring brush (verify brush name or class)

- **AC-6**: Tap same piece cancels selection
  - Given: e2 is selected
  - When: tap e2 again
  - Then: `drawable.shapes` is empty (no dots), board is in IDLE

- **AC-7**: Second touch ignored
  - Given: pointer-down on e2 (drag in progress)
  - When: second `pointerdown` event fires on g1
  - Then: `ground.state.movable.dests` is still populated for e2 selection (g1 not selected, no state change)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- `tests/unit/chess-board/input.test.ts` — must exist and all tests pass

**Status**: [x] Created and passing (7 tests)

---

## Dependencies

- Depends on: Story 001 must be DONE (ChessBoard.vue wrapper exists)
- Unlocks: Story 003 (promotion extends this input flow)

---

## Completion Notes
**Completed**: 2026-05-29
**Criteria**: 14 ACs — 6 auto-verified, 8 deferred to component/E2E (chessground native behaviors; not testable in unit env)
**Deviations**: ADVISORY — `src/composables/use-board-input.ts` created outside stated scope (valid extraction for testability)
**Test Evidence**: Logic: `tests/unit/chess-board/input.test.ts` (7 tests, all pass)
**Code Review**: Pending (to run before sprint close-out)
