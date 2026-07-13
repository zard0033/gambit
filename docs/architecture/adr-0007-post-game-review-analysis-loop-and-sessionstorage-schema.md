# ADR-0007: Post-Game Review Analysis Loop and sessionStorage Schema

## Status
Proposed — OQ-5 desktop spike RESOLVED (2026-05-30); real-iPhone measurement still outstanding as of 2026-07-13（下方 2026-06-25 production retune 已為 iPhone UX 主動降規，但真機耗時／記憶體量測仍未做）.

> **Production retune (2026-06-25)** — independent of OQ-5 reachability (depth 22 *is* reachable):
> the live Pass-2 knobs were lowered for iPhone review-speed UX — `REVIEW_TARGET_DEPTH` 22→16,
> `REVIEW_MAX_MOVE_TIME_MS` 10000→4000, `REVIEW_TOTAL_TIME_BUDGET_MS` 90000→12000,
> `REVIEW_PREVIEW_MOVE_TIME_MS` 1500→1000 (a full review stared at a ~90s progress bar; target ~20s).
> The §7 knob tables, Decision §1, and the loop diagram below retain the ORIGINAL values as the
> decision record; **live truth = `src/config/engine-tuning.ts` + control-manifest**. Rationale:
> depth 16 (~2500 Elo) far exceeds beginner play and 棋憶's 60/120cp moment gates are coarse, so the
> quality cost (cp precision, borderline moments) is acceptable for a calm training tool. The
> `@spike` `depth-22-spike` e2e + its evidence file are now historical.

> **OQ-5 spike result** (S5-03, 2026-05-30): Desktop Chromium HCE baseline reaches depth 27–29 per
> position in 10s — `REVIEW_TARGET_DEPTH = 22` CONFIRMED. Full evidence in
> `production/qa/evidence/s5-03-depth22-spike-evidence.md`.
>
> **Open items blocking Accepted status**:
> 1. ~~NNUE network file (`nn-5af11540bbfe.nnue`, 38 MB) not deployed — review engine silently uses HCE.~~
>    **RESOLVED (2026-06-02, S10-06)**: migrated to Stockfish 18 Lite — NNUE is embedded in the
>    ~7.3 MB WASM, no external network file. Review now genuinely runs NNUE in-browser
>    (verified). See ADR-0001 (amendment 2026-06-02).
> 2. Real iPhone Safari depth + memory measurement still required to fully close OQ-5.

## Date
2026-05-28

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web APIs: sessionStorage, requestAnimationFrame, AbortController, Pinia — Web App, no traditional game engine |
| **Domain** | Feature / Post-Game Review |
| **Knowledge Risk** | LOW for the analysis loop, Vue store, AbortController, and sessionStorage APIs. MEDIUM for the iOS Safari `sessionStorage` quota behavior and the NNUE worker resident memory on real iPhone hardware — both require a real-device spike. |
| **References Consulted** | `design/gdd/post-game-review.md` (Core Rules 1–32, Formulas F1–F5, Tuning Knobs, Edge Cases, Visual/Audio Requirements, Open Questions); `docs/architecture/architecture.md` (PostGameReview module, invariants); `docs/architecture/adr-0002-web-worker-isolation-and-uci-protocol.md` (reviewEngine.analyze API) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | OQ-5 iPhone Safari depth-reachability spike — see Validation Criterion 1. Blocks finalization of `REVIEW_TARGET_DEPTH` and NNUE worker Hash size. Does NOT block store/UI implementation (Rule 22a depth guard absorbs inconsistent depth). |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0002 (Proposed) — `reviewEngine.analyze()` API; ADR-0003 (Proposed) — `identifyOpening()` call on entry; ADR-0005 (Proposed) — reads `gameStore.completedGame` |
| **Enables** | Post-Game Review implementation stories |
| **Blocks** | Post-Game Review cannot be implemented without this ADR accepted |
| **Ordering Note** | iPhone depth spike should precede or run concurrently with implementation — it determines a tuning knob default but does not block the implementation itself (Rule 22a guard makes the loop depth-resilient) |

