# Epic: Chess Board & Move System

> **Layer**: Foundation
> **GDD**: design/gdd/chess-board-and-move-system.md
> **Architecture Module**: ChessBoard
> **Status**: Shipped
> **Stories**: 7 stories created

## Stories

| # | Story | Type | Status | Primary ADR |
|---|-------|------|--------|-------------|
| 001 | [FEN Rendering and Position Sync](story-001-fen-rendering.md) | Logic | Complete | ADR-0009 |
| 002 | [Dual Input — Drag-and-Drop, Tap-Tap, move-made Event](story-002-input.md) | Logic | Complete | ADR-0009 |
| 003 | [Promotion Dialog — Deliberate Selection Only](story-003-promotion.md) | UI | Complete | ADR-0009 |
| 004 | [squareToRect() Geometry Contract](story-004-square-to-rect.md) | Logic | Complete | ADR-0009 |
| 005 | [Keyboard Navigation — useBoardKeyboard Composable](story-005-keyboard-nav.md) | Logic | Complete | ADR-0009 |
| 006 | [Visual Feedback — Check Indicator, Last-Move Highlight, Reduced Motion](story-006-visual-feedback.md) | Visual/Feel | Complete | ADR-0009 |
| 007 | [Bundle Size and Performance Budget Verification](story-007-bundle-size.md) | Config/Data | Ready | ADR-0009 |

## Overview

Implements the `ChessBoard.vue` component — the visual and interactive chess board that
wraps `vue3-chessboard` (which wraps chessground 9.x). Owns board rendering from a FEN
string, dual input (drag + tap-tap), the `move-made` event with `animationDoneAt: Promise<void>`,
the `squareToRect()` geometry contract, the promotion dialog, legal-move selection overlays via
chessground `drawable.shapes`, and the custom `useBoardKeyboard` roving-tabindex composable that
provides WCAG 2.1 AA keyboard navigation (chessground 9.x has none built-in).

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0009: Chess Board Substrate, vue3-chessboard Integration, Keyboard Model | `ChessBoard.vue` wraps vue3-chessboard; `useBoardKeyboard` composable for keyboard nav; `drawable.shapes` for selection overlays; `squareToRect()` returns viewport-relative coords | MEDIUM |
| ADR-0006: Move Annotation Rendering Substrate | Custom SVG overlay consumes `boardRef` + `squareToRect()` from this module — locks the coordinate contract | MEDIUM |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-chess-board-001 | Render FEN string to board within 100ms of mount | ADR-0009 ✅ |
| TR-chess-board-002 | Dual input: drag-drop + tap-tap, both always active | ADR-0009 ✅ |
| TR-chess-board-003 | Promotion dialog: deliberate selection only (no auto-queen) | ADR-0009 ✅ |
| TR-chess-board-004 | squareToRect(): orientation-aware pixel geometry for overlay | ADR-0009 ✅ |
| TR-chess-board-005 | WCAG 2.1 AA keyboard nav (custom roving tabindex) | ADR-0009 ✅ |
| TR-chess-board-006 | 60fps budget: transform + opacity only (no layout/paint animations) | ADR-0009 ✅ |
| TR-chess-board-007 | Bundle ≤ 120 KB gzipped (board + chess.js + piece SVGs) | ADR-0009 ✅ |

**Untraced Requirements**: None — 7/7 covered by ADR-0009.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/chess-board-and-move-system.md` are verified
- Logic stories (state machine, squareToRect, animationDoneAt) have passing unit tests in `tests/unit/chess-board/`
- Visual/Feel stories (keyboard nav, promotion dialog) have evidence docs in `production/qa/evidence/`
- Bundle size verified ≤ 120 KB gzipped

## Next Step

Epic 已 Shipped，7 個 story 皆已建立並實作，無需再跑 /create-stories。
