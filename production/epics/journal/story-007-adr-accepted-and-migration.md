# Story 007: ADR-0013 Accepted + Live Migration

> **Epic**: journal
> **Status**: Complete (2026-06-16 — migration applied live, RLS verified, ADR-0013 Accepted)
> **Layer**: Phase 1 Differentiation — Process / Config
> **Type**: Config/Data (live DB migration + ADR status)
> **Estimate**: S (1-2 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-journal-007
> **ADR**: ADR-0013

## Context

**GDD**: `design/gdd/journal.md` — Open Questions (Supabase schema → ADR-0013, manual Dashboard apply)
**Requirement**: `TR-journal-007`

**ADR Governing Implementation**: ADR-0013 (Migration Plan + Validation Criteria)
**ADR Decision Summary**:
- The `journal_entries` migration is applied **manually via the Dashboard SQL Editor** (repo is not CLI-linked — `supabase/README.md`). A migration file existing in `migrations/` does NOT mean it is applied — verify against the live DB.
- Once applied and verified, ADR-0013 flips Proposed → Accepted, unblocking story-002…006 (per docs/CLAUDE.md, stories on a Proposed ADR are auto-blocked).

**Engine**: Supabase Postgres (project `vfnzekqtvxhewifnmtnz`) | **Risk**: LOW
**Engine Notes**:
- Apply SQL at `https://supabase.com/dashboard/project/vfnzekqtvxhewifnmtnz/sql/new`; success = `Success. No rows returned`.
- No CSP change (same `VITE_SUPABASE_URL` origin as ADR-0011).

**Control Manifest Rules (this layer)**:
- Required: verify the live table via anon REST probe before marking Done — do not trust the migration file's existence.
- Required: `type` column is `text` (not a PG enum) — confirm.

---

## Acceptance Criteria

*Process gate:*

- [ ] `supabase/migrations/20260826000000_create_journal_entries.sql` applied to the live DB (Dashboard SQL Editor).
- [ ] Anon REST probe: `GET …/rest/v1/journal_entries?select=*&limit=1` → HTTP 200 `[]`; unauthenticated POST → HTTP 401 code `42501` (RLS enforced).
- [ ] `\d journal_entries` (or schema inspect) confirms: `UNIQUE(user_id, source_ref_id)` present; `type` is `text`; RLS enabled with `Users access own rows`.
- [ ] `supabase/README.md` table list updated to include `journal_entries` (7 tables).
- [ ] ADR-0013 `## Status` changed Proposed → Accepted (with a dated acceptance note); story-001…006 unblocked.

---

## Implementation Notes

```
(live DB)                                ← run the migration SQL in Dashboard SQL Editor
supabase/README.md                       ← add journal_entries to the table list
docs/architecture/adr-0013-...md         ← Status: Proposed → Accepted (+ acceptance date note)
production/epics/journal/EPIC.md          ← flip story statuses Blocked → Ready once Accepted
```

Anon REST verification recipe (from `supabase/README.md`):
```bash
URL=<VITE_SUPABASE_URL>; KEY=<VITE_SUPABASE_ANON_KEY>
curl -s -w "%{http_code}\n" "$URL/rest/v1/journal_entries?select=*&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"   # expect 200 []
curl -s -X POST "$URL/rest/v1/journal_entries" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"user_id":"00000000-0000-0000-0000-000000000000","type":"onset","source_ref_id":"onset","template_id":"x","body":"x"}'   # expect 401 / 42501
```

---

## Out of Scope

- The store/settle/UI code (story-001…006) — this story only gates them on a live, accepted schema.

---

## QA Test Cases

**Gate level**: BLOCKING (release gate).

- **table-exists**: probe returns 200 `[]`. Pass: HTTP 200 + empty array.
- **rls-enforced**: unauthenticated insert returns 401 `42501`. Pass: rejected by RLS.
- **idempotency-constraint**: two inserts of the same `(user_id, source_ref_id)` (authenticated, e.g. via a test user) → 1 row. Pass: second is a no-op.
- **type-is-text**: schema inspect shows `type text` (not enum). Pass: confirmed.

---

## Test Evidence

**Story Type**: Config/Data (process gate)
**Required evidence**: `production/qa/smoke-journal-migration-<date>.md` — probe outputs pasted; ADR-0013 acceptance note.
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: ADR-0013 authored (done); migration file authored (done).
- Unlocks: story-001…006 (all flip Blocked → Ready once ADR-0013 is Accepted).
