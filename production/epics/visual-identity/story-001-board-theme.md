# Story 001: Board Theme — Custom Piece Set & Board Colors

> **Epic**: Visual Identity & Board Theme
> **Status**: Complete
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Estimate**: M (4–6 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-29
> **TR**: TR-visual-identity-001, TR-visual-identity-002
> **ADR**: ADR-0009

## Context

**GDD**: `design/gdd/visual-identity.md` *(not yet authored — ACs below are the working spec)*
**Requirements**: `TR-visual-identity-001`, `TR-visual-identity-002`

**ADR Governing Implementation**: ADR-0009: Chess Board Substrate, vue3-chessboard Integration, Keyboard Model
**ADR Decision Summary**: chessground exposes `--piece-images-url` CSS custom property for piece set swapping, and `.cg-board` / `.cg-wrap` selectors for board color overrides. No changes to gameplay logic required.

**Engine Notes**: chessground 9.x supports piece set replacement via CSS. The canonical approach is:
- Set `--piece-images-url` on `.cg-wrap` to point to a sprite directory or individual SVG URLs.
- Override `.cg-board` background gradient for square colors.
- Piece files follow the naming convention: `{color}{PieceType}.svg` — e.g., `wK.svg`, `bP.svg` (12 files total).

**Control Manifest Rules (Presentation layer)**:
- Required: All visual assets committed to `src/assets/pieces/` (not external CDN)
- Required: Piece SVGs optimized (no embedded raster images, no large transforms)
- Required: Board color palette sourced from Nippon Colors 和茶系 (per `game-concept.md`)
- Forbidden: Dark mode (deferred to Phase 2)
- Forbidden: Any change to chess logic, move validation, or engine integration

---

## Acceptance Criteria

- [ ] 12 custom piece SVG files exist in `src/assets/pieces/` following chessground naming convention (`wK`, `wQ`, `wR`, `wB`, `wN`, `wP`, `bK`, `bQ`, `bR`, `bB`, `bN`, `bP`).
- [ ] chessground renders the custom pieces — not the default cburnett set — on both White and Black sides.
- [ ] Light and dark board squares use colors from the Nippon Colors 和茶系 palette; the combination meets WCAG 3:1 non-text contrast between light and dark squares.
- [ ] The board border and coordinate labels (if visible) are styled consistently with the palette.
- [ ] All existing unit tests in `tests/unit/chess-board/` continue to pass (no regression).
- [ ] The board is visually reviewed at 375px (iPhone SE) and 1440px (desktop) widths — pieces are clearly distinguishable at both sizes.
- [ ] Evidence doc at `production/qa/evidence/board-theme-evidence.md` with screenshots showing custom pieces + board colors on mobile and desktop.

---

## Implementation Notes

### Piece Set
1. Source or design 12 SVG files (wK, wQ, wR, wB, wN, wP, bK, bQ, bR, bB, bN, bP).
   - Option A: Design from scratch inspired by a clean, minimal style.
   - Option B: Use an open-license set (e.g., "Anarcandy", "Tatiana", "Shapes") from lichess piece sets repository (`lichess-org/lila/public/piece/`), then customize colors.
   - **Recommended**: Start with a clean open-license SVG set, recolor to match the 和茶系 palette (earthy tones — light pieces warm cream/sand, dark pieces deep charcoal/umber).
2. Place files in `src/assets/pieces/`.
3. In `src/components/chess-board.vue` (or global CSS), set:
   ```css
   .cg-wrap {
     --piece-images-url: url('/pieces/{piece}.svg');
   }
   ```
   Or configure via chessground's `config` object if the `boardTheme` / `pieceSet` prop is available in vue3-chessboard ^1.x.

### Board Colors
Override chessground CSS in `src/assets/main.css` or a dedicated `board-theme.css`:
```css
/* 和茶系 palette — adjust hex values to match chosen shades */
cg-board square.light { background: #e8dcc8; }   /* warm cream */
cg-board square.dark  { background: #8b6f5c; }   /* warm umber */
```
Check vue3-chessboard / chessground 9.x for the exact selector pattern before implementing.

### Vite Asset Handling
If piece SVGs are referenced via `url()` in CSS, Vite handles them automatically when placed in `src/assets/`. If referenced from `public/`, use root-relative paths (`/pieces/wK.svg`).

---

## Out of Scope

- Dark mode (deferred to Phase 2)
- Animated piece transitions (governed by TR-chess-board-006, already in story-006)
- Board sound effects
- Custom board borders or decorative frames beyond color
- Move arrow or highlight colors (covered by move-annotation epic)

---

## Dependencies

- Depends on: S2-01 chess-board FEN Rendering (must be complete so the board renders correctly before theming)
- No blocker on engine, routing, or lifecycle systems

---

## QA Test Cases

- **Visual review — mobile**: Launch app on 375px viewport (or DevTools iPhone SE preset). Confirm all 12 piece types visible, correctly colored, not clipped.
- **Visual review — desktop**: Launch at 1440px. Same check.
- **Contrast check**: Use browser DevTools accessibility inspector or [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) to verify ≥3:1 contrast between light and dark squares.
- **Regression**: Run `npx vitest run tests/unit/chess-board/` — all tests must pass.

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**: `production/qa/evidence/board-theme-evidence.md`
- Screenshot: custom pieces on HomeView board at 375px
- Screenshot: custom pieces on HomeView board at 1440px
- Contrast ratio: light vs dark square measurement
- Sign-off table (solo dev signs all roles)

**Status**: [x] Created — `production/qa/evidence/board-theme-evidence.md` (2026-05-30), all sign-offs complete (APPROVED)

---

## Suggested Sprint

Sprint 3 (after Foundation layer complete) — this story has no dependency on engine or game lifecycle, only on the chess board being renderable (S2-01 done ✅).
