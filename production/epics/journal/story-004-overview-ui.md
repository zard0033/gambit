# Story 004: Journal Overview UI (/journal)

> **Epic**: journal
> **Status**: Ready (ADR-0013 Accepted 2026-06-16)
> **Layer**: Phase 1 Differentiation — UI
> **Type**: UI (route + view + states)
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-journal-004
> **ADR**: ADR-0013 (＋ navigation-and-routing.md route registration)

## Context

**GDD**: `design/gdd/journal.md` — UI Requirements, Visual/Audio Requirements, Edge Cases (empty, reduced-motion)
**Requirement**: `TR-journal-004`

**ADR Governing Implementation**: ADR-0013 (store interface); navigation-and-routing.md (route table)
**ADR Decision Summary**:
- v1 entry = standalone `/journal` route + homepage peek; **does NOT** enable the bottom tab bar early (nav-and-routing v0/v1 has no persistent nav bar). Exit via an in-content back button; enter via the homepage peek (story-005).
- `/journal` must be registered in the navigation-and-routing route table (bidirectional consistency 待補).

**Engine**: Web App — Vue 3 + Vue Router 4 + Tailwind | **Risk**: LOW
**Engine Notes**:
- Design SoT `design/gambit-design-system/`: deep-jade `#103029` anchor every screen; cream cards carry Neve's text; gold only for focus/reward (the unread mark — story-005 — is non-gold); touch ≥44px; 16px min font; fonts `font-lesson`/`font-display` for Neve text, `font-num` for timestamps.
- 動效 150–300ms transform/opacity only; respect `prefers-reduced-motion`.
- Base-path guardrail: any JS/inline-style asset URL must prefix `import.meta.env.BASE_URL`.

**Control Manifest Rules (this layer)**:
- Required: deep-jade anchor present; cream-on-jade contrast ≥ AA.
- Required: touch targets ≥44×44px; no hover-only interaction.
- Forbidden: any edit/delete affordance on entries (R1); any streak/timer/leaderboard; box-shadow animation, confetti, vibration.

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story:*

- [ ] **AC-order**: with ≥2 entries, the overview renders entries strictly `createdAt` desc, with `onset` always pinned at the bottom (book's first page). Same-instant entries sort by F2 priority (arrival above solace). **(2026-06-16 IA 改版：時間軸為組織主軸，見下。)**
- [ ] **AC-no-edit**: no edit or delete control exists on any entry or the view (R1).
- [ ] **AC-empty-state**: with zero entries, the view shows a fixed Neve-voice empty-state string constant — non-empty element, no emoji.
- [ ] **AC-reduced-motion**: under `prefers-reduced-motion: reduce`, the cumulative-visual nodes have no running transition/animation (`getAnimations().length === 0` or `transition-duration: 0s`); new entries appear without an entrance transition.
- [ ] `/journal` route exists and is registered in `navigation-and-routing.md`'s route table; the view has an in-content back-to-home control (no tab bar introduced).
- [ ] CJK text is **not** italic (computed `font-style != italic`).
- [ ] **(2026-06-16 IA 改版，Eason 拍板)** 組織主軸＝**時間軸**而非分卷桶：依時間倒序、**按月份分段**，近期月份展開、更早月份**收合**成可點的「N 篇」細條（收合條疊起＝累積視覺，避免越長越雜亂）。**卷不再當每筆歸屬桶**，只在「抵達筆」上當「卷X · 名」章節里程碑小標。日期退成安靜小標（font-num），Neve 內文為主角。視覺＝deep-jade 沉浸 ＋ Inspira `beam` 燈光（暖象牙燭光 `#FFE9C0`，非品牌金）。

---

## Implementation Notes

```
src/router/index.ts                       ← add { path: '/journal', component: JournalView }
src/views/JournalView.vue                 ← timeline (desc) by month (近期展開/舊月收合), onset pinned bottom, empty state, back button, lamp scene header
src/components/journal/JournalEntryCard.vue ← cream 紙頁 card; Neve body (font-lesson, 主角); 安靜小標 date (font-num); arrival 章節里程碑小標; NO edit/delete
src/components/journal/JournalLamp.vue      ← Inspira beam 燈光 reskin（暖象牙燭光，純 CSS 一次性綻放，reduced-motion 靜態）
design/gdd/navigation-and-routing.md      ← register /journal in route table (待補一致性)
tests/e2e/journal-view.spec.ts            ← order, empty state, no-edit, reduced-motion, not-italic
```

- Empty state copy: a single fixed constant (e.g. 「還沒有什麼好寫的。先下一盤吧。」) — per persona; assert equality.
- The "accumulation visual" (demo C deep-immersion / aurora light) is **direction only** here — full visual spec is Phase 4 `/ux-design` (`design/ux/journal.md`). This story ships a calm, on-brand baseline (deep-jade + cream cards) and the reduced-motion fallback; do not over-build the aurora.
- Deleted-replay state and ② replay entry are Phase 2 — no replay affordance in v1.

---

## Out of Scope

- story-005: homepage peek + unread marker.
- Phase 4 `/ux-design`: detailed per-screen visual spec, per-volume empty scaffolding, aurora light treatment.
- Phase 2: ② "回到那一手" replay deep-link.

---

## QA Test Cases

**Gate level**: ADVISORY (UI) — Playwright interaction test + screenshot.

- **AC-order**: Setup: seed 3 entries (onset@t1, arrival@t2, solace@t3). Verify: render order solace, arrival, …, onset last. Pass: DOM order matches.
- **AC-no-edit**: Verify: no button/control with edit/delete semantics anywhere in the view. Pass: query returns none.
- **AC-empty-state**: Setup: empty store. Verify: empty-state constant rendered, no emoji. Pass: text equals constant.
- **AC-reduced-motion**: Setup: emulate `prefers-reduced-motion: reduce`, enter view. Verify: `getAnimations()` empty on cumulative-visual nodes. Pass: zero running animations.
- **not-italic**: Verify: computed `font-style` of CJK text node !== 'italic'.

---

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/journal-overview-evidence.md` (Playwright walkthrough + screenshot) OR `tests/e2e/journal-view.spec.ts`.
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: story-001 (store to read), story-002 (entries to show), story-003 (rendered body).
- Unlocks: story-005 (peek/unread builds on the view).
