# Supabase Integration (Authentication + Data Sync)

> **Status**: In Design
> **Author**: Eason Lee + Claude Code agents
> **Last Updated**: 2026-05-30
> **Implements Pillar**: Pillar 1 (Accumulation Over Sessions)
> **Covers Systems**: #9 Authentication · #11 Data Sync (Supabase)

## Overview

Supabase Integration is the persistence foundation for the Chess Training Companion's MVP phase. It provides two tightly-coupled services: (1) **Authentication** via Supabase Magic Link — a passwordless email login that lets players claim ownership of their progress without creating another password; and (2) **Data Sync** — an append-only, user-scoped database that persists completed games, skill scores, and level state across devices and sessions. The system operates entirely in the background: after a one-time login, every game the player finishes is automatically written to Supabase, and every device opening the app loads the latest state. When offline (iPhone PWA, spotty connectivity), play continues uninterrupted and sync completes the next time a connection is available. Authentication is a prerequisite for all persistence — unauthenticated state is local-only with a prompt to log in.

## Player Fantasy

The player never has to think about saving. They finish a game on their laptop on Monday, pick up their phone on Thursday, and their games and scores are exactly where they left them — no account setup, no password to forget, no "did I save?" moment. The one-time Magic Link login feels like claiming ownership rather than registering for a service: one email, one click, and the app silently starts keeping their history. The system's success is its invisibility: when sync is working, players don't notice it. They only notice if it's missing — and with offline-first design, even a bad connection doesn't interrupt play.

## Detailed Design

### Authentication Flow

1. Player taps "Sign in" → app calls `supabase.auth.signInWithOtp({ email })` → Supabase sends Magic Link email.
2. Player taps link in email → browser/iOS opens the app URL with `#access_token=...&refresh_token=...` fragment.
3. On app load, `supabase.auth.onAuthStateChange()` fires with event `SIGNED_IN` and a `Session` object.
4. App stores the session; `supabase-js` persists it to `localStorage` automatically.
5. Subsequent sessions: `supabase.auth.getSession()` on mount → if valid session, user is logged in silently.
6. Token refresh: `supabase-js` handles JWT refresh automatically when token nears expiry.
7. Sign out: `supabase.auth.signOut()` → clears `localStorage` session; app returns to unauthenticated state.

**Auth state in Pinia** — owned by `useAuthStore`:

```typescript
interface AuthState {
  userId: string | null   // null = unauthenticated
  email: string | null
  isAuthLoading: boolean  // true during initial session check on mount
}
```

No other store reads Supabase session directly — all auth state flows through `useAuthStore`.

**Unauthenticated play**: Player may play without logging in. `CompletedGame` objects are written to `localStorage` under key `chess:unsynced:<gameId>`. On next login, `useAuthStore` detects unsynced entries and triggers bulk upload.

---

### Database Schema

**Table: `game_sessions`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` DEFAULT `gen_random_uuid()` | Primary key (client-generated for idempotency) |
| `user_id` | `uuid` NOT NULL | FK → `auth.users.id` |
| `played_at` | `timestamptz` NOT NULL | Game start time (client-provided) |
| `result` | `text` NOT NULL | `'white_wins' \| 'black_wins' \| 'draw'` |
| `player_color` | `text` NOT NULL | `'white' \| 'black'` |
| `end_reason` | `text` NOT NULL | `'checkmate' \| 'resign' \| 'stalemate' \| 'draw_agreement' \| 'fifty_move' \| 'threefold' \| 'insufficient'` |
| `ai_difficulty` | `integer` NOT NULL | Stockfish skill level (0–20) |
| `pgn` | `text` NOT NULL | Full PGN string (chess.js output) |
| `move_count` | `integer` NOT NULL | Total plies |
| `opening_eco` | `text` | ECO code (nullable — may be unknown) |
| `opening_name` | `text` | Opening name string (nullable) |
| `created_at` | `timestamptz` DEFAULT `now()` | Server-side insert time |

**Table: `skill_scores`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` DEFAULT `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` NOT NULL | FK → `auth.users.id` |
| `as_of_game_id` | `uuid` NOT NULL | FK → `game_sessions.id` |
| `opening_score` | `numeric(5,1)` NOT NULL | 0.0–100.0 |
| `tactics_score` | `numeric(5,1)` NOT NULL | 0.0–100.0 |
| `endgame_score` | `numeric(5,1)` NOT NULL | 0.0–100.0 |
| `level` | `integer` NOT NULL | Current level (1–N) |
| `created_at` | `timestamptz` DEFAULT `now()` | |

`skill_scores` is append-only. Latest record (`ORDER BY created_at DESC LIMIT 1`) = current state.

