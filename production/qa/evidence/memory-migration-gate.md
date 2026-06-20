# 棋憶 `memory_summaries` Live Migration Gate (story-011) — Evidence

> **Story**: `production/epics/memory/story-011-adr-accept-migration-gate.md`
> **Type**: Config/Process (release gate) — **BLOCKING** for live persistence verification
> **Status**: ✅ **PASSED 2026-06-20** — Eason applied the DDL via Dashboard SQL Editor; anon REST probe
> verified (GET 200 `[]` / POST 401 `42501`). ADR-0014 flipped Proposed → Accepted; README/EPIC/index updated.

---

## What's ready

- `supabase/migrations/20260828000000_create_memory_summaries.sql` authored + sanity-checked:
  `UNIQUE(user_id, game_id)` ✓ · `schema_version integer` ✓ · `summary jsonb` ✓ · RLS `FOR ALL`
  owner policy (`user_id = auth.uid()`; WITH CHECK defaults to USING for INSERT) ✓ → anon GET → `200 []`,
  anon POST → `401 / 42501`. Timestamp `…828` (avoids Gambit-noir's `…827`).

## Eason — run these (≈3 min)

1. Open the SQL Editor: `https://supabase.com/dashboard/project/vfnzekqtvxhewifnmtnz/sql/new`
2. Paste the full contents of `supabase/migrations/20260828000000_create_memory_summaries.sql` → Run.
   Expect: **`Success. No rows returned`**.
3. Anon REST probe (use `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` from `.env.local`):
   - `GET  …/rest/v1/memory_summaries?select=*&limit=1` (apikey + Authorization: Bearer anon) → **HTTP 200, body `[]`**
   - `POST …/rest/v1/memory_summaries` (anon, body `{}`) → **HTTP 401, code `42501`** (RLS enforced)
4. Paste both result codes back here.

## Done (2026-06-20, after probe passed)

- [x] Flipped `docs/architecture/adr-0014-…md` Status **Proposed → Accepted** (mirrors ADR-0013's note).
- [x] `supabase/README.md` table list → added `memory_summaries` (8 tables).
- [x] `production/epics/memory/EPIC.md` + `production/epics/index.md` memory row → ADR-0014 **Accepted**,
      live-persistence halves (001/004/007/010) unblocked.

## Probe results

```
GET  /memory_summaries?select=*&limit=1  → HTTP 200, body []
POST /memory_summaries (anon)            → HTTP 401, code 42501 ("new row violates row-level security policy")
Applied: 2026-06-20 (Eason, Dashboard SQL Editor) · probed from .env.local anon key
```
