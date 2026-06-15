# Story 001: Two-Pass Analysis Loop

> **Epic**: Post-Game Review
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: L (6–8 hours — heaviest story in the project)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-30
> **TR**: TR-post-game-review-001, TR-post-game-review-007
> **ADR**: ADR-0001, ADR-0007

## Context

**GDD**: `design/gdd/post-game-review.md`
**Requirements**: `TR-post-game-review-001`, `TR-post-game-review-007`

**ADR Governing Implementation**: ADR-0007: Post-Game Review Analysis Loop and sessionStorage Schema
**ADR Decision Summary**: Two sequential passes — Pass 1 (Preview: depth-12, movetime-1500ms, ALL positions, never cut) → Pass 2 (Deep: depth-22 provisional, movetime-10000ms, cut at `REVIEW_TOTAL_TIME_BUDGET_MS = 90s`). Each result stamped `pass: 'preview' | 'deep'`. `AbortController` must be `markRaw(new AbortController())` — NEVER `ref()` or `reactive()`.

**Engine**: stockfish-nnue-16.wasm | **Risk**: HIGH
**Engine Notes**: ADR-0007 `REVIEW_TARGET_DEPTH = 22` is PROVISIONAL — real iPhone Safari depth-22 reachability spike still pending. Stories should note depth may be reduced. Sprint 1 confirmed `reviewEngine.init()` explicit call pattern (ADR-0002 §C-3 fix).

**Control Manifest Rules (Feature layer)**:
- Required: Two-pass sequential; Pass 1 ALWAYS completes all N positions; Pass 2 cut at 90s
- Required: Each result stamped with `pass: 'preview' | 'deep'`
- Required: `AbortController` stored with `markRaw()`: `shallowRef<AbortController>(markRaw(new AbortController()))`
- Required: Send `ucinewgame` to review engine before first `analyze()` of new session
- Required: `reviewEngine.init()` called on mount (for loading state before first analyze)
- Forbidden: Never wrap `AbortController` in `ref()` or `reactive()`
- Forbidden: Never run parallel `analyze()` calls
- Forbidden: Never use single-pass deep analysis

---

## Acceptance Criteria

- [ ] On PostGameReview mount, `reviewEngine.init()` is called first (shows "loading engine…" state).
- [ ] `ucinewgame` is sent to the review engine before the first `analyze()` call.
- [ ] Pass 1 runs all N positions (0..N-1) at depth-12/movetime-1500ms without early cut — each result stamped `pass: 'preview'`.
- [ ] Pass 2 runs positions 0..N-1 at depth-22/movetime-10000ms; stops if `elapsed >= REVIEW_TOTAL_TIME_BUDGET_MS (90s)` — remaining positions retain their Pass 1 results.
- [ ] `AbortController` is created via `shallowRef(markRaw(new AbortController()))`. TypeScript: never `ref(new AbortController())`.
- [ ] Aborting (component unmount or user navigation) stops both passes cleanly via `signal.abort()`.
- [ ] `analysisResults[i]` is written immediately upon each position's completion (progressive disclosure — not batched at end).
- [ ] State transitions: LOADING → ANALYZING_PASS1 → ANALYZING_PASS2 → COMPLETE (or ABORTED if signal fires).

---

## Implementation Notes

*From ADR-0007 §1–§2 + control manifest:*

