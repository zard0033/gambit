# Epic: Visual Identity & Board Theme

> **Layer**: Presentation
> **GDD**: `design/gdd/visual-identity.md` *(not yet authored — see below)*
> **Architecture Module**: BoardTheme
> **Status**: Backlog
> **Stories**: 1 story

## Stories

| # | Story | Type | Status | Primary ADR |
|---|-------|------|--------|-------------|
| 001 | [Board Theme — Custom Piece Set & Board Colors](story-001-board-theme.md) | Visual/Feel | Complete | ADR-0009 |

## Overview

Replaces the default lichess/cburnett visual identity with the project's own style.
Covers two dimensions:

1. **Piece SVGs** — custom sprite sheet replacing the built-in cburnett set.
   chessground's `pieceSet` option (or CSS `--piece-images-url`) points to the new assets.
2. **Board colors** — light/dark square tones, border, and coordinate label colors
   controlled via CSS custom properties (`.cg-board`, `.cg-wrap`).

This is a Presentation-layer concern — no gameplay logic changes. Can be implemented
any time after the `chess-board` epic Foundation work is complete.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0009: Chess Board Substrate | chessground exposes `config.movable`, `config.drawable`, and CSS `--piece-images-url` for customization; board colors override `.cg-board` | LOW |

## GDD Status

No formal GDD exists yet. The story acceptance criteria serve as the design spec.
To create a full GDD before implementation, run:
`/quick-design "visual identity — custom piece set and board colors for Chess Training Companion"`

## Definition of Done

- Custom piece SVG sprite committed to `src/assets/pieces/`
- Board colors match the chosen palette (Nippon Colors 和茶系 by default)
- All pieces visible and correctly oriented on both White and Black sides
- No regression on `tests/unit/chess-board/` suite
- Evidence doc at `production/qa/evidence/board-theme-evidence.md` with screenshots

## Notes

- Eason wants to express his own visual style — don't just restyle cburnett,
  design a coherent piece set from scratch or source a set under an open license.
- The Nippon Colors 和茶系 palette is the approved starting point for board colors
  (established in `game-concept.md` Visual Identity Anchor section).
- Dark mode is explicitly deferred to Phase 2 (no dark theme in v0).
