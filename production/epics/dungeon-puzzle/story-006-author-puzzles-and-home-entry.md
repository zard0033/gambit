# Story 006: Author Puzzle Set (3 levels) + Home Card Live Entry

> **Epic**: dungeon-puzzle
> **Sprint**: S13-06 (Must Have)
> **Status**: Backlog
> **Layer**: Feature / Config-Data
> **Type**: Content + small UI wiring
> **Estimate**: M (5 hours)
> **GDD**: design/gdd/dungeon-puzzle-mode.md (§3.2, §3.3, §3.7)
> **TR**: (content for) TR-dungeon-002…004; TR-dungeon-011 (Home entry)
> **ADR**: ADR-0004, ADR-0009, ADR-0011, ADR-0012

## Context

**Depends on**: S13-01 (schema + data test), S13-04, S13-05 (views to play them in)
**Purpose**: Fill the curated puzzle catalog and turn the Home「今日謎題 即將推出」
placeholder into the live entry to `/dungeon`.

---

## Acceptance Criteria

- [ ] **AC-01**: Author a curated set across 3 levels (~3–5 puzzles each) spanning the motifs: capture / fork / pin / mate-in-1 / mate-in-2; difficulty rises with `order`.
- [ ] **AC-02**: Every puzzle passes the S13-01 data test (legal FEN with both kings, legal odd-length solution, contiguous unique order).
- [ ] **AC-03**: Each puzzle has a Socratic `hint` (idea, not the move) and a `successText` stating the transferable principle (never just「正確」), in 西洋棋用語.
- [ ] **AC-04**: Mate-in-1 puzzles set `acceptAnyMate` only where alternative mates are acceptable teaching outcomes.
- [ ] **AC-05**: Home card is **renamed「今日謎題」→「試煉」** (Eason decision 2026-06-05 — single dungeon path, no daily-puzzle concept) and becomes a live link to `/dungeon` (remove `locked`/「即將推出」); shows calm progress (solved/total) instead of a placeholder.

## Implementation Plan

- **Positions: import from the lichess CC0 puzzle DB** (database.lichess.org —
  public domain). Filter by `Themes` (fork/pin/mateIn1/mateIn2/hangingPiece) + low
  `Rating` for beginners; map themes → our `motif`; transform the move format
  (lichess: FEN + opponent setup move first → apply it, then the rest alternate
  player/opponent from the player) into our schema (FEN side-to-move = player).
- **Teaching text** (`hint`/`successText`/`title`/`prompt`): clean-room 繁中, never
  copied from lila. **No lila code/Learn-text** (AGPL/GPL).
- Write into `src/data/puzzles/level-{1,2,3}.ts`; the S13-01 data test validates every
  imported line automatically.
- Home card live entry already shipped (S13-04 turn): `今日謎題` → `試煉`, routes to
  `/dungeon`, shows `dungeon.solvedCount/totalCount`.
- Update `HomeView.vue` StatCard for「今日謎題」: drop `locked`, route to `/dungeon`,
  bind value to `useDungeonProgressStore` solved/total.

## Test Evidence

**Required**: `puzzles.test.ts` (from S13-01) passes with the full set.
**Required (ADVISORY)**: smoke walkthrough — enter from Home, solve one puzzle per level.

## Notes

- This is the critical-path content effort. Pedagogy mirrors the Lesson tactics tier so
  vocabulary (捉雙/牽制/串擊/將死) transfers between Learn and Dungeon.
- Authoring volume is a tuning knob; ~12 puzzles is a good v0 target (map readability).
