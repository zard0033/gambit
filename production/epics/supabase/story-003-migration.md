# Story 003: Supabase Database Migration

> **Epic**: Supabase
> **Status**: Complete
> **Layer**: Persistence — Foundation
> **Type**: Config + Infrastructure (SQL)
> **Estimate**: S (3 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-31
> **TR**: pending /architecture-review
> **ADR**: ADR-0004, ADR-0011

## Context

**GDD**: `design/gdd/supabase-integration.md` — Database Schema section
**Requirements**: SUPA-AC-11, SUPA-AC-12 (RLS isolation); prerequisite for SUPA-AC-06~AC-09

**ADR Governing Implementation**: ADR-0011: Supabase Authentication and Data Sync Strategy
**ADR Decision Summary**: Two append-only tables: `game_sessions` (one row per completed game) and `skill_scores` (snapshot per game). Both have `user_id = auth.uid()` RLS policy on ALL operations. Client-generated UUIDs for idempotency. No service-role key in client. Migration files use Supabase CLI format.

**Engine**: PostgreSQL (Supabase) | **Risk**: LOW
**Engine Notes**: `ON CONFLICT (id) DO NOTHING` is a Postgres UPSERT variant — requires the conflict target to be a unique/PK constraint. PK on `id` column provides this. RLS must be ENABLED on both tables (not just policies created); `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is required.

**Control Manifest Rules**:
- Required: Each migration is a separate numbered SQL file in `supabase/migrations/`
- Required: RLS `ENABLE ROW LEVEL SECURITY` on both tables before policies
- Required: Policy covers ALL operations (SELECT, INSERT, UPDATE, DELETE) via single `USING` clause
- Forbidden: No `SECURITY DEFINER` functions that bypass RLS

---

## Acceptance Criteria

- [ ] **AC-S3-01**: `supabase/migrations/` directory exists with at least one SQL file creating both tables.
- [ ] **AC-S3-02**: `game_sessions` table has all columns from ADR-0011 schema: `id uuid PK`, `user_id uuid NOT NULL`, `played_at timestamptz`, `result text`, `player_color text`, `end_reason text`, `ai_difficulty integer`, `pgn text`, `move_count integer`, `opening_eco text`, `opening_name text`, `created_at timestamptz DEFAULT now()`.
- [ ] **AC-S3-03**: `skill_scores` table has: `id uuid PK`, `user_id uuid NOT NULL`, `as_of_game_id uuid NOT NULL`, `opening_score numeric(5,1)`, `tactics_score numeric(5,1)`, `endgame_score numeric(5,1)`, `level integer`, `created_at timestamptz DEFAULT now()`.
- [ ] **SUPA-AC-11** (RLS isolation): Row-level security policy exists on both tables using `user_id = auth.uid()`.
- [ ] **SUPA-AC-12** (anon blocked): RLS is ENABLED on both tables; unauthenticated queries return empty results.

---

## Implementation Notes

### Files to create

```
supabase/migrations/20260821000000_create_game_sessions.sql
supabase/migrations/20260821000001_create_skill_scores.sql
```

### Migration 1 — game_sessions

```sql
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  played_at     timestamptz NOT NULL,
  result        text        NOT NULL CHECK (result IN ('white_wins', 'black_wins', 'draw')),
  player_color  text        NOT NULL CHECK (player_color IN ('white', 'black')),
  end_reason    text        NOT NULL CHECK (end_reason IN ('checkmate', 'resign', 'stalemate', 'draw_agreement', 'fifty_move', 'threefold', 'insufficient')),
  ai_difficulty integer     NOT NULL CHECK (ai_difficulty BETWEEN 0 AND 20),
  pgn           text        NOT NULL,
  move_count    integer     NOT NULL CHECK (move_count >= 0),
  opening_eco   text,
  opening_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_sessions_pkey PRIMARY KEY (id)
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own rows" ON public.game_sessions
  USING (user_id = auth.uid());
```

### Migration 2 — skill_scores

```sql
CREATE TABLE IF NOT EXISTS public.skill_scores (
  id              uuid           NOT NULL DEFAULT gen_random_uuid(),
  user_id         uuid           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  as_of_game_id   uuid           NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  opening_score   numeric(5,1)   NOT NULL CHECK (opening_score BETWEEN 0 AND 100),
  tactics_score   numeric(5,1)   NOT NULL CHECK (tactics_score BETWEEN 0 AND 100),
  endgame_score   numeric(5,1)   NOT NULL CHECK (endgame_score BETWEEN 0 AND 100),
  level           integer        NOT NULL CHECK (level >= 1),
  created_at      timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT skill_scores_pkey PRIMARY KEY (id)
);

ALTER TABLE public.skill_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own rows" ON public.skill_scores
  USING (user_id = auth.uid());
```

### Applying migrations

For local dev (requires Docker Desktop + Supabase CLI):
```
supabase start
supabase db push
```

For production (after ADR-0011 is Accepted):
```
supabase link --project-ref <project-ref>
supabase db push --linked
```

---

## QA Test Cases

**Gate level**: ADVISORY (SQL files; local Supabase needed to run)

- **AC-S3-02 / AC-S3-03**: Read SQL files — confirm all columns present with correct types
- **SUPA-AC-11**: SQL confirms `CREATE POLICY` with `USING (user_id = auth.uid())` on both tables
- **SUPA-AC-12**: SQL confirms `ENABLE ROW LEVEL SECURITY` on both tables

If local Supabase running:
- Create two test users; insert row as User A; query as User B → expect 0 rows (RLS isolation)

---

## Test Evidence

**Story Type**: Config + Infrastructure
**Required evidence**: SQL files exist with correct schema (ADVISORY)
**Integration test**: RLS isolation test against local Supabase (BLOCKING if local env available)

---

## Dependencies

- Depends on: story-001-project-setup.md (Supabase project configured)
- Unlocks: story-004-data-sync-store.md (needs tables to exist for integration)

---

## Completion Notes
**Completed**: 2026-05-31
**Criteria**: 5/5 passing (AC-S3-01~03, SUPA-AC-11, SUPA-AC-12 all verified by reading SQL)
**Deviations**: None
**Test Evidence**: Config+Infrastructure — SQL files at `supabase/migrations/` verified; local Supabase integration test deferred (no Docker running)
**Code Review**: Lean mode — SQL matches GDD schema and ADR-0011 exactly; no deviations
