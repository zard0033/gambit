# Story 011: ADR-0014 Accepted + `memory_summaries` Live Migration Gate

> **Epic**: memory
> **Status**: Ready (run when story-001 DDL exists and persistence is ready to verify)
> **Layer**: Feature — Phase 2 Differentiation ① — Config/Process
> **Type**: Config/Data (release gate — live migration + ADR acceptance)
> **Estimate**: S (1–2 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-memory-011
> **ADR**: ADR-0014

## Context

**GDD**: `design/gdd/memory.md` — F4-schema persistence; ADR-0014 Migration Plan + Validation Criteria
**Requirement**: `TR-memory-011`

**ADR Governing Implementation**: ADR-0014 Migration Plan (steps 1–6), Validation Criteria
**ADR Decision Summary**:
- `memory_summaries` migration is applied **manually** via Dashboard SQL Editor (repo not CLI-linked). A migration file existing in `migrations/` does **not** mean it is applied — verify the live DB.
- Acceptance gate = table live + anon REST verified (200 `[]` / 401 `42501`) → flip ADR-0014 `Proposed → Accepted` → unblocks the persistence-dependent halves of stories 001/004/007/010.

**Engine**: Supabase Postgres (live project `vfnzekqtvxhewifnmtnz`) | **Risk**: LOW
**Engine Notes**:
- Mirrors Journal story-007 / ADR-0013 acceptance exactly. Next migration timestamp after journal's `20260826000000` = `20260827000000`.
- No CSP change (same `VITE_SUPABASE_URL` origin).

**Control Manifest Rules (this layer)**:
- Required: verify with the anon REST probe before marking any persistence story Done (`supabase/README.md`).
- Required: an Accepted ADR is mandatory before stories leave Blocked (`docs/CLAUDE.md`).

---

## Acceptance Criteria

*From ADR-0014 Validation Criteria, scoped to this gate:*

- [ ] `supabase/migrations/20260827000000_create_memory_summaries.sql` (authored in story-001) applied to live DB via Dashboard SQL Editor → `Success. No rows returned`.
- [ ] Anon REST probe: `GET …/rest/v1/memory_summaries?select=*&limit=1` → HTTP 200 `[]`; unauthenticated POST → HTTP 401 `42501` (RLS enforced).
- [ ] `\d memory_summaries` (or schema check) confirms `UNIQUE(user_id, game_id)`, `schema_version int`, `summary jsonb`.
- [ ] `supabase/README.md` table list updated to include `memory_summaries` (8 tables).
- [ ] ADR-0014 status flipped `Proposed → Accepted` with an Accepted note (date + verification evidence), mirroring ADR-0013.
- [ ] EPIC.md + `production/epics/index.md` memory row updated: ADR-0014 **Accepted**, dependent stories unblocked.

---

## Implementation Notes

- Run the `migrations/20260827000000_create_memory_summaries.sql` SQL in the Dashboard SQL Editor (`https://supabase.com/dashboard/project/vfnzekqtvxhewifnmtnz/sql/new`).
- Verify with the README anon-REST recipe (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` from `.env.local`).
- Edit ADR-0014 Status block → Accepted (copy the ADR-0013 Accepted-note shape: date, project ref, GET/POST result codes, constraint confirmation).
- This is a process gate, not code — no unit test; evidence is the probe output + the flipped ADR.

---

## Out of Scope

- Authoring the DDL — story-001 (this story applies + verifies it).
- The store/data-sync code — story-001 (its live verification depends on this gate).

---

## QA Test Cases

**Gate level**: BLOCKING (Config/Process — unblocks persistence verification)

- **Verify**: GET probe → 200 `[]`; unauth POST → 401 `42501`. Record both in the evidence doc.
- **Pass condition**: table live + RLS enforced + ADR-0014 Accepted + README/EPIC/index updated.

---

## Test Evidence

**Story Type**: Config/Data
**Required evidence**: `production/qa/evidence/memory-migration-gate.md` — probe output (GET 200 `[]`, POST 401 `42501`) + ADR-0014 Accepted commit reference.
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: story-001 (DDL authored).
- Unlocks: live persistence verification for stories 001 / 004 / 007 / 010; epic Definition of Done.
