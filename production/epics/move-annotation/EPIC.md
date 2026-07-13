# Epic: Move Annotation Display

> **Layer**: Core
> **GDD**: design/gdd/move-annotation-display.md
> **Architecture Module**: MoveAnnotationDisplay
> **Status**: Shipped (S3) — story-001 & story-002 Complete（見 production/epics/index.md）
> **Stories**: 2 stories created

## Stories

| # | Story | Type | Status | Primary ADR |
|---|-------|------|--------|-------------|
| 001 | [Custom SVG Overlay — Arrows, Highlights, and Eval Bar](story-001-svg-overlay.md) | Logic | Complete | ADR-0006 |
| 002 | [rAF-Coalesced Resize Throttle](story-002-resize-throttle.md) | Logic | Complete | ADR-0006 |

## Overview

Implements the `MoveAnnotationDisplay` component: a `pointer-events: none` SVG overlay
positioned absolutely over the ChessBoard, rendering arrows and square highlights from a
declarative `annotations: Annotation[]` prop. Also renders the evaluation bar (Formula 1
`fillRatio` + sign normalization to White's perspective) and eval badge (Formula 3). Uses
`boardRef` + `squareToRect()` from ChessBoard as the sole geometry source — never computes
its own square coordinates. rAF-coalesced resize throttle (Formula 4) keeps the overlay
pixel-accurate without layout thrashing. Neutral role semantics are structurally enforced:
no emotive labels (`quality`, `blunder`, `brilliant`, etc.) in the `Annotation.role` type.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0006: Move Annotation Rendering Substrate | Custom `pointer-events:none` SVG overlay (chessground `drawable` FAILS — arrowhead tip 0.34px off-center at 352px board confirmed by spike); per-shape brushes PASS | MEDIUM |
| ADR-0009: Chess Board Substrate (squareToRect contract) | `squareToRect()` returns viewport-relative coords (not board-local) — MoveAnnotationDisplay must use the same origin when positioning its SVG | MEDIUM |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-move-annotation-001 | Declarative annotations prop — no imperative add-arrow API | ADR-0006 ✅ |
| TR-move-annotation-002 | SVG overlay positioned via boardRef + squareToRect (no own geometry) | ADR-0006 ✅ |
| TR-move-annotation-003 | Neutral role semantics — no emotive labels anywhere in rendering | ADR-0006 ✅ |
| TR-move-annotation-004 | Eval bar: Formula 1 fillRatio + sign normalisation to White's perspective | ADR-0006 ✅ |
| TR-move-annotation-005 | rAF-coalesced resize throttle (Formula 4) | ADR-0006 ✅ |

**Untraced Requirements**: None — 5/5 covered by ADR-0006.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/move-annotation-display.md` are verified
- Logic stories (Formula 1 fillRatio, sign normalization, Formula 3 badge, Formula 4 throttle) have passing unit tests in `tests/unit/move-annotation/`
- Visual story (arrow rendering, overlay positioning) has screenshot evidence + lead sign-off in `production/qa/evidence/`
- `pointer-events: none` enforced — verified by Playwright interaction test (clicks pass through)

## Next Step

Run `/create-stories move-annotation` to break this epic into implementable stories.
