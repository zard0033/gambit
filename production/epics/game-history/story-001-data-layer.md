# Story 001: Game History Data Layer

> **Epic**: game-history
> **Sprint Task**: S8-03
> **Status**: Complete
> **Layer**: MVP Feature — Data / Store
> **Type**: Logic (Pinia store + utility functions + config)
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-06-01
> **TR**: pending /architecture-review
> **ADR**: ADR-0005, ADR-0011

## Context

**GDD**: `design/gdd/game-history.md` — Detailed Design §1–7, Formulas §1–4, Edge Cases, Tuning Knobs
**Requirements**: AC-06a–f, AC-07a–i, AC-08a–c, AC-10, AC-13, AC-14, AC-15, AC-17, AC-18, AC-19–22, AC-21b, AC-23

**ADR Governing Implementation**: ADR-0011 (Supabase Auth + Data Sync), ADR-0005 (Pinia Store Boundaries)
**ADR Decision Summary**:
- `useGameHistoryStore` is a new dedicated Pinia store at `src/stores/game-history.ts` (ADR-0005 — do NOT expand gameStore)
- `loadGameHistory(cursor?)` action lives on `useDataSyncStore` (ADR-0011 Key Interfaces) — extend the existing store, do not create a separate Supabase client
- Cross-store invalidation uses deferred Pinia import inside `syncGame()` and `flushUnsyncedQueue()` function bodies (never at module top level — avoids circular import)
- `fetchGeneration` is a readable reactive Pinia state field (not a closure-local variable) so unit tests can assert its value directly

**Engine**: Web App — Vue 3 Composition API + TypeScript + Pinia 2 + Supabase JS v2 | **Risk**: LOW
**Engine Notes**:
- Supabase cursor pagination: chain `.lt('played_at', cursor.playedAt)` + `.or(...)` as specified in GDD §4 SQL
- All `supabase.from(...)` calls must remain inside `src/stores/data-sync.ts` (per ADR-0011 forbidden pattern)
- `useGameHistoryStore()` called inside `syncGame()` function body (deferred) to avoid circular import — NOT at module top level

**Control Manifest Rules**:
- Forbidden: No `supabase.from(...)` calls in `src/stores/game-history.ts`
- Forbidden: No `import { useGameHistoryStore }` at top level of `data-sync.ts`
- Required: `fetchGeneration` exposed as Pinia state (not a closure var)
- Required: `HISTORY_LOAD_LIMIT` and `HISTORY_SKELETON_ROWS` in `src/config/history-config.ts`
- Required: Formula functions are pure — no store/Vue dependencies; testable in isolation

---

## Acceptance Criteria

### Formula 1 — playerResult

- [x] **AC-06a**: `result='white_wins', playerColor='white'` → `playerResult='Win'`
- [x] **AC-06b**: `result='white_wins', playerColor='black'` → `playerResult='Loss'`
- [x] **AC-06c**: `result='black_wins', playerColor='black'` → `playerResult='Win'`
- [x] **AC-06d**: `result='black_wins', playerColor='white'` → `playerResult='Loss'`
- [x] **AC-06e**: `result='draw', playerColor='white'` → `playerResult='Draw'`
- [x] **AC-06f**: `result='draw', playerColor='black'` → `playerResult='Draw'`
- [x] **AC-23**: `result='abandoned', playerColor='white'` → `playerResult='Unknown'`, `playerResultPrefix='?'`, `console.warn` emitted; row still renders

### Formula 2 — difficultyLabel

- [x] **AC-07a**: `aiDifficulty=0` → `'Beginner'`
- [x] **AC-07b**: `aiDifficulty=4` → `'Easy'`
- [x] **AC-07c**: `aiDifficulty=10` → `'Intermediate'`
- [x] **AC-07d**: `aiDifficulty=13` → `'Hard'`
- [x] **AC-07e**: `aiDifficulty=20` → `'Master'`
- [x] **AC-07f**: `aiDifficulty=21` → `'Unknown'` (finite out-of-range, no exception, `console.warn` emitted)
- [x] **AC-07g**: `aiDifficulty=null` → `'Unknown'` (type guard fires; must NOT coerce to `0` → `'Beginner'`)
- [x] **AC-07h**: `aiDifficulty=NaN` → `'Unknown'` (type guard, no warn)
- [x] **AC-07i**: `aiDifficulty=undefined` → `'Unknown'` (type guard)