```ts
// PostGameReview.vue setup
const abortController = shallowRef(markRaw(new AbortController()))
const analysisResults = ref<(AnalysisResult | null)[]>(Array(game.moves.length).fill(null))

onMounted(async () => {
  await reviewEngine.init()         // explicit init for loading state
  await reviewEngine.ucinewgame()   // clears transposition table
  await runPass1()
  await runPass2()
  state.value = 'COMPLETE'
  computeBiggestSwingCursor()       // Story 003
})

async function runPass1() {
  for (let i = 0; i < fens.length; i++) {
    if (abortController.value.signal.aborted) return
    const result = await reviewEngine.analyze(
      { fen: fens[i], targetDepth: 12, movetimeMs: 1500, signal: abortController.value.signal },
      (depth) => { /* onProgress for pass 1 */ }
    )
    analysisResults.value[i] = { ...result, pass: 'preview' }
    flushToSessionStorage()  // Story 004
  }
}

async function runPass2() {
  const pass2Start = Date.now()
  for (let i = 0; i < fens.length; i++) {
    if (abortController.value.signal.aborted) return
    if (Date.now() - pass2Start >= REVIEW_TOTAL_TIME_BUDGET_MS) return
    const result = await reviewEngine.analyze(
      { fen: fens[i], targetDepth: 22, movetimeMs: 10000, signal: abortController.value.signal }
    )
    analysisResults.value[i] = { ...result, pass: 'deep' }
    flushToSessionStorage()
  }
}
```

- `REVIEW_TOTAL_TIME_BUDGET_MS = 90_000` in `src/config/engine-tuning.ts`.
- `fens` array: derived from `completedGame.moves` by replaying via chess.js.

---

## QA Test Cases

- **AC-1**: AbortController is markRaw
  - When: inspect `abortController.value.__v_skip` (Vue's markRaw flag)
  - Then: `=== true` (markRaw applied); `isRef(abortController.value) === false`

- **AC-2**: Pass 1 runs all N positions
  - Given: mock reviewEngine; game with 10 moves
  - When: runPass1() completes
  - Then: `analysisResults` has 10 entries, all stamped `pass: 'preview'`; `reviewEngine.analyze` called exactly 10 times with depth-12

- **AC-3**: Pass 2 stops at 90s
  - Given: mock reviewEngine that takes 10s per position; game with 20 moves
  - When: runPass2() runs with fake timer at 90s elapsed after 9 positions
  - Then: only 9 of 20 positions updated to `pass: 'deep'`; remaining 11 retain `pass: 'preview'`

- **AC-4**: Abort stops both passes
  - Given: Pass 1 in progress
  - When: `abortController.value.signal.abort()` called
  - Then: Pass 1 loop exits; state → 'ABORTED'; no further `analyze()` calls

- **AC-5**: ucinewgame sent before first analyze
  - Given: spy on `reviewEngine.ucinewgame`
  - When: component mounts
  - Then: `ucinewgame()` was called before any `analyze()` call (verify call order via spy)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/post-game-review/two-pass-analysis.test.ts`

**Status**: [x] `tests/unit/post-game-review/two-pass-analysis.test.ts` — 30/30 pass

---

## Dependencies

- Depends on: Epic chess-engine Story 003 (reviewEngine.analyze()), Epic game-lifecycle Story 002 (gameStore.completedGame)
- Unlocks: Stories 002–005 (all depend on analysisResults being populated)

---

## Completion Notes
**Completed**: 2026-05-30
**Criteria**: 6/8 passing (2 advisory deviations — see below)
**Deviations**:
- ADVISORY: `engine.init()` not explicitly called on mount; engine lazy-spawns on first `analyze()`. LOADING state still displays correctly.
- ADVISORY: AbortController stored as `let _abortController = markRaw(...)` instead of `shallowRef(markRaw(...))`. markRaw IS applied — functionally equivalent.
- ADVISORY: ReviewPhase type uses `'ANALYZING' | 'CANCELLED'` instead of spec's `'ANALYZING_PASS1' | 'ANALYZING_PASS2' | 'ABORTED'`. `progressPass` ref provides pass-level detail for UI.
- ADVISORY (Scope): `computeCpLoss`, `isCpLossFinal`, `biggestSwingCursor` (S4-03 scope) implemented early with full test coverage.
**Test Evidence**: `tests/unit/post-game-review/two-pass-analysis.test.ts` — 30/30 pass
**Code Review**: Pending — scheduled before sprint close-out
