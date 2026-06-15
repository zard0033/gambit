# Story 007: Memory Budget Verification (Peak ≤ 150 MB)

> **Epic**: Chess Engine Integration
> **Status**: Ready
> **Layer**: Foundation (Core — engine workers)
> **Type**: Config/Data
> **Estimate**: S (1–2 hours — measurement and documentation)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-chess-engine-006
> **ADR**: ADR-0001, ADR-0002, ADR-0007, ADR-0008

## Context

**GDD**: `design/gdd/chess-engine-integration.md`
**Requirement**: `TR-chess-engine-006`

**ADR Governing Implementation**: ADR-0001: Stockfish Build Versioning and HCE/NNUE Split
**ADR Decision Summary**: Memory budget: Play 25 MB + Review 80 MB + App 40 MB = 145 MB < 150 MB hard ceiling. Working target ≤ 120 MB (actual ceiling with headroom for unmeasured iOS overhead). Real iPhone RSS measurement required (ADR-0007 spike) to re-baseline.

**Control Manifest Rules**:
- Guardrail: Working target ≤ 120 MB; hard ceiling 150 MB
- Guardrail: NNUE Worker RSS target ≤ 85 MB on iPhone Safari

---

## Acceptance Criteria

- [ ] Chrome DevTools Memory snapshot taken during Play-only mode: JS heap ≤ 65 MB (Play worker 25 MB + App 40 MB).
- [ ] Chrome DevTools Memory snapshot taken during Play + Review simultaneously: total heap ≤ 150 MB (hard ceiling).
- [ ] Results documented in `production/qa/evidence/chess-engine-memory-evidence.md` with screenshots.
- [ ] ⚠️ iPhone Safari RSS measurement (ADVISORY): real-device test documents actual RSS during Play + Review. Re-baselines ADR-0001 if > 120 MB working target.

---

## Implementation Notes

- This story runs AFTER Stories 001–005 (all engine functionality implemented).
- Use Chrome DevTools → Memory → Heap snapshot at: (1) app idle, (2) game in progress (Play worker active), (3) post-game review (both workers active).
- Also use `performance.measureUserAgentSpecificMemory()` API in Chrome if available for a more programmatic snapshot.
- iPhone measurement: use Safari Developer Tools → Timelines → Memory on a real device during a full Play + Review cycle.

---

## QA Test Cases

*Config/Data story — smoke check.*

- **AC-1**: Play-only heap ≤ 65 MB
  - Setup: Start a game, wait for AI to move (Play Worker active)
  - Measure: Chrome DevTools Memory → Heap snapshot
  - Pass: Total JS heap ≤ 65 MB

- **AC-2**: Play + Review heap ≤ 150 MB
  - Setup: Complete a game and enter Post-Game Review (both workers active)
  - Measure: Chrome DevTools Memory → Heap snapshot
  - Pass: Total JS heap ≤ 150 MB (hard ceiling); document if > 120 MB (advisory flag)

---

## Test Evidence

**Story Type**: Config/Data
**Required evidence**: `production/qa/evidence/chess-engine-memory-evidence.md`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: **All Stories 001–005 must be DONE** (measures the final implementation)
- Unlocks: Nothing — verification milestone
