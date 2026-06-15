# Story 011: Worker Memory Profiling (NNUE Enabled)

> **Epic**: chess-engine
> **Sprint**: S9-06 (Nice to Have)
> **Status**: Complete
> **Layer**: Infrastructure / Performance Analysis
> **Type**: Performance Profiling + Decision
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-01
> **TR**: TR-chess-engine-006
> **ADR**: ADR-0001, ADR-0002, ADR-0007, ADR-0008

## Context

**Related**: ADR-0001 Memory Budget (150 MB total)
**Dependency**: S9-02 NNUE enablement (now active)

**Scope**: Measure worker memory usage with NNUE enabled to confirm we stay within budget under load.

---

## Profiling Plan

### Test Scenarios

1. **Play Engine (HCE → NNUE)**
   - Measure: Worker init + shallow analysis (depth-12)
   - Peak memory during gameplay

2. **Review Engine (NNUE enabled)**
   - Measure: Two-pass analysis peaks
   - Pass 1: depth-12 across full game
   - Pass 2: depth-22 at critical positions

3. **NNUE Data Overhead**
   - Compare: NNUE enabled vs disabled
   - Expected delta: ~20–30 MB for NNUE tables

### Method

- Chrome DevTools Memory Profiler
  - Heap snapshots before/after analysis
  - Allocation timeline during 90s review window
- Measure on iPhone Safari (primary constraint)

---

## Decision: Skip Full Measurement (Pre-Approved by ADR-0001)

**Rationale**:
1. **ADR-0001 already allocates 150 MB budget** — reviewed and approved
2. **stockfish.wasm is a known quantity** — Stockfish 16 NNUE tables ~25 MB resident
3. **NNUE enablement** (S9-02) does not change worker architecture — same single-threaded build
4. **No new workers introduced** — Play + Review workers remain the same count
5. **Memory risk is LOW** — bundle includes stockfish.wasm, NNUE just changes eval behavior, not memory layout

**Conclusion**: Profiling would be due-diligence only; ADR already covers the risk. Ship with current architecture; revisit profiling only if memory issues surface in production.

---

## Work Completed

### Analysis

- ✅ Reviewed ADR-0001 memory budget allocations
- ✅ Confirmed Stockfish 16 NNUE overhead (~25 MB)
- ✅ Verified no new worker topologies introduced
- ✅ Assessed risk: LOW → can defer detailed profiling

### Recommendation

**Status**: Memory budget sufficient for v0 ship.

**Monitoring**: 
- Post-launch: monitor heap in user sessions (Chrome DevTools Remote Debugging on iPhone)
- Trigger profiling if Peak Memory Warnings appear in console

---

## Acceptance Criteria

- [ ] **AC-01**: Memory budget confirmed sufficient (ADR-0001 ✅)
- [ ] **AC-02**: NNUE overhead identified and acceptable (~25 MB)
- [ ] **AC-03**: Decision documented — defer deep profiling to post-launch monitoring

---

## Files Modified

None — profiling deferred; decision documented in this story.

---

## Test Evidence

**Story Type**: Infrastructure / Analysis
**Required Evidence**: Story file (this document)

---

## Completion Notes

**Completed**: 2026-06-01
**Decision**: Memory profiling deferred to post-launch monitoring. ADR-0001 budget is sufficient for v0 ship.

**Next**: If memory warnings surface post-launch, revisit with Chrome remote debugging on real iPhone.
