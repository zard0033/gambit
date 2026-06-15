# Story 002: Navigation Guards — In-Game Guard, beforeunload, and Popstate

> **Epic**: Navigation & Routing
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: M (3–4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-nav-routing-002, TR-nav-routing-003, TR-nav-routing-006
> **ADR**: ADR-0004, ADR-0005

## Context

**GDD**: `design/gdd/navigation-and-routing.md`
**Requirements**: `TR-nav-routing-002`, `TR-nav-routing-003`, `TR-nav-routing-006`

**ADR Governing Implementation**: ADR-0004 (Router guards) + ADR-0005 (isGameInProgress ownership)
**ADR Decision Summary**: In-game guard: `beforeRouteLeave` on PlayView checks `gameStore.isGameInProgress`. If true, show confirmation dialog (v0: `window.confirm`); allow or block navigation. `window.beforeunload` listener is armed/disarmed by an `isGameInProgress` watcher, independent of the SPA guard. Popstate (browser Back): synchronously call `history.pushState(null, '', '/play')` BEFORE awaiting the confirm dialog.

**Control Manifest Rules**:
- Required: Popstate guard while `isGameInProgress`: synchronously call `history.pushState(null, '', '/play')` BEFORE awaiting confirm dialog
- Required: `beforeunload` listener armed/disarmed by `isGameInProgress` watcher directly
- Required: Disarm-before-navigate order: `setCompletedGame()` → `setGameInProgress(false)` → `router.push('/review')`
- Forbidden: Never both `return false` AND call `history.pushState` on popstate path (double URL restoration flicker)

---

## Acceptance Criteria

- [ ] `beforeRouteLeave` guard on PlayView: if `gameStore.isGameInProgress === true`, shows `window.confirm("Abandon game?")`. Confirm → allow navigation; Cancel → stay on `/play`.
- [ ] `window.beforeunload` listener sets `event.returnValue = ''` when `isGameInProgress === true`, and is removed when `isGameInProgress` becomes `false`.
- [ ] Popstate guard: when browser Back is pressed during an active game, `history.pushState(null, '', '/play')` is called synchronously (before any `await`), then confirmation dialog shown.
- [ ] If the player confirms popstate navigation → `router.push(originalTarget)`.
- [ ] If the player cancels popstate navigation → URL stays at `/play` (already restored synchronously); no double pushState.
- [ ] Disarm-before-navigate ordering verified: `gameStore.completedGame` is set BEFORE `gameStore.isGameInProgress = false`, and both are set BEFORE `router.push('/review')`.

---

## Implementation Notes

- `beforeRouteLeave` in `PlayView.vue`: `if (gameStore.isGameInProgress) { const ok = window.confirm('...'); if (!ok) return false; }`.
- `beforeunload` listener: `watch(() => gameStore.isGameInProgress, (val) => { if (val) window.addEventListener('beforeunload', handler); else window.removeEventListener('beforeunload', handler); }, { immediate: true })`.
- Popstate guard: `window.addEventListener('popstate', async (event) => { if (gameStore.isGameInProgress) { history.pushState(null, '', '/play'); const ok = await confirmLeave(); if (ok) router.push(event.state?.path ?? '/'); } })`.
- `router.beforeEach` can also check `isGameInProgress` for programmatic navigation away from `/play` (e.g., clicking Home link).

---

## QA Test Cases

- **AC-1**: beforeRouteLeave blocks navigation if isGameInProgress
  - Given: PlayView mounted, `gameStore.isGameInProgress = true`, `window.confirm` mocked to return false
  - When: `router.push('/')` called
  - Then: navigation is blocked; current route is still `/play`

- **AC-2**: beforeRouteLeave allows navigation after confirm
  - Given: same setup but `window.confirm` mocked to return true
  - When: `router.push('/')` called
  - Then: navigation succeeds; route changes to `/`

- **AC-3**: beforeunload arms/disarms correctly
  - Given: `isGameInProgress = true`
  - When: check `window._eventListeners['beforeunload']` (or spy on addEventListener)
  - Then: beforeunload listener is registered
  - When: `isGameInProgress = false`
  - Then: beforeunload listener is removed

- **AC-4**: Popstate synchronous pushState before confirm
  - Given: `isGameInProgress = true`, simulate popstate event
  - When: handler executes
  - Then: `history.pushState` was called before any `await` (verify via spy call order)

- **AC-5**: Disarm ordering (unit test)
  - Given: a GameLifecycle unit test that simulates game end
  - When: `endGame()` called
  - Then: call order is: `setCompletedGame()` → `setGameInProgress(false)` → `router.push('/review')` (verified via spy sequence)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/app-router/navigation-guards.test.ts`

**Status**: [x] Created and passing (8 tests)

---

## Completion Notes
**Completed**: 2026-05-29
**Criteria**: AC-1~AC-4 covered by unit tests; AC-5 (disarm-before-navigate ordering) DEFERRED to game-lifecycle story
**Deviations**: ADVISORY — AC-5 depends on GameLifecycle endGame() which is not yet implemented
**Test Evidence**: Logic: `tests/unit/app-router/navigation-guards.test.ts` (8 tests, all pass)
**Code Review**: Pending (to run before sprint close-out)

---

## Dependencies

- Depends on: Story 001 must be DONE (router + routes exist)
- Unlocks: Epic game-lifecycle (depends on `isGameInProgress` and `router.push('/review')`)
