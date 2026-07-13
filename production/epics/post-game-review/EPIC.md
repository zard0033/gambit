# Epic: Post-Game Review

> **Layer**: Feature
> **GDD**: design/gdd/post-game-review.md
> **Architecture Module**: PostGameReview
> **Status**: Ready
> **Stories**: 5 stories created

## Stories

| # | Story | Type | Status | Primary ADR |
|---|-------|------|--------|-------------|
| 001 | [Two-Pass Analysis Loop](story-001-two-pass-analysis.md) | Logic | Ready | ADR-0007 |
| 002 | [cpLoss Formula and Depth-Comparability Guard](story-002-cploss-formula.md) | Logic | Ready | ADR-0007 |
| 003 | [biggestSwingCursor — Computed Once at COMPLETE](story-003-biggest-swing.md) | Logic | Ready | ADR-0007 |
| 004 | [sessionStorage Persistence — Throttled Writes, pv Stripped](story-004-sessionstorage.md) | Logic | Ready | ADR-0007 |
| 005 | [Mobile Calm Default — Viewport-Responsive Annotation Display](story-005-mobile-calm.md) | UI | Ready | ADR-0007 |

## Overview

Implements the `PostGameReview` module: the v0 flagship feature. Runs a two-pass Stockfish
analysis (Pass 1: preview depth-12, Pass 2: deep depth-16, bounded by
`REVIEW_TOTAL_TIME_BUDGET_MS = 12s` — retuned from depth-22/90s on 2026-06-25 for iPhone review-speed UX, see ADR-0007 status note), writes `analysisResults[]` progressively to a reactive
cursor-driven UI. Computes `biggestSwingCursor` (once at COMPLETE — never moves), uses F2
cpLoss formula (`max(0, E[i] + E[i+1])`), enforces the depth-comparability guard
(`|depth[i] - depth[i+1]| ≤ DEPTH_MISMATCH_TOLERANCE`), persists analysis to sessionStorage
(pv stripped, key `pgr:analysis:<gameId>`, throttled write), and applies mobile calm default
on viewports < 768px (best-move arrow only; no played-move arrow, no eval bar).
`AbortController` MUST be created with `markRaw()` — not `ref()` or `reactive()`.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0007: Post-Game Review Analysis Loop and sessionStorage Schema | Two-pass loop parameters; `REVIEW_TARGET_DEPTH` = 16（OQ-5 桌機已於 2026-05-30 確認 depth-22 可達，量產值 2026-06-25 為 iPhone 體驗獨立下調至 16，見 ADR-0007 status note）; 持久化後端已改 localStorage（2026-06-22 起，版本化＋30 局 FIFO 上限），size guard, quota fallback | HIGH |
| ADR-0005: Pinia Store Boundaries | `gameStore.completedGame` is the sole handoff from GameLifecycle — PostGameReview reads it on mount | LOW |
| ADR-0002: Web Worker Isolation | `reviewEngine.analyze()` API + `reviewEngine.init()` explicit call for loading state | HIGH |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-post-game-review-001 | Two-pass analysis: preview depth-12 → deep depth-22 | ADR-0007 ✅ |
| TR-post-game-review-002 | F2 cpLoss = max(0, E[i] + E[i+1]) — side-to-move convention | ADR-0007 ✅ |
| TR-post-game-review-003 | biggestSwingCursor: computed once at COMPLETE, never moves | ADR-0007 ✅ |
| TR-post-game-review-004 | Depth-comparability guard: \|depth[i] − depth[i+1]\| ≤ DEPTH_MISMATCH_TOLERANCE | ADR-0007 ✅ |
| TR-post-game-review-005 | sessionStorage persistence: pv stripped, key pgr:analysis:<gameId>, throttled write | ADR-0007 ✅ |
| TR-post-game-review-006 | Mobile calm default: best-move arrow only; no played-move arrow, no eval bar (<768px) | ADR-0007 ✅ |
| TR-post-game-review-007 | REVIEW_TOTAL_TIME_BUDGET_MS = 12s hard ceiling on Pass 2（2026-06-25 由 90s 下調，見 ADR-0007 status note） | ADR-0007 ✅ |

**Untraced Requirements**: None — 7/7 covered by ADR-0007.

> ⚠️ **Advisory (updated 2026-06-25)**: ADR-0007 OQ-5 桌機 spike 已確認 `REVIEW_TARGET_DEPTH = 22`
> 可達（2026-05-30）；真正待補的是 real-iPhone depth/memory measurement（見 ADR-0007 open items）。
> 獨立於可達性，量產 Pass 2 深度已於 2026-06-25 為 iPhone 體驗調速下調 22→16
> （`REVIEW_TOTAL_TIME_BUDGET_MS` 90s→12s），見 ADR-0007 status note 完整理由。
> （原文交叉引用的「ADR-0008」為誤植——ADR-0008 主題是 CSP headers/WASM 部署，與此 spike 無關。）

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/post-game-review.md` are verified
- Logic stories (F2 formula, depth-comparability guard, biggestSwingCursor, sessionStorage throttle) have passing unit tests in `tests/unit/post-game-review/`
- Integration story (full two-pass analysis round-trip) has passing integration test
- Visual/Feel story (progressive disclosure UI, mobile calm) has screenshot evidence in `production/qa/evidence/`
- `markRaw(new AbortController())` constraint verified by tsc (not `ref()` or `reactive()`)

## Next Step

Run `/create-stories post-game-review` to break this epic into implementable stories.