## Context

### Problem Statement

Post-Game Review is the project's highest-risk system on iPhone Safari. Without a formal ADR, a programmer could: (a) implement single-pass analysis (player sees a blank board until the 40-ply game finishes — up to 400 seconds on mobile), (b) skip sessionStorage persistence (lost state on iOS tab kill), (c) use `ref(new AbortController())` which wraps the signal in a Vue reactive proxy (breaks cancellation silently when `.value` is assigned), or (d) compute `biggestSwingCursor` during analysis (moves the anchor while the player is reading — violates the player fantasy). This ADR formalizes all four loop invariants, the sessionStorage schema, the AbortController pattern, and the mobile calm default.

### Constraints

- **iPhone Safari is the primary target** — engine analysis is sequential (no concurrent workers per ADR-0002). Each position is analyzed one at a time, synchronously from the JavaScript perspective. A 40-ply game at 10s/position = 400s of analysis — must not block the player from reading partial results.
- **Memory ceiling ≤ 150 MB** — the NNUE worker (~80 MB estimated) is already running during review. `analysisResults` and intermediate data must not significantly add to this. The stockfish.wasm Hash size is the largest tuning knob; OQ-5 must pin it.
- **sessionStorage quota varies on iOS** — Safari in Private Mode throws on `setItem`. Safari on iPhone in some configurations has a ~5 MB per-origin sessionStorage limit. The `pv` (principal variation, up to 30–60 UCI strings per position) must be stripped before persisting to stay within quota.
- **AbortController must not be reactive** — Vue reactive proxy wraps `.signal` in a Proxy; when `.abort()` is called the signal property may be replaced rather than the original object's `dispatchEvent` triggered, silently breaking cancellation.

### Requirements

- Whole game becomes legible (preliminary results) before deep analysis completes
- Player may navigate (Previous/Next) concurrently while analysis runs
- iOS tab-kill mid-analysis results in at most a partial restart, not a full restart
- `biggestSwingCursor` is computed once at COMPLETE and does not move while the player reads
- Mobile default presentation: best-move arrow only, no eval bar, no preliminary chips (calm default)

## Decision

### 1. Two-Pass Sequential Analysis Loop (v0 requirement)

Analysis runs in two passes. Both passes iterate positions sequentially (0 through N−1 in order). The two passes are a v0 requirement, not a deferred optimization.

**Pass 1 — Preview:**
- Depth: `REVIEW_PREVIEW_DEPTH = 12`
- Time cap: `REVIEW_PREVIEW_MOVE_TIME_MS = 1500` ms per position
- Guarantee: Pass 1 **always completes all N positions** — it is never cut by the time budget
- Result label: `pass: 'preview'`
- Purpose: give the player a complete preliminary read of every move as fast as possible (~up to 1.5N seconds worst case)

**Pass 2 — Deep:**
- Depth: `REVIEW_TARGET_DEPTH = 22` (provisional — see OQ-5 spike)
- Time cap: `REVIEW_MAX_MOVE_TIME_MS = 10000` ms per position
- Hard ceiling: `REVIEW_TOTAL_TIME_BUDGET_MS = 90000` ms total for the entire Pass 2. When the ceiling is reached, Pass 2 stops. Positions not yet deepened keep their Pass-1 preview result.
- Result label: `pass: 'deep'`
- Purpose: sharpen cpLoss accuracy for the biggest-swing marker and final display values

**Engine reset per review session**: Before the first `analyze()` call of any game review, send `ucinewgame` via the reviewEngine wrapper. This clears Stockfish's transposition table — necessary to prevent stale results from a previously reviewed game contaminating the current one.

**`ucinewgame` implementation note**: The `reviewEngine.analyze()` API (ADR-0002) handles this via the `gameId` parameter or an explicit `reset()` method (to be defined in the implementation). The critical invariant is that transposition state does not leak between review sessions.

