# Story 001: Lesson Types + Static Data Loader

> **Epic**: lesson-system
> **Sprint**: S12-01 (Must Have)
> **Status**: Backlog
> **Layer**: Feature / Logic
> **Type**: Types + Data Loader
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-01
> **TR**: TR-lesson-system-001
> **ADR**: ADR-0004, ADR-0009, ADR-0012

## Context

**Depends on**: — (foundational for the epic)
**Purpose**: Define the `Lesson` / `LessonStep` types and a loader that exposes the static lesson catalog sorted by `order`.

---

## Acceptance Criteria

- [ ] **AC-01**: `src/types/lesson.ts` defines `Lesson` and `LessonStep` per the GDD schema appendix.
- [ ] **AC-02**: `src/data/lessons/index.ts` exports the catalog as a readonly array sorted by `order`.
- [ ] **AC-03**: A `getLessonById(id)` helper returns the lesson or `undefined`.
- [ ] **AC-04**: Catalog has no duplicate `id` and no duplicate `order` (enforced by a unit test).

## Implementation Plan

- Types match GDD appendix (`LessonStep`, `Lesson`).
- `src/data/lessons/` holds one file per lesson + an `index.ts` aggregator.
- Loader sorts by `order` and exposes `lessons` + `getLessonById`.

## Test Evidence

**Required**: `tests/unit/data/lessons.test.ts` — unique ids/orders, sorted order, getLessonById hit/miss.

## Notes

- Static data only; no backend, no fetch. Covers GDD AC-01 data side.
- **Deviation (2026-06-02)**: lessons are grouped **one file per tier** (`rules.ts`, etc.) instead of one file per lesson — cleaner for ~19 small lessons. `index.ts` aggregates the per-tier arrays.
- **Scope expansion (2026-06-02)**: GDD revised to a 4-tier 淺→深 curriculum (rules/tactics/opening/endgame, ~19 lessons; v1 = tiers 1–2). Type gained `tier` + `LESSON_TIERS`/`LESSON_TIER_LABELS`; `category`收斂為 `rules|tactics|opening-principles|endgame`.
- **Content gate**: `lessons.test.ts` now validates every step FEN + interactive `expectedMove` via chess.js, and side-to-move = playerColor — protects all future authored lessons.
- Delivered so far: Tier 1 (7 課) + opening seed `control-the-center`. Tier 2 (tactics) next.
