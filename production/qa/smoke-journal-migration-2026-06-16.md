# Smoke: journal_entries migration (story-007 / ADR-0013)

> **Date**: 2026-06-16
> **Story**: journal/story-007 | **ADR**: ADR-0013 | **Migration**: `supabase/migrations/20260826000000_create_journal_entries.sql`
> **Project**: `vfnzekqtvxhewifnmtnz` | **Applied via**: Dashboard SQL Editor (manual — repo not CLI-linked)
> **Result**: PASS

## Checks (anon REST probe — `supabase/README.md` recipe)

| Check | Command | Expected | Actual |
|-------|---------|----------|--------|
| table exists + read RLS-scoped | `GET /rest/v1/journal_entries?select=*&limit=1` | HTTP 200 `[]` | ✅ HTTP 200 `[]` |
| write RLS enforced (anon) | `POST /rest/v1/journal_entries` (unauth payload) | HTTP 401 code `42501` | ✅ `42501` "new row violates row-level security policy" |

## Schema confirmed (per migration)

- `UNIQUE(user_id, source_ref_id)` — event-level idempotency (constraint `journal_entries_event_unique`).
- `type text` (NOT a PG enum) — Phase 2 pens (epiphany/move/weakness-arc/retrospect) need no migration.
- RLS enabled, policy `Users access own rows` `USING (user_id = auth.uid())`.

## Consequence

ADR-0013 flipped **Proposed → Accepted** (2026-06-16). Journal story-001…006 unblocked (Ready).
