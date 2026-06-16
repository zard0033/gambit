# Story 006: Guest → Login Reconcile

> **Epic**: journal
> **Status**: Implemented (2026-06-16 — reconcile tests green, full suite 730 pass, vue-tsc 0; pending /story-done review). ⚠️ touches App.vue userId watch — run `npm run test:e2e` before push.
> **Layer**: Phase 1 Differentiation — Integration
> **Type**: Integration (localStorage → cloud union on SIGNED_IN)
> **Estimate**: S-M (3 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-journal-006
> **ADR**: ADR-0013 (primary), ADR-0011

## Context

**GDD**: `design/gdd/journal.md` — Edge Cases (訪客模式, 冪等去重), AC-guest-reconcile
**Requirement**: `TR-journal-006`

**ADR Governing Implementation**: ADR-0013 §3 (union reconcile keyed on `source_ref_id`)
**ADR Decision Summary**:
- On `SIGNED_IN`, bulk `appendJournalEntry` every local entry; `ON CONFLICT (user_id, source_ref_id) DO NOTHING` collapses "same event written twice" (guest copy + any re-derived copy). This is `lesson_progress`'s union pattern but keyed on `source_ref_id`, because journal rows carry a generated `id` (so row-UUID conflict would NOT dedup the event).
- After reconcile, `useJournalStore.load()` re-merges so `firstTimeForMotif` / arrival dedup see both sources.

**Engine**: Web App — Vue 3 + Pinia + Supabase JS v2 | **Risk**: LOW
**Engine Notes**:
- Reuse ADR-0011's `flushUnsyncedQueue()` trigger point (`onAuthStateChange` `SIGNED_IN`); add a journal flush alongside the game flush.
- Guest entries live at `chess:journal:entries`; the unsynced queue at `chess:journal:unsynced:<source_ref_id>`.

**Control Manifest Rules (this layer)**:
- Required: dedup on `source_ref_id` (event), NOT row `id`.
- Required: union is loss-free — every local `source_ref_id` present in cloud after reconcile.
- Forbidden: deleting local entries before confirming the cloud insert succeeded (no data loss on partial failure → keep in unsynced queue).

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story:*

- [ ] **AC-guest-reconcile**: a guest accumulates N entries → on login, local entries union to cloud, visible on a second client, with no duplicate (`cloud count == |distinct source_ref_id|`) and no loss (every local `source_ref_id` present in cloud).
- [ ] An event written both as guest (localStorage) and re-derived after login produces exactly one cloud row (event-key dedup).
- [ ] On partial insert failure, unsent entries remain in `chess:journal:unsynced:*` and retry on the next `SIGNED_IN`; nothing is silently dropped.

---

## Implementation Notes

```
src/stores/data-sync.ts          ← flushJournalQueue(): bulk appendJournalEntry from chess:journal:entries + chess:journal:unsynced:*; called on SIGNED_IN alongside flushUnsyncedQueue()
src/stores/journal.ts            ← after flush, call load() to re-merge
tests/integration/journal/reconcile.test.ts  ← guest N → login → union, no dup, no loss; double-source event → 1 row
```

- After a successful cloud insert for a `source_ref_id`, remove only that key from the local queue (idempotent, partial-safe).
- The merged view (`useJournalStore.entries`) must look identical pre- and post-login for a single-device user (no flicker, no dup).

---

## Out of Scope

- story-001: the `appendJournalEntry` / queue primitives (this story orchestrates the flush).
- Cross-device live sync beyond append (journal is append-only; no live realtime channel needed).

---

## QA Test Cases

**Gate level**: BLOCKING (Integration).

- **AC-guest-reconcile**: Given guest writes onset + arrival(stage-rules) + solace(gameX) to localStorage, When SIGNED_IN, Then cloud has exactly those 3 rows by `source_ref_id`; a second client read returns all 3. Edge: a stage re-derived after login (same stageId) → still 1 arrival.
- **double-source**: Given the same arrival exists in localStorage AND is re-derived by `evaluate()` after login, Then 1 cloud row. 
- **partial-failure**: Given the 2nd of 3 inserts throws, Then rows 1 & 3 committed, row 2 stays in `chess:journal:unsynced:*`, retried next SIGNED_IN; no loss.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: reconcile tests pass (BLOCKING).
**Status**: [x] Done — `tests/unit/stores/data-sync-journal.test.ts` "flushJournalQueue — guest→login reconcile" (3: union+clear, dedup by source_ref_id, no-loss/re-queue); full suite 730 green, vue-tsc 0 (2026-06-16).
**Files**: `src/stores/data-sync.ts` (+flushJournalQueue), `src/stores/journal.ts` (+reconcileOnLogin), `src/App.vue` (userId watch → journalStore.reconcileOnLogin()).
**⚠️ E2E**: App.vue auth-wiring change — `npm run test:e2e` required before push (CLAUDE.md E2E blind-spot guardrail).

---

## Dependencies

- Depends on: story-001 (queue + append), story-002 (evaluate produces the entries).
- Unlocks: none (closes the persistence loop).
