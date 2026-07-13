# Epic: Supabase (Authentication + Data Sync)

> **Layer**: Persistence (Foundation + Core)
> **GDD**: design/gdd/supabase-integration.md (complete — all 8 sections authored)
> **Architecture Module**: useAuthStore + useDataSyncStore (Pinia) + src/lib/supabase.ts
> **Status**: Shipped — ADR-0011 Accepted 2026-06-01（S8-06 iOS 驗證通過）；story-001–007 Complete，story-008（ADR-accepted 驗證 spike）AC-S8-04 尚未補（見 story-008）
> **Stories**: story-001-project-setup.md, story-002-auth-store.md, story-003-migration.md, story-004-data-sync-store.md, story-005-route-guards.md, story-006-sign-in-ui.md, story-007-sync-badge.md, story-008-adr-accepted.md

## Overview

Implements MVP Pillar 1 ("Accumulation Over Sessions") — the persistence foundation that
makes the Chess Training Companion motivating over time. Provides two tightly-coupled
services: (1) **Authentication** via Supabase Magic Link (passwordless email login) and
(2) **Data Sync** — an append-only, user-scoped database that persists completed games
and skill scores across devices and sessions. Play is never blocked when offline; sync
failures queue locally and flush on next login.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0011: Supabase Auth + Data Sync Strategy | Magic Link OTP; `useAuthStore` + `useDataSyncStore` Pinia stores; `src/lib/supabase.ts` module singleton; `game_sessions` + `skill_scores` append-only tables; RLS via `user_id = auth.uid()` | LOW — supabase-js v2 API stable |
| ADR-0005: Pinia Store Boundaries | `gameStore.completedGame` is the `CompletedGame` source for `syncGame()` | — |
| ADR-0004: Vue Router History Mode | `beforeEach` guard hooks used for `/history` + `/profile` auth gates | — |
| ADR-0008: CSP Headers | `VITE_SUPABASE_URL` must be added to `connect-src` in `index.html` | — |

## GDD Requirements

| Req-ID | Requirement | ADR Coverage |
|--------|-------------|--------------|
| SUPA-AC-01 | Magic Link OTP request + "Check your email" state | ADR-0011 |
| SUPA-AC-02 | Magic Link callback sets `useAuthStore.userId` + returns player to home | ADR-0011 |
| SUPA-AC-03 | Silent re-login on app open when session still valid | ADR-0011 |
| SUPA-AC-04 | Sign out clears `userId` + returns to home | ADR-0011 |
| SUPA-AC-05 | Expired Magic Link shows error, no crash | ADR-0011 |
| SUPA-AC-06 | `game_sessions` row written before PostGameReview mounts | ADR-0011 |
| SUPA-AC-07 | Offline game syncs on next app open | ADR-0011 |
| SUPA-AC-08 | Unsynced localStorage queue bulk-uploaded on login | ADR-0011 |
| SUPA-AC-09 | Duplicate insert → `ON CONFLICT DO NOTHING` (idempotent) | ADR-0011 |
| SUPA-AC-10 | `/history` + `/profile` redirect unauthenticated users to home | ADR-0004, ADR-0011 |
| SUPA-AC-11 | User A cannot read User B's `game_sessions` rows (RLS) | ADR-0011 |
| SUPA-AC-12 | Unauthenticated query returns empty result (RLS blocks, no error) | ADR-0011 |
| SUPA-AC-13 | Sync completes ≤ 3s on 4G, does not block PostGameReview display | ADR-0011 |

## Definition of Done

This epic is complete when:
- `src/lib/supabase.ts` singleton exists; no `createClient` calls outside lib/stores
- `useAuthStore` and `useDataSyncStore` Pinia stores implemented and unit-tested
- `supabase/migrations/` contains SQL for both tables with RLS policies
- Route guards protect `/history` and `/profile`; `App.vue` calls `initAuth()` on mount
- All AC-01–AC-13 from `design/gdd/supabase-integration.md` can be verified
- ADR-0011 status updated to Accepted (after iOS PWA validation — S7-08)

## Enables (Downstream)

- **Game History** (#12) — reads via `useDataSyncStore.loadGameHistory()`
- **Skill Scoring** (#13) — writes via `useDataSyncStore.syncSkillScore()`
- ~~**Level Progression**（#14）~~ — Superseded：依賴的 skill_scores 表已 DROP（2026-07-10 migration），此下游 epic 不再成立
