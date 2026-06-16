# Story 002: Settle Engine — F1 Gates + F2 Selection (cap=3)

> **Epic**: journal
> **Status**: Implemented (2026-06-16 — 27 journal tests green, full suite 727 pass, vue-tsc 0; pending /story-done review)
> **Layer**: Phase 1 Differentiation — Logic
> **Type**: Logic (eligibility gates + priority selection + idempotent settle)
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-journal-002
> **ADR**: ADR-0013

## Context

**GDD**: `design/gdd/journal.md` — Formulas F1 (gates), F2 (cap=3 priority), R4/R5/R6, States, Edge Cases
**Requirement**: `TR-journal-002`

**ADR Governing Implementation**: ADR-0013 §4 (lazy settle), §5 (session boundary)
**ADR Decision Summary**:
- `evaluate(trigger)` derives candidates from **persistent state only** (no in-memory event buffer in v1): onset = no `onset` entry exists; arrival = a `lesson_progress.completed` stage has no arrival entry for its `stageId`; solace = `consecutiveLosses ≥ SOLACE_LOSS_STREAK` AND `sessionsSinceLastSolace ≥ SOLACE_COOLDOWN`.
- Selection: `chosen = topN(eligible, SESSION_ENTRY_CAP=3, by priority desc)` — priority `onset 5 > arrival 3 > solace 2`. v1: `|eligible| ≤ 3` always → cap never truncates → **all eligible written**.
- `evaluate()` is **idempotent**: safe to call on every trigger (app-start / journal-open / stage-complete / game-end); duplicate writes are no-ops via `ON CONFLICT (user_id, source_ref_id)`.

**Engine**: Web App — Vue 3 + TypeScript + Pinia 2 | **Risk**: LOW
**Engine Notes**:
- Session ordinal is device-local (`chess:journal:session = {ordinal, lastActivityAt}`); bump ordinal when `now - lastActivityAt > SESSION_IDLE_TIMEOUT`. `sessionsSinceLastSolace = currentOrdinal - chess:journal:lastSolaceOrdinal` (∞ if never). Cooldown is device-local by design (accepted cross-device over-fire).
- `consecutiveLosses` derives from the game-history result sequence (most recent run of losses). No upstream change required.

**Control Manifest Rules (this layer)**:
- Required: gate + selection functions are **pure** (inputs: persistent snapshots; no Vue/supabase) — unit-testable in isolation.
- Required: never read a live in-memory lesson/review event for a v1 pen — derive from persisted `lesson_progress` / game-history only (R5).
- Forbidden: writing more than `SESSION_ENTRY_CAP` entries in one `evaluate`.

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story:*

- [ ] **AC-onset-1**: new user (no `onset` entry) → first `evaluate` writes exactly one `type='onset'`, `volume=null`, earliest `created_at`, `source_ref_id='onset'`.
- [ ] **AC-onset-2**: an `onset` entry exists → any later `evaluate` (reload / device switch / reconcile) writes no second onset (`count(type='onset') == 1`).
- [ ] **AC-arrival-1**: a stage's last lesson goes incomplete→complete and no arrival exists for that `stageId` → `evaluate` writes `type='arrival'`, `volume=volumeOf(stage)`, `source_ref_id=stageId`.
- [ ] **AC-arrival-2**: that `stageId` already has an arrival → re-`evaluate` writes none (`count(arrival, stageId)==1`).
- [ ] **AC-arrival-3**: stage S completed but a cap truncation skipped it (synthetic) → next `evaluate` writes S's arrival; a third `evaluate` writes none. *(v1 cap never truncates; test with a forced cap=1 fixture.)*
- [ ] **AC-solace-1**: `consecutiveLosses ≥ SOLACE_LOSS_STREAK` AND `sessionsSinceLastSolace ≥ SOLACE_COOLDOWN` → `evaluate` writes `type='solace'`, `volume='卷二戰術'`, `source_ref_id=<triggering gameId>`.
- [ ] **AC-solace-2**: streak met but `sessionsSinceLastSolace < SOLACE_COOLDOWN` → no solace written.
- [ ] **AC-priority-1**: any session with candidates → entries written `== min(|eligible|, SESSION_ENTRY_CAP)` and `≤ 3`.
- [ ] **AC-priority-2**: same session arrival+solace both eligible (total ≤ cap) → **both** written; arrival sorts above solace.
- [ ] **AC-priority-3**: synthetic eligible count > `SESSION_ENTRY_CAP` → only the top-`SESSION_ENTRY_CAP` by priority written.

