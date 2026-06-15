# Story 007: PostGameReview Sync Badge

> **Epic**: Supabase
> **Status**: Complete (2026-05-31)
> **Layer**: Persistence — Feature UI
> **Type**: UI
> **Estimate**: XS (2 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-30
> **TR**: pending /architecture-review
> **ADR**: ADR-0004, ADR-0011

## Context

**GDD**: `design/gdd/supabase-integration.md` — Interactions section (Post-Game Review row)
**Requirements**: SUPA-AC-13

**ADR Governing Implementation**: ADR-0011; ADR-0007 (PostGameReview sessionstorage schema)
**ADR Decision Summary**: PostGameReview reads `useDataSyncStore.syncStatus` reactively to show badge. Review mounts without awaiting sync — `syncStatus` is reactive and updates asynchronously. No prop-drilling needed because `useDataSyncStore` is a globally-reactive Pinia store.

**Engine**: Web App — Vue 3 Composition API + TypeScript + Tailwind CSS | **Risk**: LOW
**Engine Notes**: `syncStatus` changes from `'idle'` → `'syncing'` → `'synced'` (or `'error'`) asynchronously. Computed properties in `ReviewView.vue` or a small child component suffice — no watcher needed.

**Control Manifest Rules (UI layer)**:
- Required: Badge reflects `useDataSyncStore.syncStatus` — no local copy of sync state
- Required: PostGameReview mounts and displays review data without waiting for sync to complete
- Required: Error state badge shown without blocking review access
- Forbidden: No `await syncGame()` before ReviewView mounts or renders

---

## Acceptance Criteria

- [x] **SUPA-AC-13**: PostGameReview mounts and displays move list / analysis without blocking on sync.
- [x] **AC-S7-02**: When `syncStatus === 'syncing'`, a "Saving…" badge is visible near the top of PostGameReview.
- [x] **AC-S7-03**: When `syncStatus === 'synced'`, badge shows "Saved ✓" or "Saved" (or disappears after 3s).
- [x] **AC-S7-04**: When `syncStatus === 'error'`, badge shows "Not saved" — review is still fully accessible.
- [x] **AC-S7-05**: Badge transitions smoothly between states without layout shift on the review screen.

---

## Implementation Notes

### Files to modify

```
src/views/ReviewView.vue    ← add badge element
```

### Badge component (inline in ReviewView or extracted)

```vue
<!-- Near top of ReviewView content, after game result header -->
<div
  v-if="syncStatus !== 'idle'"
  class="text-xs px-2 py-1 rounded-full inline-flex items-center gap-1"
  :class="{
    'bg-yellow-100 text-yellow-800': syncStatus === 'syncing',
    'bg-green-100 text-green-800': syncStatus === 'synced',
    'bg-red-100 text-red-800': syncStatus === 'error',
  }"
  aria-live="polite"
>
  <span v-if="syncStatus === 'syncing'">Saving…</span>
  <span v-if="syncStatus === 'synced'">Saved</span>
  <span v-if="syncStatus === 'error'">Not saved</span>
</div>
```

```typescript
// In ReviewView.vue <script setup>
import { useDataSyncStore } from '@/stores/data-sync'
const dataSyncStore = useDataSyncStore()
const syncStatus = computed(() => dataSyncStore.syncStatus)
```

### When to call syncGame

`syncGame(completedGame)` should be called from `GameLifecycle` / `gameStore` immediately when game completes — **before** ReviewView mounts. This ensures `syncStatus` is already `'syncing'` or `'synced'` by the time ReviewView renders. The badge then reflects the in-progress or completed sync.

If `syncGame` is not already wired in `gameStore` / game-lifecycle flow, wire it there (not in ReviewView) to keep concerns separated.

---

## QA Test Cases

**Gate level**: ADVISORY (visual/UI story)

- Navigate to review after completing a game → confirm badge visible in one of the three states
- If Supabase not configured: badge shows "Not saved" (error state from failed insert)
- Review content (move list, score) is fully visible regardless of sync state

**Manual evidence**: Screenshot of PostGameReview with sync badge in "Saved" state
**Evidence path**: `production/qa/evidence/s7-07-sync-badge-evidence.md`

---

## Test Evidence

**Story Type**: UI
**Required evidence**: Manual walkthrough with screenshot (ADVISORY)

---

## Dependencies

- Depends on: story-004-data-sync-store.md (`syncStatus` in `useDataSyncStore`)
- `syncGame()` call must be wired in game-lifecycle / gameStore before this story is useful