### 2. AbortController Pattern — `markRaw` Required

The `AbortController` instance must be stored with `markRaw()`:

```typescript
// In usePostGameReviewStore (Pinia):
const abortController = shallowRef<AbortController>(markRaw(new AbortController()))
```

**Why `markRaw`**: Vue's reactive system wraps objects in a Proxy. When `abortController.value = new AbortController()` is called (e.g., on store reset between review sessions), if the object is NOT marked raw, Vue replaces the `.signal` property with a reactive proxy. The `AbortSignal.addEventListener` on this proxy may not dispatch events the same way as the native `AbortSignal`. More critically, calling `.abort()` on the proxy wrapper may not fire the `'abort'` event on the underlying native signal that the `reviewEngine.analyze()` already holds a reference to — silently breaking cancellation. `markRaw` prevents Vue from proxying the AbortController and its signal.

**Reset between sessions**: When the player exits and re-enters the review screen (e.g., reviews a second game), create a new `AbortController` wrapped in `markRaw`. Never reuse an aborted controller.

### 3. sessionStorage Persistence Schema

**Key format**: `pgr:analysis:<gameId>`  
where `gameId = completedGame.completedAt.toString()` (epoch ms, unique per game session).

**Persisted record per position** (stripped of `pv`):
```typescript
interface PersistedAnalysisEntry {
  bestMove: string | null
  evalCp?: number
  evalMate?: number
  depthReached: number
  pass: 'preview' | 'deep'
  // pv is NOT persisted — can run 30–60 UCI strings per position
}
```

**Write policy**: Throttled writes (rAF-piggybacked or debounced at 500ms). NOT synchronous per position. This keeps sessionStorage serialization off the 60fps navigation hot path.

**Error handling**: Every `setItem` call is wrapped in `try/catch`. On `QuotaExceededError` or any other exception (including Safari Private Mode which throws on `sessionStorage` access itself): silently swallow the error, set `persistenceAvailable = false`, and continue analysis in-memory only. No error surfaces to the player.

**Resume logic on restore** (per GDD Rule 29):
1. Load and parse `pgr:analysis:<gameId>` from sessionStorage
2. If entries 0..N−1 are all present: determine which pass to resume from
   - If any entry is `null` → resume Pass 1 from the first null index
   - If all entries exist and any is `pass: 'preview'` → skip Pass 1 entirely, resume Pass 2 from the first `pass: 'preview'` entry
   - If all entries are `pass: 'deep'` → store is already COMPLETE
3. If sessionStorage is unavailable or the key is absent: start fresh from Pass 1, position 0

**Size estimate** (40-ply game, typical): 40 entries × ~60 bytes/entry ≈ 2.4 KB — well within any sessionStorage limit.

### 4. `biggestSwingCursor` — Computed Once at COMPLETE

`biggestSwingCursor` is computed **exactly once** when the store transitions to COMPLETE. It is NOT updated during analysis. It does NOT move after being set.

**Eligibility criteria** (all must be true):
- `isPlayerMove[i]` = true (player moves only, not AI moves)
- Both `analysisResults[i]` and `analysisResults[i+1]` are non-null
- Both results have `pass: 'deep'` (deep-pass pairs only; preview pairs excluded from the global ranking)
- `analysisResults[i+1].bestMove !== null` (not a terminal position)

**Tie-break**: lowest index (first occurrence of the largest swing).

**Fallback**: If no eligible deep pair exists (e.g., Pass 2 was entirely cut by budget), fall back to ranking over preview pairs. The resulting anchor is rendered with the preliminary treatment (Rule 30 GDD).

**Why once at COMPLETE, not during analysis**: The player fantasy requires one specific anchor moment. If `biggestSwingCursor` moved during analysis (as better-analyzed positions were added), the player could observe the "biggest swing" marker relocating while they read — breaking the experience. Computing at COMPLETE guarantees stability.

### 5. Mobile Calm Default Presentation (< 768px)

