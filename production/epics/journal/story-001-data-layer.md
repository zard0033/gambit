# Story 001: Journal Data Layer (table + data-sync methods + store)

> **Epic**: journal
> **Status**: Implemented (2026-06-16 — journal tests green, full suite 700 pass, vue-tsc 0; pending /story-done review)
> **Layer**: Phase 1 Differentiation — Data / Store
> **Type**: Integration (Pinia store + Supabase persistence + localStorage merge)
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-journal-001
> **ADR**: ADR-0013 (primary), ADR-0011, ADR-0005

## Context

**GDD**: `design/gdd/journal.md` — Detailed Design (R1/R2), Interactions, Dependencies
**Requirement**: `TR-journal-001`

**ADR Governing Implementation**: ADR-0013 (Journal Data Model & Session Boundary)
**ADR Decision Summary**:
- `journal_entries` is append-only, RLS `user_id = auth.uid()`, columns: `id, user_id, type, source_ref_id, volume, template_id, params jsonb, body, created_at`; `UNIQUE(user_id, source_ref_id)` for **event-level** idempotency (NOT row-UUID).
- `useJournalStore` (new Pinia store, ADR-0005) owns the merged view; **does not import supabase**.
- `loadJournalEntries()` / `appendJournalEntry()` live on `useDataSyncStore` (ADR-0011 — only data-sync.ts + auth.ts touch supabase). `appendJournalEntry` uses `INSERT ... ON CONFLICT (user_id, source_ref_id) DO NOTHING`; offline → `chess:journal:unsynced:<source_ref_id>`.

**Engine**: Web App — Vue 3 Composition API + TypeScript + Pinia 2 + Supabase JS v2 | **Risk**: LOW
**Engine Notes**:
- `type` column is `text` (NOT a PG enum) — confirm with `\d journal_entries`. An enum breaks the Phase-2 no-migration promise.
- Guest localStorage key family `chess:journal:*` (entries: `chess:journal:entries`). Distinct from `pgr:lessons:progress`.

**Control Manifest Rules (this layer)**:
- Forbidden: any `supabase.from(...)` outside `src/stores/data-sync.ts` / `auth.ts` (ADR-0011).
- Required: `useJournalStore` is its own store (do not expand gameStore / data-sync state).
- Required: idempotency on `journal_entries` uses `ON CONFLICT (user_id, source_ref_id)` — **NOT** `ON CONFLICT (id)` (the row-UUID convention from game_sessions does NOT survive guest→login reconcile).

---

## Acceptance Criteria

*From GDD, scoped to this story:*

- [ ] `journal_entries` migration exists (`supabase/migrations/20260826000000_create_journal_entries.sql`) with the ADR-0013 schema + `UNIQUE(user_id, source_ref_id)` + RLS policy.
- [ ] `useDataSyncStore.loadJournalEntries(): Promise<JournalEntry[]>` returns own rows ordered `created_at DESC`; returns `[]` when `userId === null` (guest reads localStorage instead).
- [ ] `useDataSyncStore.appendJournalEntry(e): Promise<void>` inserts with `ON CONFLICT (user_id, source_ref_id) DO NOTHING`; on offline/error queues to `chess:journal:unsynced:<source_ref_id>`.
- [ ] `useJournalStore.load()` merges cloud ∪ localStorage entries, deduped by `source_ref_id`, sorted `createdAt` desc (onset pinned last). **(AC-order foundation)**
- [ ] Inserting the same `(user_id, source_ref_id)` twice yields exactly one row.

---

## Implementation Notes

```
supabase/migrations/20260826000000_create_journal_entries.sql   ← already authored (ADR-0013 §1); applied live in story-007
src/types/journal.ts                                            ← JournalEntry, Pen, Volume
src/stores/journal.ts                                           ← new useJournalStore (load/merge/recent/byVolume)
src/stores/data-sync.ts                                         ← modify: loadJournalEntries + appendJournalEntry + flush journal queue on SIGNED_IN
tests/unit/stores/journal-store.test.ts                         ← merge/dedup/order
tests/unit/stores/data-sync-journal.test.ts                    ← ON CONFLICT idempotency, offline queue, null-user guard
```

```typescript
// src/types/journal.ts
type Pen = 'onset' | 'arrival' | 'solace'                 // widen for Phase 2 (no migration)
type Volume = '卷一規則' | '卷二戰術' | '卷三開局' | '卷四殘局'
interface JournalEntry {
  readonly id: string; readonly type: Pen; readonly sourceRefId: string
  readonly volume: Volume | null; readonly templateId: string
  readonly params: Record<string, unknown>; readonly body: string; readonly createdAt: number
}
```

- Merge order for display: `createdAt` desc; `onset` always last (pinned bottom) regardless of timestamp; same-instant ties order by F2 priority desc (story-002 concern, but the store's `byVolume()`/timeline must keep a stable sort).
- `appendJournalEntry` must read `useAuthStore().userId`; null → write to `chess:journal:entries` localStorage array instead (guest path; reconcile handled in story-006).

---

## Out of Scope

- story-002: the `evaluate()` settle logic (this story only persists/loads what 002 decides to write).
- story-006: the guest→login reconcile flush (this story sets up the localStorage path + queue key; the SIGNED_IN union is 006).
- story-007: applying the migration to the live DB + ADR acceptance.

---

## QA Test Cases

**Gate level**: BLOCKING (Logic/Integration)

- **AC-1 (idempotency)**: Given a row with `(user_id=U, source_ref_id='arrival:stage-rules')`, When `appendJournalEntry` is called again with the same pair, Then `count == 1`. Edge: concurrent double-call.
- **AC-2 (null-user guard)**: Given `userId === null`, When `loadJournalEntries()`, Then returns `[]` with no supabase call; `appendJournalEntry` writes to `chess:journal:entries`.
- **AC-3 (merge/order)**: Given cloud=[arrival@t2], local=[solace@t3, onset@t1], When `useJournalStore.load()`, Then merged = [solace, arrival, onset] (desc, onset last), no dup.
- **AC-4 (offline queue)**: Given `appendJournalEntry` throws (offline), Then `chess:journal:unsynced:<source_ref_id>` holds the entry; cleared on successful re-append.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/unit/stores/journal-store.test.ts` + `tests/unit/stores/data-sync-journal.test.ts` + `tests/unit/journal/order.test.ts` pass (BLOCKING). Live-DB probe verified in story-007.
**Status**: [x] Done — journal-store 3 / data-sync-journal 9 / order 4 pass; full suite 700 green, vue-tsc 0 (2026-06-16).
**Files**: `src/stores/journal.ts` (new), `src/stores/data-sync.ts` (+loadJournalEntries/appendJournalEntry/readLocalJournalEntries), `src/lib/journal/order.ts` (new), `src/types/journal.ts` (JournalEntry).

---

## Dependencies

- Depends on: ADR-0013 Accepted (story-007); `production/epics/supabase/*` (useDataSyncStore, useAuthStore exist — shipped S7).
- Unlocks: story-002 (settle writes via these methods), story-004 (UI reads the store), story-006 (reconcile uses the queue).
