# Epic: Navigation & Routing

> **Layer**: Foundation
> **GDD**: design/gdd/navigation-and-routing.md
> **Architecture Module**: AppRouter
> **Status**: Complete — both stories implemented and tested (Sprint 2, 2026-05-29)
> **Stories**: 2 stories created

## Stories

| # | Story | Type | Status | Primary ADR |
|---|-------|------|--------|-------------|
| 001 | [Route Table, Lazy Loading, and GitHub Pages SPA Fallback](story-001-route-table.md) | Logic | Complete | ADR-0004 |
| 002 | [Navigation Guards — In-Game Guard, beforeunload, and Popstate](story-002-navigation-guards.md) | Logic | Complete | ADR-0004/0005 |

## Overview

Implements the `AppRouter` module: Vue Router 4 with `createWebHistory` (HTML5 history mode),
the route table (`/`, `/play`, `/review`, 404 catch-all), GitHub Pages SPA fallback via
`404.html → index.html` shim, route-level lazy loading for Play and Review chunks, the
in-game `beforeRouteLeave` guard (checks `gameStore.isGameInProgress`), `window.beforeunload`
listener lifecycle for full-page exit, and the popstate guard with deterministic
`history.pushState` restore for browser Back/swipe during a game. Scroll and focus reset on
navigation are part of this module.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0004: Vue Router History Mode and GitHub Pages SPA Fallback | `createWebHistory`; `404.html` shim with JS redirect; route-level lazy loading; popstate deterministic restore | LOW |
| ADR-0005: Pinia Store Boundaries and CompletedGame Transport | `gameStore.isGameInProgress` is the guard trigger; disarm-before-navigate ordering locked here | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-nav-routing-001 | Vue Router HTML5 history mode (createWebHistory) | ADR-0004 ✅ |
| TR-nav-routing-002 | In-game guard: beforeRouteLeave + isGameInProgress check | ADR-0005 ✅ |
| TR-nav-routing-003 | window.beforeunload listener for full-page exit | ADR-0004 ✅ |
| TR-nav-routing-004 | Route-level lazy loading (Play + Review chunks deferred) | ADR-0004 ✅ |
| TR-nav-routing-005 | GitHub Pages SPA fallback: 404.html → index.html shim | ADR-0004 ✅ |
| TR-nav-routing-006 | Popstate guard with deterministic history.pushState restore | ADR-0004 ✅ |

**Untraced Requirements**: None — 6/6 covered by ADR-0004 + ADR-0005.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/navigation-and-routing.md` are verified
- Logic stories (guards, popstate restore, isGameInProgress disarm ordering) have passing unit tests in `tests/unit/app-router/`
- `404.html` shim exists and Playwright E2E test confirms SPA deep-link navigation works
- Route-level lazy loading verified in Vite bundle analysis (Play + Review not in initial chunk)

## Next Step

Epic complete — both stories (001, 002) implemented, tested, and marked Complete. No further story creation needed.
