# Story 003: `concept-progress` Store + Dungeon Side-Door Practice Entry

> **Epic**: learning-loop
> **Sprint**: S14-03 (Must Have)
> **Status**: Complete (2026-06-06)
> **Layer**: Feature / Logic
> **Type**: Store + view entry-path
> **Estimate**: M
> **GDD**: design/gdd/learning-loop.md (§3.2 D1, §4.2, §4.3; AC-2b)
> **TR**: TR-ll-004
> **ADR**: ADR-0004, ADR-0012

## Context

**Depends on**: S14-01 (concept SoT + `MOTIF_TO_CONCEPT`)
**Purpose**: Implement the **D1 side-door** (Eason, 2026-06-06). The Bridge-1 CTA must open a
concept's puzzle for practice **without disturbing the dungeon's linear progress**. This story
builds (a) a small `concept-progress` store that records practice-solved puzzle ids, and (b) the
practice entry-path in the existing Dungeon puzzle view that bypasses the `nodeState` lock for one
puzzle id — while guaranteeing **zero mutation** of the dungeon store.

This is the riskiest Phase-A story because it touches another system's (#19) view. The binding
invariant: **a practice solve changes nothing the dungeon map reads.**

---

## Acceptance Criteria

- [ ] **AC-01**: `src/stores/concept-progress.ts` (Pinia, mirrors the dungeon-progress localStorage pattern) records a set of **practice-solved** puzzle ids; exposes `markPracticed(puzzleId)` and `practiceSolved: Set<string>`. Persists to localStorage; corrupt/absent data → empty (never throws).
- [ ] **AC-02**: `DungeonPuzzleView` accepts a `?from=lesson` route intent. When present **and** the target puzzle id matches the route, the entry guard allows the puzzle to open **even if** `nodeState(puzzle) === 'locked'` (the side-door) — for that one id only; all other entries keep the existing guard.
- [ ] **AC-03 (D1 zero-mutation invariant, BLOCKING)**: solving the puzzle in practice mode calls `conceptProgress.markPracticed(id)` and does **NOT** call the dungeon store's `markSolved`. A unit/store test asserts that after a practice solve, the **dungeon** store's `solved` set, `currentOrder`, and `nodeState(p)` for **every** puzzle are byte-for-byte identical to before (no done-island, no N+1 unlock).
- [ ] **AC-04**: In practice mode the solved panel's onward action returns to the **lesson** (or a calm "回課程" affordance), not the dungeon "下一題" linear flow — practice is a side trip, not a dungeon run.
- [ ] **AC-05**: Normal (non-`?from=lesson`) dungeon play is completely unchanged — the existing `nodeState` gate, `markSolved`, and "下一題/回到地圖" flow behave exactly as before (regression guard).

## Implementation Plan

- **Store**: `concept-progress.ts` mirrors `dungeon-progress.ts`'s load/persist shape but stores only
  `practiceSolved` ids. (Cross-device sync for practice progress is **out of scope for Phase A** —
  localStorage only; revisit with the Concept Map in Phase B if needed.)
- **Entry-path**: thread a `mode: 'practice' | 'dungeon'` derived from the route query into
  `DungeonPuzzleView`. The entry guard (`nodeState(puzzle) === 'locked'` redirect) gains an
  exception: `mode === 'practice' && route puzzle id === target`. **Do not** touch
  `dungeon-progress.ts`'s `isUnlocked` / `currentOrder` / `nodeState` — they stay pure.
- **Solve handler**: branch on `mode` — practice → `conceptProgress.markPracticed(id)`; dungeon →
  existing `dungeonProgress.markSolved(id)`. Never both.
- Keep the change surgical; the dungeon's own solving state machine (`use-dungeon-puzzle`) is reused
  unchanged — only the *progress write* and the *entry guard* branch on mode.

## Test Evidence

**Required (BLOCKING)**:
1. Store unit test — `markPracticed` adds to `practiceSolved`, persists, corrupt-data safe.
2. **D1 zero-mutation test** (AC-03) — the dungeon store snapshot is identical before/after a
   practice solve. This is the test the whole side-door rests on.
3. Regression test — normal dungeon entry/solve flow unaffected (AC-05).

## Notes

- This is the concrete realisation of the round-2 review's decisive finding: the dungeon gate is
  `nodeState`, not `isUnlocked` — so the side-door is an **entry-guard exception + a separate
  progress set**, never a patch to the dungeon's unlock predicate.
- `practiced(c)` (the Concept Map's 已練, Phase B) will read `practiceSolved ∪ dungeonSolved` of
  concept `c` ≥ `CONCEPT_PRACTICED_THRESHOLD`. This story only **writes** `practiceSolved`; the
  union/threshold computation lands with the Concept Map in Phase B.
- iOS Safari: practice entry must work from the lesson completion card tap (user-gesture chain intact).