**Row Level Security (RLS)**:

- Both tables: `user_id = auth.uid()` on ALL operations (SELECT, INSERT, UPDATE, DELETE).
- No service-role key in client — RLS is the sole authorization layer.

---

### Sync Protocol

**Immediate sync** — triggered when `GameLifecycle` emits game completion:

```
CompletedGame ready
  ↓
useDataSyncStore.syncGame(completedGame)
  ↓
Build GameSessionInsert from CompletedGame
  ↓
supabase.from('game_sessions').insert(row)
  ↓ success → mark gameId as synced; remove from unsynced queue
  ↓ failure → write to localStorage under chess:unsynced:<gameId>
```

**Retry on next login** (unsynced queue):

```
useAuthStore: SIGNED_IN event
  ↓
Read all chess:unsynced:* keys from localStorage
  ↓
For each: attempt insert with ON CONFLICT DO NOTHING
  ↓ success → remove from localStorage
  ↓ failure → leave in queue (retry on next login)
```

**Idempotency**: `game_sessions.id` is a client-generated UUID (from `crypto.randomUUID()`). Retrying an insert for the same `id` is safe via Postgres `ON CONFLICT (id) DO NOTHING` — no duplicate rows.

---

### Offline Behavior

| Scenario | Behavior |
| --- | --- |
| Play with no internet | `CompletedGame` stored to `localStorage:chess:unsynced:<gameId>`. Play is never blocked. |
| Sync fails (timeout / 5xx) | Same as offline — stored locally, retry on next app open / login event. |
| iPhone PWA backgrounded mid-game | Game state is in-memory (not yet a `CompletedGame`). If Safari kills the tab, the in-progress game is lost — acceptable in v0 (no mid-game persistence). |
| Two devices, different unsynced queues | Each device syncs its own queue independently. Server `created_at` provides canonical ordering. |
| `localStorage` not available (private browsing) | Sync silently disabled; game plays but does not persist. No error shown to player. |

---

### Interactions with Other Systems

| System | Direction | Interface |
| --- | --- | --- |
| **Game Lifecycle** | → (provides data) | `useDataSyncStore` reads `CompletedGame` from `gameStore.completedGame` after terminal state |
| **Post-Game Review** | ← (waits for sync) | Sync call completes before ReviewView mounts; ReviewView reads `useDataSyncStore.syncStatus` to show "Saved" / "Saving…" badge |
| **Skill Scoring** (MVP) | → (triggers write) | Skill Scoring computes deltas → calls `useDataSyncStore.syncSkillScore()` to write `skill_scores` row |
| **Game History** (MVP) | ← (reads data) | `useDataSyncStore.loadGameHistory()` queries `game_sessions ORDER BY played_at DESC` |
| **App Router** | ← (guards routes) | `/history` and `/profile` routes guarded by `useAuthStore.userId !== null`; unauthenticated redirect to home |

## Formulas

### Formula 1 — Session Token Expiry Window

`shouldRefreshToken = (tokenExpiresAt - now) < TOKEN_REFRESH_BUFFER_MS`

| Variable | Symbol | Type | Range | Description |
| --- | --- | --- | --- | --- |
| Token expiry timestamp | `tokenExpiresAt` | number (ms) | any future timestamp | JWT exp claim × 1000 |
| Current time | `now` | number (ms) | monotonic | `Date.now()` |
| Refresh buffer | `TOKEN_REFRESH_BUFFER_MS` | integer | 60,000–300,000 ms | How early to refresh before expiry |

**Output**: boolean — true = trigger refresh, false = session still valid  
**Default**: `TOKEN_REFRESH_BUFFER_MS = 300_000` (5 minutes before expiry)  
**Note**: `supabase-js` handles this automatically via `onAuthStateChange('TOKEN_REFRESHED')`. This formula documents the observable threshold, not implementation code.  
**Status note（2026-07-03）**：`TOKEN_REFRESH_BUFFER_MS` 與下方 Retry 公式的 `SYNC_BASE_DELAY_MS`／
`SYNC_MAX_DELAY_MS` 已自 `sync-tuning.ts` 移除——三者從未被程式讀取（token 續期由 supabase-js
內建；同步失敗由 unsynced queue 於下次啟動 flush 兜底，session 內退避重試未實作）。公式保留為
設計參考；若日後實作再恢復常數。

---

### Formula 2 — Unsynced Queue Size Guard

`unsyncedCount = localStorage.keys.filter(k => k.startsWith('chess:unsynced:')).length`

`syncBlocked = unsyncedCount >= UNSYNCED_QUEUE_MAX`

