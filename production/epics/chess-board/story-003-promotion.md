# Story 003: Promotion Dialog — Deliberate Selection Only

> **Epic**: Chess Board & Move System
> **Status**: Complete
> **Layer**: Foundation (Core — chess board substrate)
> **Type**: UI
> **Estimate**: S (3–4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-chess-board-003
> **ADR**: ADR-0006, ADR-0009

## Context

**GDD**: `design/gdd/chess-board-and-move-system.md`
**Requirement**: `TR-chess-board-003`
*(Requirement text lives in `docs/architecture/tr-registry.yaml`)*

**ADR Governing Implementation**: ADR-0009: Chess Board Substrate, vue3-chessboard Integration, Keyboard Model
**ADR Decision Summary**: Promotion dialog implements WCAG 2.1 AA focus trap. The pawn slide animation completes (MOVING_PROMOTION → PROMOTING), then the promotion dialog appears. Cancel (Escape / tap-outside) triggers pawn snap-back and no `move-made` event. No auto-queen on any stray interaction.

**Engine**: Web App — vue3-chessboard ^1.x | **Risk**: MEDIUM
**Engine Notes**: chessground 9.x provides the pawn slide animation. The promotion dialog is a custom Vue component — not provided by chessground. ADR-0009 Sprint 1 spike confirmed `animation.duration = 300ms`; the dialog should appear after this duration completes.

**Control Manifest Rules (Core layer)**:
- Required: Promotion dialog implements focus trap (WCAG 2.1 AA)
- Required: `move-made` event payload: `promotion?: 'q' | 'r' | 'b' | 'n'` when promotion occurs
- Forbidden: Never leak chessground config API to parent components

---

## Acceptance Criteria

*From GDD `design/gdd/chess-board-and-move-system.md` — promotion ACs:*

- [ ] **GIVEN** the player moves a pawn to the 8th/1st rank, **WHEN** the pawn-slide animation completes, **THEN** the promotion dialog appears anchored to the promotion file with Queen focused within 300ms (±50ms).
- [ ] **GIVEN** the promotion dialog is open, **WHEN** the player selects any piece (click, tap, Enter on focused button, or digit key 1–4), **THEN** the pawn glyph is replaced with that piece AND a warm tint matching `lastMoveHighlightColor` animates for `promotionTintMs` (±50ms) AND a `move-made` event is emitted with `promotion: [selected-piece]`.
- [ ] **GIVEN** the promotion dialog is open, **WHEN** the player dismisses without selection (Escape or tap outside), **THEN** the pawn snaps back to its origin square within `snapBackAnimationMs` (+50ms) AND **no** `move-made` event is emitted AND focus returns to the pawn's origin square.
- [ ] **GIVEN** the promotion dialog is open, **WHEN** a screen reader is connected, **THEN** the dialog announces `"Promote pawn — choose Queen, Rook, Bishop, or Knight"` via assertive live region AND focus is on the Queen button AND focus cannot leave the four buttons until a choice is made or dialog cancels.
- [ ] **GIVEN** the promotion dialog is open, **WHEN** Tab is pressed repeatedly, **THEN** focus cycles only among the four promotion buttons (focus trap verified).
- [ ] Each promotion button is ≥ 56 × 56px (above the 44px touch-target minimum — critical, infrequent action).

---

## Implementation Notes

*Derived from ADR-0009 §Decision + GDD Rule 7:*

- **State machine integration**: chessground fires its internal promotion detection on the move event. Intercept by checking if the move results in a promotion (pawn on rank 7/2 moving to rank 8/1). At this point, call `ground.set({ movable: { color: 'none' } })` to freeze input and show the promotion dialog overlay.
- **Dialog anchoring**: position the four-button column below (White) or above (Black) the back-rank square. Fallback to viewport-centered only if anchored layout clips the edge.
- **Focus trap**: on dialog open, call `dialogEl.querySelector('[data-queen]').focus()`. Tab/Shift+Tab cycle within the four buttons. Implement via `keydown` listener that calls `event.preventDefault()` and manually moves focus.
- **Selection**: on button click/Enter/digit key (1=Q, 2=R, 3=B, 4=N), complete the move via `chess.move({ from, to, promotion: choice })`, emit `move-made` with `promotion: choice`, dismiss dialog.
- **Cancel (Escape / tap-outside)**: call `ground.move(to, from)` snap-back visual, emit no event, return to IDLE, `returnFocusEl.focus()`.
- **Promotion tint**: after selection, set the destination square's warm-tint CSS class for `promotionTintMs` then remove it.
- **ARIA**: `role="dialog" aria-modal="true" aria-label="Promote pawn"`. Each button: `aria-label="Promote to queen"` etc. On open, fire assertive live region: `"Promote pawn — choose Queen, Rook, Bishop, or Knight"`.
- **Digit keys**: `keydown` on document (while dialog is open): `'1'`→queen, `'2'`→rook, `'3'`→bishop, `'4'`→knight.

---

## Out of Scope

*Handled by neighbouring stories:*

- [Story 002]: Basic drag/tap input and non-promotion `move-made` event
- [Story 005]: Keyboard navigation on the board itself (arrow keys, Enter on squares)
- [Story 006]: Visual feedback (check, last-move highlight) on other states

---

## QA Test Cases

*UI story — manual verification steps.*

- **AC-1**: Dialog appears within 300ms, Queen focused
  - Setup: Start a game. Manually maneuver a pawn to the 7th rank (set FEN directly in dev mode if needed). Move the pawn to the 8th rank via tap-tap.
  - Verify: A dialog with 4 piece buttons appears; Queen button has visible focus ring; dialog is anchored to the promotion file column.
  - Pass condition: Dialog visible within ~300ms of the pawn reaching the back rank; Queen button is focused (keyboard activation works).

- **AC-2**: Selection emits correct move-made
  - Setup: Open promotion dialog.
  - Verify: Click "Rook" button. Check browser console or test harness for 'move-made' event.
  - Pass condition: Event payload `{ ..., promotion: 'r' }`. Board shows rook on promotion square with a brief warm tint.

- **AC-3**: Cancel → snap-back, no event
  - Setup: Open promotion dialog.
  - Verify: Press Escape. Check that no 'move-made' fires and the pawn returns to its origin square.
  - Pass condition: Board shows pawn at origin (snap-back animation); no event in test harness.

- **AC-4**: Focus trap
  - Setup: Open promotion dialog. Focus is on Queen button.
  - Verify: Press Tab 4 times.
  - Pass condition: Focus cycles Queen → Rook → Bishop → Knight → Queen (no escape to background).

- **AC-5**: Screen reader announcement
  - Setup: Enable NVDA or macOS VoiceOver. Open promotion dialog.
  - Pass condition: Assertive region announces "Promote pawn — choose Queen, Rook, Bishop, or Knight" upon dialog open.

- **AC-6**: Touch target size
  - Setup: Open browser DevTools → Inspect each promotion button.
  - Pass condition: Computed `width` ≥ 56px, `height` ≥ 56px.

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- `production/qa/evidence/chess-board-promotion-evidence.md` — manual walkthrough doc with screenshots + sign-off

**Status**: [x] Created — `production/qa/evidence/chess-board-promotion-evidence.md` (manual sign-offs pending)

---

## Dependencies

- Depends on: Story 002 must be DONE (input flow emits move-made)
- Unlocks: None directly — promotion is a terminal flow within the input state machine

---

## Completion Notes
**Completed**: 2026-05-29
**Criteria**: 6 ACs — implementation complete; all ACs require manual browser verification (UI story)
**Deviations**: None
**Test Evidence**: UI: `production/qa/evidence/chess-board-promotion-evidence.md` — created, sign-offs pending manual test session
**Code Review**: Pending (to run before sprint close-out)