---

## Implementation Notes

```
src/config/journal-config.ts            ← SESSION_ENTRY_CAP=3, SOLACE_LOSS_STREAK=3, SOLACE_COOLDOWN=3, SESSION_IDLE_TIMEOUT=30, HOMEPAGE_PEEK_COUNT=3
src/lib/journal/gates.ts                ← pure: eligibleOnset/eligibleArrival/eligibleSolace(snapshots) → candidate[]
src/lib/journal/select.ts               ← pure: topN(candidates, cap, priority)
src/lib/journal/session.ts              ← device-local session ordinal + lastSolaceOrdinal helpers
src/stores/journal.ts                   ← evaluate(trigger) orchestrates: gates → select → render(story-003) → dataSync.appendJournalEntry
tests/unit/journal/gates.test.ts
tests/unit/journal/select.test.ts
tests/unit/journal/evaluate.test.ts     ← integration of gates+select+idempotency (AC-priority-*, AC-arrival-3)
```

```typescript
const PRIORITY: Record<Pen, number> = { onset: 5, arrival: 3, solace: 2 } // Phase 2: epiphany 4, move 1
function select(cands: Candidate[], cap = SESSION_ENTRY_CAP): Candidate[] {
  return [...cands].sort((a, b) => PRIORITY[b.type] - PRIORITY[a.type]).slice(0, cap)
}
```

- `consecutiveLosses`: read game-history results newest-first, count the leading run of player-losses.
- `volumeOf(stage)`: map stage → volume via the lesson catalog (rules→卷一, tactics→卷二, opening→卷三, endgame→卷四).
- Render is story-003's `render(template_id, params)`; this story calls it but does not own the templates.

---

## Out of Scope

- story-003: template句庫 + render + persona lint (this story passes `template_id`+`params`, story-003 produces `body`).
- story-001: persistence/load (this story calls `appendJournalEntry`).
- Phase 2 ephemeral pens (① ②) — not derivable from persistent state; explicitly deferred (R5).

---

## QA Test Cases

**Gate level**: BLOCKING (Logic)

- **AC-onset-1/2**: fresh state → one onset; re-evaluate → still one. Edge: reconcile re-run.
- **AC-arrival-1/2**: completed-stage fixture → arrival with correct volume + stageId; re-run → no dup. Edge: two stages completed same session → two arrivals (within cap).
- **AC-solace-1/2**: result-sequence fixtures at streak−1 / streak / streak within cooldown / streak past cooldown. Edge: exactly `== SOLACE_LOSS_STREAK` (≥ boundary) and `sessionsSinceLastSolace == COOLDOWN` (≥ boundary).
- **AC-priority-1/2/3**: candidate sets {arrival}, {arrival,solace}, {onset,arrival,solace}, and a forced 4-candidate synthetic set with cap=3 → assert count + ordering + which dropped.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: settle/stages/session/evaluate unit tests pass (BLOCKING).
**Status**: [x] Done — `tests/unit/journal/{settle(16),stages(3),session(5)}.test.ts` + `tests/unit/stores/journal-evaluate.test.ts` (3); full suite 727 green, vue-tsc 0 (2026-06-16).
**Files**: `src/config/journal-config.ts`, `src/lib/journal/{settle,stages,session}.ts`, `src/stores/journal.ts` (+evaluate).

---

## Dependencies

- Depends on: story-001 (store + appendJournalEntry), story-003 (render for body) — can stub render during gate/select unit tests.
- Unlocks: story-004 (UI shows what settle writes), story-005 (peek/unread).
