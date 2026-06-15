# Story 004: DungeonMapView (`/dungeon` node map + gates + deep-link guard)

> **Epic**: dungeon-puzzle
> **Sprint**: S13-04 (Must Have)
> **Status**: Complete (2026-06-05) — Playwright screenshot verified
> **Layer**: Feature / UI
> **Type**: Vue View
> **Estimate**: M (5 hours)
> **GDD**: design/gdd/dungeon-puzzle-mode.md (§3.1, §3.7, §5)
> **TR**: TR-dungeon-001, TR-dungeon-007, TR-dungeon-009, TR-dungeon-011
> **ADR**: ADR-0004, ADR-0009, ADR-0011, ADR-0012
> **Blueprint**: DungeonScreen.jsx → DungeonMap (minus streak)

## Context

**Depends on**: S13-01, S13-02
**Purpose**: The diamond-node map screen. Renders nodes by state, gates entry to the
current node, links to its puzzle.

---

## Acceptance Criteria

- [ ] **AC-01**: Renders one diamond node per puzzle, ordered, with state done/current/locked from the progress store (§4.1).
- [ ] **AC-02**: Only the `current` node is tappable → routes to `/dungeon/:puzzleId`; `done` nodes are also tappable (replay); `locked` nodes are inert.
- [ ] **AC-03**: Header shows calm progress (solved/total or percent) — **no streak pill, no timer, no leaderboard**.
- [ ] **AC-04**: Empty state ("謎題即將加入") when the catalog is empty; "全部完成" state when all solved.
- [ ] **AC-05**: New route `/dungeon` added to `src/router/index.ts` (lazy, not auth-required).
- [ ] **AC-06**: Gambit compliant: dark dungeon surface, jade diamond nodes, gold only on current node + CTA, Lucide icons (no emoji), touch targets ≥ 44×44px.

## Implementation Plan

- New `src/views/DungeonMapView.vue`, port DungeonScreen.jsx's DungeonMap layout (SVG
  path + diamond nodes) to Vue + Tailwind/Gambit tokens. Drop the `streak` prop and pill.
- Node geometry can stay data-driven from the puzzle list (distribute nodes along the path)
  rather than the blueprint's hardcoded coordinates, so the map scales with the puzzle set.
- Use `useDungeonProgressStore.nodeState` for each node.
- Respect `use-reduced-motion` for the current-node breathe ring.

## Test Evidence

**Required (ADVISORY — UI)**: manual walkthrough doc in `production/qa/evidence/` +
screenshot. Node-state mapping logic is already covered by the store unit test (S13-02).

## Notes

- Deep-link guards for `/dungeon/:puzzleId` live in S13-05 (the puzzle view owns them).
- Verify the screen against the blueprint minus streak before marking done.
