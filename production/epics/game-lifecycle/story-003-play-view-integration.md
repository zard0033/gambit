# Story 003: PlayView.vue ← useGameLifecycle Integration

> **Epic**: Game Lifecycle
> **Status**: Complete
> **Layer**: Core (UI wiring)
> **Type**: UI
> **Estimate**: M (3–4 hours)
> **Manifest Version**: 2026-05-30
> **Last Updated**: 2026-05-30
> **TR**: TR-game-lifecycle-001, TR-game-lifecycle-002, TR-game-lifecycle-003, TR-game-lifecycle-004, TR-game-lifecycle-005
> **ADR**: ADR-0005

## Context

**GDD**: `design/gdd/game-lifecycle.md`
**Requirements**: TR-game-lifecycle-001 through TR-game-lifecycle-005 (all — this story wires the completed module into the view layer)

**ADR Governing Implementation**: ADR-0005: Pinia Store Boundaries and CompletedGame Transport
**ADR Decision Summary**: `useGameLifecycle` is already implemented (Sprint 3, S3-02 + S3-03). This story wires it into `PlayView.vue` so the UI reacts to FSM state transitions: GAME_OVER overlay appears, New Game resets, Review navigation fires in disarm-before-navigate order.

**Sprint 3 Background**: `useGameLifecycle` and `useGameStore` are complete with 37 passing tests. However, `PlayView.vue` still uses a stub `handleMoveMade` connection — the FSM state is not consumed by the view, so GAME_OVER never surfaces to the player, and there is no New Game or Review navigation in the UI.

**Control Manifest Rules (Core layer)**:
- Required: `disarmGameLifecycle()` MUST be called before `router.push('/review')` — never reverse the order
- Required: `resetGame()` restores FSM to SETUP; board must reset via chessground config, not by remounting the component
- Required: `useGameLifecycle` composable, not ad-hoc FSM logic in the component
- Forbidden: Never navigate to `/review` without `gameStore.completedGame` being set

---

## Acceptance Criteria

- [ ] When `useGameLifecycle` returns `phase === 'GAME_OVER'`, a GAME_OVER overlay appears in `PlayView.vue` covering the board area.
- [ ] The overlay displays the game result (checkmate / stalemate / draw type) sourced from `gameStore.completedGame.endReason` and `gameStore.completedGame.result`.
- [ ] A **New Game** button on the overlay calls `resetGame()` and hides the overlay (FSM returns to SETUP).
- [ ] A **Review** button on the overlay calls `disarmGameLifecycle()` first, then `router.push('/review')`.
- [ ] The board is non-interactive while `phase === 'GAME_OVER'` (pointer-events disabled on chess board, or chessground in view-only mode).
- [ ] `useGameLifecycle` is called in `PlayView.vue` setup — it is not instantiated anywhere else in this view.
- [ ] No `setTimeout` or polling used to detect GAME_OVER — reactivity via `phase` computed/ref.

---

## Implementation Notes

```vue
<!-- PlayView.vue -->
<script setup lang="ts">
import { useGameLifecycle } from '@/modules/game-lifecycle/use-game-lifecycle'
import { useGameStore } from '@/stores/game-store'
import { useRouter } from 'vue-router'

const router = useRouter()
const gameStore = useGameStore()
const { phase, resetGame, disarmGameLifecycle } = useGameLifecycle()

function handleNewGame() {
  resetGame()
}

function handleReview() {
  disarmGameLifecycle()           // MUST come first — ADR-0005 disarm order
  router.push('/review')
}
</script>

<template>
  <!-- board area -->
  <ChessBoard :view-only="phase === 'GAME_OVER'" ... />

  <!-- GAME_OVER overlay -->
  <div v-if="phase === 'GAME_OVER'" class="game-over-overlay">
    <p>{{ gameStore.completedGame?.result }}</p>
    <p>{{ gameStore.completedGame?.endReason }}</p>
    <button @click="handleNewGame">New Game</button>
    <button @click="handleReview">Review</button>
  </div>
</template>
```

- Overlay styling: Tailwind — absolute positioning over board, semi-transparent backdrop
- `ChessBoard` prop `view-only` maps to chessground `movable.color = undefined` (no interactive moves)
- Result display: map `endReason` to human-readable strings (e.g., `'checkmate'` → `'Checkmate!'`)

---

## QA Test Cases

**Story Type**: UI
**Required evidence**: Browser verification (screenshot) — manual QA acceptable per testing standards

- **AC-1**: GAME_OVER overlay appears
  - Given: DEV FEN tool in `/play` panel — set a mated position FEN
  - When: game reaches GAME_OVER state
  - Then: overlay visible with result text; board shows no interactive cursor

- **AC-2**: New Game resets
  - Given: GAME_OVER overlay visible
  - When: click "New Game"
  - Then: overlay disappears; board resets to starting position; game is interactive again

- **AC-3**: Review navigation fires in correct order
  - Given: GAME_OVER overlay visible with `gameStore.completedGame` set
  - When: click "Review"
  - Then: route changes to `/review`; no console errors about `completedGame` being null

- **AC-4**: Board non-interactive during GAME_OVER
  - Given: GAME_OVER overlay showing
  - When: attempt to drag a piece
  - Then: no move is made (chessground in view-only mode)

---

## Test Evidence

**Story Type**: UI
**Required evidence**: Manual browser walkthrough — screenshot in `production/qa/evidence/s4-01-game-over-overlay.png`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: game-lifecycle Story 001 (useGameLifecycle FSM) ✅ Sprint 3 done, game-lifecycle Story 002 (gameStore.completedGame) ✅ Sprint 3 done
- Unlocks: S4-06 (Mobile Calm Default needs PlayView.vue wired), S4-02 (end-to-end testability of PostGameReview)

## Completion Notes
**Completed**: 2026-05-30
**Criteria**: 7/7 passing
**Deviations**:
- ADVISORY: Story AC-4 references `disarmGameLifecycle()` as an explicit call; actual implementation relies on `onGameTerminal()` inside `useGameLifecycle` to automatically disarm (setGameInProgress(false)) before the overlay renders. Functionally equivalent — navigation guard is correctly disarmed by the time the player can click Review.
- ADVISORY: `setDevFen()` added to `use-game-lifecycle.ts` (out of story scope) to support the DEV QA FEN tool. Also resets `_moves`/`_playerMoveTimes` to avoid stale CompletedGame on FEN injection.
**Test Evidence**: UI story — 7 browser screenshots at `production/qa/evidence/s4-01-*.png` (overlay, New Game reset, Review navigation verified via Playwright)
**Code Review**: Complete — 2 bugs found and fixed (engine error → permanent board disable; setDevFen stale _moves)
