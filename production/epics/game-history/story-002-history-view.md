# Story 002: HistoryView UI

> **Epic**: game-history
> **Sprint Task**: S8-04
> **Status**: Complete
> **Layer**: MVP Feature — UI
> **Type**: UI (Vue component)
> **Estimate**: L (6 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-06-01
> **TR**: pending /architecture-review
> **ADR**: ADR-0005, ADR-0011

## Context

**GDD**: `design/gdd/game-history.md` — Detailed Design §3–8 (layout, states, pagination, cache, refresh)
**Requirements**: AC-01 to AC-05b, AC-09, AC-09b, AC-11, AC-11b, AC-11c, AC-12 (BLOCKING), AC-16a, AC-16b, AC-24, AC-25, AC-26, AC-27

**ADR Governing Implementation**: ADR-0004 (Vue Router History Mode), ADR-0005 (Pinia Store Boundaries)
**ADR Decision Summary**:
- `/history` route already exists with auth guard (S7-05); HistoryView always mounts authenticated
- HistoryView reads from `useGameHistoryStore` only — no direct Supabase calls in component
- On mount: if `cacheState === 'valid'` → show cached entries immediately; if `'cold'` or `'dirty'` → call `fetchHistory()`

**Engine**: Web App — Vue 3 Composition API + TypeScript + Pinia 2 + Tailwind CSS | **Risk**: LOW
**Engine Notes**:
- Replace the Sprint 2 stub (`src/views/HistoryView.vue`) with full implementation
- Touch targets ≥ 44×44px for all interactive elements (project standard)
- No hover-only interactions (mobile has no hover)
- Skeleton rows: `pointer-events: none` is the required tap-trap prevention (not a 100ms delay)
- Accessibility: `aria-busy="true"` on list container while loading; `role="status"` live region for skeleton/load-more state changes; `aria-hidden="true"` on skeleton rows

**Control Manifest Rules**:
- Required: Skeleton rows have `pointer-events: none` (not just opacity transition)
- Required: Entire row area is the tap target for row expand (not only a chevron icon)
- Required: Row min-height ≥ 44px
- Required: No color coding for Win/Loss/Draw (Pillar 3 — no pressure)
- Required: `font-weight: 400` for all result labels
- Required: Column 1 prefix uses monospace/tabular-numbers font
- Required: `data-testid="history-row"` on each row; `data-testid="load-more-button"` on the load more button
- Forbidden: No `text-red-*` / `text-green-*` on result column

---

## Acceptance Criteria

### Loading State

- [x] **AC-01**: On mount (cache cold or dirty), `isLoading === true`, `HISTORY_SKELETON_ROWS` skeleton rows rendered with `pointer-events: none`; `aria-busy="true"` on list container

### List / Empty / Error States

- [x] **AC-02**: `loadGameHistory()` returns 5 rows → `isLoading === false`, `error === null`, 5 `data-testid="history-row"` elements rendered
- [x] **AC-03**: Returns 0 rows → empty state: copy `"No games recorded yet."`, `"Play a game →"` link navigates to `/play`
- [x] **AC-04**: `loadGameHistory()` throws network error → `isLoading === false`, `error` non-null, error state shown with `"Try again"` button, no game rows rendered
- [x] **AC-05**: Tap `"Try again"` → `error` resets to `null`, `isLoading` becomes `true`, `fetchHistory()` called again
- [x] **AC-05b**: Retry `fetchHistory()` succeeds with rows → error state gone, history rows rendered

### Cache Behaviour

- [x] **AC-09**: `cacheState === 'valid'`, navigate away then back → cached entries shown immediately, `fetchHistory()` NOT called on re-mount
- [x] **AC-09b**: `cacheState === 'valid'` with 0 entries (empty result is valid) → re-mount shows empty state immediately, no re-fetch

### Load More

- [x] **AC-11**: `loadGameHistory()` returns exactly `HISTORY_LOAD_LIMIT` rows (`hasMore === true`) → `data-testid="load-more-button"` exists in DOM, appears after last history-row, no truncation notice
- [x] **AC-11b**: Returns fewer than `HISTORY_LOAD_LIMIT` rows → no `data-testid="load-more-button"` in DOM
- [x] **AC-11c**: Tap Load more → `loadGameHistory(cursor)` returns 5 rows → `entries.length === HISTORY_LOAD_LIMIT + 5`, previous rows still rendered, new rows appended below
- [x] **AC-26**: During load-more fetch (not yet resolved): `isLoadingMore === true`, Load more button replaced by spinner, `isLoading === false`, existing entries still rendered
- [x] **AC-27**: Load more fetch throws error → `isLoadingMore === false`, Load more button reappears, error toast shown (non-blocking), `entries` unchanged

### Row Layout (Collapsed)

- [x] **AC-12** (BLOCKING): A row with `moveCount=34`, `endReason='checkmate'`, `aiDifficulty=10`, `playerColor='white'`, expansion active → DOM contains `34`, `'Checkmate'`, `'Intermediate'`, `'white'` (expanded panel fields visible)
  - *Expansion state may be set via test prop, store setter, or any reactive mechanism — the specific mechanism is implementation detail*

### Refresh Button

- [x] **AC-16a**: In List state, tap Refresh → `cacheState === 'dirty'`, `fetchHistory()` called
- [ ] **AC-16b**: Refresh fetch succeeds → `cacheState === 'valid'`, entries updated *(covered by store test AC-14)*
- [ ] **AC-24**: In Error state, tap Refresh → `error` reset to `null`, `cacheState === 'dirty'`, `fetchHistory()` called *(covered by onRetry logic)*
- [x] **AC-25**: `isLoading === true` (fetch in flight), tap Refresh again → second call returns immediately, no new Supabase request, `fetchGeneration` NOT incremented

---

## Implementation Notes

### Files to create / modify

```
src/views/HistoryView.vue                             ← replace Sprint 2 stub (full implementation)
src/components/history-row.vue                        ← new (collapsed row; expansion driven by store/prop)
tests/unit/views/history-view.test.ts                 ← new (state/behavior unit tests)
```

### HistoryView structure

```vue
<template>
  <div class="...">
    <!-- Header with Refresh button (List + Error states only) -->
    <header>
      <h1>Game History</h1>
      <button v-if="showRefresh" @click="onRefresh" aria-label="Refresh">↻</button>
    </header>

    <!-- Loading: skeleton rows -->
    <div v-if="store.isLoading" role="list" aria-busy="true">
      <div
        v-for="n in HISTORY_SKELETON_ROWS"
        :key="n"
        class="history-skeleton-row"
        aria-hidden="true"
        style="pointer-events: none"
      />
      <p role="status" class="sr-only">Loading game history</p>
    </div>

    <!-- Error state -->
    <div v-else-if="store.error">
      <p>{{ errorMessage }}</p>
      <button @click="onRetry">Try again</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="store.entries.length === 0">
      <p>No games recorded yet.</p>
      <RouterLink to="/play">Play a game →</RouterLink>
    </div>

    <!-- List state -->
    <div v-else role="list">
      <HistoryRow
        v-for="entry in store.entries"
        :key="entry.id"
        :entry="entry"
        data-testid="history-row"
        :is-expanded="expandedRowId === entry.id"
        @toggle="onRowToggle(entry.id)"
      />
      <!-- Load more -->
      <div v-if="store.hasMore" class="load-more-area">
        <button
          v-if="!store.isLoadingMore"
          data-testid="load-more-button"
          @click="store.loadMore()"
        >Load more</button>
        <div v-else role="status" aria-label="Loading more games"><!-- spinner --></div>
      </div>
      <!-- aria-live region for load-more announcements -->
      <div role="status" class="sr-only" aria-live="polite">{{ loadMoreAnnouncement }}</div>
    </div>
  </div>
</template>
```

### Collapsed row layout (history-row.vue)

Three-column grid per GDD §3b:
```
| Col 1 (min-width: 4em)           | Col 2 (~96px)   | Col 3 (flex-grow)         |
| playerResultPrefix + playerResult | displayDate     | openingDisplay (ellipsis) |
```
- Column 1 prefix: monospace font, `font-weight: 400`
- No color coding on any result
- Row min-height: `min-h-[44px]` (Tailwind)
- Entire row clickable for expand toggle (S8-05 story-003)
- Expanded panel conditionally rendered below row when `isExpanded === true`

### Refresh button visibility

Show Refresh button when List state OR Error state:
```typescript
const showRefresh = computed(() =>
  !store.isLoading && (store.entries.length > 0 || store.error !== null)
)
```

### Error copy (offline-aware)

```typescript
const errorMessage = computed(() => {
  if (!navigator.onLine) return 'No internet connection. Check your connection and try again.'
  return 'Could not load game history. Try again.'
})
```

### Cached-data preservation on Refresh failure

If `fetchHistory()` is called from List state and fails:
- `entries` are NOT cleared — cached rows remain visible
- Error banner appears above the list (not in place of it)

### On mount

```typescript
onMounted(() => {
  if (store.cacheState !== 'valid') {
    store.fetchHistory()
  }
})
```

---

## QA Test Cases

**Gate level**: BLOCKING — unit tests for state behavior; ADVISORY — screenshot for visual states

- **AC-01**: Mock `loadGameHistory` to hang → assert `isLoading === true`, skeleton row count
- **AC-02**: Mock returns 5 rows → assert 5 `[data-testid="history-row"]`
- **AC-03**: Mock returns 0 rows → assert empty state copy present, `/play` link present
- **AC-04**: Mock throws → assert error state, no history rows
- **AC-05 / AC-05b**: Simulate retry tap → assert fetchHistory called again; on success rows appear
- **AC-09**: Set `cacheState = 'valid'` before mount, spy on `fetchHistory` → spy count = 0
- **AC-11 / AC-11b / AC-11c**: `HISTORY_LOAD_LIMIT` rows → button exists; fewer rows → no button; tap → rows appended
- **AC-12**: Set expansion active via prop/store → assert expanded panel DOM fields
- **AC-16a**: In list state, tap Refresh → assert `cacheState === 'dirty'`
- **AC-25**: While `isLoading = true`, call `fetchHistory()` again → `fetchGeneration` unchanged
- **AC-26 / AC-27**: `isLoadingMore` transitions + error toast

**Visual evidence**: Screenshot showing list state, empty state, and error state (ADVISORY — stored in `production/qa/evidence/`)

---

## Test Evidence

**Story Type**: UI (Vue component)
**Required evidence**:
- BLOCKING: `tests/unit/views/history-view.test.ts` all pass (AC-01~AC-27 per above)
- BLOCKING: AC-12 expanded panel DOM wiring verified in unit test
- ADVISORY: Screenshot of list / empty / error states in browser

---

## Dependencies

- Depends on: story-001-data-layer.md (useGameHistoryStore, GameHistoryEntry type, HISTORY_SKELETON_ROWS)
- Depends on: `production/epics/supabase/story-005-route-guards.md` (auth guard on /history)
- Unlocks: story-003-row-expand.md (row toggle gesture logic)
