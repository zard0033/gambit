# ADR-0014: 棋憶 (Memory) Data Model and Post-Game Review Consumption Boundary

## Status

Accepted

> **Accepted 2026-06-20**: `memory_summaries` migration (`supabase/migrations/20260828000000_create_memory_summaries.sql`)
> applied to live DB (`vfnzekqtvxhewifnmtnz`) via Dashboard SQL Editor. Verified by anon REST probe:
> `GET …/memory_summaries?select=*&limit=1` → HTTP 200 `[]`; unauthenticated POST → HTTP 401 `42501`
> (RLS enforced). `UNIQUE(user_id, game_id)` + `schema_version integer` + `summary jsonb` per §1 spec.
> Unblocks the live-persistence halves of 棋憶 stories 001/004/007/010.
>
> **Proposed 2026-06-18**: authored after the `design/gdd/memory.md` design-review (round 2 lean
> APPROVED, log `design/gdd/reviews/memory-review-log.md`). Acceptance gate = the `memory_summaries`
> migration applied to live DB + anon REST verified (mirrors ADR-0013's acceptance flow).

## Date

2026-06-18

## Last Verified

2026-06-18

## Decision Makers

Eason (product owner); Claude (technical-director role). Informed by the approved 棋憶 GDD
(`design/gdd/memory.md`, system #22) and its design-review log.

## Summary

棋憶 (#22) is the **presentation-and-selection layer** over data Post-Game Review (#7) already
computes — it runs **no new Stockfish analysis of its own**. This ADR fixes two architectural
boundaries the GDD leaves to architecture:

1. **Data model.** The only durable artifact 棋憶 needs across sessions is a per-game
   `MemoryGameSummary` (stage/concept aggregates) feeding the F4 cross-game Neve line. It is stored
   in a **new owner-scoped `memory_summaries` table**, persisted through `useDataSyncStore`
   (ADR-0011) with guest-localStorage → login union-reconcile and **one-summary-per-game
   idempotency `UNIQUE(user_id, game_id)`** — the exact pattern ADR-0013 established for
   `journal_entries`. A top-level `schema_version` column lets F4 **ignore** summaries written under
   an incompatible selection/stage tuning rather than mix inconsistent data (GDD F4 durability note).

2. **#7 → #22 consumption boundary.** 棋憶 reads #7's `usePostGameReview` composable output
   (`analysisResults`, `cpLoss`, `biggestSwingCursor`, `phase`) **read-only** and derives its own
   presentation values (White-normalized `E_white[i]`, favorable-swing, stage). Per-game selection
   (F1) and derivation (F2/F5) are **pure functions in a new `src/modules/memory/` module** — no
   store, mirroring how `computeCpLoss`/`computeBiggestSwingCursor` are already pure over the same
   composable. `useMemoryStore` (ADR-0005) owns only the durable cross-game layer. The `/review`
   entry becomes the 棋憶 dashboard; the dense board+eval+movelist surface becomes the opt-in
   move-by-move replay, **reusing the shipped PgnViewer** (the game-replay path).

**Crucial clarification (resolves an apparent GDD contradiction):** `MemoryGameSummary` is **not** a
per-game moment cache. A single game's moment list / eval chart / slideshow are built from #7's
in-memory `analysisResults`. If those exist (same session, or sessionStorage-restored) 棋憶 selects
over them with **zero new analyze calls** (AC-14). If absent (a game opened cold from 棋誌 in a later
session — #7 persists no `analysisResults` across sessions, ADR-0007), #7 **re-analyzes the stored
PGN** via its existing review-engine path (the same on-demand analysis game-replay already ships) and
棋憶 then selects over the fresh results. 棋憶 never calls the engine itself.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | TypeScript Web App (Vue 3 + Pinia 2 + @supabase/supabase-js ^2.x) |
| **Domain** | Feature / Data Persistence / Presentation (read-only consumer of Post-Game Review) |
| **Knowledge Risk** | LOW — Postgres DDL, RLS, supabase-js v2, Pinia 2, Vue composables all within training data and stable; SVG line chart is hand-drawn (no chart lib) |
| **References Consulted** | `design/gdd/memory.md`; `design/gdd/post-game-review.md`; `docs/architecture/adr-0013-journal-data-model-and-session-boundary.md`; `docs/architecture/adr-0011-supabase-authentication-and-data-sync-strategy.md`; `docs/architecture/adr-0007-post-game-review-analysis-loop-and-sessionstorage-schema.md`; `docs/architecture/adr-0005-pinia-store-boundaries-and-completed-game-transport.md`; `src/modules/post-game-review/use-post-game-review.ts`; `src/stores/data-sync.ts`; `supabase/README.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | `UNIQUE(user_id, game_id)` collapses a re-derived summary to one row; RLS isolation with anon key; guest localStorage→login union dedups on `game_id`; opening a game whose `analysisResults` are present issues **0** `reviewEngine.analyze` calls (AC-14) |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0011 (Accepted — `useDataSyncStore` is the only module besides `auth.ts` allowed to touch `supabase.from`; RLS + offline-queue + union-reconcile pattern); ADR-0013 (Accepted — the `journal_entries` table + guest-localStorage/union-reconcile pattern this ADR copies wholesale); ADR-0007 (Accepted — #7 owns `analysisResults`/`biggestSwingCursor`, persists none across sessions; the read-only source 棋憶 consumes); ADR-0005 (Accepted — Pinia per-feature store boundary; `useMemoryStore` is a new feature store) |
| **Enables** | 棋憶 epic stories (data layer, selection F1, derivation F2/F5, cross-game line F4, dashboard, slideshow, replay reuse, journal coupling) |
| **Blocks** | All 棋憶 implementation stories cannot begin until this ADR is Accepted |
| **Ordering Note** | `memory_summaries` migration must be applied to the live DB (Dashboard SQL Editor — `supabase/README.md`) before any persistence story is verified. 棋憶 reads #7's already-shipped composable and #21's already-shipped `journal_entries` deep-link handle — no upstream GDD change required for v1, except the advisory back-reference from `journal.md` (#21) to 棋憶 as its review destination. |

## Context

### Problem statement

The 棋憶 GDD specifies *what* to show (a calm dashboard: Neve line + shape-of-game eval + 0–5 moment
cards; a moment slideshow; a dense move-by-move replay) and *how to select* (F1 key-moment selection,
F4 cross-game line, F5 stage classification) but defers two architectural questions:

1. **Where does the cross-game accumulation live, and how does it persist for guests?** F4 needs the
   last `OBS_WINDOW` games' per-game summaries. #7 persists **no** `analysisResults` across sessions
   (ADR-0007 / sessionStorage only), so the summary is the *only* durable record of a game's
   analysis. It must survive sessions and devices, for logged-in users **and guests** (GDD EC-6: a
   guest's per-game moments and few-games line both work).
2. **How does 棋憶 consume #7 without re-running analysis, and who owns the `/review` surface?** #7 is
   a composable (`usePostGameReview`) owned by `ReviewView`, not a global store. 棋憶 must read its
   results, derive a White-normalized series #7 does not expose, and turn today's direct-to-dense-board
   `/review` into a dashboard-first stack — without duplicating analysis or violating the Pillar-3
   "no emotive fields" / Principle-1 "cross-module reads through interfaces" rules.

### Current state

- **#7** = `src/modules/post-game-review/use-post-game-review.ts`, a composable exposing readonly
  `analysisResults`, `phase` (`LOADING|ANALYZING|COMPLETE|CANCELLED`), `biggestSwingCursor`
  (computed, COMPLETE-only), and pure helpers `computeCpLoss`/`computeBiggestSwingCursor`. Results
  flush to sessionStorage (`pgr:analysis:<gameId>`, `pv` stripped) — **ephemeral**, not cross-session.
- **#20 Learning Loop** provides `classify()` (→ `material|mate|none`) and `selectMistakeSignposts()`.
- **#21 Journal** ships `journal_entries` (ADR-0013) and the `gameId+ply` deep-link handle.
- **Game-replay** already re-analyzes a stored PGN on demand (the same review-engine path 棋憶 reuses
  for a cold open) and renders via the shipped lichess PgnViewer.
- **data-sync** owns all `supabase.from` calls and the journal guest/union-reconcile machinery
  (`chess:journal:entries`, `chess:journal:unsynced:*`, row mappers, `ON CONFLICT` insert).
- Seven Supabase tables exist; no memory table, no memory module, no memory store.

### Constraints

- **GitHub Pages**: no server code; RLS is the sole authorization layer; anon key only.
- **iPhone Safari 16+ PWA**: guest play must never block; no reliable app-close (so, as with journal,
  the summary write must be idempotent re-derivation, not capture-or-lose).
- **ADR-0011 boundary**: only `src/stores/auth.ts` and `src/stores/data-sync.ts` import
  `src/lib/supabase.ts`. Memory persistence routes through `useDataSyncStore`.
- **ADR-0007 boundary**: #7 owns analysis; `biggestSwingCursor` is computed once at COMPLETE and
  never moves. 棋憶 must not re-derive or move it.
- **No CLI link** (`supabase/README.md`): migrations applied manually via Dashboard SQL Editor.
- **Zero-AI v1**: selection is Stockfish cpLoss + `classify()` rules + templates; no engine on the
  surface, no new analysis owned by 棋憶.

### Requirements

- One durable per-game `MemoryGameSummary`, owner-scoped RLS, surviving sessions/devices, for
  logged-in users and guests, written **once per game** (re-derivation is a no-op).
- A `schema_version` discriminator so a future F1/F5 tuning change makes old summaries **ignored**
  (degrade the F4 window), never silently mixed — recompute-on-tune is explicitly out of scope
  (source `analysisResults` are gone).
- A read-only consumption contract over #7 that issues **0** new analyze calls when results already
  exist, and falls back to #7's existing re-analysis when they do not.
- A `(gameId, ply)` deep-link entry from 棋誌 (#21) that opens this game's 棋憶 and can mount the
  replay at a specific ply (GDD Rule 23, AC-15).

## Decision

### 1. Table: `memory_summaries` (per-game, owner-scoped RLS, union-reconcile, versioned)

```sql
-- supabase/migrations/20260828000000_create_memory_summaries.sql
create table if not exists public.memory_summaries (
  id             uuid        primary key default gen_random_uuid(),  -- client-generated
  user_id        uuid        not null references auth.users(id) on delete cascade,
  game_id        text        not null,   -- the review's gameId handle (= game_sessions.id when saved); one summary per game
  schema_version integer     not null,   -- bump when F1/F5 selection/stage tuning changes; F4 ignores incompatible rows
  summary        jsonb       not null,   -- { stageCounts:{opening,middlegame,endgame}, conceptCounts:Record<concept,number>, anchorStage: stage|null }
  created_at     timestamptz not null default now(),
  constraint memory_summaries_game_unique unique (user_id, game_id)
);

alter table public.memory_summaries enable row level security;
create policy "Users access own rows" on public.memory_summaries
  using (user_id = auth.uid());          -- USING also gates INSERT (WITH CHECK inherited), per supabase/README convention
```

- **One row per game**, idempotency keyed on the **event** (`UNIQUE(user_id, game_id)`), inserted
  `ON CONFLICT (user_id, game_id) DO NOTHING`. A re-entered review re-derives the identical summary;
  the constraint collapses it to one row (matches #7's "computed once, never moves").
- **`game_id text`, no FK to `game_sessions`.** A guest's game has no `game_sessions` row (RLS needs
  auth) and the summary's lifecycle is independent of game-history saving. `text` accommodates any
  game handle (= `game_sessions.id` once saved). This is the same FK-free event-key choice as
  `journal_entries.source_ref_id`.
- **`schema_version` is a top-level column**, not buried in the jsonb, so F4 filters
  `where schema_version = <current>` cheaply and ignores incompatible rows without parsing jsonb.
  (The GDD's F4-schema nests `schemaVersion` inside the object; promoting it to a column is the only
  deliberate deviation — same data, queryable.)
- **`summary` jsonb** carries exactly the F4 aggregate the cross-game line needs:
  `stageCounts` (GATED-candidate counts pre-cap, F1 Step 3 — not displayed counts), `conceptCounts`,
  `anchorStage` (`null` when `biggestSwingCursor` was null). It is **not** the moment cards or the
  eval series — those are rebuilt from #7 (§2), never from this row.

### 2. Store / module boundary

```
src/modules/memory/                    PURE functions over #7's composable output (NO store, NO supabase)
  selection.ts   selectMoments(analysisResults, biggestSwingCursor, classify, tuning) → Moment[]   (F1)
  derive.ts      evalWhiteSeries(analysisResults) → number[]                                        (F2)
                 favorableSwing(i, analysisResults) → number
  stage.ts       classifyStage(plyIndex, fen, bookExitPly, tuning) → 'opening'|'middlegame'|'endgame' (F5)
  summary.ts     buildGameSummary(moments, stages) → MemoryGameSummary                              (F4 step 1)
  cross-game.ts  pickNeveLine(summaries, tuning) → NeveLine                                          (F4 steps 2–4)
  templates.ts   renderMoment(kind, concept, line) → string  /  renderNeveLine(signal, params) → string (F3/F4 fill)

src/stores/memory.ts                   useMemoryStore (ADR-0005) — durable cross-game layer ONLY; NO supabase import
  summaries: ref<MemoryGameSummary[]>          // merged cloud ∪ local
  load(): Promise<void>                         // dataSync.loadMemorySummaries() ∪ localStorage, current schema_version only
  recordGame(s: MemoryGameSummary): Promise<void> // dataSync.appendMemorySummary(s)  (ON CONFLICT DO NOTHING)
  neveLine(): NeveLine                          // pickNeveLine over the F4 window

src/stores/data-sync.ts                ADD (only this file + auth.ts touch supabase) — mirror the journal methods
  loadMemorySummaries(): Promise<MemoryGameSummary[]>           // SELECT where user_id; current-schema rows
  appendMemorySummary(s: MemoryGameSummary): Promise<void>      // INSERT ... ON CONFLICT (user_id, game_id) DO NOTHING;
                                                                // guest → localStorage chess:memory:summaries;
                                                                // logged-in insert failure → chess:memory:unsynced:<game_id>
```

- **Per-game selection has no store**: `selectMoments` etc. are pure over #7's in-scope
  `analysisResults`/`biggestSwingCursor`, exactly like `computeCpLoss`. The dashboard view owns the
  `usePostGameReview` instance (it *is* the `/review` surface) and calls these at `phase==='COMPLETE'`.
- **`useMemoryStore` owns only the durable layer** (the F4 window) — it never touches a single game's
  moment selection, and never imports supabase (ADR-0011). Guest localStorage namespace is
  `chess:memory:*` (aligns with data-sync's `chess:` namespace, distinct from `chess:journal:*`).

### 3. #7 → #22 consumption boundary (read-only; 0 new analysis when results exist)

```
DASHBOARD opened (Game Over → /review, or 棋誌 entry → deep-link)
  owns a usePostGameReview instance (the /review surface)
  ├─ analysisResults present? (live this session, or sessionStorage-restored for this gameId)
  │     YES → phase drives to COMPLETE with 0 reviewEngine.analyze calls (AC-14)
  │     NO  → #7 re-analyzes the stored PGN via its EXISTING review-engine path
  │           (the same on-demand analysis game-replay ships; 棋憶 owns no engine call)
  ▼  at phase === COMPLETE:
  selectMoments(analysisResults, biggestSwingCursor, classify, tuning)  →  Moment[]   (F1, pure)
  evalWhiteSeries(analysisResults)                                       →  E_white[]  (F2, pure)
  buildGameSummary(moments, stages)  →  MemoryGameSummary
        └─► useMemoryStore.recordGame(summary)  →  dataSync.appendMemorySummary  (write-once, no-op on re-entry)
```

- 棋憶 reads #7 through its readonly composable output only; it **never writes** #7 state, never
  re-derives `biggestSwingCursor`, never mutates `analysisResults`.
- The White-normalization `E_white[i] = (i even) ? E[i] : -E[i]` (GDD F2) is 棋憶's own derived
  presentation value — #7 stores side-to-move evals and defers normalization to Move Annotation
  Display; 棋憶 performs it for its own SVG chart.
- **Pillar-3 / Principle-4 hold**: 棋憶's surfaced types (`Moment`, `NeveLine`, `MemoryGameSummary`)
  carry **no** emotive/score field (no `grade`, `rating`, `weakness`, `blunder`); `kind` is an
  internal taxonomy (`tactical|bright|plain`) that never renders as a visible category label (GDD
  Rule 11/12). F4 has **no** `weak(stage)` branch (GDD F4 — the vision's anti-rating guardrail).

### 4. View / route ownership

- `/review` becomes the **棋憶 dashboard** (Neve line → shape-of-game eval → moment list), replacing
  today's direct-to-dense-board entry (GDD Rule 1). The three views (dashboard / slideshow / replay)
  are a shallow stack popping to dashboard (GDD Rule 2); exact route vs. sub-view nesting and the
  back-to-origin targets are a **UX-spec story** decision (GDD fix-#5 deferral), not fixed here.
- The dense board+eval+movelist **replay reuses the shipped PgnViewer** + Wood12/Gioco theme (visual
  SoT) and Move Annotation Display — *not* a hand-rolled board (GDD Rule 18, AC-16). Asset URLs carry
  `import.meta.env.BASE_URL` (the `/gambit/` 404 guardrail).
- The slideshow is a new lightweight view (board at the moment's pre-move FEN + animated re-play +
  moment card); it respects `prefers-reduced-motion` and is keyboard-operable (house a11y standard,
  the fix-#5 UX-spec story).

### 5. Idempotency, guest, and durability (mirror ADR-0013)

- **Logged-in write**: `INSERT ... ON CONFLICT (user_id, game_id) DO NOTHING`.
- **Guest**: summaries → `localStorage chess:memory:summaries`; on `SIGNED_IN`, bulk
  `appendMemorySummary` (union by `game_id`, `ON CONFLICT DO NOTHING`) → re-`load()`. Zero duplicate,
  zero loss — the `journal_entries` reconcile, re-keyed on `game_id`.
- **Schema versioning**: `load()` and `loadMemorySummaries()` return **only** rows whose
  `schema_version` matches the current `MEMORY_SUMMARY_SCHEMA_VERSION`. A tuning change that alters
  selection/stage bumps the constant; older rows are ignored (the F4 window shrinks → a smaller
  sample / first-games line, EC-7), never recomputed (source `analysisResults` are gone — accepted).

## Alternatives Considered

### Alternative 1: `memory_summary jsonb` column on `game_sessions` (no new table)

- **Description**: Add a nullable `memory_summary jsonb` + `memory_schema_version int` to
  `game_sessions`; write via `UPDATE game_sessions SET … WHERE id = gameId` at #7 COMPLETE.
- **Pros**: No new table, no new RLS policy; a natural per-game 1:1; the lazier-looking option.
- **Cons (fatal)**: **A guest has no `game_sessions` row** (the table is auth-gated by RLS), yet
  GDD EC-6 requires guest per-game moments and a guest few-games F4 line — so guest summaries must
  persist to localStorage anyway, and Option A still needs the whole journal-style guest path **plus**
  a second logged-in path coupled to game-history's row lifecycle and write-timing. It couples #22's
  data into #12's table and needs an `ALTER TABLE` on a live table for a feature that already has a
  clean, identical precedent.
- **Rejection reason**: It does not actually work for the guest case, so it is not the lazy solution —
  it is a broken one with extra coupling. Option B reuses ADR-0013's proven machinery end-to-end.

### Alternative 2: Cache the full per-game moment set / eval series durably (reconstruct without re-analysis)

- **Description**: Persist each game's selected moments + `E_white[]` so a cold open from 棋誌
  rebuilds the dashboard with no analysis.
- **Pros**: A later-session open needs no Stockfish.
- **Cons**: Large, redundant storage; goes stale the moment F1/F2/F5 tuning changes (the cache would
  encode old selection); duplicates what #7's re-analysis already produces deterministically;
  contradicts the GDD's "棋憶 owns no analysis, F4-schema stores aggregates only."
- **Rejection reason**: #7 already re-analyzes a stored PGN on demand (game-replay ships it). The
  durable layer stays a small aggregate; the per-game view rebuilds from #7. Storing only what F4
  needs is the minimal correct surface.

### Alternative 3: A Pinia store for per-game selection state

- **Description**: Put `selectMoments`/`E_white`/cursor in a stateful `useMemoryReviewStore`.
- **Pros**: Familiar store shape.
- **Cons**: The inputs are #7's composable state, scoped to the `/review` surface; a global store
  duplicates that scope and invites drift (two sources of "current game"). `computeCpLoss`/
  `biggestSwingCursor` are already pure over the same data — selection should match.
- **Rejection reason**: Pure functions in `src/modules/memory/` are simpler and consistent with #7.
  The only state worth a store is the durable cross-game window.

### Alternative 4: PG enum / FK for `game_id`

- **Description**: `game_id uuid references game_sessions(id)`, or an enum for concept/stage.
- **Cons**: FK breaks for guest games (no row) and couples lifecycles; enums need `ALTER TYPE`
  migrations for future concepts (fork/pin…), contradicting the no-migration intent ADR-0011/0013
  set with `text`.
- **Rejection reason**: FK-free `text` `game_id` + jsonb aggregate keeps guests and future concepts
  migration-free.

## Consequences

### Positive

- One owner-scoped table reusing the proven `lesson_progress`/`journal_entries` reconcile model;
  guest→login is duplicate- and loss-proof by `UNIQUE(user_id, game_id)`.
- 棋憶 adds **zero** new engine ownership — it consumes #7 read-only and reuses #7's re-analysis and
  the shipped PgnViewer; the moat is selection + presentation, not new compute.
- `schema_version` makes tuning changes safe (ignore, don't mix) without a recompute pipeline.
- Per-game selection as pure functions keeps it unit-testable in isolation (GDD AC-1…AC-6, AC-13) and
  consistent with #7's existing pure helpers.
- Reuses `useDataSyncStore` — no new module touches `supabase`.

### Negative

- A **third** persistence shape now exists in data-sync (`game_sessions`/`skill_scores` row-UUID;
  `journal_entries` event-key by `source_ref_id`; `memory_summaries` event-key by `game_id`). Must be
  documented so implementers copy the right `ON CONFLICT`.
- Schema-version ignore means a tuning change **silently shrinks** the F4 window until enough new
  games accrue — a deliberate, documented trade (a wrong trend is worse than a thin one, EC-7).
- A cold open from 棋誌 in a later session pays #7's re-analysis latency (bounded by #7's own time
  budget); acceptable and identical to game-replay today.

### Neutral

- Selection logic lives in `src/modules/memory/`, persistence in `useDataSyncStore`, the durable
  window in `useMemoryStore` — the derive-vs-persist split mirrors journal and game-history.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Implementer copies `ON CONFLICT (id)` and reconcile duplicates summaries | Medium | High | This ADR + a code comment at `appendMemorySummary`; reconcile test asserts `count == |distinct game_id|` |
| 棋憶 accidentally triggers analysis when results already exist | Medium | Medium — breaks "owns no analysis" + wastes engine on iPhone | AC-14 spies on `reviewEngine.analyze` → assert 0 calls when `analysisResults` present; gate on `phase`, never call analyze from `src/modules/memory/` |
| Migration file written but never run on live DB | Medium | High — table 404s in prod | `supabase/README.md` warns; verify with anon REST probe (HTTP 200 `[]`) before any persistence story is Done |
| `schema_version` not bumped after a real selection-tuning change → mixed-era summaries | Low | Medium | Bump constant in the same commit that changes F1/F5 selection/stage; a comment ties the constant to F1/F5; ADR-0014 names it the contract |
| Cold-open re-analysis surprises the user with latency | Low | Low | Reuse #7's existing "refining…" progressive UI (EC-3); no new UX |
| `game_id` handle differs between review-time and game-history save | Low | Medium | The review's `gameId` is the summary key; if game-history later saves under the same id they align; if not, the summary still stands alone (FK-free by design) — document the handle in the data-layer story |

## Performance Implications

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU (selection) | n/a | `selectMoments` = O(plies) over already-computed results; < 1 ms | 16.6 ms frame |
| Memory | n/a | `summaries[]` window (≤ `OBS_WINDOW`≈10–20) + one game's moments: < 100 KB | 150 MB ceiling |
| Load Time | n/a | One SELECT on dashboard open (current-schema rows); per-game view reuses #7 (no extra load when present) | < 3 s initial |
| Network | n/a | One INSERT per game summary (~300 B); one SELECT per cross-game load | negligible |
| Analysis | n/a | **0** new analyze calls when results exist; one #7 re-analysis only on cold open | #7's own time budget |

## Migration Plan

No existing memory data. New table.

1. Author `supabase/migrations/20260828000000_create_memory_summaries.sql` with the §1 DDL.
2. Apply **manually** via Dashboard SQL Editor (`supabase/README.md`) — repo is not CLI-linked.
   Success = `Success. No rows returned`.
3. Verify with the anon REST probe (README §"Verify a table"):
   `GET …/rest/v1/memory_summaries?select=*&limit=1` → HTTP 200 `[]`; unauthenticated POST → HTTP 401
   `42501` (RLS).
4. Update `supabase/README.md` table list to include `memory_summaries` (8 tables).
5. No CSP change (same `VITE_SUPABASE_URL` origin as ADR-0011).
6. Flip this ADR `Proposed → Accepted` (unblocks 棋憶 implementation stories) as the acceptance-gate
   story, mirroring ADR-0013 / Journal story-007.

**Rollback plan**: `drop table public.memory_summaries;` via SQL Editor. No other table references it
(FK is to `auth.users` only). Guest localStorage summaries are unaffected and re-reconcile on the next
successful schema.

## Validation Criteria

- [x] `memory_summaries` exists on the live DB; anon REST probe returns HTTP 200 `[]`; unauthenticated
  insert returns `42501`. *(Verified 2026-06-20.)*
- [ ] Inserting the same `(user_id, game_id)` twice yields exactly one row (`ON CONFLICT DO NOTHING`).
- [ ] Guest writes N summaries → login → cloud row count == `|distinct game_id|`; every local
  `game_id` present in cloud.
- [ ] Opening a game whose `analysisResults` are present issues **0** `reviewEngine.analyze` calls
  (AC-14); opening one whose results are absent triggers exactly #7's re-analysis path.
- [ ] `loadMemorySummaries()` returns only current-`schema_version` rows.
- [ ] `grep` shows only `auth.ts` and `data-sync.ts` import `src/lib/supabase`; `useMemoryStore` and
  `src/modules/memory/*` do not.
- [ ] 棋憶's surfaced types contain no emotive/score field; F4 emits no weakest-stage line under any
  window.

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/memory.md` | 棋憶 | "runs no new Stockfish analysis"; AC-14 (0 analyze on re-entry) | §3 read-only consumption of #7; selection is pure functions; engine only via #7's existing path on cold open |
| `design/gdd/memory.md` | 棋憶 | F4 `MemoryGameSummary` persisted via Data Sync with `schemaVersion` | §1 `memory_summaries` table; §5 `schema_version` column ignore-on-mismatch |
| `design/gdd/memory.md` | 棋憶 | EC-6 guest per-game + few-games line | §5 guest localStorage + union reconcile (journal pattern) |
| `design/gdd/memory.md` | 棋憶 | F2 White-normalized `E_white[i]` for the chart | §3 棋憶 derives it itself; #7 owes only side-to-move evals |
| `design/gdd/memory.md` | 棋憶 | Rule 18 / AC-16 replay reuses shipped PgnViewer + BASE_URL assets | §4 replay = PgnViewer + Move Annotation, not a hand-rolled board |
| `design/gdd/memory.md` | 棋憶 | Rule 23 / AC-15 journal `(gameId, ply)` deep-link opens this 棋憶 | §3/§4 deep-link mounts dashboard/replay at ply; reuses #21's handle |
| `design/gdd/memory.md` | 棋憶 | "no weakness verdict / no score" (vision guardrail) | §3 Pillar-3 type discipline; F4 has no `weak(stage)` branch |
| `design/gdd/post-game-review.md` | #7 | `biggestSwingCursor` computed once, never moves | §3 棋憶 reads it read-only; never re-derives or moves it |

## Related

- [ADR-0013](adr-0013-journal-data-model-and-session-boundary.md) — the `journal_entries` table +
  guest-localStorage/union-reconcile/event-key idempotency pattern this ADR copies (re-keyed on
  `game_id`). Same **third**-vs-second `ON CONFLICT` caveat (see Negative).
- [ADR-0011](adr-0011-supabase-authentication-and-data-sync-strategy.md) — `useDataSyncStore` is the
  sole supabase owner; this ADR adds `loadMemorySummaries`/`appendMemorySummary`.
- [ADR-0007](adr-0007-post-game-review-analysis-loop-and-sessionstorage-schema.md) — #7's analysis
  loop + ephemeral sessionStorage; the read-only source 棋憶 consumes and re-triggers on cold open.
- [ADR-0005](adr-0005-pinia-store-boundaries-and-completed-game-transport.md) — per-feature store
  boundary; `useMemoryStore` is a new feature store holding only the durable cross-game window.
- `design/gdd/memory.md` — the GDD this ADR implements (#22, Phase 2 ①).
- **Advisory (GDD + active.md)**: `journal.md` (#21) should reference 棋憶 as its review destination
  (the bidirectional half of the `gameId+ply` deep-link); scheduled as a story, not a GDD blocker.
