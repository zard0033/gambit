# Story 004: Cross-Game Neve Line (F4) — rule-based, zero-AI, no weakness verdict

> **Epic**: memory
> **Status**: Done — Shipped 2026-06-18 (`a3caa1d`)
> **Layer**: Feature — Phase 2 Differentiation ① — Logic
> **Type**: Logic (per-game tagging + window + signal selection + template fill)
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-memory-004
> **ADR**: ADR-0014 (primary), ADR-0005

## Context

**GDD**: `design/gdd/memory.md` — **F4** (4 steps + schema), F4 variables, Rules 5–7, EC-6/7, AC-12, AC-12b, Player-Fantasy "Explicitly NOT" (no weakness verdict)
**Requirement**: `TR-memory-004`

**ADR Governing Implementation**: ADR-0014 §1 (`MemoryGameSummary` shape), §2 (`useMemoryStore` cross-game window), §5 (schema_version window)
**ADR Decision Summary**:
- `buildGameSummary(moments, stages)` produces the persisted `MemoryGameSummary` (`stageCounts` = GATED-candidate counts pre-cap, `conceptCounts`, `anchorStage`).
- `pickNeveLine(summaries, tuning)` runs the F4 rule over the last `OBS_WINDOW` current-schema summaries; **no `weak(stage)` branch exists** (vision anti-rating guardrail; AC-11b also asserts this — covered jointly with story-005's lint).
- `useMemoryStore.neveLine()` wraps `pickNeveLine` over `summaries` (loaded in story-001).

**Engine**: Web App — TypeScript (pure logic + store glue) | **Risk**: LOW
**Engine Notes**:
- `stageCounts` counts **GATED candidates pre-cap** (F1 Step 3 survivors), not the ≤5 displayed moments — so a calm game still contributes honest stage data.
- Insufficient sample (`< OBS_MIN_SAMPLE`) → first/few-games line, **never a fabricated trend** (EC-7: a wrong trend is worse than none).

**Control Manifest Rules (this layer)**:
- Required: tuning constants from `src/config/memory-config.ts`.
- Required: pure `pickNeveLine` (inputs: summaries array; no Vue/supabase) — unit-testable in isolation.
- Forbidden: any branch that names a weakest stage / emits a score or rating (Pillar 3 + vision guardrail).

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story:*

- [ ] **AC-12**: with `< OBS_MIN_SAMPLE` prior games → a first/few-games line, never a fabricated trend; with `≥` sample → exactly one line emitted.
- [ ] **AC-12b**: F4 priority — when both `improving(endgame)` and `recurring(material)` hold, the **improving** line wins; the `OBS_IMPROVE_DELTA` boundary (drop `== delta` fires, `delta−ε` does not) is asserted; a stage with `< OBS_MIN_STAGE` moments in either half yields no trend (**no div-by-zero**).
- [ ] **AC-11b (F4 half)**: F4 emits **no** weakest-stage line under any window (assert no `weak`-branch output) — *(banned-token lint of the rendered string is story-005.)*
- [ ] **buildGameSummary**: `stageCounts` from gated pre-cap candidates; `anchorStage` = stage of `biggestSwingCursor`'s moment, or `null` when it was null.

---

## Implementation Notes

```
src/modules/memory/summary.ts     ← buildGameSummary(moments, stages, schemaVersion): MemoryGameSummary  (F4 Step 1)
src/modules/memory/cross-game.ts  ← pickNeveLine(summaries, tuning): NeveSignal                          (F4 Steps 2–4)
src/stores/memory.ts              ← neveLine() = pickNeveLine(currentSchemaSummaries)  [store glue]
tests/unit/memory/cross-game.test.ts
tests/unit/memory/summary.test.ts
```

```
pickNeveLine:
  window = last OBS_WINDOW summaries (current schema only)
  if |window| < OBS_MIN_SAMPLE → return { kind:'first-or-few' }                       // EC-7
  improving(stage): rate(stage) dropped >= OBS_IMPROVE_DELTA from older→recent half,
                    REQUIRES both halves have >= OBS_MIN_STAGE gated moments in stage   // else skip stage
  recurring(concept): one concept holds >= OBS_CONCEPT_FRAC of gated moments across window
  priority: improving > recurring > neutral ; emit exactly one
  // template句 fill is story-005; this returns the SIGNAL { kind, stage?, concept?, n }
```

- `NeveSignal` carries the data for the template (`{ kind:'improving'|'recurring'|'neutral'|'first-or-few', stage?, concept?, n }`); story-005 renders it to text. Keeping signal separate from prose makes both unit-testable.

---

## Out of Scope

- The rendered Neve sentence string + banned-token lint — story-005 (this story returns the signal).
- Persisting `MemoryGameSummary` — story-001 (this story builds it; the store appends).
- When `recordGame` fires — story-007 (#7 COMPLETE).

---

## QA Test Cases

**Gate level**: BLOCKING (Logic)

- **AC-12**: windows of size {0, OBS_MIN_SAMPLE−1, OBS_MIN_SAMPLE} → first-or-few vs exactly-one-line.
- **AC-12b**: construct both `improving(endgame)` + `recurring(material)` → improving wins. Delta boundary: drop `== OBS_IMPROVE_DELTA` fires, `−ε` does not. Stage with `< OBS_MIN_STAGE` in a half → skipped (assert no NaN/Infinity).
- **AC-11b (F4)**: across many synthetic windows (incl. one stage clearly worst) → assert `kind` is never a weakness verdict; no `weak` signal exists.
- **buildGameSummary**: moments+stages fixture → correct `stageCounts` (pre-cap), `conceptCounts`, `anchorStage`/null.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/memory/{cross-game,summary}.test.ts` pass (BLOCKING).
**Status**: [x] `tests/unit/memory/{cross-game,summary}.test.ts` — 9 tests, all passing

---

## Dependencies

- Depends on: story-001 (`MemoryGameSummary` type + store window), story-002 (moments → tagging), story-003 (stage).
- Unlocks: story-005 (renders the signal), story-007 (dashboard Neve card).
