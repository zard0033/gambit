# Story 003: Review Engine — Lazy Load, analyze(), and 30s Auto-Terminate

> **Epic**: Chess Engine Integration
> **Status**: Complete
> **Layer**: Foundation (Core — engine workers)
> **Type**: Logic
> **Estimate**: M (4–5 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-29
> **TR**: TR-chess-engine-005
> **ADR**: ADR-0001, ADR-0002, ADR-0007, ADR-0008

## Context

**GDD**: `design/gdd/chess-engine-integration.md`
**Requirement**: `TR-chess-engine-005`

**ADR Governing Implementation**: ADR-0001 (NNUE build) + ADR-0002 (Worker lifecycle)
**ADR Decision Summary**: Review Worker uses NNUE lichess fork. It is lazy-created on first `analyze()` call. `reviewEngine.init()` is explicitly exposed for PostGameReview to call before the first analyze (to show loading state separately). Worker auto-terminates after 30s idle; auto-respawns on next `analyze()`. IDLE_TERMINATED and DISPOSED are distinct states.

**Engine**: stockfish-nnue-16.wasm lichess fork | **Risk**: HIGH
**Engine Notes**: NNUE weight download ~40MB. Worker co-residency invariant: Review Worker MUST NOT instantiate until Play Worker is IDLE.

**Control Manifest Rules**:
- Required: Review Worker is lazy-created on first `analyze()`; auto-terminated after 30s idle; auto-respawns
- Required: `IDLE_TERMINATED` (timer) auto-respawns; `DISPOSED` (explicit) rejects synchronously — never collapse into one boolean
- Required: Worker co-residency invariant: Review Worker MUST NOT instantiate while Play Worker is THINKING
- Required: Send `ucinewgame` before first `analyze()` of any new review session
- Required: `reviewEngine.init()` is explicit (idempotent) for loading state separation

---

## Acceptance Criteria

- [ ] `reviewEngine.init(): Promise<void>` triggers NNUE Worker spawn + UCI handshake; idempotent if already IDLE.
- [ ] `reviewEngine.analyze({ fen, targetDepth?, movetimeMs?, signal? }, onProgress?): Promise<ReviewResult>` sends `position fen [fen]` + `go depth [targetDepth] movetime [movetimeMs]`.
- [ ] `onProgress` callback fires for each `info depth [N]` line received from the worker.
- [ ] After 30s with no `analyze()` call, the Review Worker self-terminates and state transitions to IDLE_TERMINATED.
- [ ] On next `analyze()` call after IDLE_TERMINATED, the Worker is automatically respawned and the new search proceeds.
- [ ] `reviewEngine.dispose()` transitions to DISPOSED; any subsequent `analyze()` rejects synchronously with `EngineDisposedError`.
- [ ] `ucinewgame` is sent before the first `analyze()` of a new review session (triggered by caller passing a new `gameId` or by PostGameReview's mount lifecycle).
- [ ] `ReviewResult` type contains NO emotive/evaluative fields.

---

## Implementation Notes

- Create `src/modules/chess-engine/review-engine.ts` exporting `useReviewEngine()`.
- Web Worker file: `src/workers/stockfish-review.worker.ts` — imports NNUE WASM from lichess fork.
- Idle timer: `let idleTimer: ReturnType<typeof setTimeout>`. Reset on each `analyze()` call. On fire, call `worker.terminate()` → IDLE_TERMINATED.
- Co-residency check: before spawning Review Worker, check `playEngineState.value !== 'THINKING'`. If THINKING, wait for IDLE transition (via a Promise that resolves on state change).
- `IDLE_TERMINATED` vs `DISPOSED`: track with a `terminationReason: 'timer' | 'explicit' | null`.
- `requestId` race guard: same pattern as Play Engine (Story 002).

---

## QA Test Cases

- **AC-1**: Auto-terminate after 30s
  - Given: reviewEngine initialized and IDLE
  - When: fake timer advances 30001ms with no analyze() call
  - Then: state === 'IDLE_TERMINATED'; Worker.terminate() was called

- **AC-2**: Auto-respawn after IDLE_TERMINATED
  - Given: state === 'IDLE_TERMINATED'
  - When: `reviewEngine.analyze({ fen, targetDepth: 12 })` called
  - Then: new Worker spawned; UCI handshake completes; search runs; Promise resolves

- **AC-3**: DISPOSED rejects synchronously
  - Given: `reviewEngine.dispose()` called
  - When: `reviewEngine.analyze(...)` called
  - Then: rejects with `EngineDisposedError` without spawning a Worker

- **AC-4**: onProgress fires per info depth
  - Given: mock Worker that sends `info depth 1 ...`, `info depth 2 ...`, then `bestmove`
  - When: `analyze({ fen }, (depth) => depths.push(depth))`
  - Then: `depths` = [1, 2]; Promise resolves with ReviewResult

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/chess-engine/review-engine.test.ts`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 must be DONE (UCI handshake pattern established)
- Unlocks: Epic post-game-review (consumes reviewEngine.analyze())

## Completion Notes
**Completed**: 2026-05-29
**Criteria**: 4/4 ACs passing
**Deviations**: Co-residency guard (Play Worker not THINKING before Review Worker spawns) not yet wired into real PlayView — currently only enforced at the type/API level. To be wired in a future story when GameLifecycle integrates both engines.
**Test Evidence**: Logic — `tests/unit/chess-engine/review-engine.test.ts` — 11 tests pass
**Code Review**: Skipped (Lean mode)