### Formula 3 / 4 + Opening Priority

- [x] **AC-08a**: `opening_name='Ruy Lopez'` → opening column shows `'Ruy Lopez'`
- [x] **AC-08b**: `opening_name=null, opening_eco='B20'` → shows `'B20'`
- [x] **AC-08c**: both null → shows `'Unknown opening'`
- [x] **AC-19**: `endReason='checkmate'` → `endReasonDisplay='Checkmate'`
- [x] **AC-20**: `endReason='fifty_move'` → `endReasonDisplay='50-move rule'`
- [x] **AC-21**: `endReason='resign'` → `'Resignation'`; `'draw_agreement'` → `'Agreed draw'`; `'threefold'` → `'Threefold repetition'`; `'insufficient'` → `'Insufficient material'`
- [x] **AC-21b**: `endReason='stalemate'` → `endReasonDisplay='Stalemate'`
- [x] **AC-22**: `endReason='unknown_future_value'` → `'unknown_future_value'` (raw passthrough, `console.warn` emitted, row renders)

### Store State + Edge Cases

- [x] **AC-10**: `loadGameHistory()` called while `useAuthStore.userId === null` → returns `[]` immediately, no Supabase call
- [x] **AC-13**: (Integration) Pinia instance with both stores; `cacheState === 'valid'`; `syncGame()` succeeds → `useGameHistoryStore.cacheState === 'dirty'`. *Requires real Pinia instance — not mockable in unit isolation.*
- [x] **AC-14**: `loadGameHistory()` succeeds → `historyStore.cacheState === 'valid'`, `isLoading === false`
- [x] **AC-15**: `move_count=0` → renders `0` without error
- [x] **AC-17**: `played_at='not-a-date'` → date column shows `'—'` (em dash); no JS error
- [x] **AC-18**: Store does NOT re-sort returned rows; `entries` order matches `loadGameHistory()` return order

---

## Implementation Notes

### Files to create / modify

```
src/config/history-config.ts                          ← new
src/stores/game-history.ts                            ← new
src/stores/data-sync.ts                               ← modify (add loadGameHistory + cursor support + invalidate call)
tests/unit/stores/game-history-store.test.ts          ← new (store state + integration AC-13)
tests/unit/utils/game-history-mappers.test.ts         ← new (pure formula tests AC-06 to AC-23)
```

### history-config.ts

```typescript
// src/config/history-config.ts
export const HISTORY_LOAD_LIMIT = 100
export const HISTORY_SKELETON_ROWS = 8
```

### GameHistoryEntry type

```typescript
// src/types/game-history.ts (or inline in game-history.ts)
interface Cursor {
  playedAt: string   // ISO 8601
  createdAt: string  // ISO 8601
  id: string         // UUID (id ASC tiebreaker)
}

interface GameHistoryEntry {
  id: string
  playedAt: Date | null             // null if played_at fails to parse
  displayDate: string               // Formula 3 output; '—' if playedAt is null
  playerResult: 'Win' | 'Loss' | 'Draw' | 'Unknown'
  playerResultPrefix: 'W' | 'L' | '½' | '?'
  playerColor: 'white' | 'black'
  endReason: string
  endReasonDisplay: string          // Formula 4
  aiDifficulty: number
  difficultyLabel: string           // Formula 2
  moveCount: number
  openingName: string | null
  openingEco: string | null
  openingDisplay: string            // Formula — opening priority (AC-08)
}
```

### useGameHistoryStore state model

