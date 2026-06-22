# Story 009: Move-by-Move Replay — reuse shipped PgnViewer + eval cursor + move list

> **Epic**: memory
> **Status**: Done
> **Layer**: Feature — Phase 2 Differentiation ① — UI
> **Type**: UI (dense replay surface, reuses game-replay PgnViewer)
> **Estimate**: M (4–5 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-memory-009
> **ADR**: ADR-0014 (primary), ADR-0006

## Context

**GDD**: `design/gdd/memory.md` — Rules 18–21, AC-8, AC-16; reuse `@lichess-org/pgn-viewer` (PgnViewer) + Move Annotation
**Requirement**: `TR-memory-009`

**ADR Governing Implementation**: ADR-0014 §4 (dense surface = replay reusing the shipped PgnViewer, not a hand-rolled board)
**ADR Decision Summary**:
- The dense board+eval+movelist **reuses the shipped PgnViewer** (the game-replay path) + Wood12/Gioco theme + Move Annotation Display. The demo's hand-rolled board is illustrative only.
- Openable at a specific ply (from the trend chart → anchor ply by default; deep-linkable to any ply for the 棋誌 ②/③ coupling — story-010).

**Engine**: Web App — Vue 3 + `@lichess-org/pgn-viewer` + self-drawn SVG eval chart | **Risk**: LOW
**Engine Notes**:
- Board theme leak guardrail: PgnViewer ships `lichess-pgn-viewer.css`; board-theme selectors need the `body` prefix to out-specify it (visual SoT) — confirm Wood12/Gioco render, no lichess dark board.
- `import.meta.env.BASE_URL` on board-theme/piece asset URLs (the `/gambit/` 404 trap — AC-16).
- Prev/next animate the piece **sliding** (not teleporting), incl. captures + castling (rook moves with king); interruptible (chessground synthetic — manual evidence).
- The same `PlayView/Review/Replay` board-fit fix applies (`.board-fit :deep(.main-wrap){width:100%!important;...}`) — see technical-preferences Board gotchas.

**Control Manifest Rules (this layer)**:
- Required: reuse PgnViewer + Move Annotation Display; do not re-color eval (gold = focus/reward only; eval stays neutral).
- Required: `import.meta.env.BASE_URL` asset prefix; board-fit container width on 8-multiple.
- Forbidden: a hand-rolled board for replay (AC-16 asserts the lichess-pgn-viewer root is present).

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story:*

- [ ] **AC-8 (DOM half)**: replay move list — current ply highlighted + **auto-scrolled into view**, anchor shows its **accent bar** (Playwright DOM). *(Sliding-piece animation incl. capture + castling = manual evidence — chessground synthetic.)*
- [ ] **AC-16**: replay mounts the shipped `PgnViewer` (assert `lichess-pgn-viewer` root present, **not** the demo's hand-rolled board); board-theme asset URLs carry `import.meta.env.BASE_URL`. *(Wood12/Gioco fidelity, no lichess dark board leak = screenshot sign-off.)*
- [ ] **Eval cursor**: self-drawn SVG eval chart shows a **gold cursor at the current ply**; move list marks each scored move with its cpLoss chip + color (per #7's display contract).
- [ ] **Open-at-ply**: replay opens at the anchor ply by default from the trend chart; can mount at an arbitrary ply (deep-link handle for story-010).

---

## Implementation Notes

```
src/views/MemoryReplayView.vue (or reuse/extend the game-replay ReplayView)  ← PgnViewer mount + eval chart cursor + move list
src/components/memory/ReplayEvalChart.vue   ← self-drawn SVG (evalWhiteSeries, story-003) + gold ply cursor
```

- Prefer **extending the shipped game-replay `ReplayView`** if it already wraps PgnViewer + eval + move list — 棋憶's replay is the same surface opened at a ply, not a new board. Check `production/epics/game-replay/` (S10, shipped) before building new.
- Cross-link back from a slideshow moment (story-008) lands here at that moment's ply (EC-13).

---

## Out of Scope

- The dashboard chart that links here — story-007. The slideshow — story-008.
- The journal deep-link wiring (`gameId, ply`) — story-010 (this story exposes "open at ply N"; story-010 calls it).

---

## QA Test Cases

**Gate level**: ADVISORY (UI) — DOM half automatable via Playwright

- **AC-8**: navigate plies → current highlighted + scrolled into view; anchor ply shows accent bar.
- **AC-16**: assert `.lichess-pgn-viewer` root present (not hand-rolled); grep asset URLs carry `BASE_URL`.
- **Open-at-ply**: mount with `ply=N` → cursor at N; from chart → anchor ply.
- **Manual (evidence)**: Wood12/Gioco render (no dark board); sliding piece incl. capture + castling on device.

---

## Test Evidence

**Story Type**: UI
**Required evidence**: `tests/e2e/memory-replay.spec.ts` (move list, PgnViewer root, BASE_URL) + `production/qa/evidence/memory-replay-evidence.md` (board fidelity, animation).
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: story-003 (eval series), story-007 (chart → replay entry), shipped game-replay (PgnViewer wrapper).
- Unlocks: story-010 (deep-link opens replay at a ply); story-008 cross-link target.
