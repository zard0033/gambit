# Story 002: Tag Existing Lessons with `concepts` + Bidirectional Integrity Test

> **Epic**: learning-loop
> **Sprint**: S14-02 (Must Have)
> **Status**: Complete (2026-06-06)
> **Layer**: Feature / Config-Data
> **Type**: Additive data field + Test
> **Estimate**: S
> **GDD**: design/gdd/learning-loop.md (§3.1, Appendix; AC-1 bidirectional clause)
> **TR**: TR-ll-001
> **ADR**: ADR-0004, ADR-0012

## Context

**Depends on**: S14-01 (the `ChessConcept` union must exist)
**Purpose**: Add the optional `concepts?: ChessConcept[]` field to the lessons that teach each
concept, so Bridge 1 (course→puzzle) and the Concept Map's 已學 state have data to read. The field
is **additive** — existing lessons without it keep working unchanged.

---

## Acceptance Criteria

- [ ] **AC-01**: The `Lesson` type gains an optional `concepts?: ChessConcept[]` field; no existing lesson is broken (field omitted = current behaviour).
- [ ] **AC-02**: Each concept's `teaches` lesson carries that concept in its `concepts` array — `king-and-value`→`material`, `fork`→`fork`, `pin`→`pin`, `checkmate-in-one`→`mate`, `skewer`→`skewer`, `discovered-attack`→`discovered`, `protection`→`defense`, `control-the-center`→`center`.
- [ ] **AC-03**: A **bidirectional tag-integrity** test asserts: for every `ConceptMeta`, every id in `teaches`, when that lesson is loaded, the lesson's `concepts` array **contains** that concept. (Catches a lesson that has the id but was never tagged — the silent-bridge-disable case.)

## Implementation Plan

- Extend the `Lesson` interface (`src/types/lesson.ts` or wherever it lives) with the optional field.
- Edit the eight lesson data entries to add their `concepts` tag. Surgical — touch only the
  `concepts` field; do not rewrite lesson content.
- Add the bidirectional assertion to `tests/unit/data/concepts.test.ts` (or a sibling) — it closes
  the gap that AC-1's id-resolution check alone cannot catch (id exists ≠ concept tagged).

## Test Evidence

**Required (BLOCKING)**: bidirectional tag-integrity assertion — every `teaches` lesson actually
carries its concept. Plus the existing lessons test suite still green (additive field, no regressions).

## Notes

- A lesson may teach more than one concept (the array allows it); `learned(c)` is per-concept.
- Capstone lessons that "recall" `mate` need not be tagged unless they primarily teach it — only the
  primary teaching lesson per concept must carry the tag for AC-3 to pass.
- Verify each lesson id against the **real** `src/data/lessons/` files before editing — do not trust
  the GDD's id list blindly (it is a forward reference; confirm the catalog).

## Completion (2026-06-06)

- `Lesson` type: added optional `concepts?: ChessConcept[]` (import from `./concept`).
- Tagged 8 lessons (surgical, `concepts` field only): `fork`→fork, `pin`→pin, `skewer`→skewer,
  `discovered-attack`→discovered, `protection`→defense (rules.ts/tactics.ts), `king-and-value`→material,
  `checkmate-in-one`→mate, `control-the-center`→center.
- Added bidirectional integrity test (`test_concepts_everyTeachesLessonCarriesTheConceptTag`).
- Full suite **581 passed** (+1, no regression). Additive field — no existing lesson broken.
