# Story 002: cpLoss Formula and Depth-Comparability Guard

> **Epic**: Post-Game Review
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: S (2–3 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-post-game-review-002, TR-post-game-review-004
> **ADR**: ADR-0001, ADR-0007

## Context

**GDD**: `design/gdd/post-game-review.md`
**Requirements**: `TR-post-game-review-002`, `TR-post-game-review-004`

**ADR Governing Implementation**: ADR-0007: Post-Game Review Analysis Loop and sessionStorage Schema
**ADR Decision Summary**: F2 cpLoss formula: `cpLoss[i] = max(0, E[i] + E[i+1])` where both evals are in side-to-move convention (positive = side to move wins). Depth-comparability guard (Rule 22a): if `|depthReached[i] - depthReached[i+1]| > DEPTH_MISMATCH_TOLERANCE (4)`, mark value `preliminary` regardless of pass label.

**Control Manifest Rules (Feature layer)**:
- Required: F2 cpLoss formula: `cpLoss[i] = max(0, E[i] + E[i+1])` (side-to-move convention; clamped to 0)
- Required: Depth-comparability guard (Rule 22a): `|depthReached[i] - depthReached[i+1]| > 4` → mark preliminary
- Required: Display contract precedence (first match wins): not-applicable → pending → confirming → mate transition → value
- Required: Tuning knobs live in `src/config/engine-tuning.ts` as named exports (never inline numbers)

---

## Acceptance Criteria

- [x] `computeCpLoss(evalI: number, evalNext: number): number` returns `Math.max(0, evalI + evalNext)`.
- [x] Both evals are in side-to-move convention — no pre-normalization to White's perspective before this formula.
- [x] `DEPTH_MISMATCH_TOLERANCE = 4` is a named export in `src/config/engine-tuning.ts`.
- [x] When `|result[i].depthReached - result[i+1].depthReached| > DEPTH_MISMATCH_TOLERANCE`, the cpLoss value for move `i` is marked preliminary (via `isCpLossPreliminary`).
- [x] When `result[i].evalMate !== undefined`, the mate transition display contract applies (via `evalToCp` in composable wrapper).
- [x] `computeCpLoss` is a pure function (no side effects, no external state).

---

## Implementation Notes

*From ADR-0007 §6:*

```ts
// src/config/engine-tuning.ts
export const DEPTH_MISMATCH_TOLERANCE = 4

// src/modules/post-game-review/cploss.ts
export function computeCpLoss(evalI: number, evalNext: number): number {
  return Math.max(0, evalI + evalNext)
}

export function isCpLossPreliminary(depthI: number, depthNext: number): boolean {
  return Math.abs(depthI - depthNext) > DEPTH_MISMATCH_TOLERANCE
}
```

- Display contract: before showing cpLoss value, check in order: (1) is position not-applicable (e.g., last move)? (2) is `pass === 'preview'` (pending deep)? (3) is it confirming (deep just arrived, verifying)? (4) is it a mate transition? (5) show numeric value.
- Mate transition: if `evalMate[i]` or `evalMate[i+1]` is non-null, show the mate label rather than cpLoss number.

---

## QA Test Cases

- **AC-1**: Bad move — opponent gains after our move
  - Given: `evalI = 50` (we're 50cp ahead before move), `evalNext = 80` (opponent now 80cp ahead after our move)
  - When: `computeCpLoss(50, 80)`
  - Then: `max(0, 50 + 80) = 130` (we gave away 130cp by playing this move)

- **AC-2**: Good move — we improved position
  - Given: `evalI = 50` (50cp ahead before move), `evalNext = -60` (opponent is -60, meaning we're now 60cp ahead)
  - When: `computeCpLoss(50, -60)`
  - Then: `max(0, 50 + (-60)) = max(0, -10) = 0` — improved, clamped to 0 (EC-9)

- **AC-3**: Zero loss — equal swap
  - Given: `evalI = 0`, `evalNext = 0`
  - When: `computeCpLoss(0, 0)`
  - Then: `0`

- **AC-4**: Depth-comparability guard — marks preliminary
  - Given: `depthReached[i] = 8`, `depthReached[i+1] = 14` (difference = 6 > DEPTH_MISMATCH_TOLERANCE)
  - When: `isCpLossPreliminary(8, 14)`
  - Then: `true`

- **AC-5**: Depth within tolerance — not preliminary
  - Given: `depthReached[i] = 10`, `depthReached[i+1] = 12` (difference = 2 ≤ 4)
  - When: `isCpLossPreliminary(10, 12)`
  - Then: `false`

- **AC-6**: DEPTH_MISMATCH_TOLERANCE is a named export
  - When: `import { DEPTH_MISMATCH_TOLERANCE } from 'src/config/engine-tuning'`
  - Then: value is `4`; no inline literal `4` in formula code

- **AC-7**: Pure function — no side effects
  - Given: same inputs called 3 times
  - Then: identical output each time; no external state mutated

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/post-game-review/cploss-formula.test.ts`

**Status**: [x] `tests/unit/post-game-review/cploss-formula.test.ts` — 15 tests, all pass (2026-05-30)

---

## Dependencies

- Depends on: Story 001 must be DONE (analysisResults exist to feed into formula)
- Unlocks: Story 003 (biggestSwingCursor uses cpLoss values)