```typescript
// src/stores/game-history.ts
import { defineStore } from 'pinia'
import { HISTORY_LOAD_LIMIT, HISTORY_SKELETON_ROWS } from '@/config/history-config'

interface GameHistoryState {
  entries: GameHistoryEntry[]
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  cacheState: 'cold' | 'valid' | 'dirty'
  hasMore: boolean
  nextCursor: Cursor | null
  fetchGeneration: number   // reactive Pinia state — NOT a closure var
}

export const useGameHistoryStore = defineStore('gameHistory', {
  state: (): GameHistoryState => ({
    entries: [],
    isLoading: false,
    isLoadingMore: false,
    error: null,
    cacheState: 'cold',
    hasMore: false,
    nextCursor: null,
    fetchGeneration: 0,
  }),
  actions: {
    async fetchHistory(): Promise<void> { ... },
    async loadMore(): Promise<void> { ... },
    invalidate(): void { ... },
  },
})
```

### fetchHistory() guard + generation pattern

```typescript
async fetchHistory(): Promise<void> {
  if (this.isLoading) return  // AC-25 deduplication guard — does NOT increment fetchGeneration
  const myGeneration = ++this.fetchGeneration
  this.isLoading = true
  this.error = null
  // ... fetch via useDataSyncStore().loadGameHistory()
  // On success: if (myGeneration === this.fetchGeneration) { this.cacheState = 'valid' }
  // On failure: do NOT modify cacheState
}
```

### invalidate()

```typescript
invalidate(): void {
  this.cacheState = 'dirty'
  this.fetchGeneration++  // invalidates any in-flight fetch
}
```

### loadGameHistory() cursor-based pagination (data-sync.ts)

```typescript
// Extend existing useDataSyncStore
async loadGameHistory(cursor?: Cursor): Promise<GameSession[]> {
  const authStore = useAuthStore()
  if (!authStore.userId) return []   // AC-10

  let query = supabase
    .from('game_sessions')
    .select('*')
    .order('played_at', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(HISTORY_LOAD_LIMIT)

  if (cursor) {
    // Cursor WHERE clause (GDD §4 SQL)
    query = query.or(
      `played_at.lt.${cursor.playedAt},` +
      `and(played_at.eq.${cursor.playedAt},created_at.lt.${cursor.createdAt}),` +
      `and(played_at.eq.${cursor.playedAt},created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
```

### Deferred cross-store call in syncGame() (data-sync.ts)

```typescript
// Inside syncGame() action body — after successful upsert:
const { useGameHistoryStore } = await import('@/stores/game-history')
useGameHistoryStore().invalidate()
// Same pattern in flushUnsyncedQueue() after all upserts complete
```

### Pure formula functions (game-history-mappers.ts)

Extract all four formula computations as pure functions (no Vue/Pinia dependencies):
- `mapPlayerResult(result: string, playerColor: string): { playerResult, playerResultPrefix }`
- `mapDifficultyLabel(aiDifficulty: unknown): string`
- `mapDisplayDate(playedAt: string): { date: Date | null, displayDate: string }`
- `mapEndReasonDisplay(endReason: string): string`
- `mapOpeningDisplay(openingName: string | null, openingEco: string | null): string`

---

## QA Test Cases

**Gate level**: BLOCKING — all unit tests must pass before story ships

- **AC-06a–f, AC-23** (Formula 1): exhaustive lookup table + fallback
- **AC-07a–i** (Formula 2): boundaries + type guard (null/NaN/undefined separately)
- **AC-08a–c**: opening priority decision table
- **AC-19–22, AC-21b** (Formula 4): full lookup + passthrough fallback
- **AC-10**: null userId → empty array, no Supabase call
- **AC-13**: integration test — both stores in real Pinia; syncGame success → cacheState dirty
- **AC-14**: fetch success → cacheState valid
- **AC-15**: move_count=0 → no error
- **AC-17**: invalid date → `'—'` display, no JS error
- **AC-18**: entries order matches loadGameHistory return order

---

## Test Evidence

**Story Type**: Logic (Pinia store + pure functions)
**Required evidence**: BLOCKING — `tests/unit/stores/game-history-store.test.ts` + `tests/unit/utils/game-history-mappers.test.ts` must all pass

---

## Dependencies

- Depends on: `production/epics/supabase/story-004-data-sync-store.md` (useDataSyncStore exists)
- Depends on: `production/epics/supabase/story-002-auth-store.md` (useAuthStore.userId)
- Unlocks: story-002-history-view.md (needs store + entry type)
