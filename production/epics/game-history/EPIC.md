# Epic: Game History

> **Layer**: MVP Feature
> **GDD**: design/gdd/game-history.md (complete — APPROVED 2026-06-01)
> **Architecture Module**: useGameHistoryStore (Pinia) + useDataSyncStore.loadGameHistory()
> **Status**: Ready — GDD APPROVED, ADR coverage confirmed, stories created (Sprint 8)
> **Stories**: story-001-data-layer.md, story-002-history-view.md, story-003-row-expand.md, story-004-adr-accepted.md, story-005-visual-polish.md

## Overview

Implements MVP Pillar 1 ("Accumulation Over Sessions") — the visible payoff of Sprint 7's
persistence foundation. Reads completed games from Supabase `game_sessions` and renders them
on the `/history` screen as a scrollable list. The player sees their full game record, newest
first, with result / date / opening per row. v0 scope is list + row summary only; game replay
is explicitly deferred to Phase 2 (pgn-viewer reserved dependency).

Two components: (1) `loadGameHistory(cursor?)` action added to `useDataSyncStore` with
cursor-based pagination, and (2) `useGameHistoryStore` — a dedicated Pinia store (per ADR-0005)
that owns loaded entries, cache state, loading flags, and pagination state.

## ADR Check — No New ADR Required

| Decision | Coverage |
|----------|----------|
| `useGameHistoryStore` as a separate Pinia store | ADR-0005 (explicitly names game-history store) |
| `loadGameHistory()` action on `useDataSyncStore` | ADR-0011 Key Interfaces |
| Cursor-based pagination + 3-key sort | Fully specified in GDD §4 — implementation detail, not an architectural fork |
| Cross-store invalidation pattern (deferred Pinia import) | GDD §7 Cross-Store Call Pattern — explicit, non-conflicting with ADR-0011 |

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0005: Pinia Store Boundaries | `useGameHistoryStore` is its own store; must not expand `gameStore` or `useDataSyncStore` state | LOW |
| ADR-0011: Supabase Auth + Data Sync Strategy | `loadGameHistory()` lives on `useDataSyncStore`; queries `game_sessions` scoped by RLS | LOW |
| ADR-0004: Vue Router History Mode | `/history` route guard already implemented (S7-05); HistoryView always mounts authenticated | — |

## GDD Requirements (AC Summary)

| AC-Group | Scope | Story |
|----------|-------|-------|
| AC-01 to AC-05b | Loading / empty / error / retry states | S8-04 (story-002) |
| AC-06a–f | Formula 1 — player result | S8-03 (story-001) |
| AC-07a–i | Formula 2 — difficulty label (incl. type guard) | S8-03 (story-001) |
| AC-08a–c | Opening display priority | S8-03 (story-001) |
| AC-09, AC-09b | Cache valid — no re-fetch | S8-04 (story-002) |
| AC-10 | Defensive null userId guard | S8-03 (story-001) |
| AC-11, AC-11b, AC-11c | Load more button | S8-04 (story-002) |
| AC-12 | Expanded panel DOM wiring (BLOCKING) | S8-04 (story-002) |
| AC-12b | Single-row expand invariant (ADVISORY) | S8-05 (story-003) |
| AC-13 | Cross-store invalidation (integration test) | S8-03 (story-001) |
| AC-14 | cacheState valid on success | S8-03 (story-001) |
| AC-15 | Zero move count | S8-03 (story-001) |
| AC-16a, AC-16b | Refresh button | S8-04 (story-002) |
| AC-17 | Invalid played_at → '—' | S8-03 (story-001) |
| AC-18 | Sort order preserved through mapping | S8-03 (story-001) |
| AC-19–22, AC-21b | Formula 4 — end reason | S8-03 (story-001) |
| AC-23 | Formula 1 unexpected input fallback | S8-03 (story-001) |
| AC-24 | Refresh from error state | S8-04 (story-002) |
| AC-25 | In-flight deduplication guard | S8-04 (story-002) |
| AC-26, AC-27 | isLoadingMore state + error scenario | S8-04 (story-002) |

## Definition of Done

This epic is complete when:
- `src/stores/game-history.ts` implemented with full state model and unit tests
- `useDataSyncStore.loadGameHistory(cursor?)` supports cursor-based pagination
- `src/config/history-config.ts` created with `HISTORY_LOAD_LIMIT` + `HISTORY_SKELETON_ROWS`
- `src/views/HistoryView.vue` replaces Sprint 2 stub; shows all four states
- All BLOCKING unit tests pass (AC-06 to AC-27 as scoped per story)
- AC-12 expanded panel DOM wiring verified in S8-04
- Smoke check passed; QA sign-off APPROVED

## Enables (Downstream)

- **Skill Scoring (#13)** — may show per-game skill delta on history rows (Phase 2)
- **Level Progression (#14)** — indirect; does not read from Game History directly
