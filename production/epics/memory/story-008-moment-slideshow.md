# Story 008: Moment Slideshow — animated re-play + move comparison + reduced-motion

> **Epic**: memory
> **Status**: Done
> **Layer**: Feature — Phase 2 Differentiation ① — Visual/Feel
> **Type**: Visual/Feel (animation choreography + move-comparison UI)
> **Estimate**: L (6 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-memory-008
> **ADR**: ADR-0014 (primary), ADR-0006

## Context

**GDD**: `design/gdd/memory.md` — Rules 14–17, F5 choreography (Rule 16), EC-2/5/15, AC-9, AC-10; Tuning Knobs (animation), OQ-2
**Requirement**: `TR-memory-008`
**UX Spec**: `design/ux/memory.md` (story-006 — reduced-motion end-states, color-blind channel, keyboard, OQ-R1)

**ADR Governing Implementation**: ADR-0014 §4 (slideshow is a new lightweight view; respects reduced-motion; keyboard-operable)
**ADR Decision Summary**:
- Board renders at the moment's pre-move FEN; an animation re-plays the moment; a single tap/key **skips the in-flight animation to its end-state**; "重播這一手" re-runs it.
- The slideshow owns cursor/animation state; the board is a renderer (chessground). 棋憶 owns no engine call.

**Engine**: Web App — Vue 3 + chessground (vue3-chessboard) | **Risk**: LOW
**Engine Notes**:
- Choreography (Rule 16): **mistake** = pause → play *your* move → pause to read → move piece back → play the *better* move (highlighted). **good move** = play your move → animate the opponent's provoked/forced reply (e.g. knight chased back to b6).
- Animation knobs (demo-tuned v9, `src/config/memory-config.ts`): first-move pre-pause 650ms, move duration 380ms, read pauses 700/520ms. All respect `prefers-reduced-motion` (EC-5); OQ-2 = final sit-with-it sign-off (manual).
- Move comparison (Rule 15): **one** type size; role by **color/weight AND a non-color leading word** — mistake `你走了 <played>` (muted) │ `更好的是 <best>` (gold); good `你走了 <played> · 這手很好` (green). Text from story-005; this story owns the layout + colors. Color never the sole differentiator (AC-10 / EC-14).
- chessground synthetic events are **not Playwright-drivable** (technical-preferences) → animation/feel = manual evidence; DOM/computed-style half = automatable.

**Control Manifest Rules (this layer)**:
- Required: animate transform/opacity only (no box-shadow animation); 60fps budget.
- Required: board theme = Wood12 + Gioco via `body`-prefixed board-theme selectors; `import.meta.env.BASE_URL` on asset URLs.
- Required: dot band hidden when exactly one moment (EC-2 — a lone dot reads as loading).

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story:*

- [ ] **AC-10**: move comparison renders both halves at the **same `font-size`**, differentiated by color/weight **and** a leading word (played = muted, better = gold, good = green) — verifiable by computed style + text content.
- [ ] **AC-9 (computable half)**: reduced-motion static end-state conveys **both** halves of a mistake comparison (played-to + better-to highlighted **simultaneously**) — unit/DOM testable end-state.
- [ ] **EC-2**: exactly one moment → dot band hidden; prev/next both return to dashboard; no "1 of 1".
- [ ] **EC-15**: advancing past the last (or before the first) moment returns to the dashboard **with a visible cue** ("回棋憶"), never a silent jump.
- [ ] **Skip/replay**: a single tap/key skips the in-flight animation to its end-state; "重播這一手" re-runs the choreography.
- [ ] **Nav**: prev/next chevrons + left/right swipe on the board + arrow keys (desktop) all move between moments (keyboard parity per story-006).

---

## Implementation Notes

```
src/views/MemorySlideshowView.vue (or sub-view)   ← cursor + animation state machine; mounts at a moment index
src/components/memory/MomentCard.vue              ← kind icon, plain name, swing, move comparison (story-005 text), Neve explanation
src/components/memory/DotBand.vue                 ← one dot per moment, current elongated; hidden when 1 moment (EC-2)
src/config/memory-config.ts                       ← animation timings (already added in story-001)
```

- Animation = a small state machine driving chessground move/highlight with the timed pauses; `prefers-reduced-motion` short-circuits to the static end-state (mistake: both target squares highlighted; good: played→reply static).
- Skip = collapse the in-flight timeline to its final frame on any tap/key; idempotent.
- Cross-link to replay at this moment's ply (EC-13, per story-006 spec) lives on the card.

---

## Out of Scope

- Selecting which moments exist — story-002. The explanation **text** — story-005 (this renders it).
- The dense move-by-move replay — story-009 (the cross-link target).

---

## QA Test Cases

**Gate level**: ADVISORY (Visual/Feel) — DOM/computed-style half automatable; motion half = manual

- **AC-10**: computed `font-size` equal on both halves; leading words present; colors per role. Edge: good-move single-line variant.
- **AC-9**: with `prefers-reduced-motion`, assert both played-to + better-to squares carry the highlight class simultaneously (no animation classes).
- **EC-2/15**: 1-moment fixture → no dot band, prev/next → dashboard. Past-last → visible "回棋憶" cue.
- **Manual (evidence doc)**: mistake + good-move choreography at v9 timings; skip-to-end; 重播; swipe nav on device. OQ-2 sit-with-it sign-off.

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**: `production/qa/evidence/memory-slideshow-evidence.md` (motion sign-off, screenshots) + `tests/unit/memory/move-comparison.test.ts` (AC-10/AC-9 computable halves).
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: story-002 (moments), story-005 (explanation text), story-006 (UX spec APPROVED), story-007 (dashboard → slideshow entry).
- Unlocks: story-009 cross-link (slideshow ↔ replay).
