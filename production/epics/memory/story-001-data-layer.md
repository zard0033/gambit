# Story 001: Memory Data Layer — `memory_summaries` + data-sync + store + guest reconcile

> **Epic**: memory
> **Status**: Ready (code + unit tests; ⚠️ live persistence verification gated on story-011 — ADR-0014 Accepted)
> **Layer**: Feature — Phase 2 Differentiation ① — Integration
> **Type**: Integration (table + data-sync methods + store + guest→login reconcile)
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-memory-001
> **ADR**: ADR-0014 (primary), ADR-0011, ADR-0005

## Context

**GDD**: `design/gdd/memory.md` — F4-schema (`MemoryGameSummary`), Interactions (Data Sync #11), Dependencies, EC-6 (guest)
**Requirement**: `TR-memory-001`

**ADR Governing Implementation**: ADR-0014 §1 (table), §2 (store/data-sync boundary), §5 (idempotency/guest/durability)
**ADR Decision Summary**:
- New `memory_summaries` table: owner-scoped RLS, `UNIQUE(user_id, game_id)`, top-level `schema_version` column, `summary jsonb` = `{ stageCounts, conceptCounts, anchorStage }`.
- Persistence is **event-keyed on `game_id`** — `INSERT ... ON CONFLICT (user_id, game_id) DO NOTHING` (one summary per game, re-derive is a no-op). **NOT** ADR-0011's `ON CONFLICT (id)` — that does not survive guest→login reconcile.
- `useMemoryStore` holds only the cross-game window; persists through `useDataSyncStore`; **no supabase import**. Guest localStorage namespace `chess:memory:*`; union reconcile on `SIGNED_IN` keyed by `game_id`.
- `load()`/`loadMemorySummaries()` return **only** rows whose `schema_version === MEMORY_SUMMARY_SCHEMA_VERSION` (ignore-on-mismatch durability).

**Engine**: Web App — Vue 3 + TypeScript + Pinia 2 + @supabase/supabase-js ^2.x | **Risk**: LOW
**Engine Notes**:
- Migration applied **manually** via Dashboard SQL Editor (`supabase/README.md`) — repo is not CLI-linked. The DDL ships in this story; the *apply + verify + flip* is story-011.
- `game_id` is the review's gameId handle (`= completedGame.completedAt.toString()`, the same key #7 uses for `pgr:analysis:<gameId>`); `text`, no FK (a guest game has no `game_sessions` row).

**Control Manifest Rules (this layer)**:
- Required: only `src/stores/auth.ts` + `src/stores/data-sync.ts` import `src/lib/supabase` (ADR-0011) — `useMemoryStore` must not.
- Required: tuning/constants in `src/config/memory-config.ts` as named exports (no inline numbers).
- Forbidden: copying `ON CONFLICT (id)` from `game_sessions`/`skill_scores` — reconcile would duplicate (ADR-0014 Risks).

---

## Acceptance Criteria

*From GDD F4-schema + EC-6 + ADR-0014 Validation Criteria, scoped to this story:*

- [ ] `memory_summaries` DDL file authored at `supabase/migrations/20260828000000_create_memory_summaries.sql` (§1 DDL verbatim).
- [ ] `useDataSyncStore.appendMemorySummary(s)` inserts `ON CONFLICT (user_id, game_id) DO NOTHING`; logged-in failure → `chess:memory:unsynced:<game_id>`; guest → `chess:memory:summaries`.
- [ ] `useDataSyncStore.loadMemorySummaries()` selects own rows where `schema_version === MEMORY_SUMMARY_SCHEMA_VERSION`, newest-first.
- [ ] `useMemoryStore.load()` merges cloud ∪ local (guest + queued), dedup by `game_id`, current schema only; a single corrupt local blob is skipped, never fatal.
- [ ] Inserting the same `(user_id, game_id)` twice yields exactly one row (unit: mock data-sync asserts one append wins).
- [ ] Guest writes N summaries → `SIGNED_IN` → cloud row count `== |distinct game_id|`; every local `game_id` present in cloud (union, no dup, no loss).
- [ ] `grep` proves `useMemoryStore` + `src/modules/memory/*` do **not** import `src/lib/supabase`.

---

## Implementation Notes

```
supabase/migrations/20260828000000_create_memory_summaries.sql   ← ADR-0014 §1 DDL
src/types/memory.ts            ← MemoryGameSummary, Stage, MemoryConcept, NeveLine, Moment types
src/config/memory-config.ts    ← MEMORY_SUMMARY_SCHEMA_VERSION=1 + all tuning constants (F1/F4/F5 + animation)
src/stores/data-sync.ts        ← ADD memorySummaryRowToObj / memoryObjToRow + loadMemorySummaries + appendMemorySummary
                                  (mirror loadJournalEntries/appendJournalEntry; keys chess:memory:summaries / chess:memory:unsynced:<game_id>)
src/stores/memory.ts           ← useMemoryStore: summaries ref, load(), recordGame(s), neveLine() [neveLine impl = story-004]
tests/unit/memory/data-sync-memory.test.ts   ← ON CONFLICT no-op, schema_version filter, offline queue
tests/unit/memory/store-reconcile.test.ts    ← guest→login union by game_id (no dup, no loss), corrupt-blob skip
```

```typescript
// src/config/memory-config.ts (the schema-version contract — bump with any F1/F5 selection/stage change)
export const MEMORY_SUMMARY_SCHEMA_VERSION = 1
export const MEMORY_MOMENT_CP_GATE = 60, MEMORY_ANCHOR_FLOOR = 0, MEMORY_BRIGHT_GATE = 120
export const CONCEPT_BONUS = 100, MEMORY_MOMENT_MAX = 5
export const OBS_WINDOW = 10, OBS_MIN_SAMPLE = 6, OBS_MIN_STAGE = 3, OBS_IMPROVE_DELTA = 0.30, OBS_CONCEPT_FRAC = 0.5
export const ENDGAME_MATERIAL = 12, OPENING_PLY_MAX = 16, OPENING_MATERIAL = 56
```

- Mirror the journal data-sync methods exactly (`journalRowToEntry`/`journalEntryToRow`, `readLocalJournalEntries`, `_pushGuest*`, `_queue*`) — re-keyed on `game_id` instead of `source_ref_id`.
- `recordGame` is called by story-007's dashboard at #7 COMPLETE; this story provides the plumbing, not the trigger.

---

## Out of Scope

- F1/F4/F5 logic that *produces* a `MemoryGameSummary` — stories 002/003/004 (this story stores whatever it's handed).
- The actual `CREATE TABLE` run on live DB + RLS verify + ADR flip — story-011.
- Dashboard wiring of `recordGame` at COMPLETE — story-007.

---

## QA Test Cases

**Gate level**: BLOCKING (Integration)

- **ON CONFLICT**: append same `(user_id, game_id)` twice → one row. Edge: different `game_id`, same user → two rows.
- **schema_version filter**: seed rows at v1 + v0 → `loadMemorySummaries` returns only v1.
- **guest reconcile**: N guest summaries in localStorage → `SIGNED_IN` flush → cloud count `== |distinct game_id|`, all present. Edge: one `game_id` exists both guest+cloud → no dup.
- **corrupt blob**: malformed `chess:memory:summaries` JSON → `load()` skips it, returns the rest, no throw.
- **boundary**: live RLS (200 `[]` / 401 `42501`) deferred to story-011 (needs live DB).

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/unit/memory/{data-sync-memory,store-reconcile}.test.ts` pass (BLOCKING); live RLS probe recorded in story-011.
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None (code). Live verification depends on story-011 (ADR-0014 Accepted + migration applied).
- Unlocks: story-004 (cross-game window source), story-007 (recordGame trigger), story-010 (deep-link/one-per-game), story-011 (gate).
