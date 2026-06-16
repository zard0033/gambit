# ADR-0013: Journal (棋誌) Data Model, Idempotency, and Session Boundary

## Status

Accepted

> **Accepted 2026-06-16**: `journal_entries` migration applied to live DB (`vfnzekqtvxhewifnmtnz`) via Dashboard SQL Editor. Verified by anon REST probe: `GET …/journal_entries?select=*&limit=1` → HTTP 200 `[]`; unauthenticated POST → HTTP 401 `42501` (RLS enforced). `UNIQUE(user_id, source_ref_id)` + `type text` per spec. Unblocks Journal story-001…006.

## Date

2026-06-16

## Last Verified

2026-06-16

## Decision Makers

Eason (product owner); Claude (technical-director role). Informed by the 2026-06-16 `/design-review` of `design/gdd/journal.md` (game-designer / systems-designer / qa-lead / ux-designer / creative-director).

## Summary

The Journal system (#21) needs a persistent, append-only, cross-device store for Neve-authored entries, plus a deterministic rule for *when* an entry is evaluated and written. This ADR specifies a single `journal_entries` Supabase table (owner-scoped RLS, union-reconcile like `lesson_progress`), **event-level idempotency via `UNIQUE(user_id, source_ref_id)`** (not row-UUID like ADR-0011), a new `useJournalStore` that derives candidates from already-persistent upstream state and persists through `useDataSyncStore` (ADR-0011), and a **lazy settle model** that needs no reliable app-close event — resolving the design-review's "session is not deterministic on iOS Safari" blocker by scoping v1 to the three pens (`onset`/`arrival`/`solace`) that are fully reconstructible from persistent state.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | TypeScript Web App (Vue 3 + Pinia 2 + @supabase/supabase-js ^2.x) |
| **Domain** | Core / Data Persistence / State Management |
| **Knowledge Risk** | LOW — Postgres DDL, RLS, supabase-js v2, Pinia 2 all within training data and stable |
| **References Consulted** | `design/gdd/journal.md`; `docs/architecture/adr-0011-supabase-authentication-and-data-sync-strategy.md`; `docs/architecture/adr-0005-pinia-store-boundaries-and-completed-game-transport.md`; `supabase/README.md`; `design/gdd/lesson-system.md`; `design/gdd/game-history.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | `UNIQUE(user_id, source_ref_id)` rejects duplicate event under concurrent retry; RLS isolation with anon key; localStorage→login union dedups on `source_ref_id` not row id |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0011 (Accepted — `useDataSyncStore` is the only module besides `auth.ts` allowed to touch `supabase.from`; RLS + union-reconcile pattern); ADR-0005 (Accepted — Pinia per-feature store boundary; new MVP feature gets its own store) |
| **Enables** | Journal epic v1 stories (onset / arrival / solace pens, journal overview UI, guest→login reconcile) |
| **Blocks** | All Journal v1 implementation stories cannot begin until this ADR is Accepted (ADR must be Accepted, not Proposed, per `docs/CLAUDE.md`) |
| **Ordering Note** | `journal_entries` migration must be applied to the live DB (Dashboard SQL Editor — `supabase/README.md`) before any sync story is verified. Journal reads `lesson_progress` and game-history result sequence — both already shipped — so no upstream GDD change is required for v1. |

## Context

### Problem Statement

The Journal GDD requires entries to persist append-only, survive across sessions and devices, never duplicate, and be written **at most once per session** by a deterministic rule. The 2026-06-16 design-review surfaced four data/persistence blockers that must be resolved before stories can be cut:

1. **No table exists** and the GDD specified entry fields only in prose, missing `user_id`/RLS (mandatory per ADR-0011), a queryable+unique idempotency key, and a `source_event` discriminator.
2. **Idempotency cannot use ADR-0011's mechanism.** ADR-0011 dedups on client-generated row UUID (`ON CONFLICT (id)`). That dedups *re-inserts of the same row*, not *two different rows describing the same event* — which is exactly what the guest→login reconcile produces (one row written as guest in localStorage, one re-derived after login). Without event-level uniqueness, reconcile duplicates `arrival`/`solace`/`onset`.
3. **"Session" is not deterministic on the target platform.** The GDD's primary settle trigger was "app close OR idle > timeout"; iOS Safari has no reliable app-close event, so the primary path is unreliable, and any ephemeral in-memory candidate is lost on tab kill.
4. **`firstTimeForMotif` / `stageId` dedup need a by-column query** the prose store didn't define.

### Current State

Six Supabase tables exist (`game_sessions`, `skill_scores`, `lesson_progress`, `dungeon_progress`, + auth). `useDataSyncStore` (ADR-0011) owns all `supabase.from` calls and the offline queue. `lesson_progress` is a monotonic union-reconcile table (`supabase/README.md`): row existence = the fact; local and cloud merge by union, never conflict. No journal table, no journal store.

### Constraints

- **GitHub Pages**: no server code; RLS is the sole authorization layer; anon key only.
- **iPhone Safari 16+ PWA**: no reliable `beforeunload`/app-close; background timers are suspended; offline play must never block.
- **ADR-0011 boundary**: only `src/stores/auth.ts` and `src/stores/data-sync.ts` may import `src/lib/supabase.ts`. Journal persistence routes through `useDataSyncStore`.
- **No CLI link** (`supabase/README.md`): migrations are applied manually via Dashboard SQL Editor.
- **v1 scope** (Eason 2026-06-16): only `onset` / `arrival` / `solace` — all reconstructible from persistent state (first-use, `lesson_progress.completed`, game-result sequence). `epiphany`/`move`/`weakness-arc`/`retrospect` are Phase 2.

### Requirements

- One append-only `journal_entries` table, owner-scoped RLS, `type text` (not PG enum) so Phase 2 pens need no migration.
- Event-level idempotency: the same trigger evaluated twice (reload, double-mount, guest→login) writes **one** row.
- Guest (unauthenticated) entries persist to localStorage and union-merge to cloud on login with zero duplicates and zero loss.
- A deterministic settle model that requires **no** reliable app-close event and survives a forced tab kill (every v1 candidate is reconstructible).
- `SESSION_IDLE_TIMEOUT` precisely defined and used **only** for `solace` cooldown counting and `arrival` cross-session carryover semantics — not as a hard "settle-or-lose" boundary.

## Decision

### 1. Table: `journal_entries` (append-only, owner-scoped RLS, union-reconcile)

```sql
-- supabase/migrations/0013_journal_entries.sql
create table if not exists public.journal_entries (
  id            uuid        primary key default gen_random_uuid(), -- client-generated
  user_id       uuid        not null references auth.users(id),
  type          text        not null,        -- 'onset' | 'arrival' | 'solace' | (Phase 2) 'epiphany' | 'move' | 'weakness-arc' | 'retrospect'
  source_ref_id text        not null,        -- idempotency/event key: onset='onset', arrival=stageId, solace=triggering gameId, (P2) epiphany=motifId, move=gameId+ply
  volume        text,                        -- '卷一規則'|'卷二戰術'|'卷三開局'|'卷四殘局'; NULL for onset (not filed in any volume)
  template_id   text        not null,        -- which template句 produced body; golden-file + lint anchor (R9 zero-AI)
  params        jsonb       not null default '{}'::jsonb, -- data injected into the template (stageName, lossSpan, …)
  body          text        not null,        -- rendered Neve text snapshot; IMMUTABLE per R2 (do not re-render on copy change)
  created_at    timestamptz not null default now(),
  unique (user_id, source_ref_id)            -- EVENT-level idempotency (see §3)
);

alter table public.journal_entries enable row level security;
create policy "Users access own rows" on public.journal_entries
  using (user_id = auth.uid());             -- USING also gates INSERT (WITH CHECK inherited), per supabase/README convention
```

**Why `body` snapshot AND `template_id`+`params`**: `body` is the immutable display text (R2 append-only — editing a template later must not change a written entry). `template_id`+`params` make every entry's text a *deterministic* `render(template_id, params)`, enabling golden-file assertions and the persona forbidden-token lint (R8/R9) without parsing prose. Both are stored.

**Why `type text` not a PG enum**: ADR-0011 deliberately uses `text` for `result`/`end_reason` to avoid enum-migration. Reserving Phase 2 pens (`epiphany`/`move`/…) behind a free `text` column honors the GDD's "no migration needed for ③⑥/①②" promise. **An enum here would break that.**

**Why no `replay_ref` column in v1**: the only pen that needs `gameId+ply` is `move` (②, Phase 2). When ② lands, add nullable `replay_game_id uuid` + `replay_ply int` (additive, no rewrite). v1 writes none.

### 2. Store boundary: new `useJournalStore`, persistence through `useDataSyncStore`

Per ADR-0005, this MVP feature gets its own store. Per ADR-0011, it must not import `supabase` directly.

```typescript
// src/stores/journal.ts — derivation + F2 selection; NO supabase import
export const useJournalStore = defineStore('journal', () => {
  const entries = ref<JournalEntry[]>([])          // merged view (cloud ∪ local)

  async function load(): Promise<void>             // dataSync.loadJournalEntries() ∪ localStorage, sort desc
  async function evaluate(trigger: SettleTrigger): Promise<void>  // §4: derive candidates → F2 → write top-≤SESSION_ENTRY_CAP(3) by priority
  function recent(n: number): JournalEntry[]       // homepage peek (HOMEPAGE_PEEK_COUNT)
  function byVolume(): Record<Volume, JournalEntry[]>
  return { entries, load, evaluate, recent, byVolume }
})

// src/stores/data-sync.ts — ADD these methods (only this file + auth.ts touch supabase)
loadJournalEntries(): Promise<JournalEntry[]>      // SELECT * ORDER BY created_at DESC
appendJournalEntry(e: JournalEntryInsert): Promise<void> // INSERT ... ON CONFLICT (user_id, source_ref_id) DO NOTHING; offline → chess:journal:unsynced:<source_ref_id>
```

`useJournalStore` reads upstream **persistent** state only: `useLessonProgressStore` (`completed` array → arrival), game-history result sequence (→ solace), and `entries` itself (→ onset existence, arrival/onset dedup). It never reads a live in-memory event.

### 3. Idempotency: `UNIQUE(user_id, source_ref_id)` + union reconcile

The dedup key is the **event**, not the row:

| pen | `source_ref_id` |
|---|---|
| `onset` | the constant string `'onset'` (one per user, ever) |
| `arrival` | the `stageId` of the completed stage |
| `solace` | the `gameId` of the loss that completed the streak |
| (P2) `epiphany` | the `motifId` |
| (P2) `move` | `"{gameId}:{ply}"` |

- **Cloud insert**: `INSERT ... ON CONFLICT (user_id, source_ref_id) DO NOTHING`. A reload, double-mount, or re-derivation that produces the same event is a no-op.
- **Guest→login reconcile**: read all local entries, `appendJournalEntry` each (bulk) with the same `ON CONFLICT` — the unique constraint, not the row UUID, collapses "same event written twice." This is the union-reconcile pattern of `lesson_progress`, but keyed on `source_ref_id` because journal rows (unlike a set of completed-IDs) carry a generated `id`.
- **`firstTimeForMotif` / `arrivalNotYetRecorded(stageId)` queries**: resolved against the in-memory merged `entries` array (filter by `type`+`source_ref_id`) — O(n) over a small list, no DB round-trip per candidate. After login, `load()` re-merges so the check sees both sources.

### 4. Lazy settle model (no reliable close event required)

Because every v1 pen is reconstructible from persistent state, settling is **idempotent re-evaluation**, not "capture-or-lose":

```
evaluate(trigger) is called on ANY of:
  - app start (after auth init + journal load)
  - entering /journal or rendering the homepage peek
  - lesson stage just completed (lesson-progress changed)
  - a game just ended (game result appended)

evaluate():
  1. derive eligibleCandidates from persistent state (F1 gates):
       onset   if no entry with source_ref_id='onset'
       arrival if a stage in lesson_progress.completed has no arrival entry for its stageId
       solace  if consecutiveLosses ≥ SOLACE_LOSS_STREAK and sessionsSinceLastSolace ≥ SOLACE_COOLDOWN
  2. if empty → return (no write)
  3. chosen = topN(eligible, SESSION_ENTRY_CAP=3, by priority desc)  (onset 5 > arrival 3 > solace 2)   [F2]
                // v1: |eligible| ≤ 3 always → cap never truncates → all eligible written
  4. for each c in chosen: appendJournalEntry(render(c))   // ON CONFLICT makes a duplicate trigger a no-op
```

A forced tab kill before step 4 loses nothing: the next `evaluate` (on restart) re-derives the same candidate from the same persistent state. **This is why v1 has no "unsettled candidate lost" failure** — the design-review's iOS-close blocker does not apply to v1. (Phase 2 `epiphany`/`move` *do* depend on ephemeral event-time data; the in-memory session buffer and a reliable-ish settle path are deferred to that work.)

### 5. Session boundary (for cooldown/carryover counting only)

`SESSION_IDLE_TIMEOUT = 30 min` (range 10–60, GDD Tuning Knob). Session state is **device-local** in localStorage, never synced:

```
chess:journal:session = { ordinal: number, lastActivityAt: epochMs }

on app activity:
  if now - lastActivityAt > SESSION_IDLE_TIMEOUT*60_000 → ordinal += 1
  lastActivityAt = now
```

- **`sessionsSinceLastSolace`** = `currentOrdinal − chess:journal:lastSolaceOrdinal` (∞ if never). `lastSolaceOrdinal` is written (device-local) when a solace entry is created.
- **`arrival` cross-session carryover** (Edge Case): needs no session math — it is purely "does an arrival row exist for this `stageId`?" If onset out-prioritised it this session, the next `evaluate` (next session or even next trigger) still finds the stage un-recorded and writes it.

**Accepted limitation**: solace cooldown is device-local, so a user active on two devices could receive solace on each within the cooldown window. Low frequency, low harm (an extra gentle note), and avoids syncing a counter purely to throttle an anti-spam rule. Documented, not mitigated.

### Architecture

```
upstream PERSISTENT state (already shipped)         useJournalStore (logic; NO supabase)
  ├─ first use? (no 'onset' entry)  ───────────────►  evaluate(trigger)
  ├─ lesson_progress.completed[]    ───────────────►    F1 gates → candidates
  └─ game-history result sequence   ───────────────►    F2 argmax (onset5 > arrival3 > solace2)
                                                          │ render(template_id, params) → body
                                                          ▼
                                              useDataSyncStore.appendJournalEntry()   ← ONLY store touching supabase
                                                ↙ online                         ↘ offline
                            INSERT journal_entries                       localStorage chess:journal:unsynced:<source_ref_id>
                            ON CONFLICT (user_id, source_ref_id) DO NOTHING   [flush on SIGNED_IN]
                                                ▼
                            journal_entries (RLS user_id = auth.uid())

guest (no auth): entries → localStorage chess:journal:entries
   on SIGNED_IN → bulk appendJournalEntry (union by source_ref_id) → merged view re-loaded
device-local, never synced: chess:journal:lastSeenAt, chess:journal:session, chess:journal:lastSolaceOrdinal
```

### Key Interfaces

```typescript
type Pen = 'onset' | 'arrival' | 'solace'            // v1; widen for Phase 2 (no migration)
type Volume = '卷一規則' | '卷二戰術' | '卷三開局' | '卷四殘局'

interface JournalEntry {
  readonly id: string
  readonly type: Pen
  readonly sourceRefId: string                        // event key (idempotency)
  readonly volume: Volume | null                      // null for onset
  readonly templateId: string
  readonly params: Record<string, unknown>
  readonly body: string                               // immutable rendered text
  readonly createdAt: number                          // epoch ms (mirrors created_at)
}
type SettleTrigger = 'app-start' | 'journal-open' | 'stage-complete' | 'game-end'
```

### Implementation Guidelines

- `body` is rendered **once** at write time and frozen; copy/lint tooling reads `templateId`+`params` for golden assertions, never re-renders the stored entry.
- Guest localStorage key family is `chess:journal:*` (aligns with data-sync's `chess:` namespace, since data-sync owns persistence). Distinct from `pgr:lessons:progress`.
- `evaluate()` must be safe to call redundantly (it is idempotent by construction) — call it liberally on the four triggers rather than trying to catch a single "session end."
- Never read a live in-memory lesson/review event for a v1 pen — derive from the persisted `lesson_progress`/game-history only.

## Alternatives Considered

### Alternative 1: Reuse ADR-0011 row-UUID idempotency (`ON CONFLICT (id)`)

- **Description**: Generate a client UUID per entry; dedup on `id` like `game_sessions`.
- **Pros**: Identical to existing pattern; no new unique constraint.
- **Cons**: Dedups only re-inserts of the *same row object*. The guest→login reconcile re-derives a *new* row (new UUID) for the same event → duplicate `arrival`/`solace`/`onset`. The whole point (write-once-per-event) is unmet.
- **Estimated Effort**: Same.
- **Rejection Reason**: Does not satisfy the idempotency requirement across the localStorage→cloud boundary. Event-level `UNIQUE(user_id, source_ref_id)` is mandatory.

### Alternative 2: In-memory session buffer with capture-on-event + flush-on-close (the original GDD model)

- **Description**: Push candidates into a RAM buffer at event time; settle/flush on app-close or idle timeout.
- **Pros**: Needed for Phase 2 ephemeral pens (`epiphany`/`move`) where data exists only at the moment.
- **Cons**: iOS Safari has no reliable close event; background timers suspend; a tab kill loses the buffer. For v1 pens this is *unnecessary* — the data is already persistent.
- **Estimated Effort**: Higher (timer lifecycle, visibilitychange handling, buffer persistence).
- **Rejection Reason**: Over-engineered and unreliable for v1. Lazy re-derivation from persistent state is simpler and loss-proof. The buffer model returns in Phase 2 *only* for the genuinely ephemeral pens.

### Alternative 3: Store rendered `body` only (no `template_id`/`params`)

- **Description**: Persist just the final text.
- **Pros**: Smallest schema.
- **Cons**: Tone/register ACs become un-testable (can't assert against a known template; can't lint deterministically without re-deriving intent). qa-lead flagged AC1/5/9/10 as untestable prose otherwise.
- **Rejection Reason**: Storing `template_id`+`params` is what makes R9 (zero-AI) pay off as golden-file testability. Cheap columns, large QA benefit.

### Alternative 4: PG enum for `type`

- **Description**: `create type journal_pen as enum (...)`.
- **Pros**: DB-level validation.
- **Cons**: Adding Phase 2 pens requires `ALTER TYPE` — a migration — contradicting the GDD's "type reserved, no migration" promise. Diverges from ADR-0011's deliberate `text` choice.
- **Rejection Reason**: Breaks the no-migration-for-Phase-2 guarantee.

## Consequences

### Positive

- Single append-only table, owner-scoped RLS — inherits the proven `lesson_progress` reconcile model.
- Event-level uniqueness makes guest→login reconcile duplicate-proof and reload-proof.
- Lazy settle eliminates the iOS app-close dependency — v1 has no "unsettled-candidate lost" failure mode.
- `type text` keeps all Phase 2 pens migration-free.
- `template_id`+`params`+`body` gives both immutability (R2) and deterministic testability (R8/R9).
- Reuses `useDataSyncStore` boundary — no new module touches `supabase`.

### Negative

- A second idempotency convention now exists in the codebase (`ON CONFLICT (id)` for `game_sessions`/`skill_scores`; `ON CONFLICT (user_id, source_ref_id)` for `journal_entries`). Must be documented so implementers don't copy the wrong one.
- `evaluate()` runs on four triggers — slightly more invocations — but each is a cheap in-memory derive + a no-op insert when nothing changed.
- Solace cooldown is device-local (cross-device over-fire possible; accepted).

### Neutral

- Journal logic lives in `useJournalStore` but persistence in `useDataSyncStore` — the read/derive vs persist split mirrors how Game History reads via data-sync.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Implementer copies `ON CONFLICT (id)` from ADR-0011 and reconcile duplicates entries | Medium | High — duplicate Neve entries break "append-only, no repeat" | This ADR + a code comment at `appendJournalEntry`; AC-guest-reconcile integration test asserts `count == |distinct source_ref_id|` |
| `UNIQUE(user_id, source_ref_id)` violation surfaces as an error instead of silent no-op | Low | Medium | Use `ON CONFLICT ... DO NOTHING` (not a bare insert); verify the constraint name; probe with the anon REST recipe in `supabase/README.md` |
| Migration file written but never run on live DB | Medium | High — table 404s in prod | `supabase/README.md` warns explicitly; verify with anon REST probe (HTTP 200 `[]`) before marking any sync story Done |
| Device-local session ordinal drift (clock change / cleared storage) mis-counts cooldown | Low | Low — at worst an extra or missing solace | Cooldown is a soft anti-spam; acceptable. Never used for correctness of onset/arrival. |
| Phase 2 `replay_ref` retro-fit | Low | Low | Additive nullable columns; no rewrite of v1 rows |

## Performance Implications

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU (settle) | n/a | `evaluate()` = O(n) derive over ≤ a few hundred entries + 1 no-op/insert; < 1 ms | 16.6 ms frame |
| Memory | n/a | `entries[]` merged view: ~300 B/entry × ≤ few hundred ≈ < 100 KB | 150 MB ceiling |
| Load Time | n/a | One SELECT on app start (no pagination v1; add if entries > 500) | < 3 s initial |
| Network | n/a | One INSERT per written entry (~400 B); one SELECT per load | negligible |

## Migration Plan

No existing journal data. New table.

1. Author `supabase/migrations/0013_journal_entries.sql` with the DDL in §1.
2. Apply **manually** via Dashboard SQL Editor (`supabase/README.md`) — repo is not CLI-linked. Success = `Success. No rows returned`.
3. Verify with the anon REST probe (README §"Verify a table"): `GET …/rest/v1/journal_entries?select=*&limit=1` → HTTP 200 `[]`; unauthenticated POST → HTTP 401 `42501` (RLS).
4. Update `supabase/README.md` table list to include `journal_entries` (7 tables).
5. No CSP change (same `VITE_SUPABASE_URL` origin as ADR-0011).

**Rollback plan**: `drop table public.journal_entries;` via SQL Editor. No other table references it (FK is to `auth.users` only). Guest localStorage entries are unaffected and re-reconcile on the next successful schema.

## Validation Criteria

- [ ] `journal_entries` exists on the live DB; anon REST probe returns HTTP 200 `[]`; unauthenticated insert returns `42501`.
- [ ] Inserting the same `(user_id, source_ref_id)` twice yields exactly one row (`ON CONFLICT DO NOTHING`).
- [ ] Guest writes N entries → login → cloud row count == `|distinct source_ref_id|`; every local `source_ref_id` present in cloud (AC-guest-reconcile).
- [ ] `evaluate()` called twice for the same completed stage writes one `arrival` row (AC-arrival-2).
- [ ] Forced reload mid-session re-derives and does not duplicate (idempotent settle).
- [ ] `grep` shows only `auth.ts` and `data-sync.ts` import `src/lib/supabase`; `useJournalStore` does not.
- [ ] `type` column is `text` (not a PG enum) — `\d journal_entries` confirms.

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/journal.md` | Journal | R2 append-only, immutable `created_at` | `journal_entries` append-only; `body` frozen snapshot; no update/delete path |
| `design/gdd/journal.md` | Journal | R5 v1 derivable-not-ephemeral settle | §4 lazy `evaluate()` on 4 triggers; reconstructible from persistent state; no close event |
| `design/gdd/journal.md` | Journal | R6 once-only / dedup keys | §3 `source_ref_id` per pen + `UNIQUE(user_id, source_ref_id)` |
| `design/gdd/journal.md` | Journal | R9 zero-AI deterministic text | `template_id`+`params`+`body`; golden-file + lint testable |
| `design/gdd/journal.md` | Journal | AC-guest-reconcile (union, no dup, no loss) | §3 union reconcile keyed on `source_ref_id`, `ON CONFLICT DO NOTHING` |
| `design/gdd/journal.md` | Journal | AC-solace-2 cooldown; arrival carryover | §5 device-local session ordinal; carryover = stageId-existence, no session math |
| `design/gdd/journal.md` | Journal | Tuning: `SESSION_IDLE_TIMEOUT` | §5 defined = 30 min (10–60), scoped to cooldown/carryover only |
| `design/gdd/journal.md` | Journal | `type` reserved for Phase 2 ①②③⑥ no migration | §1 `type text` (not enum); `replay_ref` additive when ② lands |

## Related

- [ADR-0011](adr-0011-supabase-authentication-and-data-sync-strategy.md) — provides `useDataSyncStore` (sole supabase owner), RLS + offline-queue pattern; this ADR adds journal methods and a **second** idempotency convention (event-key, not row-UUID — see Risks).
- [ADR-0005](adr-0005-pinia-store-boundaries-and-completed-game-transport.md) — per-feature Pinia store boundary; `useJournalStore` is a new MVP store following it.
- `design/gdd/journal.md` — the GDD this ADR implements (v1 = onset/arrival/solace).
- `supabase/README.md` — manual Dashboard migration process + anon REST verification recipe.
- **Phase 2 follow-up**: when `epiphany`/`move` land, a successor ADR (or amendment) must specify the in-memory session buffer + ephemeral capture (Alternative 2), the `#18` per-answer `motif`+`hintUsed` event, the `#7` per-move calm-move signal, and the additive `replay_*` columns.
