# Epic: Opening Identification

> **Layer**: Foundation
> **GDD**: design/gdd/opening-identification.md
> **Architecture Module**: OpeningIndex
> **Status**: Shipped (S2)
> **Stories**: 1 story created

## Stories

| # | Story | Type | Status | Primary ADR |
|---|-------|------|--------|-------------|
| 001 | [Opening Identification — ECO.lookupSync and identifyOpening()](story-001-opening-lookup.md) | Logic | Complete | ADR-0003 |

## Overview

Implements the `OpeningIndex` module: a compile-time Vite plugin/script that reads the
`chess-openings` dataset (pinned to v0.1.1) and emits `src/data/openings-index.generated.ts`
— an EPD-keyed `Map<string, { eco, name, ply }>`. At runtime, `identifyOpening(moves: Move[])`
walks the move list using O(N) hash lookups to find the longest-prefix match, and
`identifyPosition(fenOrEpd)` does a single O(1) map get. No TSV parsing occurs in the browser.
The en passant EPD convention mismatch between chess.js and the lichess dataset is confirmed
non-existent (ADR-0003 spike) — `lookupSync` aligns exactly with no normalization needed.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0003: chess-openings Dataset Pin and EPD Index Build | Pin `chess-openings@0.1.1`; `ECO.lookupSync(fen)` as runtime API (no build-time Map needed — simpler than ADR assumed); EPD convention confirmed matching; bundle ≤ 150 KB gzipped, ≤ 1 MB resident | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-opening-id-001 | EPD-keyed Map, built at compile time (no TSV parsing in browser) | ADR-0003 ✅ |
| TR-opening-id-002 | Longest-prefix match: O(N) hash lookups only (no full-table scan) | ADR-0003 ✅ |
| TR-opening-id-003 | Lookup ≤ 5ms desktop, ≤ 20ms iPhone (Formula 3) | ADR-0003 ✅ |
| TR-opening-id-004 | Index ≤ 150 KB gzipped, ≤ 1 MB resident (Formula 4) | ADR-0003 ✅ |

**Untraced Requirements**: None — 4/4 covered by ADR-0003.

> **Implementation Note** (from Sprint 1 spike): The ADR originally assumed a build-time
> Map approach, but the spike revealed that `chess-openings@0.1.1` exposes `ECO.lookupSync(fen)`
> — a runtime sync API that aligns exactly with the dataset convention. The runtime lookup is
> simpler and no build-time generation step is needed. Story scope should reflect this finding.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/opening-identification.md` are verified
- `identifyOpening()` and `identifyPosition()` have passing unit tests (≥ 10 representative ECO codes including edge cases) in `tests/unit/opening-id/`
- Performance test verifies lookup ≤ 20ms on simulated low-end device
- Bundle size verified ≤ 150 KB gzipped

## Next Step

Run `/create-stories opening-id` to break this epic into implementable stories.
