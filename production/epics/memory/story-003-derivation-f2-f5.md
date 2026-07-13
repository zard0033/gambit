# Story 003: Derivation — White-normalized Eval (F2) + Stage Classification (F5)

> **Epic**: memory
> **Status**: Done — Shipped 2026-06-18 (`a3caa1d`)
> **Layer**: Feature — Phase 2 Differentiation ① — Logic
> **Type**: Logic (pure derivation: eval series + favorable swing + stage)
> **Estimate**: S (2–3 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-memory-003
> **ADR**: ADR-0014 (primary), ADR-0007, ADR-0003

## Context

**GDD**: `design/gdd/memory.md` — **F2** (E_white series), **F5** (stage classification), F5 variables, EC-8, AC-13
**Requirement**: `TR-memory-003`

**ADR Governing Implementation**: ADR-0014 §3 (棋憶 derives `E_white` itself — #7 owes only side-to-move evals)
**ADR Decision Summary**:
- `evalWhiteSeries(analysisResults)` and `favorableSwing(i, analysisResults)` are pure derivations over #7's results; `classifyStage(plyIndex, fen, bookExitPly, tuning)` derives stage from ply + material with **no engine call**.
- White normalization is 棋憶's own presentation value: `E_white[i] = (i even) ? E[i] : -E[i]` (i even → White to move → already White's view; i odd → negate). Mate values clamped to ±4 pawns before plotting.

**Engine**: Web App — TypeScript (pure module) + chess.js (material count from FEN) | **Risk**: LOW
**Engine Notes**:
- `bookExitPly` from Opening Identification (#3, `identifyOpening().bookExitPly`); reused, not recomputed. Unknown opening → no `bookExitPly` → F5 falls back to `ply <= OPENING_PLY_MAX` (EC-8).
- `nonPawnMaterial` = total value of non-pawn non-king pieces (Q=9,R=5,B=3,N=3); full board = 62 (31/side). Derive from FEN piece placement (chess.js `board()` or FEN parse).
- **Invariant**: `ENDGAME_MATERIAL < OPENING_MATERIAL` must hold (tuning ranges preserve it) — assert in a test.

**Control Manifest Rules (this layer)**:
- Required: tuning constants from `src/config/memory-config.ts`.
- Required: `MATE_CP = 30000` sentinel reused from `src/config/engine-tuning.ts` (don't redefine).
- Forbidden: engine/supabase imports in `src/modules/memory/`.

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story:*

- [ ] **AC-13**: `classifyStage` is deterministic and unit-tested against fixtures **including the boundaries**:
  - `nonPawnMaterial == ENDGAME_MATERIAL` → endgame (edge; endgame checked first).
  - `ply <= bookExitPly` → opening (in-book path).
  - out-of-book `ply ≤ OPENING_PLY_MAX && material ≥ OPENING_MATERIAL` → opening.
  - unknown opening (no `bookExitPly`) → falls back to ply-only opening boundary (EC-8).
  - low-material-at-low-ply → endgame wins (endgame-first ordering).
  - middlegame is the catch-all → every position classifies (no gap, no overlap).
- [ ] **F2-1**: `evalWhiteSeries` negates odd indices; even indices unchanged; mate (`±MATE_CP`) clamped to ±4-pawn display bound before plotting.
- [ ] **F2-2**: `favorableSwing(i) === -(E[i] + E[i+1])` (the cpLoss expression read with opposite sign).
- [ ] **Invariant test**: assert `ENDGAME_MATERIAL < OPENING_MATERIAL`.

---

## Implementation Notes

```
src/modules/memory/derive.ts   ← evalWhiteSeries(analysisResults): number[] ; favorableSwing(i, analysisResults): number
src/modules/memory/stage.ts    ← classifyStage(plyIndex, fen, bookExitPly, tuning): 'opening'|'middlegame'|'endgame'
                                  nonPawnMaterial(fen): number
tests/unit/memory/derive.test.ts
tests/unit/memory/stage.test.ts
```

```
classifyStage (order matters):
  endgame   if nonPawnMaterial <= ENDGAME_MATERIAL                                  // checked FIRST
  opening   if (bookExitPly != null && ply <= bookExitPly)
            || (ply <= OPENING_PLY_MAX && nonPawnMaterial >= OPENING_MATERIAL)
  middlegame otherwise                                                              // catch-all
```

- `evalWhiteSeries`: map `analysisResults[i]` → `E[i]` (side-to-move, `±MATE_CP` for mate) → `E_white[i]` → clamp `[-400, 400]` cp for the chart (the chart story scales; this returns clamped cp).

---

## Out of Scope

- Drawing the SVG chart — story-007 (this story returns the numbers).
- Using stage to tag a game's summary — story-004 (`buildGameSummary` calls `classifyStage`).

---

## QA Test Cases

**Gate level**: BLOCKING (Logic)

- **AC-13 boundaries**: fixtures at each branch + the exact `== ENDGAME_MATERIAL` edge; an unknown-opening position; a low-material early-ply position (endgame-first). Assert exhaustive coverage (every fixture lands in exactly one stage).
- **F2**: even/odd index sign; a mate-score position → clamped, not ±30000 on the chart.
- **Invariant**: `ENDGAME_MATERIAL < OPENING_MATERIAL`.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/memory/{derive,stage}.test.ts` pass (BLOCKING).
**Status**: [x] `tests/unit/memory/{derive,stage}.test.ts` — 12 tests, all passing

---

## Dependencies

- Depends on: None (consumes #7 results + #3 `bookExitPly`, both shipped).
- Unlocks: story-004 (stage tagging for cross-game window), story-007 (eval chart input).
