# Epic: Journal (棋誌)

> **Layer**: Phase 1 Differentiation Feature
> **GDD**: design/gdd/journal.md (Designed — v1 scope: onset / arrival / solace；review log 2026-06-16)
> **Architecture Module**: useJournalStore (Pinia, logic) + useDataSyncStore.loadJournalEntries/appendJournalEntry + journal_entries table + JournalView + HomeView peek
> **Status**: Ready to implement (v1) — ADR-0013 **Accepted** 2026-06-16, `journal_entries` live + RLS verified (story-007 done); story-001…006 Ready
> **Stories**: story-001…007 (see table below)

## Overview

棋誌是差異化北極星 Phase 1 的「心臟」：Neve 一個人寫的、寫「你」的 append-only 文學式成長之書（非統計、非 juice、平靜見證）。v1 實作三種筆——**onset 啟程**（首次使用的零門檻歡迎，解 cold-start）、**arrival 抵達**（完成一階）、**solace 陪伴**（連敗時的溫柔記，永不批評）。三者皆可從**已持久化狀態**重建（首次旗標／`lesson_progress.completed`／對局結果序列），故不依賴 ephemeral 捕捉或可靠 app-close 事件。①②③⑥ 留待 Phase 2（需上游 #18/#7 補事件介面或數月累積；`type` 已預留，無需 migration）。

兩塊：(1) `journal_entries` 表（append-only、RLS、事件級冪等 `UNIQUE(user_id, source_ref_id)`）＋ `useDataSyncStore` 的 journal 方法；(2) `useJournalStore`（從持久狀態惰性 `evaluate()` 推導候選、F2 取 priority 前 `SESSION_ENTRY_CAP`=3 筆、零 AI 模板渲染）＋ JournalView ＋ 首頁 peek。

## ADR Check — New ADR Required (ADR-0013)

| Decision | Coverage |
|----------|----------|
| `journal_entries` schema, event-key idempotency, lazy settle, session boundary | **ADR-0013** (new, 2026-06-16) — Proposed |
| `useJournalStore` as its own Pinia store | ADR-0005 (per-feature store boundary) |
| journal methods on `useDataSyncStore`; RLS + offline queue + union reconcile | ADR-0011 (only data-sync/auth touch supabase) |
| `/journal` route | navigation-and-routing.md — must register `/journal` in the route table (待補一致性) |

## Governing ADRs

| ADR | Decision Summary | Status | Engine Risk |
|-----|-----------------|--------|-------------|
| ADR-0013: Journal Data Model & Session Boundary | `journal_entries` table; `UNIQUE(user_id, source_ref_id)` event idempotency (NOT row-UUID); lazy `evaluate()` settle (no app-close needed); `SESSION_IDLE_TIMEOUT` scoped to cooldown/carryover; `type text` (Phase 2 no migration) | **Accepted** (2026-06-16) | LOW |
| ADR-0011: Supabase Auth + Data Sync | journal persistence lives on `useDataSyncStore`; RLS `user_id=auth.uid()`; offline queue; union reconcile | Accepted | LOW |
| ADR-0005: Pinia Store Boundaries | `useJournalStore` is its own store; does not expand gameStore/data-sync state; no supabase import | Accepted | LOW |

> **UNBLOCKED (2026-06-16)**: ADR-0013 is **Accepted**; `journal_entries` applied to live DB and verified (GET 200 `[]` / unauth POST 401 `42501`). story-007 is **Complete**. story-001…006 are all **Implemented** (2026-06-16, same day as 007 — see Stories table).

## GDD Requirements (AC → Story map)

| AC | Scope | Story | TR-ID |
|----|-------|-------|-------|
| (table, store load/merge, order foundation) | data layer | 001 | TR-journal-001 |
| AC-onset-1/2, AC-arrival-1/2/3, AC-solace-1/2, AC-priority-1/2/3 | settle engine (F1+F2, cap=3) | 002 | TR-journal-002 |
| AC-tone-lint, AC-solace-3 | templates + persona lint | 003 | TR-journal-003 |
| AC-order, AC-no-edit, AC-empty-state, AC-reduced-motion | overview UI | 004 | TR-journal-004 |
| AC-unread (+ homepage peek) | peek + unread watermark | 005 | TR-journal-005 |
| AC-guest-reconcile | guest→login reconcile | 006 | TR-journal-006 |
| (live migration + ADR acceptance) | release gate | 007 | TR-journal-007 |

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Journal data layer (table + data-sync methods + store) | Integration | **Implemented** (2026-06-16) | ADR-0013, ADR-0011, ADR-0005 |
| 002 | Settle engine — F1 gates + F2 cap=3 | Logic | **Implemented** (2026-06-16) | ADR-0013 |
| 003 | Zero-AI templates + persona lint | Logic | **Implemented** (2026-06-16, 26 tests green) | ADR-0013 |
| 004 | Journal overview UI (/journal) | UI | **Implemented** (2026-06-16) | ADR-0013 |
| 005 | Homepage peek + unread watermark | UI | **Implemented** (2026-06-16) | ADR-0013 |
| 006 | Guest→login reconcile | Integration | **Implemented** (2026-06-16) | ADR-0013, ADR-0011 |
| 007 | ADR-0013 Accepted + live migration | Config/Process | **Complete** (2026-06-16) | ADR-0013 |

## Definition of Done

- `supabase/migrations/20260826000000_create_journal_entries.sql` applied to live DB; anon REST probe verifies table + RLS.
- ADR-0013 status flipped to Accepted.
- `src/stores/journal.ts` + `useDataSyncStore` journal methods implemented with unit tests.
- F1/F2 settle logic (cap=3) unit-tested per AC-onset/arrival/solace/priority.
- Zero-AI template render + persona/forbidden-token lint tests pass (≥5 variants/pen).
- `/journal` route + JournalView + HomeView peek shipped; `/journal` registered in nav-and-routing route table.
- Guest→login reconcile integration test: union by `source_ref_id`, no dup, no loss.
- vue-tsc 0, vitest green; Eason on-device pass (iPhone Safari).

## Enables (Downstream)

- **Phase 2 ① epiphany** — Implemented 2026-06-23 via concept-deepening 的沉默零求助偵測（df5402d；非原規劃的 #18 motif+hintUsed 訊號路徑）。**② move** 仍待 #7 emits a per-move calm-move signal；add `replay_*` columns (additive) when ready.
- **課程長在你棋上 / 蘇格拉底賽後** — read journal entries as teaching material.
