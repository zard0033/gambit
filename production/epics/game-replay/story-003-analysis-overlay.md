# Story 003: Engine Analysis Overlay in Replay

> **Epic**: game-replay
> **Sprint**: S10-03 (Must Have)
> **Status**: Done (2026-06-02) — 退役 2026-06-22（`66e17ae`）：replay-analysis-overlay.vue／use-replay-analysis.ts 全刪，分析 overlay 併入 MemoryReplay
> **Layer**: Feature / Analysis
> **Type**: Integration with Existing Engine
> **Estimate**: M (6 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-02
> **TR**: pending /architecture-review
> **ADR**: ADR-0001, ADR-0004, ADR-0007

> **Completion note (2026-06-02)**: Real engine analysis wired (was a static stub before).
> `useReplayAnalysis` pre-analyses every position at depth-12 via the NNUE review engine
> (`useReviewEngine`), caches by FEN, and degrades gracefully on per-position failure (EC-04).
> Overlay renders eval bar (mate-aware) + depth + best move; best-move arrow drawn on the
> pgn-viewer board via `setAutoShapes`. Tests:
> `tests/integration/game-replay/analysis.test.ts` (5), `tests/unit/game-replay/replay-positions.test.ts` (6).
> AC-04 60fps under rapid stepping remains advisory (manual QA on device).

## Context

**Depends on**: S10-02 ReplayView (move navigation ready)
**Purpose**: Show evaluation bar + best move arrow for each position during replay
**Reuse**: review-engine (S4), move-annotation (S3)

---

## Acceptance Criteria

- [ ] **AC-01**: Each move in replay shows evaluation bar (filled rectangle, White's perspective)
- [ ] **AC-02**: Best move arrow renders on board for current position
- [ ] **AC-03**: Evaluation updates instantly when user steps to new move (no lag)
- [ ] **AC-04**: 60fps performance maintained during rapid stepping (no jank)
- [ ] **AC-05**: Mobile: eval bar visible below board; arrow not clipped
- [ ] **AC-06**: Depth indicator shows analysis depth (e.g., "depth 20")

---

## Implementation Plan

### Data Flow

1. User loads game in ReplayView
2. On mount: Pre-analyze all positions (one pass, depth-12 for speed)
3. On move change: Fetch pre-computed eval + arrows from cache
4. Render: eval bar + move-annotation.vue

### Reuse Components

- **move-annotation.vue** (S3): Render arrow overlay
- **review-engine** (S4): Stockfish eval computation
- **Formulas from GDD**: CP loss calculation (already defined)

### Optimization

- Memoize evals: `Map<FEN, Eval>` to avoid re-analysis
- Depth-12 for speed (full game < 30s pre-analysis)
- Show "analysing..." spinner during pre-analysis

---

## QA Test Cases

**Gate level**: BLOCKING — integration tests for eval formula + Stockfish bridge

GDD Formula: `fillRatio = (eval + 4) / 8` where `eval ∈ [-4, +4]`

- **Formula**: eval = 0 → fillRatio = 0.5; eval = 4 → 1.0; eval = -4 → 0.0; eval = 6 (over) → clamped 1.0; eval = -6 (under) → clamped 0.0
- **Pre-analysis**: 5-move game analyzed at `depthForSpeed = 12` without errors; completes < 30s
- **Eval reactivity**: Step move 1 → move 2 → assert eval bar `fillRatio` value changes
- **Arrow data**: Best move arrow component receives correct `from`/`to` square for current position

**Edge cases (GDD)**:
- EC-04: Stockfish error/timeout → eval bar hidden; board visible; no crash or stuck spinner
- EC-05: 100+ move game → eval updates without lag
- Depth indicator: "depth 12" string rendered for current position
- Position timeout (3s): that move shows blank eval, not crash

---

## Test Evidence

**Required**: Integration test `tests/integration/game-replay/analysis.test.ts` (≥4 tests)

---

## Notes

- Reuse FEN-to-eval caching pattern from PostGameReview (ADR-0005)
- Do NOT persist analysis to Supabase yet (Phase 2b feature)
