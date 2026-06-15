# Story 002: useLessonProgressStore

> **Epic**: lesson-system
> **Sprint**: S12-02 (Must Have)
> **Status**: Backlog
> **Layer**: Feature / Logic
> **Type**: Pinia Store + localStorage
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-01
> **TR**: TR-lesson-system-002, TR-lesson-system-003, TR-lesson-system-008
> **ADR**: ADR-0004, ADR-0009, ADR-0012

## Context

**Depends on**: S12-01 (lesson catalog available)
**Purpose**: Track completed lessons, persist to localStorage, and compute unlock state + curriculum progress.

---

## Acceptance Criteria

- [ ] **AC-01**: Store loads `{ completed: string[] }` from `pgr:lessons:progress`; corrupt/missing data → empty, no throw (GDD AC-09, EC-06).
- [ ] **AC-02**: `markComplete(id)` adds the id (idempotent) and persists.
- [ ] **AC-03**: `isUnlocked(lesson)` implements the GDD predicate: `order===1` OR previous lesson's id completed (GDD AC-02, AC-03).
- [ ] **AC-04**: `progress` getter = `completedCount / totalLessons` (GDD AC-04).
- [ ] **AC-05**: `isComplete(id)` reflects completion state.

## Implementation Plan

```typescript
// src/stores/lesson-progress.ts
const STORAGE_KEY = 'pgr:lessons:progress'
// state: completed: string[]
// actions: load(), markComplete(id)
// getters: isComplete(id), isUnlocked(lesson), progress
```

- Reuse the `pgr:` localStorage convention (see Game Replay rating).
- Unlock predicate reads the catalog (S12-01) to find the previous `order`.

## Test Evidence

**Required**: `tests/unit/stores/lesson-progress.test.ts` (≥6 tests)
- corrupt data → empty
- markComplete idempotent + persists
- isUnlocked: first unlocked, gated chain, all-complete
- progress formula at 0 / partial / full

## Notes

- BLOCKING test gate (Logic story). Pure logic; inject/clear localStorage per test.
