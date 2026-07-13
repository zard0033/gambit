# Epic: Chess Engine Integration

> **Layer**: Foundation
> **GDD**: design/gdd/chess-engine-integration.md
> **Architecture Module**: ChessEngine
> **Status**: Shipped (S2, NNUE S9)
> **Stories**: 9 stories created

## Stories

| # | Story | Type | Status | Primary ADR |
|---|-------|------|--------|-------------|
| 001 | [Play Engine — Worker Scaffold and UCI Handshake](story-001-play-engine-uci.md) | Logic | Ready | ADR-0001/0002 |
| 002 | [Play Engine — play() Method with AbortSignal and Race Guard](story-002-play-engine-play.md) | Logic | Ready | ADR-0002 |
| 003 | [Review Engine — Lazy Load, analyze(), 30s Auto-Terminate](story-003-review-engine.md) | Logic | Ready | ADR-0001/0002 |
| 004 | [Engine Error Surface and Local-Play Degradation](story-004-error-degradation.md) | Logic | Ready | ADR-0002 |
| 005 | [iOS Visibility-Change Liveness Probe and Worker Respawn](story-005-ios-visibility.md) | Integration | Ready | ADR-0002 |
| 006 | [CSP Headers and WASM Deployment Configuration](story-006-csp-wasm-deployment.md) | Config/Data | Ready | ADR-0008 |
| 007 | [Memory Budget Verification (Peak ≤ 150 MB)](story-007-memory-budget.md) | Config/Data | Ready | ADR-0001 |

## Overview

Implements the two-worker Stockfish integration: a long-lived HCE Play worker
(`stockfish@16.0.0`, UCI `Use NNUE false`) for opponent moves and a lazy-loaded NNUE Review
worker (`stockfish-nnue-16.wasm` lichess fork) for post-game analysis. Both workers use
`postMessage`-only communication (no SharedArrayBuffer — GitHub Pages constraint), strict UCI
handshake, AbortSignal cancellation with requestId race guards, and structured error types
(`EngineUnavailableError`, `EngineTimeoutError`, `CanceledError`, `EngineDisposedError`).
The Review worker auto-terminates after 30s idle. iOS visibility-change liveness probe + respawn
is a required mobile reliability feature.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0001: Stockfish Build Versioning and HCE/NNUE Split | `stockfish@16.0.0` (HCE via `Use NNUE false`); NNUE lichess fork for Review; memory budget Play 25 MB + Review 80 MB + App 40 MB = 145 MB < 150 MB ceiling | HIGH |
| ADR-0002: Web Worker Isolation and UCI Protocol | `postMessage`-only; no SharedArrayBuffer; requestId race guard; AbortSignal cancellation; IDLE_TERMINATED vs DISPOSED distinction; iOS visibility liveness | HIGH |
| ADR-0008: CSP Headers and WASM Deployment Configuration | `script-src 'wasm-unsafe-eval'; worker-src 'self' blob:` — required for GitHub Pages WASM delivery | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-chess-engine-001 | Two engines: HCE Play + NNUE Review (separate WASM builds) | ADR-0001 ✅ |
| TR-chess-engine-002 | Single-threaded WASM only — no SharedArrayBuffer, no COOP/COEP | ADR-0002 ✅ |
| TR-chess-engine-003 | UCI protocol: strict uci→uciok→setoption→isready→readyok handshake | ADR-0002 ✅ |
| TR-chess-engine-004 | AbortSignal cancellation + requestId race guard | ADR-0002 ✅ |
| TR-chess-engine-005 | Review worker auto-terminates after 30s idle | ADR-0002 ✅ |
| TR-chess-engine-006 | Memory budget: peak ≤ 150 MB (Formula 4) | ADR-0001 ✅ |
| TR-chess-engine-007 | CSP: script-src 'wasm-unsafe-eval'; worker-src 'self' blob: | ADR-0008 ✅ |
| TR-chess-engine-008 | EngineUnavailableError → degrade to two-human local play | ADR-0002 ✅ |
| TR-chess-engine-009 | iOS visibility change: liveness ping on resume, respawn if dead | ADR-0002 ✅ |

**Untraced Requirements**: None — 9/9 covered by ADR-0001 + ADR-0002 + ADR-0008.

> ⚠️ **Advisory**: ADR-0008 iOS Safari CSP verification on a real iPhone is still pending
> (deferred from Sprint 1 — needs real device). Stories for TR-chess-engine-007 should
> include a "verify on iPhone Safari" acceptance criterion marked ADVISORY until the spike
> is complete.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/chess-engine-integration.md` are verified
- Logic stories (UCI handshake, AbortSignal, race guard, idle-terminate) have passing unit tests in `tests/unit/chess-engine/`
- Integration story (Play worker full round-trip) has passing integration test
- Memory budget verified in Chrome DevTools snapshot
- iOS advisory stories have evidence doc in `production/qa/evidence/` (after real-device test)

## Next Step

Run `/create-stories chess-engine` to break this epic into implementable stories.
