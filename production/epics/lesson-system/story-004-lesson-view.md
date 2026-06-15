# Story 004: LessonView (Coach Player)

> **Epic**: lesson-system
> **Sprint**: S12-04 (Must Have)
> **Status**: Backlog
> **Layer**: Feature / Integration
> **Type**: View Component + Move Validation
> **Estimate**: L (8 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-01
> **TR**: TR-lesson-system-004, TR-lesson-system-005, TR-lesson-system-006, TR-lesson-system-007, TR-lesson-system-010
> **ADR**: ADR-0004, ADR-0009, ADR-0012

## Context

**Depends on**: S12-01 (catalog), S12-02 (progress store)
**Purpose**: The `/learn/:lessonId` coached player — steps through a lesson with narration and interactive "play this move" steps.

---

## Acceptance Criteria

- [ ] **AC-01**: Route `/learn/:lessonId` (lazy-loaded) renders ChessBoard at the current step's FEN + coach panel.
- [ ] **AC-02**: Narration step shows coach text and a "Next" button that advances (GDD AC-05).
- [ ] **AC-03**: Interactive step disables "Next"; board accepts only `expectedMove`, then shows `successText` and advances (GDD AC-06).
- [ ] **AC-04**: A legal non-expected move does not advance, is not committed to the board, and shows `hint` (GDD AC-07).
- [ ] **AC-05**: Coach `arrows`/`highlights` render via chessground shapes when defined (GDD AC-08).
- [ ] **AC-06**: Promotion expectedMove matches only when from/to/promotion all match (GDD AC-12, EC-05).
- [ ] **AC-07**: Reaching the final step marks the lesson complete (store) and offers "Next lesson" / back to `/learn` (GDD AC-03).
- [ ] **AC-08**: Locked or non-existent `:lessonId` redirects to `/learn` (GDD AC-10, EC-03/04).
- [ ] **AC-09**: Mobile responsive; board full width, coach panel below; touch targets ≥44px (GDD AC-11).

## Implementation Plan

```
LessonView
├── Header (back to /learn + lesson title)
├── ChessBoard (:fen, :disabled on narration, @move-made)
├── Coach panel (text, hint/success feedback)
└── Step controls (Next on narration; auto-advance on correct move)
```

```typescript
// move check on @move-made:
const ok = step.expectedMove
  && m.from === step.expectedMove.from
  && m.to === step.expectedMove.to
  && (m.promotion ?? null) === (step.expectedMove.promotion ?? null)
// ok → advance; else → revert board, show hint
```

- Reuse `chess-board.vue` (`fen` / `playerColor` / `disabled` props, `move-made` emit).
- chessground shapes pattern: see `use-board-input.ts` `buildLegalMoveShapes()`.
- Redirect guards in component `onMounted` (lesson missing or `!isUnlocked`).

## Test Evidence

**Required (BLOCKING — Integration)**: `tests/unit/views/lesson-view.test.ts` or integration test covering: expectedMove accept/reject, promotion match, narration advance, completion marks store, locked redirect.

## Notes

- Step index is ephemeral (restart from step 0 on refresh, GDD EC-07). Only completion is persisted.
- Defer AI commentary (Phase 2b).
