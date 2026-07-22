# Game History

> **Status**: Approved (2026-06-01 pass 5 — all blockers resolved; implementation unblocked)
> **Author**: Eason Lee + Claude Code agents
> **Last Updated**: 2026-06-01
> **Implements Pillar**: Pillar 1 (Accumulation Over Sessions)
> **Priority**: MVP / Feature Layer
> **System #**: 12

## Overview

Game History is the system that queries and displays the player's completed game log from Supabase and renders it on the `/history` screen. On the technical side, it consists of two components: (1) a `loadGameHistory()` action on `useDataSyncStore` (ADR-0011) that queries `game_sessions ORDER BY played_at DESC`, and (2) a `useGameHistoryStore` (a separate Pinia store per ADR-0005) that owns the loaded list, loading state, and error state for the HistoryView. The UI transforms each database row into a `GameHistoryEntry` display model — mapping `result` + `playerColor` to a player-perspective outcome ("Win / Loss / Draw"), formatting the date, and labelling the AI difficulty. **Game replay is explicitly out of scope in v0**; the `pgn` column stores full PGN strings (chess.js output, per ADR-0011 schema), and the pgn-viewer integration that would enable replay is a Phase 2 reserved dependency. The HistoryView instead shows move count as a numeric fact.

From the player's perspective, `/history` is a scrollable list of their completed games — a growing record of practice sessions. Each row is a quiet, factual entry: result from their perspective, date, and opening name. The list shows the first `HISTORY_LOAD_LIMIT` (default 100) sessions; a **Load more** button at the bottom fetches older records — no game is hidden. No judgments, no rankings, no win-rate badges — just the record. Selecting a row reveals a brief summary panel (Should Have, S8-05). The system is online-only: it reads from Supabase via the auth'd session and shows an empty state on the player's first session or an error state if the fetch fails.

## Player Fantasy

The player's fantasy is **"Look what I've built."** They open `/history` and see the list — growing because they showed up, game after game. Each row is a quiet mark on the wall: an opening name, a result, a date. The list doesn't add these up into a grade. It doesn't need to. The evidence is already there, accumulating without ceremony.

The anchor moment is scrolling down and finding a game from two weeks ago. The list is longer than they remembered. *"I've played more than I realized."* That recognition — private, unhurried, real — is the reward the system delivers. Not a badge, not a banner, but the undeniable record of their own practice.

The no-pressure principle (Pillar 3) governs every display decision: results are stated plainly as Win / Loss / Draw with no red/green color coding, no cumulative win-rate shown, no streak counters. The history is a growing personal record, not a leaderboard against themselves.

