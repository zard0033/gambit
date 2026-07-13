# Epic: Game Replay

> **Layer**: Feature (Phase 2)
> **GDD**: design/gdd/game-replay.md (pending design-review)
> **Architecture Module**: ReplayView (Vue component) + review-engine integration
> **Status**: Shipped（S10 — QA APPROVED 2026-06-02；story-001~004 Done、story-005 動畫 polish deferred、story-006 非規劃內引擎遷移 Done）——2026-06-22 已退役（`66e17ae`）：ReplayView 全鏈刪除，回放功能併入 MemoryView（見 memory epic）
> **Stories**: story-001 through story-006 (S10；story-006 為 S10-03 瀏覽器 QA 期間浮現的非規劃內故事)

## Overview

Implements the first Phase 2 feature: move-by-move replay of saved games with live engine analysis overlay. Players can revisit completed games, step through moves, see what the engine thinks of each position, and rate/annotate games for personal learning tracking.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0001: Engine Performance | Stockfish NNUE enabled; depth-12 for pre-analysis in replay | LOW |
| ADR-0003: Opening ID | openingResult.eco available; reuse for opening header | LOW |
| ADR-0005: State Management | useGameHistoryStore already owns game data; ReplayView reads it | LOW |

**No new ADR required** — replay uses existing engine, state, and opening systems.

## GDD Requirements (from design/gdd/game-replay.md)

| TR-ID | Requirement | ADR Coverage |
|-------|------------|-------------|
| GR-01 | Move-by-move stepping through full game | ADR-0001 (engine), ADR-0005 (state) |
| GR-02 | Evaluation bar shows position strength | ADR-0001 (eval formula) |
| GR-03 | Best move arrow on board | ADR-0001 (move calc) |
| GR-04 | Game rating/notes (localStorage) | ADR-0005 (Pinia pattern) |

## Definition of Done

This epic is complete when:

1. **S10-01 ✅ pgn-viewer wrapper**: PgnViewer.vue renders PGN strings, emits move selections
2. **S10-02 ✅ ReplayView UI**: Full replay view with navigation, move stepping, history integration
3. **S10-03 ✅ Analysis overlay**: Evaluation bar + best move arrow integrated and performant
4. **S10-04 ✅ Game rating**: Star rating + notes with localStorage persistence
5. **S10-05 ✅ Animation polish**: Smooth transitions between moves
6. **All tests pass**: 40+ unit + integration tests
7. **QA sign-off**: APPROVED (no critical issues)
8. **Design review passed** (GDD → APPROVED status)

## Phase 2 Roadmap

**Phase 2a (S10)**: Game Replay MVP — step through moves, see analysis ✓ (this epic)
**Phase 2b (S11)**: AI Explanations — Claude API generates move commentary
**Phase 2c (S12)**: Lesson System (alternative path if chosen instead of Phase 2b)

## Success Metrics

- Users can navigate from History → Replay seamlessly
- Replay view handles 50+ move games without performance degradation
- Rating/notes feature has >50% usage rate (post-launch tracking)
- No mobile-specific bugs reported (iOS Safari tested)
