# Story 005: DungeonPuzzleView (`/dungeon/:puzzleId` solver + hints + solved panel)

> **Epic**: dungeon-puzzle
> **Sprint**: S13-05 (Must Have)
> **Status**: Complete (2026-06-05) — solve flow + overlay Playwright-verified (Rxd4 → 正確！→ 1/6)
> **Layer**: Feature / Integration
> **Type**: Vue View
> **Estimate**: L (8 hours)
> **GDD**: design/gdd/dungeon-puzzle-mode.md (§3.4, §3.5, §3.7, §5, §7)
> **TR**: TR-dungeon-002, TR-dungeon-003, TR-dungeon-005, TR-dungeon-006, TR-dungeon-007, TR-dungeon-009, TR-dungeon-011, TR-dungeon-012
> **ADR**: ADR-0004, ADR-0009, ADR-0011, ADR-0012
> **Blueprint**: DungeonScreen.jsx → DungeonPuzzle (minus streak)

## Context

**Depends on**: S13-01, S13-02, S13-03
**Purpose**: The solving screen — board + prompt + hint + solved panel. Thin presenter
over `use-dungeon-puzzle`; wires progress on solve.

---

## Acceptance Criteria

- [ ] **AC-01**: Embeds `chess-board.vue` showing the puzzle FEN, oriented to the player; player moves are submitted to the composable.
- [ ] **AC-02**: Correct move advances/solves per the composable; on multi-move, the scripted opponent reply animates after `OPPONENT_REPLY_DELAY_MS`, with input locked during the reply.
- [ ] **AC-03**: Wrong-but-legal move snaps back, shows「再想想」, brief error tint (`WRONG_TINT_DURATION_MS`), no progress change.
- [ ] **AC-04**: On solve, shows the solved panel with `successText` + 下一題 (next by order) + 回地圖; calls `markSolved(id)`.
- [ ] **AC-05**: 提示 is two-stage: 1st press shows the `hint` text, 2nd press draws the first-move arrow; using it calls `markHintUsed(id)` and does **not** penalise.
- [ ] **AC-06**: Deep-link guard: locked or unknown `:puzzleId` redirects to `/dungeon`; a `done` id is replayable.
- [ ] **AC-07**: New route `/dungeon/:puzzleId` added (lazy, not auth-required).
- [ ] **AC-08**: **No streak / timer / leaderboard** in the UI; reduced-motion makes opponent reply + solved transitions instant.
- [ ] **AC-09**: Gambit compliant: dark surface, gold CTA, Lucide icons (no emoji), 西洋棋用語, ≥44×44px buttons.

## Implementation Plan

- New `src/views/DungeonPuzzleView.vue`, port DungeonScreen.jsx's DungeonPuzzle layout to
  Vue. Drop the streak pill and「連殺」copy in the solved overlay; solved panel shows
  「正確」+ successText (or「看了提示」neutral when hintUsed, without any streak-break copy).
- `dungeon-tuning.ts` config module for the timing knobs (§7).
- Promotion uses the existing board promotion picker.
- Guard logic reads `getPuzzleById` + `useDungeonProgressStore.isUnlocked`.

## Test Evidence

**Required (Integration)**: an interaction test (`tests/unit/views/...` or
`tests/integration/...`) covering a correct solve marking progress and a wrong move not
advancing, OR a documented playtest if the board component is hard to drive headlessly.
Composable logic is unit-covered in S13-03.
**Required (ADVISORY — UI)**: walkthrough doc + screenshots in `production/qa/evidence/`.

## Notes

- Keep the view thin — all rules live in `use-dungeon-puzzle`. The view only presents and
  animates.