**Explicitly NOT this system's job:**
- No "Your win rate is X%" headline — that is Skill Scoring (#13), not History
- No "losing streak" warnings or pressure indicators
- No "Review this game" deep-link in v0 (re-review of past games is a Phase 2 feature requiring pgn-viewer + post-game review accepting an external PGN input)
- No animated entry transitions or celebratory moments when a new game appears

## Detailed Design

### Core Rules

1. **Route entry**: HistoryView mounts only when the user is authenticated (enforced by the S7-05 route guard). On mount, `useGameHistoryStore.fetchHistory()` is called immediately. `useGameHistoryStore` calls `useDataSyncStore.loadGameHistory()` and stores the result.

2. **Data model**: `loadGameHistory()` returns raw `GameSession[]` rows from Supabase. The store maps each row to a `GameHistoryEntry`:

```typescript
interface GameHistoryEntry {
  id: string
  playedAt: Date              // parsed from game_sessions.played_at
  playerResult: 'Win' | 'Loss' | 'Draw' | 'Unknown'   // derived (Formula 1); 'Unknown' only on corrupt/unexpected data
  playerResultPrefix: 'W' | 'L' | '½' | '?'    // display prefix for result column (monospace); '?' for 'Unknown'
  playerColor: 'white' | 'black'
  endReason: string           // raw DB value (e.g. 'checkmate', 'resign')
  endReasonDisplay: string    // derived (Formula 4)
  aiDifficulty: number        // 0–20
  difficultyLabel: string     // derived (Formula 2)
  moveCount: number
  openingName: string | null
  openingEco: string | null
}
```

3. **Sort order**: Entries are ordered newest-first (`played_at DESC, created_at DESC, id ASC`). The primary sort is enforced at the database query level. The secondary `created_at DESC` tiebreaker provides insertion-ordered determinism for rows sharing the same `played_at`; the tertiary `id ASC` (UUID primary key) is the fully deterministic final tiebreaker — it ensures stable ordering even if two rows share both `played_at` and `created_at`. The UI renders entries in the order returned without client-side re-sorting.

  **Sort rationale**: Newest-first is retained for immediate access to the most recent session — the most common navigation intent. The accumulation anchor moment ("the list is longer than I realized") is delivered by visible list length on first open, not by scrolling to the oldest entry.

  **Tiebreaker note**: `id ASC` uses `gen_random_uuid()` (UUID v4 — random). The sort order is stable across repeated queries for the same dataset, but the ordering is arbitrary with respect to insertion sequence — it is NOT chronologically deterministic. This is an accepted limitation: the scenario where `played_at` AND `created_at` are both identical is practically impossible in normal single-player conditions (single game completes per session; `created_at` has millisecond resolution). The tiebreaker ensures no unstable sort panic, not a meaningful ordering guarantee.

3a. **Row touch targets**: Every row in the history list must have a minimum height of 44px (iOS HIG + project standard in `technical-preferences.md`). The **entire row area** — not only a disclosure chevron — must be the tap/click target for the row expand interaction.

3b. **Row field layout — collapsed vs. expanded:**
  - **Collapsed row** (always visible): `playerResultPrefix` (W / L / ½), `playerResult` label, `displayDate`, `openingName` (or fallback)
  - **Expanded panel** (S8-05, tap to reveal): `moveCount`, `endReasonDisplay` (Formula 4), `difficultyLabel`, `playerColor`
  - **Collapsed row layout grid**: Three visible columns in a single line at minimum 44px height:
    - Column 1 (min-width: 4em — scales with system font; do NOT use a fixed `px` value): `playerResultPrefix` (monospace, 1–2 chars) + `playerResult` text ("Win" / "Loss" / "Draw" / "Unknown")
    - Column 2 (fixed ~96px): `displayDate` (e.g., "Sep 4, 2026")
    - Column 3 (flex-grow): `openingName` — single line, `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
  - **Field order rationale**: `playerResult` leads — it is the primary scan field ("did I win?"). `displayDate` is the episodic recall anchor ("that game last Tuesday"). `openingName` is secondary enrichment; ellipsis truncation for long names is expected and acceptable in this position.
  - `moveCount` is in the **expanded panel only** — it is not shown in the collapsed row. Rationale: removing it from the collapsed row allows `openingName` to use its flex-grow space without truncation conflict.
  - `difficultyLabel` and `endReasonDisplay` appear **only** in the expanded panel.

3c. **Result display typography**: `playerResult` is displayed with **no color coding** and **no font-weight hierarchy** (both are pressure signals per Pillar 3). All three outcomes use `font-weight: 400` (normal). Scannability is provided by a fixed-width, single-character prefix in Column 1:
  - `'Win'`: prefix `W`, `font-weight: 400`
  - `'Loss'`: prefix `L`, `font-weight: 400`
  - `'Draw'`: prefix `½`, `font-weight: 400`
  - `'Unknown'`: prefix `?`, `font-weight: 400` — sentinel value rendered only when Formula 1 fallback fires (corrupt or unrecognised DB data); the row still renders normally

  The prefix column uses a monospace or tabular-numbers font so `W`, `L`, `½`, and `?` occupy identical horizontal space — the result text ("Win", "Loss", "Draw", "Unknown") begins at the same x-position for all rows, enabling fast column scanning. **All four outcomes are visually equal in weight** — no outcome is typographically prominent. The `½` Draw prefix is chess-standard notation; beginners encountering it for the first time can read the adjacent "Draw" label for immediate clarification. No tooltip or explanation is needed because the label is always present next to the prefix.

4. **Pagination**: `loadGameHistory(cursor?)` queries with `.limit(HISTORY_LOAD_LIMIT)` (Tuning Knob, default 100) ordered by `(played_at DESC, created_at DESC, id ASC)`. When `cursor` is provided, the query adds the following WHERE clause matching all three sort keys:

  ```sql
  WHERE played_at < cursor.playedAt
     OR (played_at = cursor.playedAt AND created_at < cursor.createdAt)
     OR (played_at = cursor.playedAt AND created_at = cursor.createdAt AND id > cursor.id)
  ```

  The third OR clause is the `id ASC` tiebreaker — without it, two rows sharing `(played_at, created_at)` but with different `id` values would be silently skipped at page boundaries.

  **`hasMore` signal**: If the fetch returns exactly `HISTORY_LOAD_LIMIT` rows, `hasMore` is set to `true`. If fewer rows (including 0 rows) are returned, `hasMore` is `false`. The last row's `(playedAt, createdAt, id)` values are stored as `nextCursor` for the next page request. **Zero-row subsequent page**: when `loadGameHistory(cursor)` returns 0 rows on any page fetch after the first, `hasMore` is immediately set to `false` and `nextCursor` is set to `null` — the "Load more" button disappears. This handles the edge case where total game count is an exact multiple of `HISTORY_LOAD_LIMIT`.

  **Load more button**: When `hasMore === true` and the list is in non-loading state, a **"Load more"** button is rendered below the last `history-row`. Tapping it calls `loadMore()` on `useGameHistoryStore`:
  - `isLoadingMore` is set to `true`; the button is replaced by a spinner
  - `const myGeneration = fetchGeneration` is recorded at the start of the load-more request (before the async call)
  - `loadGameHistory(nextCursor)` is called with the stored cursor
  - On success: **check `myGeneration === fetchGeneration` before appending.** If equal, new rows are **appended** to `entries` (not replaced) and `hasMore`/`nextCursor` are updated. If not equal, a concurrent `fetchHistory()` call has superseded this request — discard results silently and set `isLoadingMore` to `false`. This guards against the Refresh-during-load-more race where `fetchHistory()` clears `entries` while a load-more fetch is still in flight.
  - On error: error toast (non-blocking); the "Load more" button reappears
  - The primary list state is never disrupted during a load-more fetch

  **Accessibility — focus management and live region**:
  - When "Load more" is tapped, focus stays on the spinner element (the button's accessible label changes to "Loading more games" while `isLoadingMore` is true)
  - On success: focus is moved to the first newly appended `history-row`; a `role="status"` aria-live region announces `'[N] more games loaded'` (e.g. `'5 more games loaded'`)
  - On error: focus returns to the "Load more" button; the aria-live region announces `'Could not load more games. Try again.'`

  **Invalidation resets pagination**: When `invalidate()` is called, `entries` is cleared, `hasMore` is set to `false`, `nextCursor` is set to `null`, and the next `fetchHistory()` starts from page 1. No rows are ever hidden — all game records in Supabase remain accessible via successive Load more actions.

5. **Three primary view states**:
   - **Loading**: `isLoading === true` — skeleton list shown (`HISTORY_SKELETON_ROWS` placeholder rows of fixed height, matching the real row proportions); no game data visible. Skeleton rows **must have `pointer-events: none`** — this is the correct tap-trap prevention mechanism. A 100ms fade-out is applied for cosmetic smoothness only but does not substitute for pointer-events control. **Accessibility**: the list container has `aria-busy="true"` while `isLoading === true`; a visually-hidden `role="status"` live region contains `'Loading game history'` while loading and is cleared to `''` when loading completes; each skeleton row has `aria-hidden="true"` to prevent VoiceOver from announcing placeholder content.
   - **Empty**: `isLoading === false && entries.length === 0 && error === null` — empty state shown with copy: **"No games recorded yet."** and a secondary link "Play a game →" (navigates to `/play`). The copy acknowledges uncertainty — the player may have played but data may not have synced yet; "recorded yet" is accurate without asserting the player has never played.
   - **List**: `isLoading === false && entries.length > 0 && error === null` — full entry list rendered, optionally with "Load more" button below (Rule 4).

6. **Error state**: `isLoading === false && error !== null` — error message shown with a "Try again" button. Tapping retry calls `fetchHistory()` and resets `error` to `null`. The Refresh button (Rule 7a) is visible in **both List and Error states** to enable manual re-fetch in either context. Error message copy distinguishes common failure modes:
   - If `!navigator.onLine`: "No internet connection. Check your connection and try again."
   - All other errors: "Could not load game history. Try again."

   **Cached-data preservation on Refresh failure**: If `fetchHistory()` is triggered from List state (`cacheState === 'valid'`, `entries.length > 0`) and fails, **`entries` are not cleared** — the cached rows remain rendered below the error banner. The error banner is shown at the top of the list (above the rows), not in place of the list. This preserves the game record for PWA users who refresh while offline or on a flaky connection. The error banner includes the "Try again" button; the Refresh button in the header remains visible. If `fetchHistory()` is triggered from Empty or cold state and fails, `entries` remains empty and the error state is shown without any rows (no change to current empty-state behavior).

7. **Cache policy**: `useGameHistoryStore` uses a `cacheState` enum instead of separate boolean + timestamp fields to avoid undefined intermediate states:

  ```typescript
  cacheState: 'cold' | 'valid' | 'dirty'
  // 'cold'  — initial state; no fetch has completed yet; triggers fetchHistory() on mount
  // 'valid' — at least one fetch has completed and no invalidation has occurred since
  // 'dirty' — a known change has occurred; next mount or Refresh triggers re-fetch
  ```

  **Cursor type** (used by `nextCursor` and `loadGameHistory` parameter):
  ```typescript
  interface Cursor {
    playedAt: string   // ISO 8601 timestamp (game_sessions.played_at)
    createdAt: string  // ISO 8601 timestamp (game_sessions.created_at)
    id: string         // UUID of the last row on the current page (id ASC tiebreaker)
  }
  ```

  Additional pagination and race-guard fields:
  ```typescript
  hasMore: boolean           // true if last fetch returned exactly HISTORY_LOAD_LIMIT rows
  nextCursor: Cursor | null  // cursor for next page; null when no further pages
  isLoadingMore: boolean     // true during a load-more fetch (does not replace isLoading)
  fetchGeneration: number    // incremented on every fetchHistory() start AND every invalidate() call; used to detect in-flight invalidation
  ```

  **`fetchGeneration` must be a readable reactive store property** (not a closure-local variable). Unit tests assert its value directly to verify AC-25 (no-op call does not increment) and to verify load-more discard behavior. Exposing it as a Pinia state field enables white-box testing without requiring Supabase call spies.

  Cache is **valid** when `cacheState === 'valid'`. A fetch that returns 0 rows is a valid cached state (`entries.length === 0` does not prevent validity — an empty history is a real, cacheable result).

  Cache is **invalidated** (`cacheState` → `'dirty'`) in these cases:
  - `useDataSyncStore.syncGame()` completes successfully — `syncGame()` **internally calls** `useGameHistoryStore().invalidate()` inside the function body (deferred Pinia import pattern — see Cross-Store Call Pattern below). The call-site code (`use-game-lifecycle.ts`) does NOT need to call `invalidate()` directly.
  - `useDataSyncStore.flushUnsyncedQueue()` completes successfully (one or more rows upserted) — `flushUnsyncedQueue()` must call `useGameHistoryStore().invalidate()` after all upserts complete, using the same deferred import pattern.
  - The user taps the Refresh button (Rule 7a).

  On HistoryView mount: if `cacheState === 'valid'`, show cached entries immediately; if `'cold'` or `'dirty'`, call `fetchHistory()`.

  **Failure transition**: If `fetchHistory()` fails (network error, Supabase 5xx, timeout), `cacheState` is **not modified** — it remains in its pre-fetch state (`'dirty'` or `'cold'`). `isLoading` is set to `false` and `error` is set to the error message. The next HistoryView mount will see the unchanged `cacheState` and retry.

  **Race condition guard — in-flight invalidation**: If `invalidate()` is called while `isLoading === true` (e.g. `syncGame()` completes while a fetch is already in flight), the in-flight fetch must **not** transition `cacheState` to `'valid'` upon completion. Implementation: use `fetchGeneration` (see Additional pagination fields above). On `fetchHistory()` start, record `const myGeneration = ++fetchGeneration`. On `fetchHistory()` completion (success), set `cacheState → 'valid'` **only if** `myGeneration === fetchGeneration`. `invalidate()` also increments `fetchGeneration`, so any completion that sees a mismatch leaves `cacheState` as `'dirty'` for the next mount.

  **Cross-Store Call Pattern (circular import prevention)**: `useDataSyncStore` and `useGameHistoryStore` both depend on each other. ES module circular imports are avoided by calling `useGameHistoryStore()` inside the function body (not at the module top level). Pinia resolves `useStore()` at call time, making this safe:

  ```typescript
  // data-sync.ts — inside syncGame() action body
  async function syncGame(game: CompletedGame): Promise<void> {
    // ... upsert to Supabase ...
    // Deferred import inside function body — no circular module issue
    const historyStore = useGameHistoryStore()
    historyStore.invalidate()
  }
  ```

  The same pattern applies inside `flushUnsyncedQueue()`. Do NOT import `useGameHistoryStore` at the top level of `data-sync.ts`. After a successful fetch, `isDirty` is reset to `false` and `lastFetchedAt` is updated.

7a. **Refresh button**: A "Refresh" icon button (e.g., ↻) is visible in the HistoryView header whenever the **List state or Error state** is active (not during Loading or Empty states). Tapping it calls `useGameHistoryStore.invalidate()` then `fetchHistory()`. Under normal flow, a newly completed game appears automatically on `/history` mount — `syncGame()` calls `invalidate()`, making the cache dirty, so the next mount triggers a fresh fetch. The Refresh button is a **fallback** for cases where auto-invalidation did not fire (network retry scenarios, edge cases). Pull-to-refresh is deferred to a future sprint but `fetchHistory()` is designed to be externally triggered so that adding pull-to-refresh requires only a gesture handler, not a new store action.

  **`fetchHistory()` in-flight guard**: If `isLoading === true` when `fetchHistory()` is called, the call returns immediately without starting a second concurrent fetch (deduplication guard).

8. **Row expand (Should Have — S8-05)** — **[REMOVED 2026-07-22]**: superseded by
   row-tap-to-navigate（點列直接導向 `/review?gameId=…` 賽後檢討，資訊量遠大於行內面板）。
   展開面板自上線後不可達，2026-07-22 連同 store 狀態（`expandedRowId`/`setExpandedRow`）與
   測試一併移除（commit `5156f73`）。原文保留於 git 歷史；勿依此規則重新實作面板。
   ~~Tapping a row toggles an inline expanded panel below the row showing the fields listed in Rule 3b.~~

  **iOS scroll disambiguation**: On iPhone Safari, brief scroll attempts frequently register as taps. The tap handler must use a touch-start/touch-end delta check: if the touch moved ≥4px (vertical or horizontal) between `touchstart` and `touchend`, treat the gesture as a scroll and do NOT toggle the row. This prevents accidental expansion mid-scroll in a 100-row list. Implementation: record `touchstartY` on `touchstart`; on `touchend`, expand only if `|touchendY - touchstartY| < 4` (use `pointer-events` or a `click` handler supplemented by this delta guard). A Playwright interaction test (ADVISORY, S8-05) should verify that a ≥4px vertical touch drag does not expand a row.

### States and Transitions

| State | Condition | UI shown |
| ------- | --------- | -------- |
| Loading | `isLoading === true` | Skeleton list (`HISTORY_SKELETON_ROWS` rows, `pointer-events: none`) |
| Empty | `entries.length === 0 && error === null` | "No games recorded yet." + "Play a game →" link |
| List | `entries.length > 0 && error === null` | Scrollable `GameHistoryEntry` list + optional "Load more" button |
| Error | `error !== null` | Error message (offline-aware copy) + "Try again" + Refresh button |

Transitions:
- App mount (cold) → Loading → List (success) or Empty (no rows) or Error (fetch fails)
- App mount (cold) → cold (fetch fails — cacheState NOT modified; error shown; next mount retries)
- App mount (dirty) → Loading → List (success) or Empty (no rows) or Error (fetch fails)
- App mount (dirty) → dirty (fetch fails — cacheState NOT modified; error shown; next mount retries)
- App mount (valid) → List (cached, no fetch)
- Loading → Error (`cacheState` stays `'dirty'` or `'cold'` — fetch failure does NOT change cacheState)
- Loading → List/Empty, but `invalidate()` called during flight → `cacheState` stays `'dirty'`; next mount triggers fresh fetch
- Error → Loading → List / Empty / Error (on retry)
- List → List (cached, no re-fetch within same session unless dirty)
- List → Loading (on invalidate + re-fetch)
- List + "Load more" → List (appended rows, no full re-fetch; load-more discarded silently if fetchGeneration changed mid-flight)

### Interactions with Other Systems

| System | Direction | Interface |
| ------ | --------- | --------- |
| **Data Sync** (#11) | ← reads via | `useDataSyncStore.loadGameHistory() → Promise<GameSession[]>` |
| **Auth** (#9) | ← reads via | Route guard checks `useAuthStore.userId`; HistoryView assumes authenticated on mount |
| **App Router** (#4) | ← guarded by | `/history` route guard (implemented S7-05); unauthenticated users redirected to home before reaching HistoryView |
| **Game Lifecycle** (#5) | indirect | Each game synced via `useDataSyncStore.syncGame()` — not a direct interface with History |
| **Skill Scoring** (#13) | future | History entries may link to skill score snapshots in a later sprint; not in v0 scope |

## Formulas

Game History computations are display transformations only — no balance math or scoring.

### Formula 1 — Player Result

`playerResult = f(result, playerColor)`

| Variable | Symbol | Type | Range | Description |
| -------- | ------ | ---- | ----- | ----------- |
| DB result | `result` | string enum | `'white_wins' \| 'black_wins' \| 'draw'` | Stored in `game_sessions.result` |
| Player color | `playerColor` | string enum | `'white' \| 'black'` | Stored in `game_sessions.player_color` |
| Output | `playerResult` | string enum | `'Win' \| 'Loss' \| 'Draw'` | Displayed to player |

**Lookup table (exhaustive, unambiguous):**

| result | playerColor | playerResult |
| ------ | ----------- | ------------ |
| `'white_wins'` | `'white'` | `'Win'` |
| `'white_wins'` | `'black'` | `'Loss'` |
| `'black_wins'` | `'black'` | `'Win'` |
| `'black_wins'` | `'white'` | `'Loss'` |
| `'draw'` | `'white'` | `'Draw'` |
| `'draw'` | `'black'` | `'Draw'` |

**Output range:** Always one of three values.
**Fallback:** `result` and `player_color` are stored as Postgres `text` columns (not SQL enums). If an unexpected combination is received (e.g., from a future migration or data corruption), `playerResult` returns `'Unknown'` and `playerResultPrefix` returns `'?'`; a `console.warn('[GameHistory] Unexpected result/playerColor combination:', result, playerColor)` is emitted. The row still renders. **`'Unknown'` is a display-only sentinel — it must NOT be written back to the database. Returning `'Draw'` for corrupt data would write a false game outcome into the player's history.**
**Example:** `result='white_wins', playerColor='black'` → `'Loss'`; `result='abandoned', playerColor='white'` → `playerResult: 'Unknown'`, `playerResultPrefix: '?'` + console.warn.

---

### Formula 2 — Difficulty Label

`difficultyLabel = f(aiDifficulty)`

| Variable | Symbol | Type | Range | Description |
| -------- | ------ | ---- | ----- | ----------- |
| AI skill level | `aiDifficulty` | integer | 0–20 | `game_sessions.ai_difficulty` (Stockfish skill level) |
| Output | `difficultyLabel` | string | see below | Human-readable difficulty label |

**Stepped mapping:**

| aiDifficulty range | difficultyLabel |
| ------------------ | --------------- |
| 0–3 | `'Beginner'` |
| 4–7 | `'Easy'` |
| 8–12 | `'Intermediate'` |
| 13–17 | `'Hard'` |
| 18–20 | `'Master'` |

**Output range:** Always one of five labels; range 0–20 fully covered with no gaps.
**Type guard (required before range logic):** Check `typeof aiDifficulty !== 'number' || !isFinite(aiDifficulty)` before evaluating any range. This guard handles: `null` (would otherwise coerce silently to `0` → `'Beginner'`), `undefined`, `NaN` (fails all comparisons, causing silent fall-through), and `Infinity`. If the guard triggers, `difficultyLabel` immediately returns `'Unknown'`.
**Out-of-range fallback:** If `aiDifficulty` is a finite number but falls outside 0–20 (negative value, data corruption, or migration error), `difficultyLabel` returns `'Unknown'` and a `console.warn('[GameHistory] aiDifficulty out of range:', aiDifficulty)` is emitted. The row still renders. This mirrors the warn behavior of Formulas 1 and 4 for unexpected inputs.
**Example:** `aiDifficulty=10` → `'Intermediate'`; `aiDifficulty=20` → `'Master'`; `aiDifficulty=21` → `'Unknown'` + console.warn; `aiDifficulty=NaN` → `'Unknown'` (type guard, no warn); `aiDifficulty=null` → `'Unknown'` (type guard, not coerced to `0`, no warn).

---

### Formula 3 — Date Display

`displayDate = playedAt.toLocaleDateString(locale || undefined, { year: 'numeric', month: 'short', day: 'numeric' })`

| Variable | Symbol | Type | Range | Description |
| -------- | ------ | ---- | ----- | ----------- |
| Game timestamp | `playedAt` | `Date` | any valid date | `game_sessions.played_at` parsed as JS `Date` |
| Locale | `locale` | string | browser default | `navigator.language \|\| undefined`. Guard: an empty string `''` from headless/WebView environments causes `RangeError`; `undefined` uses the runtime default |
| Output | `displayDate` | string | locale-dependent | e.g. `"Sep 4, 2026"` (en-US) |

**Output:** Locale-aware short date string; no hardcoded language.
**Example:** `playedAt = new Date('2026-09-04T10:30:00Z')` → `"Sep 4, 2026"` (en-US).

---

### Formula 4 — End Reason Display

`endReasonDisplay = f(endReason)`

| Variable | Symbol | Type | Range | Description |
| -------- | ------ | ---- | ----- | ----------- |
| DB end reason | `endReason` | string enum | see lookup table | Stored in `game_sessions.end_reason` |
| Output | `endReasonDisplay` | string | see lookup table | Displayed in the expanded panel |

**Lookup table:**

| endReason | endReasonDisplay |
| --------- | ---------------- |
| `'checkmate'` | `'Checkmate'` |
| `'resign'` | `'Resignation'` |
| `'stalemate'` | `'Stalemate'` |
| `'draw_agreement'` | `'Agreed draw'` |
| `'fifty_move'` | `'50-move rule'` |
| `'threefold'` | `'Threefold repetition'` |
| `'insufficient'` | `'Insufficient material'` |

**Out-of-range fallback:** If `endReason` does not match any known value (data corruption or future migration), `endReasonDisplay` returns the raw `endReason` string unchanged. The expanded panel still renders. A `console.warn('[GameHistory] Unknown endReason:', endReason)` is emitted — an unknown value indicates either (a) a new end condition added to the game engine but not to this lookup table, or (b) data corruption; both should be surfaced to developers.
**Example:** `endReason='fifty_move'` → `'50-move rule'`; `endReason='unknown_value'` → `'unknown_value'` + console.warn.

## Edge Cases

- **If `loadGameHistory()` is called when `useAuthStore.userId` is null**: Return empty array immediately without making a Supabase call. HistoryView shows the empty state. This should not occur in v0 because the route guard prevents unauthenticated access — but the data layer must still be defensive.

- **If the Supabase fetch returns an error** (network failure, 5xx, RLS denial): `useGameHistoryStore.error` is set to the error message; `isLoading` becomes `false`. HistoryView shows the error state with "Try again" button. No partial data is rendered.

- **If `game_sessions` returns 0 rows** (no games played yet, or all games are beyond `HISTORY_LOAD_LIMIT`): `entries` remains `[]`; HistoryView shows the empty state with CTA to `/play`. This is not an error.

- **If `opening_name` is null** (opening not recognized, or game predates opening identification): Display `"Unknown opening"` in the row. Do not omit the opening column — inconsistent row height would cause layout shift.

- **If `opening_eco` is not null but `opening_name` is null**: Display the ECO code directly (e.g., `"C50"`) as a fallback. Prefer `opening_name` when available; never show both simultaneously.

- **If `move_count` is 0**: The game ended immediately (resignation before any move, or corrupted data). Display `"0 moves"`. Do not crash — the row renders normally.

- **If `played_at` is in the future** (client clock skew): Display the date as-is (Formula 3). The sort order may appear wrong to the user but data integrity is preserved. No special handling in v0.

- **If `played_at` fails to parse into a valid Date** (malformed timestamptz in the DB): `new Date(invalidString)` returns an Invalid Date object without throwing. The mapping layer must check `isNaN(date.getTime())` before storing `playedAt`; if invalid, store `null` and display `'—'` (em dash) in the date column. Never display the string `"Invalid Date"` to the player.

- **If two entries have identical `played_at`**: The `created_at DESC` tiebreaker (Rule 3) provides stable ordering across re-fetches; `created_at` is assigned server-side at insert time. Ambiguity only occurs when two rows share both `played_at` and `created_at`, which is practically impossible under normal conditions.

- **If exactly `HISTORY_LOAD_LIMIT` rows are returned** (`hasMore === true`): A "Load more" button is rendered below the last row per Rule 4. All older records remain accessible — no games are hidden, only deferred to subsequent fetches.

- **If a row is tapped while another row is already expanded** (S8-05): The previously expanded row collapses first, then the tapped row expands. No animation required — immediate state swap is acceptable.

## Dependencies

### Upstream (what this system requires)

| System | Dependency Type | Interface |
| ------ | --------------- | --------- |
| **Data Sync (#11)** | Hard | `useDataSyncStore.loadGameHistory() → Promise<GameSession[]>`; this action does not exist yet and will be added in S8-03 |
| **Auth (#9)** | Hard | `useAuthStore.userId`; route guard ensures authenticated entry; `loadGameHistory()` relies on Supabase RLS to automatically scope results to the current user |
| **App Router (#4)** | Hard | `/history` route must exist with its auth guard (implemented in S7-05); HistoryView is never reachable when unauthenticated |

### Downstream (systems that depend on this one)

| System | Dependency Type | What it needs |
| ------ | --------------- | ------------- |
| **Skill Scoring (#13)** | Soft (future) | History list may show per-game skill delta in a later sprint; not in v0 scope |
| **Level Progression (#14)** | Indirect (future) | Does not read from Game History directly |
| **Journal — 棋誌 (#21)** | Soft (Phase 1 diff) | Reads the completed-game result sequence to derive a losing streak for the ⑤ solace journal entry. Read-only; Journal degrades gracefully (⑤ simply never fires) if unavailable. See `design/gdd/journal.md` |

### Bidirectional Consistency Notes

- **Game Lifecycle GDD** (Downstream Dependents section) already lists: `Game History (MVP) — consumes game-completed events to persist completed games to Supabase` ✅
- **Supabase Integration GDD** (Downstream section) already lists: `Game History (#12) — Hard — useDataSyncStore.loadGameHistory()` ✅
- **ADR-0011** Key Interfaces defines: `loadGameHistory(): Promise<GameSession[]>` ✅ **ACCEPTED** — ADR-0011 status updated to `Accepted` 2026-06-01. Implementation stories for Game History are unblocked. Outstanding post-acceptance risk: iOS PWA Magic Link verification tracked in S8-06.
- **ADR-0005** already establishes: GameHistory requires its own store (`src/stores/game-history.ts`); does not expand `gameStore` ✅

## Tuning Knobs

| Knob | Default | Safe Range | Effect of Too Low | Effect of Too High |
| ---- | ------- | ---------- | ----------------- | ------------------ |
| `HISTORY_LOAD_LIMIT` | 100 | 20–500 | "Load more" appears immediately with very few rows per page; extra network round-trips | Large payload on slow connections; Supabase free tier row pressure |
| `HISTORY_SKELETON_ROWS` | 8 | 5–12 | Skeleton looks sparse; visible layout jump when real list loads with many more rows | Skeleton taller than real list for first-time users with very few games |

**Knobs owned by upstream systems (referenced here):**

| Knob | Owner | Default | Usage in this system |
| ---- | ----- | ------- | -------------------- |
| `UNSYNCED_QUEUE_MAX` | Data Sync (#11) — `src/config/sync-tuning.ts` | 50 | Bounds how many games can be queued offline; affects completeness of history |

**Notes:**
- `HISTORY_LOAD_LIMIT` is the page size for both the initial fetch and each Load more fetch. It is not a hard cap — all historical records remain accessible via successive Load more actions.
- Both new knobs live in `src/config/history-config.ts` (created in S8-03).
- Difficulty label thresholds (Formula 2) are not tunable at runtime — the mapping is design-stable.

## Acceptance Criteria

**AC-01 — Loading state on mount**
GIVEN the user is authenticated and navigates to `/history` and the cache is empty or dirty,
WHEN `fetchHistory()` is called on mount and `loadGameHistory()` has not yet resolved,
THEN `isLoading === true` and `HISTORY_SKELETON_ROWS` skeleton placeholder rows are rendered.
*Test implementation: mock `loadGameHistory()` to return a promise that does not resolve until explicitly triggered; assert `isLoading === true` and skeleton row count before resolving.*

**AC-02 — List state on success**
GIVEN `loadGameHistory()` returns a list of 5 `GameSession` rows,
WHEN the fetch completes successfully,
THEN `isLoading` is `false`, `error` is `null`, `entries.length === 5`, and 5 history rows are rendered in the HistoryView.

**AC-03 — Empty state**
GIVEN `loadGameHistory()` returns 0 rows,
WHEN the fetch completes successfully,
THEN `isLoading` is `false`, `error` is `null`, `entries.length === 0`, and the empty state is shown with copy "No games recorded yet." and a "Play a game →" link that navigates to `/play`.

**AC-04 — Error state**
GIVEN `loadGameHistory()` throws a network error,
WHEN the fetch fails,
THEN `isLoading` is `false`, `error` is a non-null string, the error state is shown with a "Try again" button, and no game rows are rendered.

**AC-05 — Retry from error state**
GIVEN the error state is displayed,
WHEN the player taps "Try again",
THEN `error` is reset to `null`, `isLoading` becomes `true`, and `fetchHistory()` is called again.

**AC-05b — Retry success path**
GIVEN the error state is displayed and `fetchHistory()` is retried,
WHEN `loadGameHistory()` succeeds on retry and returns rows,
THEN `error` is `null`, the error state is gone, and the history rows are rendered (list state).

**AC-06a — Formula 1: white wins, player is white**
GIVEN `result='white_wins'` and `player_color='white'`,
THEN `playerResult = 'Win'`.

**AC-06b — Formula 1: white wins, player is black**
GIVEN `result='white_wins'` and `player_color='black'`,
THEN `playerResult = 'Loss'`.

**AC-06c — Formula 1: black wins, player is black**
GIVEN `result='black_wins'` and `player_color='black'`,
THEN `playerResult = 'Win'`.

**AC-06d — Formula 1: black wins, player is white**
GIVEN `result='black_wins'` and `player_color='white'`,
THEN `playerResult = 'Loss'`.

**AC-06e — Formula 1: draw, player is white**
GIVEN `result='draw'` and `player_color='white'`,
THEN `playerResult = 'Draw'`.

**AC-06f — Formula 1: draw, player is black**
GIVEN `result='draw'` and `player_color='black'`,
THEN `playerResult = 'Draw'`.

**AC-07a — Formula 2: Beginner boundary**
GIVEN `ai_difficulty=0`,
THEN `difficultyLabel = 'Beginner'`.

**AC-07b — Formula 2: Easy tier**
GIVEN `ai_difficulty=4` (low boundary of Easy),
THEN `difficultyLabel = 'Easy'`.

**AC-07c — Formula 2: Intermediate tier**
GIVEN `ai_difficulty=10`,
THEN `difficultyLabel = 'Intermediate'`.

**AC-07d — Formula 2: Hard tier**
GIVEN `ai_difficulty=13` (low boundary of Hard),
THEN `difficultyLabel = 'Hard'`.

**AC-07e — Formula 2: Master boundary**
GIVEN `ai_difficulty=20`,
THEN `difficultyLabel = 'Master'`.

**AC-07f — Formula 2: out-of-range fallback**
GIVEN `ai_difficulty=21` (finite but outside 0–20),
THEN `difficultyLabel = 'Unknown'` (no exception thrown, row still renders).

**AC-07g — Formula 2: type guard — null input**
GIVEN `ai_difficulty=null`,
THEN `difficultyLabel = 'Unknown'` — the type guard fires, `null` is NOT silently coerced to `0` → `'Beginner'`.
*This test specifically verifies the type guard, not the range fallback. A passing AC-07f does not cover this.*

**AC-07h — Formula 2: type guard — NaN input**
GIVEN `ai_difficulty=NaN`,
THEN `difficultyLabel = 'Unknown'`.

**AC-07i — Formula 2: type guard — undefined input**
GIVEN `ai_difficulty=undefined`,
THEN `difficultyLabel = 'Unknown'`.

**AC-08 — Opening name display priority (decision table)**
The opening column applies this priority order (first matching branch wins):
1. `opening_name` non-null → display `opening_name`
2. `opening_name` null, `opening_eco` non-null → display `opening_eco` (ECO code)
3. Both null → display `"Unknown opening"`

**AC-08a — Opening name present**
GIVEN `opening_name='Ruy Lopez'` (non-null),
WHEN the row is rendered,
THEN the opening column displays `'Ruy Lopez'`.

**AC-08b — ECO fallback when name is null**
GIVEN `opening_name=null` and `opening_eco='B20'`,
WHEN the row is rendered,
THEN the opening column displays `'B20'` (NOT `"Unknown opening"`).

**AC-08c — Both null fallback**
GIVEN `opening_name=null` and `opening_eco=null`,
WHEN the row is rendered,
THEN the opening column displays `"Unknown opening"` (not blank, not an error).

**AC-09 — No re-fetch when cache is valid**
GIVEN the HistoryView has loaded entries (`cacheState === 'valid'`, `entries.length > 0`) and the user navigates away then back to `/history`,
WHEN HistoryView remounts,
THEN the cached entries are shown immediately without calling `fetchHistory()` again.
*Test implementation: spy on `useGameHistoryStore().fetchHistory` — the spy call count must not increase after re-mount. Do NOT spy on `useGameHistoryStore().loadGameHistory` (that method does not exist on `useGameHistoryStore`; `loadGameHistory` lives on `useDataSyncStore`).*

**AC-09b — Empty-result cache is valid after first fetch**
GIVEN the HistoryView has previously fetched successfully and received 0 rows (`entries.length === 0`, `cacheState === 'valid'`) and the user navigates away then back to `/history`,
WHEN HistoryView remounts,
THEN `fetchHistory()` is NOT called again — the empty-list result is a valid cached state and the empty state UI is shown immediately from cache.

**AC-10 — Defensive null userId guard**
GIVEN `loadGameHistory()` is called while `useAuthStore.userId` is `null`,
WHEN the call executes,
THEN it returns an empty array immediately without making a Supabase network request.

**AC-11 — Load more button appears when hasMore is true**
GIVEN `loadGameHistory()` returns exactly `HISTORY_LOAD_LIMIT` rows (so `hasMore === true`),
WHEN HistoryView renders,
THEN (a) `getAllByTestId('history-row').length === HISTORY_LOAD_LIMIT`, (b) an element with `data-testid="load-more-button"` exists in the DOM, (c) the load-more button appears after the last `history-row` in DOM source order, (d) no `data-testid="truncation-notice"` element exists, and (e) the error state is not shown.

**AC-11b — Load more button absent when hasMore is false**
GIVEN `loadGameHistory()` returns fewer than `HISTORY_LOAD_LIMIT` rows (so `hasMore === false`),
WHEN HistoryView renders,
THEN no element with `data-testid="load-more-button"` exists in the DOM.

**AC-11c — Load more appends rows**
GIVEN HistoryView is showing `HISTORY_LOAD_LIMIT` rows and `hasMore === true`,
WHEN the player taps the "Load more" button and `loadGameHistory(cursor)` returns 5 additional rows,
THEN `entries.length === HISTORY_LOAD_LIMIT + 5`, all previously visible rows are still rendered, and the 5 new rows appear below them.

**AC-12 — Expanded panel DOM wiring (S8-04 blocking unit gate)** — **[REMOVED 2026-07-22]**
*本 AC 隨 Rule 8 展開面板一併移除（row-tap-to-navigate 取代，面板不可達；commit `5156f73`）。
歷史上曾以 blocking gate 通過並 ship（S8-04），移除非未達成。gate/consistency 工具勿再視為必要 gate。*
GIVEN a `GameHistoryEntry` with `moveCount=34`, `endReason='checkmate'` (→ `endReasonDisplay='Checkmate'`), `aiDifficulty=10` (→ `difficultyLabel='Intermediate'`), and `playerColor='white'`,
WHEN the row is mounted with expansion state set to active (via a test prop, store setter, or any reactive mechanism that drives the expanded panel render condition — the specific mechanism is implementation detail and should not be hard-coded in this AC),
THEN the DOM contains elements displaying `34`, `'Checkmate'`, `'Intermediate'`, and `'white'` (or equivalent `playerColor` label).
*This BLOCKING unit AC verifies formula outputs are correctly bound to the expanded panel DOM, independent of the tap gesture. It must pass before S8-04 ships. Tests that set `isExpanded=true` via a store or prop are acceptable; tests that simulate a tap gesture are also acceptable but are not required for this AC.*

**AC-12b — Single-row expand invariant (S8-05 advisory)** — **[REMOVED 2026-07-22]**
*同 AC-12,隨展開面板移除。*
GIVEN a game row is expanded,
WHEN a different row is tapped,
THEN the first row collapses and the second row expands; at no point are two rows simultaneously in the expanded state.
*Test layer: Playwright interaction test (ADVISORY gate — S8-05 story only).*

**AC-13 — Cache invalidated after syncGame()** *(Integration test — requires real Pinia instance with both stores wired)*
GIVEN a Pinia instance with both `useDataSyncStore` and `useGameHistoryStore` initialized, and `cacheState === 'valid'`,
WHEN `useDataSyncStore.syncGame(completedGame)` resolves successfully,
THEN `useGameHistoryStore.cacheState === 'dirty'` (invalidate() was called internally by syncGame()).
*Test type: BLOCKING integration test. Requires mounting both stores in a real Pinia instance — not mockable in unit isolation. The spy must be on `useGameHistoryStore.invalidate()`, not on `fetchHistory()`. AC-13 verifies the cross-store invalidation contract; the subsequent fetch trigger is separately covered by the cache-valid check on HistoryView mount (AC-09).*

**AC-14 — cacheState transitions to valid on success**
GIVEN `loadGameHistory()` completes successfully,
WHEN the store processes the result,
THEN `historyStore.cacheState === 'valid'` and `isLoading === false`.

**AC-15 — Zero move count edge case**
GIVEN a game session with `move_count=0`,
WHEN the row is rendered,
THEN the move count is displayed as `0` (or `'0 moves'`) and no error is thrown.

**AC-16a — Refresh button transitions cache to dirty and calls fetch**
GIVEN the HistoryView is in List state (`cacheState === 'valid'`),
WHEN the player taps the Refresh button,
THEN `cacheState` transitions to `'dirty'` and `fetchHistory()` is called.

**AC-16b — Refresh success path**
GIVEN `fetchHistory()` was called via the Refresh button and `loadGameHistory()` returns a new set of rows,
WHEN the fetch completes successfully,
THEN `isLoading` is `false`, `cacheState === 'valid'`, and the entries list is updated with the new data.
*(The success-path behavior is identical to AC-02; AC-16b confirms it applies to the Refresh trigger as well.)*

**AC-17 — Invalid `played_at` displays '—'**
GIVEN a `GameSession` row where `played_at` is an unrecognized non-date string (e.g. `"not-a-date"`),
WHEN the history row is rendered,
THEN the date column displays exactly `'—'` (U+2014 em dash) and no JavaScript error is thrown.

**AC-18 — Sort order preserved through mapping layer**
GIVEN `loadGameHistory()` returns rows in order `[T3, T1, T2]` (already sorted newest-first by the database query),
WHEN the store processes the result and HistoryView renders the entries,
THEN `entries[0].playedAt` corresponds to T3, `entries[1].playedAt` corresponds to T1, `entries[2].playedAt` corresponds to T2 — the store must not re-sort client-side.

**AC-19 — Formula 4: checkmate**
GIVEN `end_reason='checkmate'`,
THEN `endReasonDisplay = 'Checkmate'`.

**AC-20 — Formula 4: multi-word display**
GIVEN `end_reason='fifty_move'`,
THEN `endReasonDisplay = '50-move rule'` (verifies multi-word mapping with number).

**AC-21 — Formula 4: full coverage spot-check**
GIVEN `end_reason='resign'`,
THEN `endReasonDisplay = 'Resignation'`.
GIVEN `end_reason='draw_agreement'`,
THEN `endReasonDisplay = 'Agreed draw'`.
GIVEN `end_reason='threefold'`,
THEN `endReasonDisplay = 'Threefold repetition'`.
GIVEN `end_reason='insufficient'`,
THEN `endReasonDisplay = 'Insufficient material'`.

**AC-21b — Formula 4: stalemate**
GIVEN `end_reason='stalemate'`,
THEN `endReasonDisplay = 'Stalemate'`.

**AC-22 — Formula 4: out-of-range passthrough**
GIVEN `end_reason='unknown_future_value'` (not in lookup table),
THEN `endReasonDisplay = 'unknown_future_value'` (raw string, unchanged — NOT `'Unknown'`), no exception thrown, row renders, and a `console.warn` is emitted.

**AC-23 — Formula 1: unexpected input fallback**
GIVEN `result='abandoned'` and `player_color='white'` (not in the expected enum values),
THEN `playerResult = 'Unknown'` (sentinel value — not a real game outcome), `playerResultPrefix = '?'`, and a `console.warn('[GameHistory] Unexpected result/playerColor combination:', 'abandoned', 'white')` is emitted. The row still renders.

**AC-24 — Refresh button in Error state**
GIVEN the HistoryView is in Error state (`error !== null`),
WHEN the player taps the Refresh button,
THEN `error` is reset to `null`, `cacheState` transitions to `'dirty'`, and `fetchHistory()` is called.
*(Same behavior as AC-16a for List state; confirms the Refresh button works from both List and Error states.)*

**AC-25 — In-flight deduplication guard**
GIVEN `isLoading === true` (a `fetchHistory()` call is already in progress),
WHEN `fetchHistory()` is called a second time (e.g., double-tap of Refresh button),
THEN the second call returns immediately without starting a new Supabase request; `isLoading` remains `true` and `fetchGeneration` is not incremented by the no-op call.
*Test implementation: read `store.fetchGeneration` before and after the second call — the value must be identical. `fetchGeneration` is a readable reactive store property (see Rule 7 state model), so this assertion does not require Supabase call spies.*

**AC-26 — `isLoadingMore` state during Load more fetch**
GIVEN HistoryView is showing `HISTORY_LOAD_LIMIT` rows and `hasMore === true`,
WHEN the player taps "Load more" and `loadGameHistory(cursor)` has not yet resolved,
THEN `isLoadingMore === true`, the "Load more" button is replaced by a spinner, `isLoading === false` (primary list is not in loading state), and the existing `entries` are still rendered.

**AC-27 — Load more error scenario**
GIVEN HistoryView is showing `HISTORY_LOAD_LIMIT` rows and `hasMore === true`,
WHEN the player taps "Load more" and `loadGameHistory(cursor)` throws an error,
THEN `isLoadingMore` returns to `false`, the "Load more" button reappears, a non-blocking error toast is shown, and `entries` are not modified (existing rows remain visible).

## Open Questions

1. **Re-review from history (Phase 2)**: Once pgn-viewer is integrated (Phase 2 reserved dependency), history rows should offer a "Re-review" action that loads the stored PGN into PostGameReview. The `pgn` column stores full PGN strings (chess.js output, per ADR-0011). **Schema verification required**: if any `game_sessions` rows were inserted before this column definition was finalised, query `SELECT pgn FROM game_sessions LIMIT 1` to confirm the actual stored format matches the spec. If rows contain UCI move strings instead, a backfill migration will be needed before Phase 2 replay can work. Define migration strategy in the pgn-viewer ADR.

2. **Opening ECO backfill**: Games synced in Sprint 7 may have `opening_eco=null` because opening identification was not wired into the sync path at that point. If this is the case, a backfill migration or a "re-identify" action on History rows may be needed. Defer decision to when opening identification is confirmed to be wired into `syncGame()`.

3. **Pull-to-refresh on mobile**: iOS Safari PWA users may expect pull-to-refresh to reload the history list. Not required in v0, but the re-fetch hook should be designed to allow it.
