# Story 004: Engine Error Surface and Local-Play Degradation

> **Epic**: Chess Engine Integration
> **Status**: Ready
> **Layer**: Foundation (Core — engine workers)
> **Type**: Logic
> **Estimate**: S (2–3 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-chess-engine-008
> **ADR**: ADR-0001, ADR-0002, ADR-0007, ADR-0008

## Context

**GDD**: `design/gdd/chess-engine-integration.md`
**Requirement**: `TR-chess-engine-008`

**ADR Governing Implementation**: ADR-0002: Web Worker Isolation and UCI Protocol
**ADR Decision Summary**: Typed error surface only — `CanceledError`, `EngineUnavailableError`, `EngineDisposedError`, `EngineTimeoutError`. No unhandled promise rejections. `EngineUnavailableError` → degrade to two-human local play (Review unavailable, no crash).

**Control Manifest Rules**:
- Required: Typed error surface only — never unhandled promise rejection
- Required: `EngineUnavailableError` → degrade to two-human local play (board still works)
- Forbidden: Never treat `messageerror` as CRASHED — drop the message, stay in current state

---

## Acceptance Criteria

- [ ] Four typed error classes exist: `CanceledError`, `EngineUnavailableError`, `EngineDisposedError`, `EngineTimeoutError` — each extends `Error` with distinct `name` property.
- [ ] When `playEngine.init()` fails with `EngineUnavailableError`, the app gracefully degrades to two-human local play (board accepts moves from both colors, no AI opponent).
- [ ] `messageerror` from Worker is silently dropped — state does NOT transition to CRASHED.
- [ ] `EngineTimeoutError` is thrown when no `bestmove` arrives within `2 × movetimeMs`.
- [ ] `CanceledError` is thrown when AbortSignal fires.
- [ ] None of the typed errors produce an unhandled promise rejection (all are caught by callers or error boundaries).

---

## Implementation Notes

- Create `src/modules/chess-engine/errors.ts` with the four error classes.
- `EngineUnavailableError` degradation: in `GameLifecycle`, catch `EngineUnavailableError` from `playEngine.init()` → set `engineAvailable = false` → ChessBoard becomes `playerColor = 'white'` for both sides (two-human mode).
- `EngineTimeoutError`: start a `2 × movetimeMs` safety timer in `play()`. If `bestmove` hasn't arrived, cancel, terminate, CRASHED, reject with `EngineTimeoutError`.
- `messageerror` handler: `worker.addEventListener('messageerror', () => { /* silently drop */ })`.

---

## QA Test Cases

- **AC-1**: Four error classes with distinct names
  - When: `new EngineUnavailableError('msg').name`
  - Then: `=== 'EngineUnavailableError'` (same pattern for all four)

- **AC-2**: Degrade to local play
  - Given: mock Worker that never sends `uciok` (init will fail)
  - When: `GameLifecycle` calls `playEngine.init()` and catches EngineUnavailableError
  - Then: `engineAvailable === false`; ChessBoard accepts moves for both colors

- **AC-3**: messageerror is swallowed
  - Given: worker in IDLE state
  - When: `worker.dispatchEvent(new MessageEvent('messageerror', { data: 'bad' }))`
  - Then: state still === 'IDLE'; no error thrown; no transition

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/chess-engine/error-surface.test.ts`

**Status**: [x] `tests/unit/chess-engine/error-surface.test.ts` — 9 tests, all pass (2026-05-30)

---

## Dependencies

- Depends on: Story 001 must be DONE
- Unlocks: Story 005 (liveness probe also handles recovery)
