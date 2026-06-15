# Story 003: biggestSwingCursor — Computed Once at COMPLETE

> **Epic**: Post-Game Review
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: S (1–2 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-post-game-review-003
> **ADR**: ADR-0001, ADR-0007

## Context

**GDD**: `design/gdd/post-game-review.md`
**Requirement**: `TR-post-game-review-003`

**ADR Governing Implementation**: ADR-0007: Post-Game Review Analysis Loop and sessionStorage Schema
**ADR Decision Summary**: `biggestSwingCursor` is computed EXACTLY ONCE on transition to COMPLETE state. It is never updated while the player is reading the review. Eligibility: `isPlayerMove[i] === true` AND both adjacent results non-null AND both `pass: 'deep'` AND `next.bestMove !== null`. Tie-break: lowest index.

**Control Manifest Rules (Feature layer)**:
- Required: `biggestSwingCursor` computed EXACTLY ONCE on transition to COMPLETE; never updated during analysis
- Required: Eligibility: `isPlayerMove[i]` AND both `pass: 'deep'` AND `next.bestMove !== null`; tie-break = lowest index
- Forbidden: Never recompute `biggestSwingCursor` during analysis

---

## Acceptance Criteria

- [x] `biggestSwingCursor` is computed exactly once, on state transition to COMPLETE — not during Pass 1 or Pass 2.
- [x] Only positions where `isPlayerMove[i] === true` are eligible candidates.
- [x] Only positions where both `analysisResults[i]` and `analysisResults[i+1]` have `pass: 'deep'` are eligible.
- [x] Only positions where `analysisResults[i+1].bestMove !== null` are eligible (not a terminal position).
- [x] Among eligible positions, the one with the highest cpLoss value is selected. Tie-break: lowest index.
- [x] If no eligible position exists, `biggestSwingCursor` is `null`.
- [x] After COMPLETE, navigating through the review does NOT change `biggestSwingCursor` (it is frozen at computation time).

---

## Implementation Notes

*From ADR-0007 §4:*

```ts
function computeBiggestSwingCursor(
  analysisResults: (AnalysisResult | null)[],
  isPlayerMove: boolean[],
  cpLossValues: number[]
): number | null {
  let bestIdx: number | null = null
  let bestLoss = -1

  for (let i = 0; i < analysisResults.length - 1; i++) {
    const curr = analysisResults[i]
    const next = analysisResults[i + 1]
    if (!isPlayerMove[i]) continue
    if (!curr || !next) continue
    if (curr.pass !== 'deep' || next.pass !== 'deep') continue
    if (next.bestMove === null) continue

    const loss = cpLossValues[i]
    if (loss > bestLoss || (loss === bestLoss && bestIdx === null)) {
      bestLoss = loss
      bestIdx = i
    }
  }
  return bestIdx
}
```

- Call `computeBiggestSwingCursor()` in `runPass2()`'s completion handler — AFTER state transitions to COMPLETE.
- Store result in `const biggestSwingCursor = ref<number | null>(null)` — set once, never mutated again.
- `isPlayerMove[i]`: derive from `completedGame.playerColor` and whether `i` is an even or odd ply (White moves on even ply 0, 2, 4…; Black on odd).

---

## QA Test Cases

- **AC-1**: Basic selection — picks highest cpLoss player move
  - Given: analysisResults with 4 deep results; player moves at indices 0, 2; cpLoss[0]=50, cpLoss[2]=120
  - When: `computeBiggestSwingCursor(results, isPlayerMove, cpLoss)`
  - Then: returns 2 (highest player-move loss)

- **AC-2**: Tie-break — lowest index wins
  - Given: cpLoss[0]=100 and cpLoss[2]=100 (both player moves, both deep)
  - When: `computeBiggestSwingCursor(...)`
  - Then: returns 0 (lowest index on tie)

- **AC-3**: Non-player moves excluded
  - Given: cpLoss[1]=999 (AI move), cpLoss[0]=50 (player move)
  - When: `computeBiggestSwingCursor(...)`
  - Then: returns 0 (ignores index 1 — AI move)

- **AC-4**: Preview results excluded
  - Given: analysisResults[0].pass='preview', analysisResults[2].pass='deep' (only one deep player move)
  - When: `computeBiggestSwingCursor(...)`
  - Then: only index 2 is eligible; index 0 excluded (preview)

- **AC-5**: No eligible positions → null
  - Given: all results have pass='preview' or isPlayerMove all false
  - When: `computeBiggestSwingCursor(...)`
  - Then: returns null

- **AC-6**: Computed exactly once (not during analysis)
  - Given: spy on `computeBiggestSwingCursor`
  - When: state transitions ANALYZING_PASS2 → COMPLETE
  - Then: spy called exactly 1 time; not called during Pass 1 or mid-Pass 2

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/post-game-review/biggest-swing.test.ts`

**Status**: [x] `tests/unit/post-game-review/biggest-swing.test.ts` — 11 tests, all pass (2026-05-30)

---

## Dependencies

- Depends on: Story 002 must be DONE (cpLoss values computed)
- Unlocks: Story 005 (mobile calm UI uses this cursor for the anchor position)