On viewports < 768px (mobile default):

| Signal | Mobile default | Toggle to show |
|--------|---------------|----------------|
| Best-move arrow | ✅ Shown | — |
| Played-move arrow | ❌ Hidden | "Show detail" toggle |
| Eval bar | ❌ Hidden (badge only) | "Show detail" toggle |
| Preliminary cpLoss chips (`~`) | ❌ Hidden (empty slot instead) | "Show detail" toggle |
| Biggest-swing anchor | ✅ Shown | — |
| Opening header, navigation, progress | ✅ Shown | — |
| Final cpLoss chips | ✅ Shown | — |
| Pending/not-applicable tokens | ✅ Shown | — |

On viewports ≥ 768px (desktop default): all signals on by default.

**Why mobile calm default**: Post-Game Review is aimed at chess beginners on iPhone. Showing all annotation types simultaneously (best arrow + played arrow + eval bar + preliminary chips) overloads the audience. The mobile calm default renders what is essential for the Player Fantasy ("one named opening + one biggest-swing anchor") without noise. `Show detail` is the opt-in path.

**This default is binding** — it cannot be overridden by the UX spec. The UX spec owns the toggle UI, breakpoint pixel value, and persistence across sessions.

### 6. F2 cpLoss Formula and Display Contract

The centipawn loss at ply index `i` is:

```
cpLoss[i] = max(0, E[i] + E[i+1])
```

where `E[i]` and `E[i+1]` are both in side-to-move convention (positive = moving side is better). The addition captures the swing: `E[i]` was the player's advantage before; `E[i+1]` is the opponent's advantage after. Clamped to 0 (outperforming the engine is not a loss).

**Display contract** (ordered precedence — first match wins):
1. **not-applicable** → `"—"`: not a player move, OR last move (N−1), OR terminal position (null bestMove), OR COMPLETE with missing results
2. **pending** → `"…"` (spinner): player move, ANALYZING, result not yet available
3. **confirming** → chip omitted: player move matched engine's best move (Rule 20)
4. **mate transition** → F2b label (`"Missed forced mate"` / `"Allowed forced mate"`): either result carries `evalMate`
5. **value** → pawn number (`"−0.7"` etc.): final if both deep-pass results pass depth guard; preliminary (`"~−0.7"`) if either is preview or depth guard fails

**Depth-comparability guard** (Rule 22a): if `|depthReached[i] - depthReached[i+1]| > DEPTH_MISMATCH_TOLERANCE (= 4)`, the value is marked preliminary regardless of pass label.

**Display format**: pawn units (cpLoss ÷ 100), one decimal place, shown as a loss (negative or zero). Raw centipawn on tap (secondary). No per-move qualitative word ("Blunder"/"Mistake" etc.). The word "Biggest swing" appears on exactly one position — the `biggestSwingCursor` (Rule 31).

### 7. Tuning Knobs (v0 defaults, all in `src/config/engine-tuning.ts`)

| Knob | v0 Default | Spike Gate |
|------|-----------|------------|
| `REVIEW_PREVIEW_DEPTH` | 12 | Not gated |
| `REVIEW_PREVIEW_MOVE_TIME_MS` | 1 500 ms | Not gated |
| `REVIEW_TARGET_DEPTH` | 22 | **OQ-5 spike required** — may be lowered |
| `REVIEW_MAX_MOVE_TIME_MS` | 10 000 ms | Not gated |
| `REVIEW_TOTAL_TIME_BUDGET_MS` | 90 000 ms | Not gated |
| `DEPTH_MISMATCH_TOLERANCE` | 4 | Not gated |
| `MATE_CP` | 30 000 | Not gated |

### Architecture Diagram

