# Story 005: Author Opening-Principles Lessons

> **Epic**: lesson-system
> **Sprint**: S12-05 (Must Have)
> **Status**: Backlog
> **Layer**: Feature / Config-Data
> **Type**: Content Authoring
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-01
> **TR**: TR-lesson-system-001
> **ADR**: ADR-0004, ADR-0009, ADR-0012

## Context

**Depends on**: S12-01 (lesson schema)
**Purpose**: Hand-author 3–4 beginner opening-principles concept lessons as static data. This is the content critical path called out in the epic.

---

## Acceptance Criteria

- [ ] **AC-01**: 3–4 lessons authored in `src/data/lessons/`, each conforming to the `Lesson` type.
- [ ] **AC-02**: Lessons cover opening principles (e.g., control the center, develop knights/bishops, castle early), one concept per lesson.
- [ ] **AC-03**: Each lesson has a mix of narration and ≥1 interactive step; every `expectedMove` is legal from its step `fen` (verified by a data test using chess.js).
- [ ] **AC-04**: `order` values are sequential starting at 1; ids are unique.
- [ ] **AC-05**: Coach text uses no judgment language toward the player (consistent with the project's neutral-tone convention); it explains the concept.

## Implementation Plan

- One file per lesson under `src/data/lessons/`, aggregated by `index.ts` (S12-01).
- Suggested set:
  1. `control-the-center` — push e4/d4, why the center matters
  2. `develop-your-pieces` — knights before bishops, don't move the same piece twice
  3. `king-safety-castling` — castle early, why
  4. (optional) `dont-bring-queen-out-early`
- Each interactive step's `expectedMove` must be legal from its FEN.

## Test Evidence

**Required (Config/Data)**: data-validation test in `tests/unit/data/lessons.test.ts` — every `expectedMove` is a legal move from its step `fen` (chess.js), all `fen` strings parse.

## Notes

- Content quality matters more than quantity; keep each lesson ≤6 steps (GDD tuning knob default).
