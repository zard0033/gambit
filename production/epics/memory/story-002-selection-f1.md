# Story 002: Key-Moment Selection (F1) — pure, zero new analysis

> **Epic**: memory
> **Status**: Ready
> **Layer**: Feature — Phase 2 Differentiation ① — Logic
> **Type**: Logic (candidate gather + merge + gate + force-include + cap + order)
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-memory-002
> **ADR**: ADR-0014 (primary), ADR-0007

## Context

**GDD**: `design/gdd/memory.md` — **F1** (5 steps), F1 variables/worked-example, Rules 11–13, EC-1/9/10/11, AC-2…6, AC-14
**Requirement**: `TR-memory-002`

**ADR Governing Implementation**: ADR-0014 §2 (pure `src/modules/memory/selection.ts`), §3 (read-only #7 consumption, 0 analysis)
**ADR Decision Summary**:
- `selectMoments(analysisResults, biggestSwingCursor, classify, tuning)` is a **pure function** over #7's readonly output — same shape as the shipped `computeCpLoss`/`computeBiggestSwingCursor`. **No store, no supabase, no engine call.**
- 棋憶 owns no analysis: selection runs at `phase === 'COMPLETE'` over whatever #7 finalized. AC-14 = 0 `reviewEngine.analyze` calls when results already present (verified at the view layer, story-007; this story must not import the engine).

**Engine**: Web App — TypeScript (pure module) | **Risk**: LOW
**Engine Notes**:
- `E[i] = analysisResults[i].evalCp` (side-to-move; `±MATE_CP` when `evalMate != null`). `cp = computeCpLoss(i)` (reuse #7's). `fav = -(E[i] + E[i+1])`.
- `concept = classify(...)` from #20 — `'material' | 'mate' | 'none'`; `signals[i].allowedForcedMate` comes from #7's F2b mate-transition.
- **Mate guard (source B)**: bright excludes positions where `isMate[i] || isMate[i+1]` (else `fav` spikes to ~+60000 and fires a spurious bright move).

**Control Manifest Rules (this layer)**:
- Required: tuning constants from `src/config/memory-config.ts` (no inline numbers).
- Required: `biggestSwingCursor` read-only — never recompute or move it (ADR-0007 §4).
- Forbidden: any `fetch`/`supabase`/`reviewEngine`/`sessionStorage` import in `src/modules/memory/` (static grep — mirror game-export §VC9).

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story (test-frozen constants per AC preamble):*

- [ ] **AC-2**: ≥1 player move with `cpLoss ≥ GATE` → `selectMoments()` returns 1…`MAX` moments, never more than `MAX`, ascending ply order.
- [ ] **AC-2b**: >`MAX` gated candidates incl. anchor ranked outside top `MAX` by `weightedScore` → result is exactly `MAX` **and includes the anchor** (force-include); ties → lower ply index.
- [ ] **AC-2c**: gate boundary — `cp == GATE` kept, `cp == GATE−1` dropped; bright with `fav ≥ BRIGHT_GATE` but `cp < GATE` kept (Step 3 exemption); anchor kept when `cp ≥ ANCHOR_FLOOR` even if `< GATE`.
- [ ] **AC-2d**: a ply matching multiple sources (tactical + anchor, worked-example ply 13) → **one** card, kind = highest-priority (tactical), carries anchor flag (Step 2 merge).
- [ ] **AC-3**: a game where F1 returns 0 moments → `selectMoments()` returns `[]` (zero-state is story-007).
- [ ] **AC-4**: anchor (`biggestSwingCursor` non-null, `≥ ANCHOR_FLOOR`) appears with its flag; `biggestSwingCursor` null → no anchor moment.
- [ ] **AC-5**: adjacent-ply candidates collapse to one card (blunder-then-forced-reply pair).
- [ ] **AC-6**: a move `classify()` returns `none` for is never tactical; appears (if it clears gate) only as plain swing.
- [ ] **AC-14 (module half)**: `src/modules/memory/*` imports no engine (static grep); selection consumes results only.

---

## Implementation Notes

```
src/modules/memory/selection.ts   ← selectMoments(...) : Moment[]  (F1 Steps 1–5, pure)
tests/unit/memory/selection.test.ts
```

```
Step 1 gather (per player-move i, exclude last):
  (A) tactical : concept != 'none'                              → kind=tactical, score = cp + CONCEPT_BONUS
  (B) anchor   : i == biggestSwingCursor (non-null)             → flag anchor,   score = cp
      bright   : fav >= BRIGHT_GATE && !isMate[i] && !isMate[i+1]  (max 1)       → kind=bright, score = fav
  (C) plain    : concept=='none' && cp >= MOMENT_CP_GATE         → kind=plain,    score = cp
Step 2 same-ply merge → one candidate, displayed kind by priority tactical>anchor>bright>plain; score = max
Step 3 gate: drop cp < GATE EXCEPT (a) confirmed bright, (b) anchor when cp >= ANCHOR_FLOOR
Step 4 rank by score desc, tie lower ply; FORCE-INCLUDE anchor + bright first, then fill to MAX
Step 5 re-sort kept set by ply asc (anchor keeps flag, not reordered)
```

- Worked example (demo game): ply13 Re1 cp290 material → tactical+anchor merged to one; ply15 d3 → bright; ply17 Bg5 cp70 → plain (gate 60). Encode as a fixture.
- `Moment` type: `{ ply, kind:'tactical'|'bright'|'plain', anchor:boolean, concept:'material'|'mate'|'none', playedUci, bestUci, cp, fav }` — **no emotive/score field surfaced** (Pillar 3).

---

## Out of Scope

- E_white / stage derivation — story-003. Per-moment text — story-005. Rendering — stories 007/008.
- Re-analysis on cold open — that is #7's existing path, triggered at the view (story-007), not here.

---

## QA Test Cases

**Gate level**: BLOCKING (Logic)

- **AC-2/2b**: synthetic results with 7 gated candidates incl. a low-ranked anchor → assert count==MAX, anchor present, ascending ply.
- **AC-2c**: candidates at `cp ∈ {GATE−1, GATE}`, a bright `{fav≥BRIGHT_GATE, cp<GATE}`, an anchor `{cp<GATE, ≥ANCHOR_FLOOR}` → assert keep/drop per rule.
- **AC-2d**: ply with concept!='none' AND i==biggestSwingCursor → one card, kind=tactical, anchor flag true.
- **AC-3/4**: all-quiet game (`biggestSwingCursor==null`, no gated) → `[]`. Anchor-present game → flagged moment.
- **AC-5**: i and i+1 both large swings → one card kept (Step 4 + same-ply intent).
- **AC-6**: large swing, `classify=none` → plain kind, never tactical. Mate guard: `isMate[i+1]` with huge fav → no bright.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/memory/selection.test.ts` pass (BLOCKING) incl. the worked-example fixture.
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None (consumes #7 readonly types + #20 `classify`, both shipped). Reuses `computeCpLoss` from #7.
- Unlocks: story-004 (per-game tagging needs moments), story-005 (templates keyed on moment kind), story-007/008 (render).
