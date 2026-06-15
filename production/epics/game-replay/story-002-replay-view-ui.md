# Story 002: ReplayView UI + Navigation

> **Epic**: game-replay
> **Sprint**: S10-02 (Must Have)
> **Status**: Done (2026-06-02)
> **Layer**: Feature / UI
> **Type**: View Component + Navigation
> **Estimate**: L (8 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-02
> **TR**: pending /architecture-review
> **ADR**: ADR-0001, ADR-0004, ADR-0007

> **Completion note (2026-06-02)**: Re-implemented to AC. Navigation is now driven by
> `useReplayNavigation` (single source of truth for `currentPly`); the pgn-viewer board
> is mirrored from it (`toPly`), eliminating the earlier dual-navigation defect. Keyboard
> (arrows = move, Esc = back) and move-list click-to-sync added. Tests:
> `tests/unit/views/replay-view.test.ts` (11), `tests/unit/game-replay/replay-navigation.test.ts` (8).
> AC-04 60fps and mobile screenshot remain advisory (manual QA).

## Context

**Depends on**: S10-01 pgn-viewer wrapper (PgnViewer component available)
**Purpose**: Create the main Replay view where users can step through a saved game

---

## Acceptance Criteria

- [ ] **AC-01**: ReplayView renders with board (PgnViewer) + move list + controls
- [ ] **AC-02**: User can navigate to ReplayView from History row (route: `/replay/:gameId`)
- [ ] **AC-03**: Controls work: play/pause, next/prev move, jump to move slider
- [ ] **AC-04**: Move list shows highlighted current move; scrolls to keep in view
- [ ] **AC-05**: Back button returns to History view; game state not persisted across revisits
- [ ] **AC-06**: Mobile responsive (<768px): board full width, controls below
- [ ] **AC-07**: No console errors; keyboard nav (arrows = move, esc = back)

---

## Implementation Plan

### Layout (Desktop/Mobile)

```
ReplayView
├── Header (back button + game meta)
├── Board + PgnViewer (flex container)
├── Move list (right panel on desktop, below on mobile)
└── Controls (play/pause/next/prev/slider)
```

### Route Integration

```typescript
// Update router:
path: '/replay/:gameId',
component: ReplayView,
beforeEnter: ensureAuth  // Reuse S7-05 guard
```

### Move Navigation

```typescript
interface ReplayState {
  moveIndex: number      // 0 = initial position, N = after move N
  isPlaying: boolean
}

// Methods:
nextMove() / prevMove() / jumpToMove(index)
```

---

## QA Test Cases

**Gate level**: BLOCKING — unit tests for navigation and state; ADVISORY — mobile screenshot

- **AC-02 route**: Mount ReplayView with `{ params: { gameId } }` → route resolves; auth guard (S7-05 pattern) rejects unauthenticated user
- **AC-03a next**: Call `nextMove()` → assert `moveIndex` increments by 1; at max, call again → stays clamped
- **AC-03b prev**: Call `prevMove()` → assert `moveIndex` decrements by 1; at 0, call again → stays at 0
- **AC-03c slider**: Call `jumpToMove(5)` on 10-move game → assert `moveIndex === 5`
- **AC-03d play/pause**: Toggle play/pause → assert `isPlaying` state flips
- **AC-04 highlight**: Mock `moveIndex = 3` → assert move list item index 3 has active class; scroll-into-view triggered
- **AC-05 back**: Back button fires `router.back()`; remount component → `moveIndex` resets to 0
- **AC-07 keyboard**: Arrow keys call `nextMove`/`prevMove`; Esc calls `router.back()`

**Edge cases (GDD)**:
- EC-01: `pgn` with 0 moves → prev/next controls disabled; no crash
- EC-02: Game aborted at move 3 → move list has 3 items; `nextMove()` clamped at 3
- EC-03: `gameId` not found → assert router redirects to `/history`

**Visual evidence**: Mobile screenshot showing board full-width + controls below (ADVISORY — `production/qa/evidence/s10-02-replay-view-mobile.png`)

---

## Test Evidence

**Required**: `tests/unit/views/replay-view.test.ts` (≥8 tests)

---

## Notes

- Reuse move-annotation.vue from S3 (show best move arrow)
- Defer: Game comments, position evaluation popup (Phase 2b)
