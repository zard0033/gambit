# Story 010: 棋誌 Coupling — one entry per game + (gameId, ply) deep-link

> **Epic**: memory
> **Status**: Done — Shipped 2026-06-22 (slice A: `66e17ae`, slice B: `b3ca459`)
> **Layer**: Feature — Phase 2 Differentiation ① — Integration
> **Type**: Integration (cross-system: 棋憶 ↔ 棋誌 #21)
> **Estimate**: M (3–4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-memory-010
> **ADR**: ADR-0014 (primary), ADR-0013, ADR-0011

## Context

**GDD**: `design/gdd/memory.md` — Rules 22–24 (Group 7 棋誌 Coupling), Interactions (#21), AC-15; `design/gdd/journal.md` (#21 back-reference)
**Requirement**: `TR-memory-010`

**ADR Governing Implementation**: ADR-0014 §3/§4 (deep-link `(gameId, ply)` opens this 棋憶 / mounts replay at ply), Related (journal.md back-reference advisory)
**ADR Decision Summary**:
- **Exactly one journal entry per completed game**, independent of whether the player opens 棋憶 (confirmed model) → the dashboard shows **no "saved to journal" action prompt** (it is automatic).
- Tapping a journal entry on the 棋誌 page opens **this** game's 棋憶; the deep-link reuses #21's `gameId + ply` handle (the same #7 exposes to #21). Deep-link `(gameId, ply=N)` mounts replay with the cursor at ply N (AC-15).

**Engine**: Web App — Vue 3 + Vue Router + Pinia (journal + memory stores) | **Risk**: LOW
**Engine Notes**:
- The "one entry per game" journal write is #21's responsibility (its settle engine) — this story ensures the **link** is bidirectional and the entry's deep-link resolves to 棋憶. Confirm #21 already writes a per-game ②/③ entry (or note the dependency if the per-game pen is Phase 2 in #21's v1 scope — journal v1 = onset/arrival/solace; the per-game `move`/② pen is Phase 2). **If #21's per-game entry isn't shipped yet, this story wires the 棋憶 deep-link target + the journal.md back-reference, and the entry-creation half tracks #21's Phase 2.**
- Deep-link route carries `gameId` + optional `ply`; cold open (no `analysisResults`) triggers #7 re-analysis first (story-007 path).

**Control Manifest Rules (this layer)**:
- Required: only data-sync/auth touch supabase; the link is route + store state, not a new table.
- Required: no "saved to journal" CTA on the dashboard (Rule 22 — automatic, not an action).

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story:*

- [ ] **AC-15**: exactly one journal entry exists per completed game **regardless of whether 棋憶 was opened**; a journal entry opens this game's 棋憶; the deep-link `(gameId, ply=N)` mounts replay with the cursor at ply N.
- [ ] **Rule 22**: the dashboard shows no "saved to journal" action prompt.
- [ ] **Rule 23**: a 棋誌 entry tap routes to this game's 棋憶 dashboard (then replay at ply via the entry's handle).
- [ ] **journal.md back-reference**: `design/gdd/journal.md` (#21) references 棋憶 as its review destination (the bidirectional half of the deep-link) — GDD/active.md advisory.

---

## Implementation Notes

```
src/router/index.ts            ← /review (or /memory) accepts gameId + optional ply query/param
src/views/JournalView.vue      ← entry tap → router.push to 棋憶 with (gameId, ply)
src/views/MemoryView.vue       ← read (gameId, ply) → open dashboard; if ply present → mount replay at ply (story-009)
design/gdd/journal.md          ← add the 棋憶 back-reference (Dependencies / Interactions)
tests/e2e/memory-journal-deeplink.spec.ts
tests/unit/...                 ← one-entry-per-game (mock #21 settle) if #21 per-game pen is in scope
```

- Reuse #21's existing `gameId+ply` handle — do not invent a second linking scheme.
- If #21's per-game entry pen is still Phase 2 (journal v1 = onset/arrival/solace), scope this story to: (a) the 棋憶 deep-link **target** (route + replay-at-ply), (b) the journal.md back-reference, and (c) note the entry-creation half as tracking #21 Phase 2. Surface this to Eason at `/dev-story` time rather than silently assuming the entry exists.

---

## Out of Scope

- The 棋憶 views themselves — stories 007/009 (this wires the link into them).
- #21's settle engine / per-game pen implementation — journal epic (#21).

---

## QA Test Cases

**Gate level**: BLOCKING (Integration)

- **AC-15**: complete a game without opening 棋憶 → exactly one journal entry (when #21 per-game pen in scope); open 棋憶 → still one. Deep-link `(gameId, ply=N)` → replay cursor at N.
- **Rule 22/23**: dashboard has no "saved" CTA; 棋誌 entry tap → correct game's 棋憶.
- **Edge**: deep-link to a game whose `analysisResults` are gone → #7 re-analysis runs, then opens at ply.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/e2e/memory-journal-deeplink.spec.ts` + one-entry-per-game unit test (scope-dependent on #21); `design/gdd/journal.md` updated.
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: story-007 (dashboard), story-009 (replay-at-ply), story-001 (per-game summary write); #21 journal (deep-link handle; per-game pen scope TBC).
- Unlocks: the full 棋憶 ↔ 棋誌 loop (vision "課程長在你棋上 + 棋誌").