| Variable | Symbol | Type | Range | Description |
| --- | --- | --- | --- | --- |
| Unsynced game count | `unsyncedCount` | integer | 0–∞ | Games pending sync |
| Max queue size | `UNSYNCED_QUEUE_MAX` | integer | 10–100 | Maximum games held offline |

**Output**: boolean — true = oldest entry will be dropped to make room  
**Default**: `UNSYNCED_QUEUE_MAX = 50`  
**Behaviour at limit**: Drop oldest entry (oldest `chess:unsynced:*` key by insertion order) and log a console warning. Never block play.

---

### Formula 3 — Sync Retry Backoff

`retryDelayMs = min(SYNC_BASE_DELAY_MS × 2^attempt, SYNC_MAX_DELAY_MS)`

| Variable | Symbol | Type | Range | Description |
| --- | --- | --- | --- | --- |
| Base delay | `SYNC_BASE_DELAY_MS` | integer | 500–5,000 ms | First retry wait |
| Attempt count | `attempt` | integer | 0–N | Zero-indexed retry number |
| Max delay | `SYNC_MAX_DELAY_MS` | integer | 30,000–120,000 ms | Ceiling on backoff |

**Output range**: 1,000 ms (attempt 0) → capped at `SYNC_MAX_DELAY_MS`  
**Defaults**: `SYNC_BASE_DELAY_MS = 1_000`, `SYNC_MAX_DELAY_MS = 30_000`  
**Example**: attempt 0 → 1s; attempt 1 → 2s; attempt 2 → 4s; attempt 5 → 30s (capped)  
**Note**: Retries occur only within the same session. If the app is closed, the queue persists to localStorage and is retried fresh on next open — backoff resets to 0.

## Edge Cases

- **If Magic Link is clicked on a different device than the one that requested it**: Supabase issues tokens to whichever device follows the link. Both devices will eventually have valid sessions via `onAuthStateChange`. No data loss; both devices may be logged in simultaneously (expected for cross-device use).

- **If Magic Link expires before the player clicks it** (default Supabase expiry: 1 hour): The app detects `AuthError` with code `otp_expired` on the callback URL and shows "Link expired — request a new one." Player must call `signInWithOtp` again.

- **If the player has no internet when PostGameReview mounts and sync was not called**: The `syncStatus` badge shows "Not saved yet." The player is not blocked from reviewing. On next connectivity, the app retries via the unsynced queue.

- **If `game_sessions` insert returns a duplicate key error** (same UUID inserted twice): `ON CONFLICT (id) DO NOTHING` discards the duplicate silently. The app treats this as success (idempotent by design).

- **If `localStorage` is full** (quota exceeded): The unsynced queue write fails silently. The player sees "Unable to save offline — please sign in to save." No crash.

- **If the player signs out while a sync is in flight**: The in-flight request completes or fails. If it fails after sign-out, the game is dropped — we cannot attribute it to an unknown future user. Unsynced queue is cleared on sign-out.

- **If the player logs in on a new device and has unsynced games on both devices**: Each device uploads its own queue independently. Server receives both sets; no conflict (each game has a unique UUID from its originating device).

- **If `onAuthStateChange` fires `SIGNED_OUT` unexpectedly** (token revoked server-side): `useAuthStore` clears `userId` and redirects to home. Any in-flight sync is abandoned. Unsynced queue remains in `localStorage` for re-authentication.

- **If `skill_scores` has no rows for a user** (first login, no games yet): All queries return empty results. App shows "No games yet" state — not an error.

- **If the player plays more than `UNSYNCED_QUEUE_MAX` games offline**: Oldest entries are dropped from `localStorage` to make room. Console warning logged. No player-visible error (Pillar 3 — no pressure).

## Dependencies

### Upstream (this system depends on)

| System | Dependency Type | Interface |
| --- | --- | --- |
| **Supabase** (external service) | Hard — cannot sync without it | `@supabase/supabase-js` SDK v2; project URL + anon key from env vars |
| **Game Lifecycle** | Hard — provides data to sync | `CompletedGame` object from `gameStore.completedGame` (ADR-0005) |
| **App Router** | Soft — guards auth-gated routes | `useAuthStore.userId` read by route guards; no direct dependency on Router internals |

### Downstream (systems that depend on this one)

