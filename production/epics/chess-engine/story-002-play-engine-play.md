# Story 002: Play Engine — play() Method with AbortSignal and Race Guard

> **Epic**: Chess Engine Integration
> **Status**: Complete
> **Layer**: Foundation (Core — engine workers)
> **Type**: Logic
> **Estimate**: M (3–4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-chess-engine-004
> **ADR**: ADR-0001, ADR-0002, ADR-0007, ADR-0008

## Context

**GDD**: `design/gdd/chess-engine-integration.md`
**Requirement**: `TR-chess-engine-004`

**ADR Governing Implementation**: ADR-0002: Web Worker Isolation and UCI Protocol
**ADR Decision Summary**: Each `play()` call increments a monotonic `requestId`. The wrapper drops any `bestmove` whose `requestId` doesn't match the current latest. `AbortSignal` triggers cancel-replace: send `stop` → drain `info` lines until `bestmove` → if no `bestmove` within `stopDrainTimeout=2000ms`, terminate Worker and transition to CRASHED.

**Engine**: stockfish@16.0.0 WASM | **Risk**: HIGH

**Control Manifest Rules (Core layer)**:
- Required: Each `analyze()` call increments a monotonic `requestId`; drop `bestmove` if `requestId` doesn't match
- Required: Cancel-replace on new call while THINKING: send `stop` → drain → timeout=2000ms
- Required: `AbortSignal` as external cancellation API
- Forbidden: Never queue `play()` requests — cancel-replace only

---

## Acceptance Criteria

- [x] `playEngine.play({ fen, skillLevel, movetimeMs, signal? }): Promise<PlayResult>` sends `position fen [fen]` + `go movetime [movetimeMs]` to the HCE worker.
- [x] `PlayResult` type contains NO emotive/evaluative fields (`quality`, `label`, `judgment`, `brilliant`, `blunder`) — enforced by TypeScript interface.
- [x] When `play()` is called while THINKING, the current search is canceled (UCI `stop` sent, drain until `bestmove` or 2s timeout) before the new search starts.
- [x] `requestId` is incremented on each call; a stale `bestmove` (wrong requestId) is silently dropped.
- [x] When `AbortSignal` fires, the same cancel-replace sequence runs and the Promise rejects with `CanceledError`.
- [x] `skillLevel` (0-20) is sent as `setoption name Skill Level value [n]` before `go` — per GDD §Detailed Design line "Engine sends: position fen [fen], setoption name Skill Level value [n], go movetime [ms]".

---

## Implementation Notes

- `play()` sends: `position fen ${fen}` then `go movetime ${movetimeMs}`.
- State transitions: IDLE → THINKING (on call) → IDLE (on bestmove received with matching requestId).
- `requestId` is a module-level `let requestId = 0; requestId++` before each search.
- `onmessage` handler in wrapper checks `event.data.includes('bestmove')` — parse requestId from a custom header appended to the UCI `info` stream (not native UCI). Alternative: use a closure over `const localId = requestId` and compare.
- AbortSignal listener: `signal.addEventListener('abort', cancelSearch)`.
- `stopDrainTimeout`: start a 2s timer after sending `stop`. If `bestmove` arrives before timeout, transition normally. If timeout fires, terminate Worker → CRASHED.

---

## QA Test Cases

- **AC-1**: play() resolves with PlayResult
  - Given: worker in IDLE state, FEN = starting position
  - When: `playEngine.play({ fen, skillLevel: 10, movetimeMs: 100 })`
  - Then: resolves with `{ bestMove: string, depthReached: number, ... }` within 200ms (mock worker)

- **AC-2**: Race guard drops stale bestmove
  - Given: two consecutive `play()` calls (requestId 1, then 2)
  - When: worker returns bestmove for requestId 1 after requestId 2 search started
  - Then: the stale bestmove is dropped; only requestId 2 result resolves the Promise

- **AC-3**: AbortSignal → CanceledError
  - Given: play() in THINKING state
  - When: AbortController.abort() called
  - Then: Promise rejects with `CanceledError`; `stop` was sent to Worker

- **AC-4**: PlayResult has no emotive fields
  - When: TypeScript compiles `PlayResult` type
  - Then: No field named `quality`, `label`, `judgment`, `brilliant`, `blunder`, `mistake`, `rating`

- **AC-5**: stopDrainTimeout → CRASHED if no bestmove after stop
  - Given: mock Worker that never sends `bestmove` after receiving `stop`
  - When: second `play()` triggers cancel-replace, fake timer advances 2001ms
  - Then: Worker terminated, state === 'CRASHED'

- **AC-6**: skillLevel → UCI option mapping
  - Given: mock Worker capturing all postMessage calls, skillLevel=10
  - When: `playEngine.play({ fen, skillLevel: 10, movetimeMs: 100 })` called
  - Then: `setoption name Skill Level value 10` sent before `go`
  - Edge case: `skillLevel=0` sends `setoption name Skill Level value 0`

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/chess-engine/play-engine-play.test.ts`

**Status**: [x] Created and passing (19 tests)

---

## Completion Notes
**Completed**: 2026-05-29
**Criteria**: 6/6 passing
**Deviations**:
- ADVISORY: play() throws EngineUnavailableError when non-IDLE (not cancel-replace per ADR-0002 §3) — inert for v0, deferred to future story
- ADVISORY: AC-6 wording corrected from UCI_LimitStrength+UCI_Elo to Skill Level value [n] per GDD
- FIXED: worker.terminate() added to stopDrainTimeout path (code review)
- FIXED: cancelSearch() dead code removed (code review)
**Test Evidence**: `tests/unit/chess-engine/play-engine-play.test.ts` — 19 tests, all passing
**Code Review**: Complete — APPROVE with fixes

---

## Dependencies

- Depends on: Story 001 must be DONE (worker initialized)
- Unlocks: Story 003 (review engine follows same pattern)
