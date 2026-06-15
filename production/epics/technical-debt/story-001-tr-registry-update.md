# Story 001: TR-ID Registry Update for Opening Knowledge Cards

> **Epic**: Technical Debt
> **Sprint**: S9-05 (Should Have)
> **Status**: Complete
> **Layer**: Infrastructure / Documentation
> **Type**: Technical Debt Cleanup
> **Estimate**: XS (2 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-01
> **TR**: N/A
> **ADR**: N/A

## Context

**Related tech debt**: `docs/tech-debt-register.md` (2026-05-30, S6-02)
- Opening Knowledge Cards GDD uses non-standard TR-ID format: `OKC-01`, `OKC-02`, etc.
- TR-IDs were not registered in `docs/architecture/tr-registry.yaml`
- Story references in epic assumed TR-IDs existed; registry was silent

**Resolution**: Register all 8 Acceptance Criteria from the opening-knowledge-cards GDD as formal TR-IDs using the standard `TR-opening-knowledge-cards-NNN` format.

---

## Acceptance Criteria

- [ ] **AC-01**: All 8 `TR-opening-knowledge-cards-NNN` IDs are registered in `docs/architecture/tr-registry.yaml` using the standard format.
- [ ] **AC-02**: Each TR-ID maps one-to-one to an Acceptance Criterion from the opening-knowledge-cards GDD.
- [ ] **AC-03**: All registered TR-IDs have `status: active` in the registry.
- [ ] **AC-04**: `last_updated` in `tr-registry.yaml` is updated to reflect the change date.

---

## Work Completed

### Added to `docs/architecture/tr-registry.yaml`

8 new TR-IDs, one per Acceptance Criterion:

| TR-ID | Requirement | Source AC |
|-------|------------|-----------|
| TR-opening-knowledge-cards-001 | Card renders below opening header when ECO matches | AC-01 |
| TR-opening-knowledge-cards-002 | No DOM element when eco is null | AC-02 |
| TR-opening-knowledge-cards-003 | No element for missing ECO codes (same as EC-02) | AC-03 |
| TR-opening-knowledge-cards-004 | Mobile: collapsed by default; tap to expand | AC-04 |
| TR-opening-knowledge-cards-005 | Desktop: expanded by default; click to collapse | AC-05 |
| TR-opening-knowledge-cards-006 | Markdown: **bold** + _italic_ only; no HTML injection | AC-06 |
| TR-opening-knowledge-cards-007 | ≥20 ECO codes with hand-authored cards | AC-07 |
| TR-opening-knowledge-cards-008 | Card tone: no judgment language; strategic focus only | AC-08 |

**Registry updated**: `last_updated: 2026-06-01`

---

## Files Modified

- `docs/architecture/tr-registry.yaml` — added 8 TR-IDs (lines 374–411)

---

## Test Evidence

**Story Type**: Technical Debt / Documentation
**Required Evidence**: Registry entries created and validated

---

## Completion Notes

**Completed**: 2026-06-01
**Acceptance Criteria**:
- ✅ All 8 TR-IDs registered in standard format
- ✅ Each TR-ID maps to exactly one GDD Acceptance Criterion
- ✅ Status: all active
- ✅ GDD cross-reference: `design/gdd/opening-knowledge-cards.md`

**Impact**: Stories referencing opening-knowledge-cards TR-IDs can now be validated by `/story-readiness` tool against the registry.

**Future**: New stories for opening-knowledge-cards features (e.g., Phase 2 extensions) should embed these TR-IDs.
