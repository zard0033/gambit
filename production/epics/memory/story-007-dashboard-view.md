# Story 007: 棋憶 Dashboard View — Neve card → shape-of-game eval → moment list + zero-state

> **Epic**: memory
> **Status**: Ready (⚠️ `recordGame` live persistence verification gated on story-011)
> **Layer**: Feature — Phase 2 Differentiation ① — UI
> **Type**: UI (dashboard view, composes #7 + memory module)
> **Estimate**: L (5–6 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-memory-007
> **ADR**: ADR-0014 (primary), ADR-0007, ADR-0006

## Context

**GDD**: `design/gdd/memory.md` — Rules 1–13, F2 chart (Rule 8–10), EC-1/3/4, AC-1, AC-3, AC-7 (chart tap), AC-10 (partial)
**Requirement**: `TR-memory-007`
**UX Spec**: `design/ux/memory.md` (story-006 — must be `/ux-review` APPROVED first)

**ADR Governing Implementation**: ADR-0014 §3 (read-only #7 consumption, 0 analysis when present), §4 (`/review` → dashboard)
**ADR Decision Summary**:
- The dashboard owns the `usePostGameReview` instance (it *is* the `/review` surface). At `phase==='COMPLETE'` it calls the pure `selectMoments`/`evalWhiteSeries` (stories 002/003) and `useMemoryStore.recordGame(buildGameSummary(...))` (write-once).
- **0 new `reviewEngine.analyze` calls when `analysisResults` already exist** (AC-14). Cold open from 棋誌 with no results → #7's existing re-analysis path runs first (progressive render, EC-3).

**Engine**: Web App — Vue 3 + Tailwind + self-drawn SVG | **Risk**: LOW
**Engine Notes**:
- Eval chart is a **self-drawn SVG** (no chart library — "整包框架不裝"). White-up/Black-down, clamp ±4 pawns; White/Black labels on the **left** with a backing plate (Rule 10). Selected moments marked with small colored dots (same color as their card); dots are **not** tap targets (AC-7).
- Chart tap → replay at the anchor ply (story-009); drift-guarded real `<button>` (EC-12, per story-006 spec).
- Neve card = 深青卡 + 頭像 + 文楷 (`font-lesson`), opens the dashboard (Rule 3, visual-voice SoT).

**Control Manifest Rules (this layer)**:
- Required: `import.meta.env.BASE_URL` prefix on any JS/inline asset URL (the `/gambit/` 404 guardrail).
- Required: animations 150–300ms transform/opacity only; respect `prefers-reduced-motion`.
- Forbidden: emotive/score node in the DOM; gold as body text (gold = focus/reward only).

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story:*

- [ ] **AC-1**: opening a completed game lands on the **dashboard** (not the dense move list); DOM order = Neve line → eval view → moment list; **no ranking/verdict element rendered** (assert absence of any "weakest"/score node — the report-card layout is *not* a pass condition).
- [ ] **AC-3**: F1 returns 0 → the dashboard renders the **zero-state component** (not a one-row list); eval view + replay remain mounted/tappable; zero-state copy equals the approved fixture string and contains none of `['做得好','恭喜','完美']`.
- [ ] **AC-7**: a tap at the eval chart's geometric center (not a dot) opens replay at the anchor ply; tapping a curve dot opens the **same** replay (dots not separate handlers); a scroll gesture over the chart does **not** open replay (EC-12).
- [ ] **AC-14 (view half)**: opening 棋憶 when `analysisResults` exist → spy on `reviewEngine.analyze` asserts **0** calls; cold open (no results) → exactly #7's re-analysis runs (progressive "still refining…", EC-3).
- [ ] **EC-1/3/4**: zero-state calm line; progressive pre-COMPLETE (selection runs only at COMPLETE, no vanishing card); preview-depth anchor carries #7's "preliminary" treatment, never below WCAG 1.4.3 contrast.

---

## Implementation Notes

```
src/views/MemoryView.vue (or restructured ReviewView)  ← /review surface; owns usePostGameReview; renders dashboard
src/components/memory/NeveCard.vue        ← 深青卡 + 頭像 + 文楷; text from useMemoryStore.neveLine() → renderNeveLine (story-005)
src/components/memory/EvalShapeChart.vue  ← self-drawn SVG from evalWhiteSeries (story-003); dots per moment; drift-guarded button (story-006)
src/components/memory/MomentList.vue      ← moment cards: kind icon+color, plain name, played move, swing; tap → slideshow (story-008)
src/components/memory/EmptyMemory.vue     ← zero-state component (EC-1)
```

- At `phase==='COMPLETE'`: `const moments = selectMoments(...)`; if `moments.length===0` render `EmptyMemory`; else `MomentList`. Always render `NeveCard` + `EvalShapeChart`. Call `recordGame` once (guard against re-fire on re-render).
- Moment card shows the **plain-language short name** + kind icon (no engine-taxonomy label, Rule 11); icon shape per kind (story-006 spec: triangle/star/circle-with-line).
- Route change: `/review` resolves to this view. Back → entry point (Game Over / 棋誌) per story-006 spec.

---

## Out of Scope

- The slideshow (tap target destination) — story-008. The replay (chart destination) — story-009.
- Selection/derivation/templates logic — stories 002–005 (this story calls them).
- The deep-link entry from 棋誌 — story-010 (this story renders; story-010 wires the link + ply).

---

## QA Test Cases

**Gate level**: ADVISORY (UI) — automatable DOM half is effectively blocking via Playwright

- **AC-1**: mount with COMPLETE results → assert DOM order + absence of any verdict/score/"weakest" node.
- **AC-3**: 0-moment fixture → `EmptyMemory` present, list absent, copy == fixture, no banned token; chart + replay still tappable.
- **AC-7**: Playwright tap chart center → replay at anchor ply; tap a dot → same; simulate scroll over chart → no navigation.
- **AC-14**: spy `reviewEngine.analyze`; mount with sessionStorage-restored results → 0 calls; mount cold → re-analysis path runs.

---

## Test Evidence

**Story Type**: UI
**Required evidence**: `tests/e2e/memory-dashboard.spec.ts` (DOM order, zero-state, chart tap, 0-analysis) + manual screenshot of Neve card / chart / list per `production/qa/evidence/memory-dashboard-evidence.md`.
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: story-002 (moments), story-003 (E_white), story-004 (Neve line), story-005 (text), story-006 (UX spec APPROVED), story-001 (`recordGame`).
- Unlocks: story-008 (moment tap → slideshow), story-009 (chart tap → replay), story-010 (deep-link).
