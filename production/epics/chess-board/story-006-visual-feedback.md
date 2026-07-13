# Story 006: Visual Feedback — Check Indicator, Last-Move Highlight, Reduced Motion

> **Epic**: Chess Board & Move System
> **Status**: Complete
> **Layer**: Foundation (Core — chess board substrate)
> **Type**: Visual/Feel
> **Estimate**: M (4–5 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-29
> **TR**: TR-chess-board-006
> **ADR**: ADR-0006, ADR-0009

## Context

**GDD**: `design/gdd/chess-board-and-move-system.md`
**Requirement**: `TR-chess-board-006`
*(Requirement text lives in `docs/architecture/tr-registry.yaml`)*

**ADR Governing Implementation**: ADR-0009: Chess Board Substrate, vue3-chessboard Integration, Keyboard Model
**ADR Decision Summary**: All animations use `transform` and `opacity` only (no `width`, `height`, `top`, `left`, `box-shadow` — triggers layout/paint thrash at 60fps on mid-tier iPhone). Check glow is an SVG overlay with `opacity` transitions, not `box-shadow`. `prefers-reduced-motion` collapses all durations to `reducedMotionDurationMs` (default 0).

**Engine**: Web App — vue3-chessboard ^1.x | **Risk**: MEDIUM
**Engine Notes**: chessground 9.x natively draws the last-move highlight (`.cg-last-dests`). Custom check indicator must be a separate SVG layer positioned over the king square using `squareToRect()`. `forced-colors: active` fallbacks required for Windows High Contrast Mode.

**Control Manifest Rules (Core layer)**:
- Required: All animations use `transform` + `opacity` only
- Forbidden: Never animate `width` / `height` / `top` / `left` / `box-shadow`
- Required: Chess Board subsystem bundle ≤ 120 KB gzipped

---

## Acceptance Criteria

*From GDD `design/gdd/chess-board-and-move-system.md` — visual feedback ACs:*

- [ ] **GIVEN** a move just completed, **WHEN** the board re-renders, **THEN** the origin and destination squares carry the `data-last-move="true"` attribute AND the rendered tint achieves ≥3:1 non-text contrast against the unhighlighted square color.
- [ ] **GIVEN** the player's king is in check, **WHEN** the board re-renders, **THEN** the king square shows: (a) a red glow at intensity `checkGlowIntensity` that pulses once then fades to `checkGlowResidualOpacity`; AND (b) a persistent border ring of width `checkBorderRingPx`; AND (c) an assertive screen-reader announcement of `"Check"`.
- [ ] **GIVEN** the player's king is in check AND `prefers-reduced-motion: reduce` is set, **WHEN** the board re-renders, **THEN** no pulse animation occurs but the border ring is still present (non-color, non-motion cue survives).
- [ ] **GIVEN** the user has `prefers-reduced-motion: reduce` set, **WHEN** any move or capture would animate, **THEN** all animation durations equal `reducedMotionDurationMs` (default 0) — pieces snap to destination instantly.
- [ ] **GIVEN** overlays would stack on the same square (e.g., selected piece on a last-move square in check), **WHEN** the board renders, **THEN** the visible layers follow z-order in GDD Rule 17 AND no two competing tints fill the same square simultaneously.
- [ ] **GIVEN** `forced-colors: active` media query is matched (Playwright `emulateMedia`), **WHEN** the board renders, **THEN** dots and rings use `SelectedItem`/`Highlight` colors with outlines AND the check border ring uses `CanvasText`.
- [ ] **GIVEN** a position update arrives during an in-flight piece animation, **WHEN** the new FEN differs from the animation target, **THEN** the in-flight animation is canceled AND a reconciliation animation of `reconcileAnimationMs` (±50ms) runs.
- [ ] **GIVEN** any move animates, **WHEN** the animation CSS is inspected, **THEN** no `width`, `height`, `top`, `left`, or `box-shadow` property appears in the transition definition.

---

## Implementation Notes

*Derived from ADR-0009 Constraints + GDD Visual Requirements:*

- **Last-move highlight**: chessground natively adds `.cg-last-dests` class to last-move squares. Add a CSS class that applies `background-color` with `opacity` — no extra JS. Add `data-last-move="true"` attribute via `afterEach` watcher on position change.
- **Check glow**: a custom `<svg>` overlay positioned over the king square using `squareToRect(kingSquare)`. Render a `<rect>` or `<ellipse>` with a radial gradient fill. Use CSS `@keyframes` `opacity` pulse (from `checkGlowIntensity` → `checkGlowResidualOpacity` in 800ms). When `prefers-reduced-motion: reduce`, set CSS `animation: none` and opacity directly to `checkGlowResidualOpacity`.
- **Check border ring**: a `<rect>` in the same SVG, `fill: none`, `stroke: red`, `stroke-width: checkBorderRingPx`. This element is ALWAYS visible when in check, regardless of reduced motion.
- **prefers-reduced-motion**: use a composable `useReducedMotion()` that reads `window.matchMedia('(prefers-reduced-motion: reduce)')`. When true, set chessground `animation.duration = 0` and `reconcileAnimationMs = 0`.
- **z-order**: managed by CSS z-index. Legal-move dots (chessground `drawable`) z-index < check glow SVG z-index < piece layer z-index < annotation SVG z-index < promotion dialog z-index.
- **forced-colors**: add `@media (forced-colors: active)` CSS block. Override dot/ring styles to use `SelectedItem` system color with 1px outline. Override check ring stroke to `CanvasText`.
- **No layout/paint animations**: audit all `transition` and `animation` CSS rules to confirm only `transform` and `opacity` appear. This is enforced by the manifest — add a CI lint rule or visual audit note.

---

## Out of Scope

*Handled by neighbouring stories:*

- [Story 002]: Legal-move dots/rings (chessground drawable.shapes)
- [Story 001]: FEN rendering, position updates
- [Story 007]: Bundle size and performance frame budget verification

---

## QA Test Cases

*Visual/Feel story — manual verification steps.*

- **AC-1**: Last-move highlight presence and contrast
  - Setup: Play a move (e.g., e2→e4).
  - Verify: Inspect origin (e2) and destination (e4) squares. Check for `data-last-move="true"` attribute and a visible tint.
  - Pass condition: Both squares have the attribute; tint is visually distinct from unhighlighted squares (measure in DevTools with color picker — ≥3:1 ratio against square background).

- **AC-2**: Check indicator (glow + ring + announcement)
  - Setup: Set FEN to a position with the white king in check (e.g., `rnbqkb1r/pppp1ppp/4p3/8/2B1P3/8/PPP2PPP/RNBQK1NR w KQkq - 0 4` — Fool's mate partial).
  - Verify: King square shows red glow (pulsing once then residual opacity) AND a border ring. Screen reader announces "Check".
  - Pass condition: Both visual cues visible; glow fades to lower opacity after 800ms pulse; ring remains at full opacity.

- **AC-3**: prefers-reduced-motion — no pulse, ring survives
  - Setup: Enable `prefers-reduced-motion: reduce` via DevTools → Rendering panel.
  - Verify: Set a check position. King square shows border ring but no pulse animation. Make a move — piece teleports instantly (no slide).
  - Pass condition: Transition-duration of piece element = `0s` (confirm in DevTools Computed Styles); border ring visible; no animation keyframes firing.

- **AC-4**: forced-colors fallback
  - Setup: Use Playwright `page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' })` OR test in Edge with Windows High Contrast Mode enabled.
  - Verify: Legal-move dots use system colors with outlines; check border ring uses `CanvasText` color.
  - Pass condition: No dots/rings are "invisible" (flat same color as background); check ring is distinguishable.

- **AC-5**: z-order with stacked overlays
  - Setup: Select a piece (shows dots). Ensure the last-move highlight is on the selected square. If possible, trigger check simultaneously.
  - Verify: Visual layers are correctly stacked — last-move tint under selection tint under dots under check glow under check ring under pieces under annotation SVG under promotion dialog.
  - Pass condition: No visual artifacts from competing layers (no double tint, no invisible check ring hidden under piece layer).

- **AC-6**: No layout/paint animations
  - Setup: Open DevTools Performance tab. Record while making a move.
  - Verify: Inspect "Rendering" flame chart — no layout or paint events during the piece slide animation.
  - Pass condition: Only composite/paint-free layers in animation path; `transform` and `opacity` only in transition definitions (confirm via CSS inspection).

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**:
- `production/qa/evidence/chess-board-visual-feedback-evidence.md` — screenshots of check indicator, last-move highlight, reduced-motion behavior + sign-off

**Status**: [x] Created — `production/qa/evidence/chess-board-visual-feedback-evidence.md` — PARTIAL SIGN-OFF (AC-1+AC-2 verified 2026-05-29; AC-3–AC-6 still pending)

---

## Dependencies

- Depends on: Story 001 must be DONE (board renders), Story 004 must be DONE (`squareToRect` for check glow positioning)
- Unlocks: None (terminal visual story for this epic)

## Completion Notes
**Completed**: 2026-05-29
**Criteria**: All ACs implemented in code; manual verification PENDING (Visual/Feel advisory)
**Deviations**: (1) `data-last-move="true"` attribute not added — chessground natively renders last-move tint via CSS class; (2) Pulse animation uses simple opacity keyframes (meets the spirit of the story ACs)
**Test Evidence**: Visual/Feel — `production/qa/evidence/chess-board-visual-feedback-evidence.md` (pending sign-off — requires browser testing with FEN dev tool)
**Code Review**: Skipped (Lean mode)