```
PostGameReview (ReviewView)
  │
  ├─ LOADING
  │   ├─ load gameStore.completedGame
  │   ├─ identifyOpening(moves) → openingResult
  │   ├─ create AbortController (markRaw)
  │   ├─ try: restore from sessionStorage key pgr:analysis:<gameId>
  │   └─ render board at position 0
  │
  ├─ ANALYZING (two-pass loop)
  │   ├─ Pass 1: positions 0..N−1 at depth 12 / 1500ms cap
  │   │   ├─ check abortController.signal.aborted before each call
  │   │   ├─ reviewEngine.analyze({ fen, targetDepth: 12, movetimeMs: 1500 })
  │   │   ├─ stamp result with pass: 'preview'
  │   │   ├─ write analysisResults[i] (progressive)
  │   │   └─ throttled sessionStorage write (pv stripped)
  │   │
  │   └─ Pass 2: positions 0..N−1 at depth 22 / 10000ms cap
  │       ├─ check abortController.signal.aborted before each call
  │       ├─ check elapsed >= REVIEW_TOTAL_TIME_BUDGET_MS → stop → COMPLETE
  │       ├─ reviewEngine.analyze({ fen, targetDepth: 22, movetimeMs: 10000 })
  │       ├─ stamp result with pass: 'deep'
  │       └─ overwrite analysisResults[i]
  │
  ├─ COMPLETE
  │   ├─ compute biggestSwingCursor (once, over deep pairs)
  │   └─ show peak marker + jump button
  │
  └─ CANCELLED
      └─ abortController.abort() on exit
```

## Alternatives Considered

### Alternative 1: Single-Pass Deep Analysis

- **Description**: Run one pass at depth 22 (or target depth), filling `analysisResults` sequentially. The player waits until position N−1 is complete before seeing any results.
- **Pros**: Simpler state machine — no `pass` label, no two-loop structure.
- **Cons**: A 40-ply game at 10s/position = 400s before the first result appears. On mobile where analysis is slower, this is a fatal UX regression. The GDD explicitly resolves this as a v0 requirement (OQ-2 is marked RESOLVED as a v0 requirement).
- **Rejection Reason**: Unacceptable latency for beginner users on mobile. Two-pass is v0, not optional.

### Alternative 2: Parallel Analysis (Multiple Concurrent `analyze()` Calls)

- **Description**: Call `reviewEngine.analyze()` for several positions simultaneously.
- **Pros**: Faster total analysis time.
- **Cons**: ADR-0002 (cancel-replace pattern) and the single-threaded WASM model mean only one UCI search can be active at a time. Parallel calls would immediately cancel each other. No benefit achievable.
- **Rejection Reason**: Architecturally impossible with single-threaded WASM and the cancel-replace pattern.

### Alternative 3: Store `pv` in sessionStorage

- **Description**: Persist the full `pv` (principal variation, 30–60 UCI move strings per position) in sessionStorage.
- **Pros**: The `pv` is useful for showing alternate lines to the player.
- **Cons**: 40 positions × 40 `pv` entries × ~5 bytes/move = ~8 KB additional storage per game — manageable, but the pv is only useful for the currently-viewed position and is re-analyzable. Safari's ~5 MB sessionStorage limit on iPhone makes conservatism worthwhile. The GDD explicitly strips pv from persistence.
- **Rejection Reason**: Per GDD EC-3, pv is stripped before persisting. It is re-fetched on demand (or just held in memory for the current position).

### Alternative 4: IndexedDB Instead of sessionStorage

- **Description**: Use IndexedDB for the analysis persistence layer — larger quota, async, structured.
- **Pros**: No quota concerns.
- **Cons**: IndexedDB is async — persisting per-position analysis results mid-60fps navigation would require careful microtask scheduling. sessionStorage is synchronous (simpler), the payload is tiny (2.4 KB/game), and the use case is session-scoped (no need for cross-session persistence — that is Game History, an MVP feature).
- **Rejection Reason**: sessionStorage is sufficient for the session-scoped persistence requirement. IndexedDB is the correct choice for cross-session persistence (Game History, MVP tier).

### Alternative 5: Compute `biggestSwingCursor` Continuously During Analysis

