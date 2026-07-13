# Epic: Dungeon Puzzle Mode

> **Layer**: Feature (Phase 2)
> **GDD**: design/gdd/dungeon-puzzle-mode.md (Approved 2026-06-05)
> **Architecture Module**: DungeonMapView + DungeonPuzzleView (Vue) + useDungeonProgressStore + use-dungeon-puzzle composable + static puzzle data
> **Status**: Complete — 全 7 個 story（S13-01~07）皆已交付並上線，2026-06-05~09（`c69bd18`／`beae144`／`29a99a9`）；`dungeon_progress` migration 已套用 live DB（見 `supabase/README.md`）
> **Stories**: story-001 through story-007 (S13)
> **Visual blueprint**: design/gambit-design-system/ui_kits/app/DungeonScreen.jsx (minus streak)

## Overview

Implements 試煉道場 — a single-player tactics-puzzle track. The player solves curated
positions (win material / fork / pin / mate) by playing moves on the real board; the
mode validates each move against the authored solution line, auto-plays scripted opponent
replies for multi-move puzzles, and shows a calm "正確" + transferable principle on
completion. Puzzles are grouped into levels shown as a diamond-node map; clearing a puzzle
unlocks the next linearly. Scope is static, clean-room puzzle data (no AI, no engine call
for validation), localStorage progress. Reuses the existing ChessBoard component and
chess.js for legality + checkmate detection.

## Design Decision (2026-06-05) — No streak

The DungeonScreen.jsx blueprint includes a「連殺」streak counter. This is **dropped** —
it violates the Gambit non-negotiable rule `無 streak / timer / leaderboard`. Progress is
expressed only as calm counts (puzzles solved / total, nodes completed). Eason approved
this resolution before design.

## Content Sourcing & Licensing (guardrail, revised 2026-06-05)

- Puzzle **positions** may be imported from the **lichess puzzle database** —
  **CC0 / public domain** (verified: database.lichess.org; ~5.9M puzzles CSV with FEN /
  solution / rating / themes; free for commercial use + redistribution). Map lichess
  themes → our `motif`; transform lichess move format (FEN + opponent setup move) to our
  schema (FEN side-to-move = player).
- The **teaching text** (`hint` / `successText` / `title` / `prompt`) is **clean-room
  authored in 繁中** — never copied from lila's Learn module.
- **Do NOT port lila code or Learn-module text** — `lila` is **AGPL-3.0**, `chessops`
  **GPL-3.0** (strong copyleft). We use **chess.js (BSD)** for validation.
- Every puzzle FEN must contain **both kings** and every `solution` must be a legal line
  from the FEN. Enforced by `tests/unit/data/puzzles.test.ts`.

## Governing ADRs

| ADR | Decision Summary | Risk |
|-----|-----------------|------|
| ADR-0005: State Management | Progress is a small Pinia store (useDungeonProgressStore) backed by localStorage; chess.js stays non-reactive | LOW |
| ADR-0011: Supabase Auth + Sync | Cross-device progress sync via data-sync store + new `dungeon_progress` table; local-first, union reconcile on login (mirrors `lesson_progress`) | LOW |

**No new ADR required** — static puzzles reuse the existing ChessBoard, chess.js, routing,
the localStorage + Pinia pattern, and the established Supabase sync boundary (ADR-0011)
exactly as the Lesson System did. **Cross-device sync is in scope for v0** (Eason
requirement 2026-06-05): `dungeon_progress` table + data-sync methods mirror
`lesson_progress`.

## GDD Requirements (from design/gdd/dungeon-puzzle-mode.md)

