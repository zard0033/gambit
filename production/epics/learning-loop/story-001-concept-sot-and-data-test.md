# Story 001: Concept Type + SoT Data + Motif Map + Data Test

> **Epic**: learning-loop
> **Sprint**: S14-01 (Must Have)
> **Status**: Complete (2026-06-06)
> **Layer**: Feature / Logic
> **Type**: Types + Data + Test
> **Estimate**: M
> **GDD**: design/gdd/learning-loop.md (§3.1, §4.1, Appendix; AC-1)
> **TR**: TR-ll-001
> **ADR**: ADR-0004, ADR-0012

## Context

**Depends on**: — (foundational for the epic)
**Purpose**: Define the closed `ChessConcept` vocabulary, the per-concept metadata SoT, and the
`motif → concept` inverse index, plus a blocking data-integrity test that protects every later
bridge and the Concept Map from authoring drift.

---

## Acceptance Criteria

- [ ] **AC-01**: `src/types/concept.ts` defines `ChessConcept` (union: `material | fork | pin | mate | skewer | discovered | defense | center`), `ConceptMeta { id; label; teaches: string[] }`, and `MOTIF_TO_CONCEPT: Record<PuzzleMotif, ChessConcept>` per the GDD appendix.
- [ ] **AC-02**: `src/types/concept.ts` also exports `ALL_PUZZLE_MOTIFS: readonly PuzzleMotif[]` — an explicit runtime list adjacent to the `PuzzleMotif` type (NOT derived from `puzzles.map`).
- [ ] **AC-03**: `src/data/concepts/index.ts` exports `concepts` (readonly `ConceptMeta[]`) and a derived `conceptToMotifs(c)` helper (computed from `MOTIF_TO_CONCEPT`, may be ∅).
- [ ] **AC-04**: `tests/unit/data/concepts.test.ts` asserts: every `label.trim().length > 0`; every id in every `teaches` resolves against `new Set(lessons.map(l => l.id))`; `Object.keys(MOTIF_TO_CONCEPT)` **equals** `ALL_PUZZLE_MOTIFS` by set-enumeration; `conceptToMotifs` returns the correct inverse for each concept (incl. ∅ for skewer/discovered/defense/center).

## Implementation Plan

- Types match the GDD appendix exactly. `material → ['king-and-value']`, `fork → ['fork']`,
  `pin → ['pin']`, `mate → ['checkmate-in-one']`, `skewer → ['skewer']`,
  `discovered → ['discovered-attack']`, `defense → ['protection']`, `center → ['control-the-center']`.
- `MOTIF_TO_CONCEPT`: `capture→material, fork→fork, pin→pin, mate-in-1→mate, mate-in-2→mate`.
  `Record<PuzzleMotif,…>` enforces compile-time totality; `ALL_PUZZLE_MOTIFS` makes the runtime
  enumeration test real (the TS type is erased at runtime).
- `src/data/concepts/` mirrors the `src/data/puzzles/` convention (SoT + index aggregator).
- Data test mirrors `tests/unit/data/puzzles.test.ts` structure.

## Test Evidence

**Required (BLOCKING)**: `tests/unit/data/concepts.test.ts` — label non-empty; `teaches` ids
resolve; `MOTIF_TO_CONCEPT` keys == `ALL_PUZZLE_MOTIFS`; `conceptToMotifs` correctness.

## Notes

- Static front-end data only; no backend, no fetch.
- This data test is the content gate for the whole epic.
- 西洋棋用語 in every `label`: 后/城堡/騎士/主教/國王/兵 (no 車/馬/象).
- All `teaches` ids are **forward references** that must resolve against the real
  `src/data/lessons/` catalog — the test fails loudly if a lesson id is renamed.

## Completion (2026-06-06)

- Files: `src/types/concept.ts` (`ChessConcept`, `ConceptMeta`, `MOTIF_TO_CONCEPT`,
  `ALL_PUZZLE_MOTIFS`), `src/data/concepts/index.ts` (`concepts`, `getConceptById`,
  `conceptToMotifs`), `tests/unit/data/concepts.test.ts`.
- Verified all 8 `teaches` ids resolve against the real catalog: `king-and-value`,
  `fork`, `pin`, `checkmate-in-one`, `skewer`, `discovered-attack`, `protection`,
  `control-the-center` (rules.ts / tactics.ts / control-the-center.ts).
- `npx vitest run concepts.test.ts` → **10/10 pass**. Full suite **580 passed** (+10, no regression).