- **Description**: Recompute `biggestSwingCursor` after each new result arrives, keeping it up-to-date throughout analysis.
- **Pros**: Player sees the best anchor available at any point during analysis.
- **Cons**: The anchor marker moves while the player is reading, which is disorienting and violates the Player Fantasy ("one specific moment") — the anchor is a stable reference, not a moving target. The GDD (Rule 30) and the architecture doc are both explicit: computed once at COMPLETE.
- **Rejection Reason**: The Player Fantasy explicitly requires a stable anchor. A moving marker while the player reads is a UX regression, not an improvement.

## Consequences

### Positive

- Two-pass architecture gives the player a full preliminary read (all moves legible) before deep analysis completes — compatible with 60fps navigation during analysis
- sessionStorage persistence survives iOS tab kill for any game up to ~80 plies (well within practical game lengths)
- `markRaw(AbortController)` prevents the single-most-common Vue reactive proxy pitfall in async cancel patterns
- `biggestSwingCursor` stability guarantees the Player Fantasy's anchor moment is readable
- Mobile calm default reduces visual noise for the target audience (beginners on iPhone)

### Negative

- Two-pass loop is more complex than single-pass — must track `pass` label per result and handle resume logic for both pass states
- sessionStorage is best-effort — quota failures are silently ignored, meaning a tab-kill restart is possible on restricted Safari configurations
- `REVIEW_TARGET_DEPTH = 22` is provisional until the OQ-5 spike; implementations must be written against the tuning knob constant, not a hardcoded `22`

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| iPhone Safari does not reach depth 22 within 10s per position | Medium | Medium — many positions will be shallow; cpLoss accuracy reduced | Rule 22a depth guard marks mismatched-depth pairs as preliminary; acceptable for v0; spike calibrates the defaults |
| sessionStorage quota exceeded on 80-ply game in some Safari config | Low (2.4 KB is tiny) | Low — analysis restarts from position 0 (no user-visible error) | pv stripped; try/catch on every setItem; graceful fallback documented |
| AbortController reactive proxy breaks cancellation | Low (caught by `markRaw`) | High — cancel-replace silently fails, analysis never stops | `markRaw` required; AC-18 test verifies it; code review enforces it |
| `REVIEW_TOTAL_TIME_BUDGET_MS = 90s` too short for a long (80-ply) game | Low | Low — trailing positions remain at preview depth; depth guard marks them preliminary | Tuning knob; can be raised post-launch; user sees `~` markers on uncompleted positions |

## GDD Requirements Addressed

| GDD System | Section / Requirement | How This ADR Addresses It |
|------------|----------------------|--------------------------|
| post-game-review.md | Core Rules 9–14: Two-pass analysis loop (v0 requirement) | Decision §1: Pass 1 (depth 12, 1500ms) + Pass 2 (depth 22, 10000ms, 90s budget) |
| post-game-review.md | F2: cpLoss formula + display contract | Decision §6: F2 formula + ordered 5-branch display contract documented |
| post-game-review.md | Rules 30–32: biggestSwingCursor (once at COMPLETE, stable) | Decision §4: computed at COMPLETE over deep pairs; never moves |
| post-game-review.md | EC-3: sessionStorage persistence (pv stripped, QuotaError handled) | Decision §3: schema, key format, write policy, error handling, resume logic |
| post-game-review.md | Rule 4 + architecture.md invariant: AbortController with markRaw | Decision §2: `markRaw(new AbortController())` required; Vue proxy pitfall documented |
| post-game-review.md | Visual Requirements / Mobile calm default | Decision §5: mobile default table with "Show detail" opt-in |
| post-game-review.md | Tuning Knobs table | Decision §7: all tuning knobs in `src/config/engine-tuning.ts` with OQ-5 gate |

## Performance Implications