| TR-ID | Requirement (AC) | Story |
|-------|------------------|-------|
| TR-dungeon-001 | Map renders done/current/locked per §4.1; only current enterable (AC-01) | S13-02, S13-04 |
| TR-dungeon-002 | Correct single-move solve → solved + successText + progress (AC-02) | S13-03, S13-05 |
| TR-dungeon-003 | Multi-move solve: scripted opponent reply, ply state machine (AC-03) | S13-03, S13-05 |
| TR-dungeon-004 | Mate flexibility: acceptAnyMate accepts any mating move (AC-04) | S13-03 |
| TR-dungeon-005 | Wrong-but-legal: snap back, 再想想, no progress loss (AC-05) | S13-03, S13-05 |
| TR-dungeon-006 | Two-stage non-penalising hints (idea → arrow) (AC-06) | S13-05 |
| TR-dungeon-007 | No streak / timer / leaderboard anywhere (AC-07) | S13-04, S13-05 |
| TR-dungeon-008 | Unlock persists across reload via localStorage (AC-08) | S13-02 |
| TR-dungeon-009 | Deep-link to locked/unknown id redirects to /dungeon; done is replayable (AC-09) | S13-04, S13-05 |
| TR-dungeon-010 | Data integrity: legal FENs, legal lines, odd length, unique/contiguous order (AC-10) | S13-01 |
| TR-dungeon-011 | Gambit compliance: jade nodes, gold-only-current, Lucide, 西洋棋用語, ≥44px (AC-11) | S13-04, S13-05 |
| TR-dungeon-012 | Reduced motion: opponent reply + breathe ring instant/static (AC-12) | S13-05 |

## Stories (S13)

| ID | Title | Type | Est. | Depends on |
|----|-------|------|------|-----------|
| S13-01 | Puzzle types + static data loader + data test | Logic | M | — |
| S13-02 | useDungeonProgressStore (localStorage + Supabase sync, linear unlock, counts) | Logic | M | S13-01, S13-07 |
| S13-03 | use-dungeon-puzzle composable (validation state machine) | Logic | M | S13-01 |
| S13-04 | DungeonMapView (`/dungeon` node map + gates + deep-link guard) | UI | M | S13-01, S13-02 |
| S13-05 | DungeonPuzzleView (`/dungeon/:puzzleId` solver + hints + solved panel) | Integration | L | S13-01, S13-02, S13-03 |
| S13-06 | Author puzzle set (3 levels) + Home card live entry | Config/Data | M | S13-01, S13-04, S13-05 |
| S13-07 | Supabase `dungeon_progress` table + data-sync methods (cross-device sync) | Persistence | M | S13-01 |

Routes added in S13-04/05: `/dungeon` and `/dungeon/:puzzleId`, lazy-loaded, **not**
auth-required, following the existing `src/router/index.ts` pattern. Home card
「今日謎題 即將推出」(HomeView.vue) becomes the live entry in S13-06.

## Definition of Done

This epic is complete when:

1. **S13-01**: `src/types/puzzle.ts` + `src/data/puzzles/index.ts` load and expose the
   static catalog; `puzzles.test.ts` validates FEN/solution/order integrity.
2. **S13-02**: useDungeonProgressStore with passing unit tests (unlock predicate,
   current-node selection, counts, corrupt-data handling, login reconcile union).
7. **S13-07**: `dungeon_progress` Supabase table + RLS migration + data-sync
   upsert/load methods (mirrors `lesson_progress`), wired to login reconcile.
3. **S13-03**: use-dungeon-puzzle composable with passing unit tests (single/multi-move
   validation, acceptAnyMate, wrong-move handling, ply pointer).
4. **S13-04**: DungeonMapView with node states, gating, deep-link guard, empty state,
   Gambit styling (no streak).
5. **S13-05**: DungeonPuzzleView solver with board, prompt, two-stage hints, solved panel,
   reduced-motion, redirect guards.
6. **S13-06**: curated puzzle set across 3 levels authored; Home card live entry.
7. **All tests pass**: data + store + composable unit tests + interaction test.
8. **QA sign-off**: APPROVED (no critical issues).
9. **Design review passed** (GDD → APPROVED ✓ 2026-06-05).

## Phase 2 Roadmap Position

**Phase 2a (S10)**: Game Replay MVP ✓
**Phase 2c (S12)**: Lesson System — static scripted concept lessons ✓ (built)
**Phase 2d (S13)**: Dungeon Puzzle Mode (this epic) — static tactics puzzles ✓ (built)

## Success Metrics

- A beginner can solve the first puzzle with no external guidance.
- Linear unlock correctly gates subsequent puzzles; progress survives reload.
- The mode feels calm — no streak/timer/leaderboard pressure (Gambit compliance).
- No mobile-specific bugs (iOS Safari tested).
