# Story 007: Supabase `dungeon_progress` Table + Data-Sync Methods

> **Epic**: dungeon-puzzle
> **Sprint**: S13-07 (Must Have)
> **Status**: Complete (2026-06-07 — migration applied live)
> **Layer**: Feature / Persistence
> **Type**: Migration + Sync methods
> **Estimate**: M (4 hours)
> **GDD**: design/gdd/dungeon-puzzle-mode.md (§3.6, AC-08)
> **TR**: TR-dungeon-008
> **ADR**: ADR-0011 (Supabase Auth + Sync)

## Context

**Depends on**: S13-01 (puzzle ids exist to key rows)
**Purpose**: Provide the cross-device sync backend for puzzle progress — a Supabase table
+ RLS + data-sync store methods, mirroring the `lesson_progress` implementation exactly.

---

## Acceptance Criteria

- [ ] **AC-01**: A migration `supabase/migrations/NNNN_dungeon_progress.sql` creates a `dungeon_progress` table keyed by `(user_id, puzzle_id)` with a `hint_used` boolean and `solved_at` timestamp, mirroring `lesson_progress`'s columns/types.
- [ ] **AC-02**: RLS policies allow a user to read/write only their own rows (same policy shape as `lesson_progress`).
- [ ] **AC-03**: `useDataSyncStore` gains `upsertDungeonProgress(ids, hintUsedMap?)` and `loadDungeonProgress()` mirroring the lesson methods; logged-out calls no-op gracefully.
- [ ] **AC-04**: Monotonic semantics — upsert never deletes; load returns the union of solved ids (+ hintUsed flags).

## Implementation Plan

- Copy the `lesson_progress` migration as the template; rename table/columns; keep the
  same RLS policy structure and indexes.
- Add the two methods to `src/stores/data-sync.ts` next to the lesson equivalents.
- No new ADR — rides ADR-0011.

## Test Evidence

**Required**: data-sync method unit tests with a mocked Supabase client (logged-out no-op,
upsert payload shape, load mapping). The store-level reconcile is tested in S13-02.
**Required (ADVISORY)**: documented two-device playtest — solve on device A, see it solved
on device B after login.

## Notes

- **Migration is a real DB change** — coordinate apply with Eason (Supabase project). The
  CI Node-22 lock (supabase client imports WebSocket) already applies; no new constraint.
- Mirrors `lesson_progress` so future maintainers see one consistent pattern.
