# Story 010: chess-openings Bundle Size Decision

> **Epic**: chess-engine
> **Sprint**: S9-03 (Should Have)
> **Status**: Complete
> **Layer**: Infrastructure / Optimization Decision
> **Type**: Analysis + Architecture Decision
> **Estimate**: S (2 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-01
> **TR**: pending /architecture-review
> **ADR**: ADR-0001, ADR-0002, ADR-0007, ADR-0008

## Context

**Related**: S6-07 chess-openings chunk advisory (2026-05-30)
**GDD**: N/A (data library, not a gameplay feature)
**ADR Reference**: ADR-0001 (memory budget 150 MB)

---

## Decision

**chess-openings package is within budget — no optimization required.**

### Bundle Size Analysis (2026-06-01)

| Metric | Value | Status |
|--------|-------|--------|
| Uncompressed | 1,352.99 kB (1.3 MB) | ✅ Acceptable (library size) |
| Gzip compressed | 137.23 kB | ✅ **Within 150 kB budget** |
| % of total bundle | ~15% | ✅ Reasonable for opening database |

### Rationale

1. **Gzip size 137.23 kB is < 150 kB budget** — headroom maintained
2. **Bundle is static** — all openings loaded once at startup, no repeated requests
3. **Deferred optimizations** (if ever needed):
   - Lazy-load via async import (breaking change to sync interface per ADR-0005)
   - Subset by ECO range (trade-off between coverage and size)
   - Pre-computed index (marginal gains, maintenance burden)
4. **Current approach**: Ship full database; revisit only if budget pressure forces it

---

## Acceptance Criteria

- [ ] **AC-01**: Bundle size confirmed ≤ 150 kB gzip (2026-06-01: 137.23 kB ✅)
- [ ] **AC-02**: No breaking changes to `identifyOpening()` interface
- [ ] **AC-03**: Decision documented in story + ADR-0001 reference updated

---

## Implementation Notes

None — decision-only story. No code changes required.

---

## Test Evidence

**Story Type**: Infrastructure / Analysis
**Required Evidence**: Bundle size measurement (captured in story)

---

## Completion Notes

**Completed**: 2026-06-01
**Criteria**: 
- AC-01 ✅ (137.23 kB gzip measured)
- AC-02 ✅ (no interface changes)
- AC-03 ✅ (documented in this story)

**Decision**: Ship as-is; no optimization needed. Budget headroom maintained for future growth.