- **CPU**: Sequential analysis — no parallelism. Pass 1 is bounded per-position (1.5s cap). Pass 2 is bounded globally (90s). These are by design.
- **Memory**: `analysisResults` array: 40–80 entries × ~100 bytes/entry (no pv) = 4–8 KB. `markRaw` ensures no Vue reactive proxy overhead on the array contents. The dominant memory consumer is the stockfish.wasm NNUE heap (~80 MB estimated).
- **sessionStorage writes**: Throttled to ~2 writes/second max (debounced) to avoid blocking the main thread with JSON serialization. Total payload: ~2.4 KB for a 40-move game.
- **UI frame budget**: `analysisResults` writes are batched via rAF flush to prevent synchronous store mutations from triggering > 1 re-render per frame during rapid navigation + streaming results.

## Migration Plan

No existing Post-Game Review implementation. This ADR establishes the initial architecture.

## Validation Criteria

1. **[BLOCKING spike — iPhone depth-reachability + memory]**
   Run on real iPhone SE 2nd gen (or iPhone 12 minimum) in Safari:
   - Load the app with a completed 40-ply game
   - Run two-pass analysis and measure: does `depthReached` consistently reach `REVIEW_TARGET_DEPTH = 22` within `REVIEW_MAX_MOVE_TIME_MS = 10000`?
   - If not: lower `REVIEW_TARGET_DEPTH` to the consistently-reachable depth (likely 14–18 on older iPhones)
   - Measure peak Safari Web Inspector memory (RSS) during analysis — must stay ≤ 150 MB
   - Pin `Hash` tuning knob for the stockfish NNUE worker based on measurement

2. **[Unit — AbortController is not reactive]**
   Assert `isReactive(abortController.value) === false` AND `isProxy(abortController.value.signal) === false` after store initialization (Validation Criterion from GDD AC-18).

3. **[Unit — pass label stamped correctly]**
   Spy on reviewEngine.analyze calls: verify Pass 1 calls use `targetDepth: REVIEW_PREVIEW_DEPTH` and results are stamped `pass: 'preview'`; Pass 2 calls use `targetDepth: REVIEW_TARGET_DEPTH` and results are stamped `pass: 'deep'`.

4. **[Unit — biggestSwingCursor stable]**
   After COMPLETE: call `setAnalysisResult(i, newResult)` on a non-biggestSwing position → assert `biggestSwingCursor` has not changed. Computed once.

5. **[Unit — sessionStorage key format + pv stripped]**
   After analysis of a game with `completedAt = 1748400000000`: assert sessionStorage key is `pgr:analysis:1748400000000` AND no persisted entry contains a `pv` field.

6. **[Unit — sessionStorage QuotaExceededError]**
   Mock `sessionStorage.setItem` to throw `QuotaExceededError`: assert analysis continues normally, store transitions to COMPLETE, no error surfaces to UI.

7. **[Unit — resume from sessionStorage (both pass states)]**
   Restore scenario A (partial Pass 1): entries 0–3 present, 4+ null → assert Pass 1 resumes from index 4.
   Restore scenario B (all preview): all N entries present with `pass: 'preview'` → assert Pass 1 is skipped, Pass 2 resumes from index 0.

8. **[E2E — mobile calm default on 390px viewport]**
   Playwright `viewport: { width: 390, height: 844 }`: assert played-move arrow is absent from DOM (or display:none) AND eval bar element is absent/hidden AND preliminary chip `"~"` prefix is not rendered for ANALYZING positions.

## Related Decisions

- [ADR-0002](adr-0002-web-worker-isolation-and-uci-protocol.md) — `reviewEngine.analyze()` API, IDLE_TERMINATED auto-respawn, cancel-replace semantics
- [ADR-0003](adr-0003-chess-openings-dataset-pin-and-epd-index.md) — `identifyOpening()` called once on entry
- [ADR-0005](adr-0005-pinia-store-boundaries-and-completed-game-transport.md) — reads `gameStore.completedGame` on entry
- [ADR-0006](adr-0006-move-annotation-rendering-substrate.md) — MoveAnnotationDisplay receives `annotations` and `evaluation` props from this system
- `design/gdd/post-game-review.md` — the GDD this ADR implements
