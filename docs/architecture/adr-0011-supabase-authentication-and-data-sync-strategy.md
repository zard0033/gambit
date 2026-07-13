# ADR-0011: Supabase Authentication and Data Sync Strategy

## Status
Accepted

> **Accepted**: 2026-06-01 — Sprint 7 implementation complete (S7-01–S7-07 all verified).
> Post-acceptance verification (S8-06, 2026-06-01): Magic Link end-to-end validated on iOS Safari.
> **Result**: ✅ Authentication flow complete — Magic Link email → sign-in → session established.
> **iOS PWA Deep Link Limitation**: Safari browser mode verified; PWA Deep Link (email → PWA app) deferred as iOS architectural constraint (not PWA-specific, affects all web apps on iOS). Web app functioning correctly in browser mode.
> `detectSessionInUrl: true` (supabase-js v2 default) confirmed handling `#access_token` fragment correctly on iOS Safari.

## Date
2026-05-30

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | TypeScript Web App (Vue 3 + @supabase/supabase-js ^2.x) |
| **Domain** | Cloud Backend / Authentication / Data Persistence |
| **Knowledge Risk** | LOW — supabase-js v2 API stable and within LLM training data |
| **References Consulted** | `design/gdd/supabase-integration.md`; @supabase/supabase-js v2 SDK |
| **Post-Cutoff APIs Used** | None — signInWithOtp, onAuthStateChange, RLS are all stable v2 patterns |
| **Verification Required** | Magic Link hash fragment on iOS PWA; ON CONFLICT DO NOTHING under concurrent retry; RLS policy enforcement with anon key |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0005 (Accepted — `gameStore.completedGame` is the data source for sync); ADR-0004 (Accepted — Vue Router provides `/history`/`/profile` route guard hooks) |
| **Enables** | Game History epic (#12 — reads via `useDataSyncStore.loadGameHistory()`); Skill Scoring epic (#13 — writes via `useDataSyncStore.syncSkillScore()`); Level Progression epic (#14 — reads skill_scores via Skill Scoring) |
| **Blocks** | Game History, Skill Scoring, Level Progression epics cannot begin implementation until this ADR is Accepted |
| **Ordering Note** | `useAuthStore.initAuth()` must be called in `App.vue` `onMounted` before any route requiring authentication resolves |

## Context

### Problem Statement
Game data (PGN, result, opening) and skill scores exist only in memory during a session. Closing the tab or switching devices permanently loses all progress. MVP Pillar 1 ("Accumulation Over Sessions") requires every completed game to be persistently recorded and retrievable across sessions and devices.

### Constraints
- GitHub Pages deployment: no server-side code, no custom HTTP headers — all auth is client-side
- iPhone Safari 16+ iOS PWA: Magic Link email click must open the PWA and process the `#access_token=...` hash fragment correctly
- Memory budget: Supabase client adds ~50 KB — negligible against the 150 MB ceiling (ADR-0001)
- No service-role key in client bundle: the Supabase anon key is public-safe; service-role is not
- Offline play must never be blocked: sync failures are queued locally, never shown as blocking errors

### Requirements
- Passwordless login (Magic Link OTP) — no passwords to manage or reset
- Persist `game_sessions` (full PGN + metadata) and `skill_scores` (snapshot per game) per user
- Row-level security: each user sees only their own rows; no server-side auth logic required
- Idempotent sync: replaying an insert must not create duplicate rows
- Sync completes within 3 seconds on 4G mobile without blocking PostGameReview display (AC-13)
- Unauthenticated play is supported — local-only, no login required

## Decision

### Auth Strategy: Magic Link OTP via supabase-js v2

`supabase.auth.signInWithOtp({ email })` sends a one-time link. The player taps it; the app opens with `#access_token=...&refresh_token=...` in the URL hash. `supabase.auth.onAuthStateChange()` fires `SIGNED_IN` with the resulting `Session`. supabase-js persists the session to `localStorage` and handles JWT refresh automatically.

Auth state is owned exclusively by `useAuthStore` (Pinia). No other store reads `supabase.auth.*` directly.

### Store Ownership: Two Pinia Stores

**`useAuthStore`** — auth identity (globally reactive):

```typescript
interface AuthState {
  userId: string | null    // null = unauthenticated
  email: string | null
  isAuthLoading: boolean   // true during initial getSession() on mount
}
// Actions: signIn(email), signOut(), initAuth()
```

**`useDataSyncStore`** — sync operations and status (globally reactive Pinia store, not a composable, so `syncStatus` is accessible across all components without prop-drilling):

```typescript
interface DataSyncState {
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error'
  lastSyncedGameId: string | null
}
// Actions: syncGame(game), syncSkillScore(score), loadGameHistory(), flushUnsyncedQueue()
```

### Supabase Client: Module Singleton

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

Only `src/stores/auth.ts` and `src/stores/data-sync.ts` import from `src/lib/supabase.ts`. All other modules interact with Supabase exclusively through these store interfaces.

### Schema: Two Append-Only Tables

**`game_sessions`** — one row per completed game:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` DEFAULT `gen_random_uuid()` | PK — client-generated for idempotency |
| `user_id` | `uuid` NOT NULL | FK → `auth.users.id` |
| `played_at` | `timestamptz` NOT NULL | Game start time (client-provided) |
| `result` | `text` NOT NULL | `'white_wins' \| 'black_wins' \| 'draw'` |
| `player_color` | `text` NOT NULL | `'white' \| 'black'` |
| `end_reason` | `text` NOT NULL | `'checkmate' \| 'resign' \| 'stalemate' \| 'draw_agreement' \| 'fifty_move' \| 'threefold' \| 'insufficient'` |
| `ai_difficulty` | `integer` NOT NULL | Stockfish skill level (0–20) |
| `pgn` | `text` NOT NULL | Full PGN string |
| `move_count` | `integer` NOT NULL | Total plies |
| `opening_eco` | `text` | ECO code (nullable) |
| `opening_name` | `text` | Opening name (nullable) |
| `created_at` | `timestamptz` DEFAULT `now()` | Server-side insert time |

> **Amendment (2026-07-03 拍板／2026-07-10 套用 live)**：`skill_scores` 已被移除（`supabase/migrations/20260830053142_drop_unused_tables.sql`）——`src/` 下零引用，從未接上任何讀寫路徑。本 ADR 原本啟用的 Skill Scoring epic（#13）／Level Progression epic（#14）並未在此 schema 下實作；若日後重啟，需要一份新的 schema 決策。

**`skill_scores`** — append-only snapshot per game:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` DEFAULT `gen_random_uuid()` | PK |
| `user_id` | `uuid` NOT NULL | FK → `auth.users.id` |
| `as_of_game_id` | `uuid` NOT NULL | FK → `game_sessions.id` |
| `opening_score` | `numeric(5,1)` NOT NULL | 0.0–100.0 |
| `tactics_score` | `numeric(5,1)` NOT NULL | 0.0–100.0 |
| `endgame_score` | `numeric(5,1)` NOT NULL | 0.0–100.0 |
| `level` | `integer` NOT NULL | Current level (1–N) |
| `created_at` | `timestamptz` DEFAULT `now()` | |

Latest skill state: `ORDER BY created_at DESC LIMIT 1`.

**RLS Policy (both tables):**

```sql
CREATE POLICY "Users access own rows" ON game_sessions
  USING (user_id = auth.uid());
-- Same pattern applied to skill_scores
```

No service-role key in client. RLS is the sole authorization layer.

### Sync Protocol: Immediate + Offline Queue

**Immediate sync** — triggered when `CompletedGame` is ready:

```
gameStore.completedGame (set by game-lifecycle)
  ↓
useDataSyncStore.syncGame(game)
  ↓
supabase.from('game_sessions').insert(row)
  ↙ success                        ↘ failure / offline
syncStatus: 'synced'         localStorage chess:unsynced:<id>
[remove from queue]                  [retry on SIGNED_IN]
```

**Idempotency**: `game_sessions.id` is client-generated (`crypto.randomUUID()`). Retries use `INSERT ... ON CONFLICT (id) DO NOTHING`.

**Offline queue flush**: On `onAuthStateChange` `SIGNED_IN` event → `flushUnsyncedQueue()` reads all `chess:unsynced:*` localStorage keys → bulk insert with `ON CONFLICT DO NOTHING`.

**In-session backoff**: Exponential backoff (Formula 3 in GDD: base 1s, max 30s). Cross-session: no backoff — queue is replayed fresh on next login.

### Architecture Diagram

```
App.vue onMounted → useAuthStore.initAuth()
                         ↓
                   supabase.getSession()
                         ↓ session found
                    userId set in store
                         ↓
               flushUnsyncedQueue()

   ┌──────────────────────────────────────────────────┐
   │  Game completes → gameStore.completedGame is set │
   └──────────────────────────────────────────────────┘
                         ↓
          useDataSyncStore.syncGame(completedGame)
               ↙ online                  ↘ offline/error
        game_sessions INSERT         localStorage chess:unsynced:<id>
        syncStatus: 'synced'         syncStatus: 'error'
                                     [retry on next SIGNED_IN]
```

### Key Interfaces

```typescript
// useAuthStore
initAuth(): Promise<void>         // called once on App.vue onMounted
signIn(email: string): Promise<void>
signOut(): Promise<void>
userId: string | null             // reactive; route guards read this
isAuthLoading: boolean

// useDataSyncStore
syncGame(game: CompletedGame): Promise<void>
syncSkillScore(score: SkillScoreInsert): Promise<void>
loadGameHistory(): Promise<GameSession[]>
flushUnsyncedQueue(): Promise<void>
syncStatus: 'idle' | 'syncing' | 'synced' | 'error'  // reactive

// Supabase singleton — internal to auth.ts and data-sync.ts only
// src/lib/supabase.ts exports: supabase: SupabaseClient
```

## Alternatives Considered

### Alternative 1: Traditional Email/Password
- **Description**: `supabase.auth.signInWithPassword({ email, password })`
- **Pros**: Familiar pattern; works offline after initial session
- **Cons**: Password reset flow required; password fatigue in casual apps; friction at first use
- **Rejection Reason**: Magic Link aligns with GDD Player Fantasy — "one email, one click." Password reset support is disproportionate for a casual training tool.

### Alternative 2: Social Login (Google OAuth)
- **Description**: `supabase.auth.signInWithOAuth({ provider: 'google' })`
- **Pros**: No password management; familiar to most users
- **Cons**: OAuth redirect URI on GitHub Pages is fragile (custom domain required); Google consent screen adds a step; excludes non-Google users
- **Rejection Reason**: GitHub Pages deployment complexity is disproportionate for v0. Magic Link is equally passwordless with simpler configuration.

### Alternative 3: Fully Anonymous (No Auth)
- **Description**: localStorage only; no cloud sync; no accounts
- **Pros**: Zero external dependency; simplest implementation
- **Cons**: No cross-device access; data lost on browser storage clear; violates Pillar 1
- **Rejection Reason**: Cross-session persistence is a core MVP requirement (Pillar 1). Anonymous play is supported as an on-ramp only.

### Alternative 4: IndexedDB for Offline Queue
- **Description**: IndexedDB instead of localStorage for the unsynced game queue
- **Pros**: Larger storage quota; structured queries
- **Cons**: Async API complicates flush logic; localStorage is sufficient for ≤50 games (~100 KB max)
- **Rejection Reason**: Over-engineered for MVP. localStorage is synchronous, always available, and sufficient for the bounded queue size (UNSYNCED_QUEUE_MAX = 50).

## Consequences

### Positive
- Passwordless auth eliminates password management and reset support burden
- Append-only schema eliminates update/delete conflict races
- Client-generated UUIDs enable idempotent retries without server coordination
- RLS enforces data isolation at database level — no server-side auth middleware
- Offline play is never blocked; localStorage queue is transparent to the player
- `useDataSyncStore` as Pinia store makes `syncStatus` globally accessible for PostGameReview badge, future Game History screen, and Profile screen

### Negative
- Magic Link requires email access at login time — no email means no cross-device persistence (acceptable for target audience)
- Magic Links expire (default 1 hour); players who delay must request a new link
- localStorage queue capped at 50 games (UNSYNCED_QUEUE_MAX) — heavy offline users risk losing oldest entries
- No mid-game persistence — Safari PWA process kill loses in-progress game state (v0 accepted; documented in GDD Edge Cases)
- **CSP update required**: `VITE_SUPABASE_URL` must be added to `connect-src` in `index.html` CSP meta tag (ADR-0008 is affected)

### Risks
- **iOS PWA Magic Link callback**: `#access_token` hash fragment must survive the iOS URL open. If PWA not installed, Safari may strip the fragment on redirect. _Mitigation_: Verify on-device before marking ADR Accepted; AC-02 explicitly tests this path.
- **localStorage unavailability** (private browsing): sync silently disabled. _Mitigation_: GDD Edge Cases documented; no player-visible error shown.
- **RLS misconfiguration**: A policy bug produces silent empty results (not an error). _Mitigation_: AC-11 and AC-12 test RLS isolation; integration tests run against local Supabase instance.
- **Supabase service availability**: sync fails when Supabase is down. _Mitigation_: All failures route to localStorage queue; no blocking player error shown.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| `supabase-integration.md` | AC-01–AC-05: Magic Link auth flow | `useAuthStore` owns signIn/signOut/initAuth; `onAuthStateChange` handles `SIGNED_IN` callback |
| `supabase-integration.md` | AC-06: game_sessions row before PostGameReview mounts | `syncGame()` called immediately on `CompletedGame`; PostGameReview reads `syncStatus` reactively for badge |
| `supabase-integration.md` | AC-07–AC-08: offline queue + bulk upload on login | `localStorage chess:unsynced:*` + `flushUnsyncedQueue()` on `SIGNED_IN` event |
| `supabase-integration.md` | AC-09: idempotent insert (no duplicates) | Client-generated UUID + `ON CONFLICT (id) DO NOTHING` |
| `supabase-integration.md` | AC-10: /history route guard | `useAuthStore.userId` read by Vue Router `beforeEach`; null → redirect home |
| `supabase-integration.md` | AC-11–AC-12: RLS data isolation | `user_id = auth.uid()` on both tables; no service-role key in client |
| `supabase-integration.md` | AC-13: sync ≤ 3s on 4G, non-blocking | `syncGame()` is non-blocking; PostGameReview mounts without awaiting sync; `syncStatus` updates reactively |

## Performance Implications
- **CPU**: Negligible — all Supabase calls are async network I/O; PGN JSON serialization < 1ms for typical game lengths
- **Memory**: ~50 KB supabase-js client; `useDataSyncStore` Pinia state < 1 KB; localStorage queue ≤ 100 KB (50 × ~2 KB PGN)
- **Load Time**: supabase-js bundled with app (no additional network round-trip on initial load); tree-shakeable
- **Network**: One INSERT per game (~500 B payload); one SELECT for `loadGameHistory()` (no pagination in v0 — add if game count exceeds 200); Magic Link send is one API call

## Migration Plan
No existing data to migrate — this is the first persistence layer introduced.
1. Author SQL in `supabase/migrations/` (Supabase CLI format)
2. Apply locally: `supabase db push`
3. Apply to production: `supabase db push --linked` after ADR is marked Accepted
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to GitHub Pages repository secrets for CI deployment
5. Update `index.html` CSP meta tag: add `VITE_SUPABASE_URL` to `connect-src` directive (required — ADR-0008)

## Validation Criteria
- All AC-01–AC-13 in `design/gdd/supabase-integration.md` pass
- `grep -r "createClient" src/ --include="*.ts" --exclude-path="src/lib/*" --exclude-path="src/stores/*"` returns zero matches
- `grep -r "SERVICE_ROLE" src/` returns zero matches
- Integration test: Player A query returns zero rows from Player B's data
- `supabase test db` passes all RLS policy tests for `game_sessions` and `skill_scores`

## Related Decisions
- ADR-0004: Vue Router — provides `beforeEach` route guard hooks for `/history` and `/profile` auth gates
- ADR-0005: Pinia Store Boundaries — `gameStore.completedGame` is the `CompletedGame` source for `syncGame()`; this ADR adds `useDataSyncStore` as a new Pinia store following the same ownership pattern
- ADR-0008: CSP Headers — `VITE_SUPABASE_URL` domain must be added to `connect-src` in `index.html`; failing to do so causes all Supabase fetch calls to be blocked by the browser CSP
