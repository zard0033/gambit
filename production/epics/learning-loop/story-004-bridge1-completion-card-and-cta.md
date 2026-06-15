# Story 004: Bridge 1 — Lesson Completion Card + Recommendation Fns + CTA

> **Epic**: learning-loop
> **Sprint**: S14-04 (Must Have)
> **Status**: Complete (2026-06-06)
> **Layer**: Feature / Integration
> **Type**: Pure fns + UI insertion
> **Estimate**: M
> **GDD**: design/gdd/learning-loop.md (§3.2, §4.3; AC-2, AC-3; EC-1, EC-7, EC-8)
> **TR**: TR-ll-002, TR-ll-003, TR-ll-005
> **ADR**: ADR-0004, ADR-0012

## Context

**Depends on**: S14-01 (concepts), S14-03 (side-door practice entry)
**Purpose**: Build Bridge 1 — the course→puzzle bridge. Two parts: (a) the pure recommendation
functions (`recommended` / `practiceTarget`), and (b) the **new lesson completion card** that hosts
the calm invitation and routes into practice mode.

> **Reality note**: LessonView currently routes straight to `/learn` on完成課程
> (`markComplete(id)` → `router.push('/learn')`) with **no completion panel**. This story adds a
> calm completion moment (Eason approved, 2026-06-06) — without it Bridge 1 has nowhere to live.

---

## Acceptance Criteria

- [ ] **AC-01** (`recommended` / `practiceTarget` pure fns): given fixtures, `recommended(c, N)` returns ≤ N `candidates(c)` sorted by puzzle `order`, **unsolved-first**, and **mate difficulty-matched** (a player who finished `checkmate-in-one` is offered `mate-in-1` before `mate-in-2`). `practiceTarget(c)` returns the lowest-order unsolved puzzle, and **when all of `c`'s puzzles are solved, falls back to the lowest-order solved puzzle (replay, EC-7) — never ∅ when the concept has ≥1 puzzle**.
- [ ] **AC-02** (completion card + CTA): on完成課程, a calm completion card renders. For a concept **with** puzzles it shows `data-testid="lesson-practice-cta"` ("趁熱練幾題『<label>』"); tapping it routes to `practiceTarget(c)` via `?from=lesson` (the S14-03 side-door).
- [ ] **AC-03** (EC-1, no-puzzle concept): for a lesson whose concept has **no** puzzles (skewer/discovered/defense/center), the card renders `data-testid="lesson-practice-hint"` (calm "這個概念的試煉即將加入") and **no** `lesson-practice-cta`.
- [ ] **AC-04** (EC-8, multi-concept lesson): a lesson teaching multiple concepts renders **one CTA per concept that has puzzles**, capped at `LESSON_TO_PUZZLE_COUNT` for readability.
- [ ] **AC-05**: the card also offers a calm secondary "回課程列表" action; `markComplete(lesson.id)` still fires (the lesson is genuinely completed — 已學 must flip).
- [ ] **AC-06 (Gambit)**: completion card uses deep-jade anchor + gold only on the CTA; jade piece silhouette per the Home/Learn `TIER_PIECE` convention; Lucide icons (no emoji); CTA target ≥ 44×44px; calm copy (no streak/celebration-explosion).

## Implementation Plan

- **Pure fns**: `src/modules/learning-loop/recommend.ts` — `candidates`, `recommended`,
  `practiceTarget`. No store access inside; take solved-set + puzzle list as args (testable).
  Difficulty-match for `mate` = secondary sort key (motif-affinity to the lesson level).
- **Tuning**: `LESSON_TO_PUZZLE_COUNT` (default 3) lives in `config/learning-loop-tuning.ts`.
- **Completion card**: a calm panel shown when `isLastStep` `next()` fires, **before** routing away
  (replaces the immediate `router.push('/learn')`). Reuse the lesson's design-system surface; keep
  it a lightweight state in LessonView, not a new route.
- **CTA wiring**: tap → `router.push('/dungeon/<practiceTarget.id>?from=lesson')` (S14-03 honours it).

## Test Evidence

**Required**:
- **Unit (BLOCKING)**: `recommend.test.ts` — `recommended` ordering/cap/difficulty-match, and
  `practiceTarget` incl. the **all-solved replay fallback** (EC-7).
- **Component (ADVISORY→blocking for the branch logic)**: completion card renders CTA vs hint per
  concept-has-puzzles; multi-concept fan-out + cap; markComplete fires.
- **Manual walkthrough**: the completion moment feels calm and earned (not a to-do); CTA lands in
  practice mode and returns to the lesson (verify with S14-03).

## Notes

- This story makes the lesson "completion moment" exist for the first time — keep it calm and
  low-pressure per Gambit (no streak, no score, no celebration explosion).
- The CTA preserves the *completion feeling*; phrase it as an invitation ("想趁熱練幾題…嗎？"), not a
  command / assignment (rec 11).
- Concepts: confirm `practiceTarget` never deep-links a concept with zero puzzles (that path is the
  AC-03 hint, guarded before any routing).

## Completion (2026-06-06)

- Pure fns: `src/modules/learning-loop/recommend.ts` (`candidates`/`recommended`/`practiceTarget`)
  + `src/config/learning-loop-tuning.ts` (`LESSON_TO_PUZZLE_COUNT`). 9/9 unit tests
  (`tests/unit/learning-loop/recommend.test.ts`) incl. mate difficulty-match + all-solved replay (EC-7).
- LessonView: `next()` on last step now sets `completed=true` (was: immediate `router.push('/learn')`);
  new completion-card overlay with `completionConcepts` (CTA vs EC-1 hint per concept, capped),
  testids `lesson-completion-card` / `lesson-practice-cta` / `lesson-practice-hint` /
  `lesson-completion-return`; CTA → `/dungeon/<practiceTarget>?from=lesson` (S14-03 side-door).
- **Browser-verified (Playwright)** the full Bridge-1 loop: completed `checkmate-in-one` (drove the
  a1→a8 mate via real CDP mouse) → completion card showed CTA「想趁熱練幾題「將殺」嗎？」+「回課程列表」
  → clicking CTA routed to `/dungeon/l1-back-rank-mate?from=lesson` (practice mode, back button「課程」).
  Side-door control verified: same locked puzzle redirects to `/dungeon` WITHOUT `?from=lesson`.
- Full suite **595 passed** (+9). Test localStorage + screenshots cleaned up after.