| System | Dependency Type | What it needs |
| --- | --- | --- |
| **Game History** (#12) | Hard — cannot load history without sync | `useDataSyncStore.loadGameHistory()` → returns `GameSession[]` from Supabase |
| **Skill Scoring** (#13) | Hard — cannot persist scores without sync | `useDataSyncStore.syncSkillScore()` → writes `skill_scores` row after each game |
| **Level Progression** (#14) | Indirect (via Skill Scoring) | Reads latest level from `skill_scores`; does not call Data Sync directly |
| **Post-Game Review** | Soft — reads sync status for badge | `useDataSyncStore.syncStatus` to display "Saved" / "Saving…" indicator |

### Bidirectional Consistency Notes

- **Game Lifecycle GDD** exposes `CompletedGame` via `gameStore.completedGame` before PostGameReview mounts (ADR-0005). This GDD depends on that contract.
- **Game History GDD** (not yet authored) must document that it reads through `useDataSyncStore.loadGameHistory()` — not direct Supabase calls.
- **Skill Scoring GDD** (not yet authored) must document that it writes through `useDataSyncStore.syncSkillScore()` — not its own Supabase client instance.

## Tuning Knobs

| Knob | Default | Safe Range | Effect of Too Low | Effect of Too High |
| --- | --- | --- | --- | --- |
| `TOKEN_REFRESH_BUFFER_MS` | 300,000 ms (5 min) | 60,000–600,000 ms | Token expires before refresh triggers → unexpected sign-out | Refreshes too often → wastes network calls on mobile |
| `UNSYNCED_QUEUE_MAX` | 50 games | 10–200 | Queue fills quickly on spotty connection → data loss for heavy offline users | Large `localStorage` footprint; startup scan slows on old hardware |
| `SYNC_BASE_DELAY_MS` | 1,000 ms | 500–5,000 ms | Hammers Supabase with retries on flaky connection | First retry feels sluggish |
| `SYNC_MAX_DELAY_MS` | 30,000 ms | 10,000–120,000 ms | Retries too aggressively when server is down | Unsynced game sits in queue too long after brief disconnect |
| `MAGIC_LINK_OTP_EXPIRY` | 3,600 s (1 hr) | 300–86,400 s | Players who check email slowly cannot log in | Security window too wide |

**Notes**:
- `MAGIC_LINK_OTP_EXPIRY` is configured in the Supabase dashboard, not in app code — changing it requires a project settings update.
- All other knobs live in `src/config/sync-tuning.ts` as `const` exports.
- Tuning knobs for downstream systems (score decay rate, level thresholds) are defined in their respective GDDs, not here.

## Acceptance Criteria

**Authentication**

- **AC-01**: GIVEN the player enters a valid email and taps "Sign in", WHEN `signInWithOtp` succeeds, THEN the app shows "Check your email" state and an email with a Magic Link is sent.
- **AC-02**: GIVEN the player taps the Magic Link in email, WHEN the app opens the callback URL, THEN `onAuthStateChange` fires `SIGNED_IN`, `useAuthStore.userId` is set to the user's UUID, and the player returns to home (or the originating page).
- **AC-03**: GIVEN the player returns after closing and reopening the app with a still-valid session, WHEN `getSession()` is called on mount, THEN the player is silently logged in without seeing the sign-in flow.
- **AC-04**: GIVEN the player is logged in and taps "Sign out", WHEN `signOut()` completes, THEN `useAuthStore.userId` is null and the player is on the home screen.
- **AC-05**: GIVEN a Magic Link that has expired (> 1 hour old), WHEN the player taps it, THEN the app shows "Link expired — request a new one" and does not crash.

**Data Sync**

- **AC-06**: GIVEN the player is logged in and completes a game, WHEN PostGameReview is about to mount, THEN `game_sessions` contains a row with the correct `pgn`, `result`, `player_color`, and `opening_eco`.
- **AC-07**: GIVEN the player completes a game while offline, WHEN connectivity returns and the app is opened, THEN the game is uploaded to `game_sessions` and removed from `localStorage:chess:unsynced:*`.
- **AC-08**: GIVEN the player completes games while not logged in, WHEN the player subsequently logs in, THEN all unsynced games in `localStorage` are bulk-uploaded to `game_sessions`.
- **AC-09**: GIVEN the same game UUID is inserted twice (retry scenario), WHEN both inserts hit Supabase, THEN only one row exists in `game_sessions` — no duplicate.
- **AC-10**: GIVEN the player navigates to `/history` while not logged in, WHEN the route guard runs, THEN the player is redirected to home with a "Log in to see your history" prompt.

**Security (RLS)**

- **AC-11**: GIVEN two users (User A and User B) each logged in, WHEN User A queries `game_sessions`, THEN only User A's rows are returned.
- **AC-12**: GIVEN an unauthenticated request to `game_sessions` (no JWT), WHEN the query executes, THEN Supabase returns an empty result (RLS blocks all access without error).

**Performance**

- **AC-13**: GIVEN the player completes a game on a standard 4G mobile connection, WHEN the sync call runs, THEN it completes within 3 seconds and does not block PostGameReview from displaying.

## Open Questions

[To be designed]
