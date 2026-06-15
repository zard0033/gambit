# Story 003: LessonsView (Catalog)

> **Epic**: lesson-system
> **Sprint**: S12-03 (Must Have)
> **Status**: Backlog
> **Layer**: Feature / UI
> **Type**: View Component + Route
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-01
> **TR**: TR-lesson-system-001, TR-lesson-system-002, TR-lesson-system-003, TR-lesson-system-009
> **ADR**: ADR-0004, ADR-0009, ADR-0012

## Context

**Depends on**: S12-01 (catalog), S12-02 (progress store)
**Purpose**: The `/learn` lesson list — shows each lesson with completion/lock state and overall progress.

---

## Acceptance Criteria

- [ ] **AC-01**: Route `/learn` (lazy-loaded, not auth-required) renders the catalog (GDD AC-01).
- [ ] **AC-02**: Each row shows title, difficulty, and completion state (done / available / locked).
- [ ] **AC-03**: Locked lessons show a lock badge and are not clickable; first lesson always unlocked (GDD AC-02).
- [ ] **AC-04**: A curriculum progress indicator shows `completed/total` (GDD AC-04).
- [ ] **AC-05**: Clicking an unlocked lesson navigates to `/learn/:lessonId`.
- [ ] **AC-06**: Mobile responsive; touch targets ≥44×44px (GDD AC-11).

## Implementation Plan

```
LessonsView
├── Header (title + progress indicator)
└── Lesson list
    └── LessonCard (title, difficulty, state badge, lock/done icon)
```

- Add route in `src/router/index.ts` following existing lazy-load pattern.
- Read unlock/complete state from useLessonProgressStore.

## Test Evidence

**Required (ADVISORY — UI)**: manual walkthrough doc in `production/qa/evidence/`, or an interaction test asserting lock-gating and navigation.

## Notes

- Reuse Tailwind conventions from HistoryView rows.
