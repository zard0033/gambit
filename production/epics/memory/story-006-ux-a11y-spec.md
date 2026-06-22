# Story 006: UX / a11y Spec (fix #5) — two doors, color-blind, reduced-motion, keyboard, back-nav

> **Epic**: memory
> **Status**: Done
> **Layer**: Feature — Phase 2 Differentiation ① — UI (spec authoring)
> **Type**: UI (UX spec doc — gates the view stories)
> **Estimate**: M (3–4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-memory-006
> **ADR**: ADR-0014

## Context

**GDD**: `design/gdd/memory.md` — Open Questions "Deferred to a UX spec / frontend pass (fix #5)", EC-5/12/13/14, AC-17, Rule 1; OQ-R1 (anchor hue in a loss)
**Requirement**: `TR-memory-006`

**ADR Governing Implementation**: ADR-0014 §4 (view/route ownership left to this spec)
**ADR Decision Summary**:
- The exact route-vs-sub-view nesting, back-to-origin targets, and the two-door affordances are **this spec's** decision, not fixed by the ADR. The spec conforms 棋憶 to the existing house a11y/visual standard; it is **not** a new GDD design hole.

**Engine**: Web App — Vue 3 + Tailwind + Gambit Design System | **Risk**: LOW
**Engine Notes**:
- **Sequenced FIRST among the view stories** — story-007 (dashboard) and story-008 (slideshow) implement against this spec. Authoring it before they start prevents retrofitting a11y.
- Output is a UX spec doc: `design/ux/memory.md` (per `design/CLAUDE.md` UX Specs convention). Validate with `/ux-review` before 007/008 begin.

**Control Manifest Rules (this layer)**:
- Required (Presentation): two `aria-live` regions outside the board subtree; WCAG 2.1 AA keyboard model (arrow/Home/End/Enter/Space/Escape, orientation-aware); forced-colors fallback.
- Required: touch targets ≥ 44×44px; no hover-only interactions (mobile has no hover).
- Required: visual SoT = `design/gambit-design-system/` (gold only focus/reward; Neve 深青卡+文楷+頭像 visual voice).

---

## Acceptance Criteria

*The spec must specify (testable: each row resolved with an unambiguous rule the view stories implement):*

- [ ] **EC-13 two doors**: the eval view (→ replay, "逐手覆盤") and a moment card (→ slideshow, "看這一手") have visually distinct affordances signaling their destination **before** the tap; a slideshow moment offers a cross-link into replay at that ply (no dead-end silos).
- [ ] **EC-12 drift-guard**: the eval view tap is a deliberate target — a touch that moves beyond a small threshold before release is a scroll, not a tap; the chart is a real keyboard-focusable `<button>`, not a bare `div`; curve dots are **not** separate tap targets.
- [ ] **EC-14 color-blind**: each moment kind is distinguishable without color — a distinct **icon shape** (warning triangle / star / circle-with-line) + the comparison's leading **words**; curve dots are a redundant cue only.
- [ ] **EC-5 reduced-motion**: the static end-state of a **mistake** conveys **both** halves (played-to + better-to highlighted simultaneously); a **good move** shows played→provoked-reply statically; replay teleports. No information lost.
- [ ] **AC-17 keyboard + targets**: every dashboard/slideshow action reachable + activatable by keyboard alone (eval view + moment cards are real buttons); any interactive dot has ≥44px hit area, or dots are non-interactive.
- [ ] **Rule 1 back-nav**: back from the dashboard returns to **wherever the user came from** (Game Over or 棋誌), not a fixed destination; the three views are a shallow stack popping to dashboard (incl. OS/browser back).
- [ ] **OQ-R1 decision**: specify whether the anchor in a **loss** keeps the celebratory star/success hue or gets a neutral "turning point" treatment (the GDD flags this for the UX pass).

---

## Implementation Notes

```
design/ux/memory.md   ← the spec: screen map, the 3 views, affordance table, a11y conformance table,
                         keyboard map, reduced-motion end-states, OQ-R1 ruling, back-nav targets per entry
```

- Author per the studio UX template (`/ux-design memory`). Cover: screen inventory (dashboard / slideshow / replay), per-control affordance + destination, the two-door distinction, drift-guard threshold value, icon-shape-per-kind table, reduced-motion static end-states (with the both-halves rule drawn), keyboard map, ≥44px target audit, back-nav per entry point, OQ-R1 ruling (recommend: neutral "turning point" treatment for an anchor in a loss — a costly turning point should not wear the celebratory hue).
- Pull visual tokens from `design/gambit-design-system/` — do not invent colors; gold stays focus/reward only.

---

## Out of Scope

- Implementing the dashboard / slideshow / replay — stories 007/008/009 (they consume this spec).
- The selection/derivation logic — stories 002–005.

---

## QA Test Cases

**Gate level**: ADVISORY (UI — spec doc) → becomes BLOCKING for 007/008 via `/ux-review`

- **Manual check**: run `/ux-review design/ux/memory.md` → APPROVED (no MAJOR REVISION) before 007/008 start.
- **Verify**: each fix-#5 row above has a single unambiguous rule a developer can implement and a tester can pass/fail (no "should feel good").
- **Pass condition**: spec covers all of EC-5/12/13/14, AC-17, Rule 1, OQ-R1; `/ux-review` verdict APPROVED.

---

## Test Evidence

**Story Type**: UI (spec)
**Required evidence**: `design/ux/memory.md` authored; `/ux-review` APPROVED; sign-off noted in `production/qa/evidence/memory-ux-spec.md`.
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: GDD (approved). Independent of the logic stories.
- Unlocks: story-007 (dashboard), story-008 (slideshow) — both implement against this spec. **Must precede them.**
