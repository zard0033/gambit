# Story 002: Remaining 10 ECO Content Cards

> **Epic**: Opening Knowledge Cards
> **Status**: Complete
> **Layer**: Feature
> **Type**: Content (UI advisory)
> **Estimate**: S (3–4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-30
> **TR**: TR-opening-knowledge-cards-007, TR-opening-knowledge-cards-008
> **ADR**: ADR-0003

## Context

**GDD**: `design/gdd/opening-knowledge-cards.md` — Appendix: ECO Coverage (v0), Sprint 2 Backlog
**Requirements**: OKC-05, OKC-06

**No ADR** — data-only story. Cards are hand-authored TypeScript objects keyed by ECO code.

**Engine**: N/A — content authoring only | **Risk**: LOW

---

## Acceptance Criteria

- [ ] **AC-07**: `src/data/opening-knowledge-cards.ts` contains ≥ 20 ECO code entries. All 10 Sprint 2 backlog cards (below) are present.
- [ ] **AC-08**: All card bodies pass a tone review: no phrases such as "should have played", "you missed", "bad choice", "blunder" (when describing the opening strategy, not a specific move). Text describes the opening's strategic plan and what to look for next time.
- [ ] **AC-ECO**: Each new card's ECO code is verified against `chess-openings@0.1.1` `lookupSync` output — the GDD Appendix marks several as "approx." and they may need adjustment.

---

## Cards to Author

Verify each ECO code against `lookupSync` before writing. If the library returns a different sub-variant, use the actual returned code as the key.

| ECO (approx.) | Opening Name | Notes |
| ------------- | ------------ | ----- |
| C20 | King's Gambit | White sacrifices f4 pawn for fast development |
| D10 | Slav Defense | Solid — c6 supports d5 |
| E62 | King's Indian Defense | Black lets White build center, then counterattacks |
| E21 | Nimzo-Indian Defense | Black pins the Nc3 to fight for d4 |
| B06 | Modern Defense | Black delays ...d5 and provokes White to over-extend |
| A80 | Dutch Defense | f5 to control e4; aggressive |
| D70 | Grünfeld Defense | Black cedes center then attacks it with pieces |
| B90 | Sicilian Najdorf | Most popular chess opening; ...a6 gives flexibility |
| B70 | Sicilian Dragon | ...g6 fianchetto; sharp mutual attacks |
| C25 | Vienna Game | White plays Nc3 before f4; flexible and aggressive |

## Card Format Reference

```typescript
ECO_CODE: {
  eco: 'ECO_CODE',
  name: 'Opening Name',
  body:
    'Sentence 1 — what move was played and why. ' +
    'Sentence 2 — White\'s or Black\'s strategic goal. ' +
    'Sentence 3 — typical plan or key challenge for the responding side. ' +
    'Sentence 4 — key pattern or idea to recognize.',
},
```

- Max 4 sentences per card
- Inline formatting only: `**bold**` for move notation, `_italic_` for emphasis
- No judgment language — describe strategy, not player quality

---

## Implementation Notes

1. Run `lookupSync` in the browser console (dev server) for each ECO to confirm exact code returned:
   ```js
   import { lookupSync } from 'chess-openings'
   lookupSync('1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6')
   // Check .eco field
   ```
2. Add new entries to the existing `OPENING_CARDS` record in `src/data/opening-knowledge-cards.ts`.
3. No new files — edit only `src/data/opening-knowledge-cards.ts`.

---

## QA Test Cases

**Gate level**: BLOCKING — `tests/unit/opening-knowledge-cards/opening-knowledge-cards-data.test.ts` must pass.

- **AC-07 count**: `Object.keys(OPENING_CARDS).length >= 20`
- **AC-07 completeness**: All 10 Sprint 2 backlog ECO codes present — C20, D10, E62, E21, B06, A80, D70, B90, B70, C25
- **AC-08 no-judgment**: No card body contains `'should have played'`, `'you missed'`, `'bad choice'`
- **Structural**: Each entry has non-empty `eco`, `name`, `body` string fields
- **Key match**: `card.eco === key` for every entry (no mismatched keys)
- **Body length**: Each body ≤ 600 characters

**Manual tone review** (advisory — document in QA sign-off):
- Read all 10 new card bodies; confirm no judgment language; confirm strategic focus

---

## Test Evidence

**Story Type**: Content
**Required evidence**: `tests/unit/opening-knowledge-cards/opening-knowledge-cards-data.test.ts` (BLOCKING) + manual tone review note in QA sign-off (advisory)

## Completion Notes

**Completed**: 2026-05-30
**Criteria**: AC-07 ✅ (20 ECO codes), AC-08 ✅ (tone review pass), AC-ECO ✅ (codes verified via lookupSync)
**Deviations**:
- ADVISORY: 4 ECO codes differed from GDD Appendix approximations — corrected to actual library values: C20→C30, E62→E61, E21→E20, D70→D80
- Card bodies written in Traditional Chinese (繁體中文) per product requirement
**Test Evidence**: `tests/unit/opening-knowledge-cards/opening-knowledge-cards-data.test.ts` — 6/6 pass (341 total)
**Code Review**: N/A — Config/Data story

---

## Dependencies

- Depends on: Story 001 (component implemented — can verify cards render correctly)
- Unlocks: Epic Definition of Done (AC-07 is the final AC for the epic)
