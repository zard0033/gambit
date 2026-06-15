# Story 005: iOS Visibility-Change Liveness Probe and Worker Respawn

> **Epic**: Chess Engine Integration
> **Status**: Complete
> **Layer**: Foundation (Core — engine workers)
> **Type**: Integration
> **Estimate**: S (2–3 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-chess-engine-009
> **ADR**: ADR-0001, ADR-0002, ADR-0007, ADR-0008

## Context

**GDD**: `design/gdd/chess-engine-integration.md`
**Requirement**: `TR-chess-engine-009`

**ADR Governing Implementation**: ADR-0002: Web Worker Isolation and UCI Protocol
**ADR Decision Summary**: On `visibilitychange → visible`, if `(now - lastHeartbeatTs) ≥ 60_000ms`, send `isready` + start 1000ms timer. If `readyok` arrives → alive. If timer expires → terminate, respawn from checkpoint `{ fen, requestId, lastForwardedDepth }`. `requestId` is preserved through respawn so stale post-respawn `bestmove` is dropped.

**Control Manifest Rules**:
- Required: iOS visibility liveness protocol (exact timing: `backgroundThresholdMs=60_000ms`, probe timer `1000ms`)
- Required: `requestId` preserved through Worker respawn

---

## Acceptance Criteria

- [ ] On `document.visibilitychange` → visible: if `(Date.now() - lastHeartbeatTs) ≥ 60_000ms`, send `isready` to the worker and start a 1000ms timer.
- [ ] If `readyok` arrives within 1000ms → worker is alive, no respawn.
- [ ] If 1000ms elapses without `readyok` → terminate Worker, respawn, re-run UCI handshake, resume search from checkpoint.
- [ ] `requestId` counter value is preserved through respawn — any stale `bestmove` from before-respawn is dropped by the race guard.
- [ ] `lastHeartbeatTs` is updated whenever any message arrives from the Worker.

---

## Implementation Notes

- Add `document.addEventListener('visibilitychange', onVisibilityChange)` in the engine composable, cleaned up in `onUnmounted`.
- `lastHeartbeatTs` is a `let` variable updated in the `onmessage` handler.
- Checkpoint object `{ fen, requestId, lastForwardedDepth }` is stored before each `play()` or `analyze()` call and cleared on resolve.
- On respawn: re-run `init()` handshake sequence, then re-issue the search from checkpoint.
- Note: This story covers the mechanism. Real-device verification (actual iOS Safari background + resume) is an advisory evidence item.

---

## QA Test Cases

- **AC-1**: Liveness probe fires after 60s background
  - Given: engine in THINKING state, `lastHeartbeatTs` set to `Date.now() - 61_000`
  - When: `document.dispatchEvent(new Event('visibilitychange'))` (document.hidden = false)
  - Then: `isready` was sent to Worker; probe timer started

- **AC-2**: readyok within 1s → alive, no respawn
  - Given: probe timer running; mock Worker sends `readyok` at 500ms
  - Then: Worker.terminate() was NOT called; search continues

- **AC-3**: No readyok in 1s → respawn
  - Given: probe timer running; mock Worker never sends readyok
  - When: fake timer advances 1001ms
  - Then: Worker.terminate() called; new Worker spawned; UCI handshake initiated

- **AC-4**: requestId preserved through respawn
  - Given: requestId = 5 at time of respawn
  - When: old Worker sends bestmove with requestId=5 after new Worker started
  - Then: stale bestmove dropped (new search already has requestId=6 or same 5 but race guard filters it)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- `tests/unit/chess-engine/visibility-liveness.test.ts` — unit test with fake timers (BLOCKING)
- `production/qa/evidence/ios-visibility-liveness-evidence.md` — manual test on real iPhone Safari (ADVISORY)

**Status**: [x] Created and passing (7 tests)

---

## Dependencies

- Depends on: Stories 001–002 must be DONE (UCI handshake + play search exist)
- Unlocks: Nothing — terminal reliability feature

## Completion Notes
**Completed**: 2026-05-30
**Criteria**: 5/5 ACs passing + 2 edge case tests
**Deviations**:
- `VisibilityEventTarget` injectable parameter added to `usePlayEngine` (second arg) for testability — avoids `document` direct access which fails in Node.js test environment
- `dispose()` added to `usePlayEngine` return value (was not in original play-engine; needed for listener cleanup)
- Real-device iOS Safari verification is advisory (no physical device available)
**Test Evidence**: Integration — `tests/unit/chess-engine/visibility-liveness.test.ts` — 7 tests pass
**Code Review**: Skipped (Lean mode)
