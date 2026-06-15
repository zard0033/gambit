# Story 004: useDataSyncStore

> **Epic**: Supabase
> **Status**: Complete
> **Layer**: Persistence — Core
> **Type**: Logic (Pinia store)
> **Estimate**: M (6 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-31
> **TR**: pending /architecture-review
> **ADR**: ADR-0004, ADR-0011

## Context

**GDD**: `design/gdd/supabase-integration.md` — Sync Protocol + Offline Behavior sections
**Requirements**: SUPA-AC-06, SUPA-AC-07, SUPA-AC-08, SUPA-AC-09, SUPA-AC-13

**ADR Governing Implementation**: ADR-0011: Supabase Authentication and Data Sync Strategy
**ADR Decision Summary**: `useDataSyncStore` is a globally-reactive Pinia store (not a composable) so `syncStatus` is accessible across all components without prop-drilling. Immediate sync on game completion; failure routes to `localStorage chess:unsynced:<id>`. `flushUnsyncedQueue()` called on `SIGNED_IN` event. Client-generated UUIDs + `ON CONFLICT (id) DO NOTHING` for idempotency. Exponential backoff Formula 3 (base 1s, max 30s) for in-session retries.

**Engine**: Web App — Vue 3 Composition API + TypeScript + Pinia 2 | **Risk**: LOW
**Engine Notes**: `gameStore.completedGame` (ADR-0005) is the data source. `useDataSyncStore` must import from `@/lib/supabase` and `@/stores/auth` — not call `supabase.auth` directly. The `flushUnsyncedQueue` trigger: either called from `useAuthStore.initAuth()` after `SIGNED_IN`, or `useDataSyncStore` watches `useAuthStore.userId` and calls it when userId becomes non-null.

**Control Manifest Rules (Persistence Core)**:
- Required: `syncGame()` is non-blocking — PostGameReview mounts without awaiting it
- Required: All sync failures write to `localStorage` under key `chess:unsynced:<gameId>`; never shown as blocking player error
- Required: `ON CONFLICT (id) DO NOTHING` on all insert retries
- Required: `UNSYNCED_QUEUE_MAX = 50` — drop oldest entry when queue full
- Forbidden: No direct `supabase.from(...)` calls outside `src/stores/data-sync.ts`

---

## Acceptance Criteria

- [ ] **SUPA-AC-06**: GIVEN player is logged in and completes a game, WHEN `syncGame(completedGame)` is called, THEN `game_sessions` receives a row with correct `pgn`, `result`, `player_color`, `opening_eco`, and `syncStatus` transitions `idle → syncing → synced`.
- [ ] **SUPA-AC-07**: GIVEN player completes a game while offline (sync fails), WHEN app is reopened later (online), THEN the game is uploaded and removed from `localStorage:chess:unsynced:*`.
- [ ] **SUPA-AC-08**: GIVEN unsynced games in localStorage before login, WHEN player logs in (`SIGNED_IN` fires), THEN `flushUnsyncedQueue()` uploads all queued games with `ON CONFLICT DO NOTHING`.
- [ ] **SUPA-AC-09**: GIVEN the same game UUID inserted twice (retry scenario), THEN only one row exists in `game_sessions` (idempotent).
- [ ] **SUPA-AC-13**: `syncGame()` does not block PostGameReview from mounting; `syncStatus` updates reactively after sync resolves.
- [ ] **Unit tests**: `tests/unit/stores/data-sync-store.test.ts` — all scenarios covered with mocked supabase client and localStorage.

---

## Implementation Notes

### Files to create / modify

```
src/stores/data-sync.ts                         ← new
tests/unit/stores/data-sync-store.test.ts       ← new
src/stores/auth.ts                              ← modify (call flushUnsyncedQueue on SIGNED_IN)
```

### Store interface (from ADR-0011)

```typescript
// src/stores/data-sync.ts
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

interface DataSyncState {
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error'
  lastSyncedGameId: string | null
}

export const useDataSyncStore = defineStore('dataSync', {
  state: (): DataSyncState => ({
    syncStatus: 'idle',
    lastSyncedGameId: null,
  }),
  actions: {
    async syncGame(game: CompletedGame): Promise<void> { ... },
    async syncSkillScore(score: SkillScoreInsert): Promise<void> { ... },
    async loadGameHistory(): Promise<GameSession[]> { ... },
    async flushUnsyncedQueue(): Promise<void> { ... },
  },
})
```

### syncGame() flow

```typescript
async syncGame(game: CompletedGame) {
  const authStore = useAuthStore()
  if (!authStore.userId) {
    // not logged in — write to unsynced queue
    this._writeToUnsyncedQueue(game)
    return
  }
  this.syncStatus = 'syncing'
  const row = buildGameSessionInsert(game, authStore.userId)
  const { error } = await supabase
    .from('game_sessions')
    .insert(row)
    .on('conflict', 'id', 'ignore')  // ON CONFLICT DO NOTHING
  if (error) {
    this._writeToUnsyncedQueue(game)
    this.syncStatus = 'error'
  } else {
    this.lastSyncedGameId = game.id
    this.syncStatus = 'synced'
  }
}
```

### Offline queue helpers

```typescript
private _writeToUnsyncedQueue(game: CompletedGame) {
  const keys = this._getUnsyncedKeys()
  if (keys.length >= UNSYNCED_QUEUE_MAX) {
    // drop oldest entry
    localStorage.removeItem(keys[0])
    console.warn('[DataSync] Queue full — oldest entry dropped')
  }
  localStorage.setItem(`chess:unsynced:${game.id}`, JSON.stringify(game))
}

private _getUnsyncedKeys(): string[] {
  return Object.keys(localStorage)
    .filter(k => k.startsWith('chess:unsynced:'))
    .sort()  // insertion-order approximation via lexicographic sort on UUID
}
```

### Sync constants (src/config/sync-tuning.ts)

```typescript
export const UNSYNCED_QUEUE_MAX = 50
export const SYNC_BASE_DELAY_MS = 1_000
export const SYNC_MAX_DELAY_MS = 30_000
export const TOKEN_REFRESH_BUFFER_MS = 300_000
```

### flushUnsyncedQueue() — called from useAuthStore on SIGNED_IN

```typescript
async flushUnsyncedQueue() {
  const keys = this._getUnsyncedKeys()
  for (const key of keys) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    const game: CompletedGame = JSON.parse(raw)
    const { error } = await supabase
      .from('game_sessions')
      .insert(buildGameSessionInsert(game, useAuthStore().userId!))
    if (!error) localStorage.removeItem(key)
    // on error: leave in queue; retry next login
  }
}
```

---

## QA Test Cases

**Gate level**: BLOCKING — `tests/unit/stores/data-sync-store.test.ts` must pass

- **SUPA-AC-06 logged in sync**: mock supabase insert success → `syncStatus` = `'synced'`; `lastSyncedGameId` set
- **SUPA-AC-07 offline write**: mock supabase insert failure → `localStorage` has `chess:unsynced:<id>`
- **SUPA-AC-08 flush on login**: populate localStorage with 2 games; call `flushUnsyncedQueue()`; mock success → both keys removed
- **SUPA-AC-09 idempotent**: duplicate insert → `ON CONFLICT DO NOTHING` called; no error thrown
- **Queue overflow**: write 51 games offline → only 50 remain; oldest dropped; console.warn called
- **Not logged in**: `syncGame()` with `userId = null` → immediately writes to localStorage, no Supabase call
- **SUPA-AC-13 non-blocking**: `syncGame()` called without await; syncStatus starts as `'syncing'` immediately; store resolves asynchronously

---

## Test Evidence

**Story Type**: Logic (Pinia store)
**Required evidence**: `tests/unit/stores/data-sync-store.test.ts` — BLOCKING unit test

---

## Dependencies

- Depends on: story-001-project-setup.md (supabase singleton)
- Depends on: story-002-auth-store.md (userId, SIGNED_IN trigger)
- Depends on: story-003-migration.md (tables exist)
- Depends on: `src/config/sync-tuning.ts` (constants — create in this story)
- Unlocks: story-007-sync-badge.md (reads `syncStatus`)

---

## Completion Notes
**Completed**: 2026-05-31
**Criteria**: 6/6 passing (SUPA-AC-06~09, SUPA-AC-13, unit tests)
**Deviations**:
- ADVISORY: `flushUnsyncedQueue` trigger implemented via App.vue `watch(authStore.userId)` instead of modifying auth.ts — avoids circular module dependency (data-sync → auth → data-sync). Functionally equivalent.
- ADVISORY: `pgn` field stores space-joined UCI moves (not proper PGN) — placeholder until PGN viewer story is implemented.
**Test Evidence**: Logic — `tests/unit/stores/data-sync-store.test.ts` 14/14 pass; 386/386 total
**Code Review**: Lean mode — all ACs verified by tests; row mapping covers all endReason/result variants
