# Epic: Game Export / Share

> **Layer**: Feature
> **GDD**: design/gdd/game-export-share.md
> **Architecture Module**: GameExport
> **Status**: Shipped (S4)
> **Stories**: 2 stories created

## Stories

| # | Story | Type | Status | Primary ADR |
|---|-------|------|--------|-------------|
| 001 | [PGN Serialization and Claude.ai Prompt Assembly](story-001-pgn-prompt-assembly.md) | Logic | Complete | ADR-0010 |
| 002 | [Tier-1/2/3 Clipboard Delivery State Machine](story-002-tier-delivery.md) | Logic | Complete | ADR-0010 |

## Overview

Implements the `GameExport` module: PGN serialization via `chess.js .pgn()` (Seven Tag Roster
included, round-trip valid), Claude.ai prompt template assembly (deterministic, pure synchronous
— `string` return type, not `Promise<string>`), and the Tier-1/2/3 clipboard delivery state
machine (IDLE → SHARING/COPYING → SUCCESS → FALLBACK). On iOS, `clipboardWriteText()` must be
called synchronously inside the tap gesture. `navigator.share()` is one-shot on iOS: AbortError
(user dismissed sheet) → IDLE; any other rejection → FALLBACK; `ClipboardAPI NotAllowedError`
→ FALLBACK. The FALLBACK renders a select-all textarea for manual copy.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0010: Game Export Tier-1/2/3 Delivery and Sync-Gesture Clipboard Contract | Pure-sync `assembleExportPayload()`; `canShare({ text })` probed synchronously; SHARING→COPYING retry forbidden on iOS; FALLBACK on non-AbortError or clipboard NotAllowedError | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-game-export-001 | PGN serialisation via chess.js; valid per PGN standard (round-trip) | ADR-0010 ✅ |
| TR-game-export-002 | Tier-1/2/3 delivery: Web Share → Clipboard API → textarea fallback | ADR-0010 ✅ |
| TR-game-export-003 | Clipboard write synchronous in tap gesture (iOS user-activation) | ADR-0010 ✅ |
| TR-game-export-004 | Claude.ai prompt template: deterministic, pure synchronous assembly | ADR-0010 ✅ |

**Untraced Requirements**: None — 4/4 covered by ADR-0010.

> **Advisory**: iOS `canShare({ text })` reachability on real iPhone is deferred (Sprint 1
> spike noted it needs real device). Stories should include manual verification on iPhone
> as ADVISORY acceptance criterion.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/game-export-share.md` are verified
- Logic stories (PGN serialization, prompt template assembly, state machine transitions) have passing unit tests in `tests/unit/game-export/`
- Integration story (full export flow: Tier-1 attempt → FALLBACK) has Playwright E2E test
- iOS user-activation constraint verified: static grep confirms no `await` between tap handler and clipboard/share call
- iPhone manual test documented in `production/qa/evidence/` (ADVISORY)

## Next Step

Run `/create-stories game-export` to break this epic into implementable stories.
