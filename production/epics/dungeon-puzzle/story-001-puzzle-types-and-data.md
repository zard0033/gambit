# Story 001: Puzzle Types + Static Data Loader + Data Test

> **Epic**: dungeon-puzzle
> **Sprint**: S13-01 (Must Have)
> **Status**: Complete (2026-06-05)
> **Layer**: Feature / Logic
> **Type**: Types + Data Loader
> **Estimate**: M (4 hours)
> **GDD**: design/gdd/dungeon-puzzle-mode.md (Appendix: Puzzle Data Schema; §3.2, §4)
> **TR**: TR-dungeon-010
> **ADR**: ADR-0004, ADR-0009, ADR-0011, ADR-0012

## Context

**Depends on**: — (foundational for the epic)
**Purpose**: Define the `Puzzle` type and a loader exposing the static puzzle catalog
sorted by `order`, plus a blocking data-integrity test that protects all future authored
puzzles.

---

## Acceptance Criteria

- [ ] **AC-01**: `src/types/puzzle.ts` defines `Puzzle`, `PuzzleMove`, `PuzzleMotif` per the GDD schema appendix.
- [ ] **AC-02**: `src/data/puzzles/index.ts` exports `puzzles` as a readonly array sorted by `order`, plus `getPuzzleById(id)`.
- [ ] **AC-03**: `tests/unit/data/puzzles.test.ts` asserts, for every puzzle: FEN parses in chess.js with both kings; `solution` is a fully legal line from the FEN; `solution.length` is odd; `order` values are unique and contiguous from 1; `id` values are unique.
- [ ] **AC-04**: For each puzzle the FEN side-to-move equals the player's side (player plays `solution[0]`).

## Implementation Plan

- Types match the GDD appendix exactly (`PuzzleMotif`, `PuzzleMove`, `Puzzle`).
- `src/data/puzzles/` holds one file per level (`level-1.ts`, `level-2.ts`, `level-3.ts`)
  + an `index.ts` aggregator (mirrors the lessons one-file-per-tier deviation).
- Loader sorts by `order`, exposes `puzzles` (readonly) + `getPuzzleById`.
- Data test replays each `solution` move-by-move through chess.js to prove legality and
  asserts the structural invariants. A couple of seed puzzles ship in this story so the
  test has data; the full curated set is S13-06.

## Test Evidence

**Required**: `tests/unit/data/puzzles.test.ts` — FEN legality (both kings), full-line
legality, odd solution length, unique/contiguous order, unique ids, side-to-move = player.

## Notes

- Static data only; no backend, no fetch. Reuses chess.js (bundled with vue3-chessboard).
- This data test is the content gate — every puzzle authored in S13-06 is protected by it.
- 西洋棋用語 in `title`/`prompt`/`successText`: 后/城堡/騎士/主教/國王/兵 (no 車/馬/象).

## Completion (2026-06-05)

- Files: `src/types/puzzle.ts`, `src/data/puzzles/{level-1,level-2,level-3,index}.ts`,
  `tests/unit/data/puzzles.test.ts`.
- 6 seed puzzles (2 per level) across motifs capture/fork/mate-in-1; full ~12 set is S13-06.
- **Data test caught a real bug**: `l3-knight-fork-queen` originally had the white king on
  e1, pinning the e4 knight against the e8 queen → no legal knight move. Fixed FEN to Kg1.
- `npx vitest run` → 11/11 pass. New files type-clean under `vue-tsc` (pre-existing
  unrelated test-file type errors in auth/data-sync/game-history are out of scope).
