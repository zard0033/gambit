# ADR-0001: Stockfish Build Source, Version, and HCE/NNUE Split

## Status
Accepted

> **Spike completed 2026-05-28.** Validation Criterion 1 resolved. Key findings:
> (1) No standalone HCE binary exists — single `stockfish-nnue-16-single` build handles
> both modes via `Use NNUE false/true`. (2) NNUE weights are a separate file
> (`nn-5af11540bbfe.nnue`, 38.3 MB raw), not embedded in WASM. (3) UCI handshake
> confirmed < 500 ms (HCE) and < 1 s (NNUE, local disk). All placeholder names replaced.
> Validation Criterion 2 (iPhone RSS) still pending — requires real device.

> **S6-04 decision (2026-05-30):** Original NNUE-for-review plan confirmed — no change to
> this ADR's Decision section. Current deployment state: `nn-5af11540bbfe.nnue` is **not
> yet deployed**; review engine is currently running in HCE mode as a temporary fallback.
> Sprint 7 story will complete the deployment (see Post-Implementation Notes below).

> **AMENDMENT — S10-06 (2026-06-02): migrated to Stockfish 18 Lite single-threaded.**
> Root cause found in browser smoke testing: SF16's NNUE network file
> (`nn-5af11540bbfe.nnue`, ~40 MB) was never deployed to `public/stockfish/`, so enabling
> `Use NNUE true` hung the engine ("network file was not loaded successfully") — review
> analysis was silently broken in the browser despite passing unit tests (which mock the
> worker). Rather than commit a 40 MB external network, we upgraded to
> **`stockfish-18-lite-single`** (npm `stockfish@18.0.7`): the NNUE network is **embedded
> in the ~7.3 MB WASM**, it is single-threaded (no COOP/COEP cross-origin-isolation headers
> required — works on GitHub Pages), and SF18 is always-NNUE (the `Use NNUE` UCI option no
> longer exists). One build now serves play, review, and replay. Files in
> `public/stockfish/`: `stockfish-18-lite-single.js` + `.wasm`. Worker URL is built from
> `import.meta.env.BASE_URL` so it resolves under the GitHub Pages base path. The legacy
> SF16 files and the HCE/NNUE split are removed. Verified in-browser: handshake + bestmove,
> and replay depth-12 eval over a full game. (Strength delta vs SF16 is irrelevant for a
> beginner trainer; SF18 Lite is still far above any human.)

## Date
2026-05-28

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Stockfish WASM (lichess fork) — Web App project; no traditional game engine (Godot/Unity/Unreal) |
| **Domain** | Core / AI Engine Integration |
| **Knowledge Risk** | LOW — spike confirmed package structure, file names, and HCE/NNUE UCI switching. NNUE resident RSS on iPhone Safari remains unverified; measured on Node.js only. |
| **References Consulted** | `design/gdd/chess-engine-integration.md` (Core Rule 1–4, OQ#5–6, Formula 4, External Dependencies table); `.claude/docs/technical-preferences.md`; `docs/architecture/architecture.md` (TD sign-off conditions) |
| **Post-Cutoff APIs Used** | None — Stockfish 16.1 UCI protocol is stable and within LLM training data. No Godot/Unity/Unreal APIs. |
| **Verification Required** | ~~1-day spike: confirm HCE build file name + size + UCI handshake~~ — **Done 2026-05-28**. Remaining: measure NNUE RSS on iPhone Safari (Validation Criterion 2). |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None (ADR-0001 is the first ADR in this project) |
| **Enables** | All Chess Engine implementation stories: Play Mode Worker, Review Mode Worker, UCI wrapper, engine state machine |
| **Blocks** | v0 implementation of Chess Engine Integration — per `architecture.md` TD sign-off: "ADR-0001 HCE spike must resolve before v0 coding begins" |
| **Ordering Note** | This ADR must reach Accepted status (post-spike) before any Chess Engine story enters a sprint. Stories may be written against Proposed status, but sprint inclusion is blocked until Accepted. |

## Context

### Problem Statement

The chess-engine-integration GDD (Core Rule 1) mandates two separate Stockfish WASM
builds: a lightweight HCE build (~1–2 MB) for Play Mode and an NNUE build (~40 MB)
for Review Mode. Without pinning the exact build source and version:

- The skill-level differential AC (≥ 100 cp spread between skill 0 and skill 20 on
  a fixed position) cannot have a reproducible baseline
- WASM bundle sizes cannot be locked in CI — any npm update could silently change
  the Formula 4 memory model
- The HCE/NNUE split itself is assumed, not confirmed — Open Question #6 requires
  a 1-day spike to verify the lichess fork distributes both builds separately

GDD Open Questions #5 and #6 explicitly require this ADR before v0 implementation
begins. The architecture.md Technical Director sign-off makes this a blocking condition.

### Constraints

- **Single-threaded WASM only** — no SharedArrayBuffer, no COOP/COEP headers
  (GitHub Pages deployment + iOS Safari 16.0–16.3 compatibility)
- **Memory ceiling ≤ 150 MB** — total resident memory including both engine workers
  and app overhead, per GDD Formula 4
- **HCE build must be behaviorally distinct from NNUE** — not NNUE with network
  zeroed; skill-level calibration (0–20) must match the GDD's acceptance criteria
- **Vite + Web Worker bundling**: WASM files must be importable as Vite asset URLs
  (`import wasmUrl from '...?url'`) and loadable from a Worker without COOP/COEP

### Requirements

- Standalone HCE (no NNUE weights) WASM build — target file size (gzip): [1, 3] MB
- NNUE-enabled WASM build with the SF16 network — target file size (gzip): [38, 45] MB
- Both builds expose the full UCI protocol over Worker `postMessage`
- Version pinned (no `^` or `~` semver range) for reproducible test baselines
- Source actively maintained with confirmed single-threaded WASM support

## Decision

Pin **`stockfish@16.0.0`** (nmrugg/stockfish.js, the Stockfish 16 WASM distribution)
as the chess engine for both Play Mode and Review Mode. This is Fallback Option A from
the original ADR — the spike confirmed that no standalone HCE binary is published by
either the niklasf lichess fork or the nmrugg package. The single-threaded build
(`stockfish-nnue-16-single`) handles both HCE and NNUE modes via a UCI option switch,
which is architecturally equivalent to two builds and fully satisfies the GDD requirements.

> **Spike note (2026-05-28)**: The `stockfish.wasm` package (niklasf/lichess fork) was
> audited and rejected — it requires SharedArrayBuffer + COOP/COEP headers, violating
> the single-threaded constraint. The nmrugg v16 package provides only NNUE builds; there
> is no published standalone HCE binary. However, the engine defaults to HCE (`Use NNUE
> false`) and supports runtime switching, making a single binary serve both modes.

### Build (confirmed by spike)

**Single build for both modes:**

| Asset | File | Raw size | Gzip size |
| --- | --- | --- | --- |
| Engine JS glue | `stockfish-nnue-16-single.js` | 25 KB | ~10 KB |
| Engine WASM | `stockfish-nnue-16-single.wasm` | 562 KB | 186 KB |
| NNUE network | `nn-5af11540bbfe.nnue` | 38.3 MB | 32.5 MB |

The NNUE network is a **separate file** (not embedded in WASM). It is loaded by the
engine at runtime via XHR when `Use NNUE true` is set. In HCE mode the file is never
fetched.

**Play Mode — HCE via single-threaded build:**
Use `stockfish-nnue-16-single` with:
```
setoption name Use NNUE value false   ← default; omit if no prior setoption
setoption name Hash value 16
```
The engine replies `info string classical evaluation enabled.` confirming HCE.
No NNUE file download occurs. Resident memory: ~20–25 MB (WASM heap + 16 MB Hash).

**Review Mode — NNUE via single-threaded build:**
Use the same JS/WASM files with:
```
setoption name EvalFile value <url-or-path-to-nn-5af11540bbfe.nnue>
setoption name Use NNUE value true
setoption name Hash value 32
```
The engine loads the NNUE file and replies `Load eval file success: 1` then
`info string NNUE evaluation enabled.` The NNUE file (38.3 MB raw) is served as a
static asset and cached by the Service Worker after first load.

### Source

`stockfish@16.0.0` from npmjs.com (nmrugg/stockfish.js). Pin exact version without
semver range. The GDD allowed libraries table entry `stockfish (WASM) — lichess fork`
is satisfied by this package: the nmrugg v16 build is derived from the same niklasf
+ hi-ogawa Emscripten pipeline used by lichess's analysis board.

### Version

Stockfish 16.0 (engine code compiled from SF16 source).

> **Note on version numbering**: The npm package is `stockfish@16.0.0`. The UCI banner
> reports `Stockfish 16 64 POPCNT WASM Single-threaded`. This is the SF16.0 release
> (not SF16.1 as the original ADR assumed — no SF16.1 WASM build is published on npm).
> The ≥ 100 cp skill-level differential acceptance criteria were authored against SF16
> behavior and remain valid.

**Rationale**: SF17 adoption is deferred to Phase 2 with a dedicated ADR; the skill-level
ACs would require re-validation against SF17's recalibrated skill curve.

### Worker co-residency invariant

The memory budget in Formula 4 assumes the two Workers are not simultaneously active
at full load. This invariant must be enforced at the application level:

> **Invariant**: The Review Worker is not instantiated until the Play Worker has
> completed its current search and entered the IDLE state. The two Workers are never
> in the THINKING state simultaneously.

Because both modes use the same JS/WASM binary, they are separate Worker instances —
the Review Worker is created with `Use NNUE true` when Review Mode is first entered.
In practice, Review Mode is only accessible from the post-game results screen, at
which point Play Mode has ended and the Play Worker is idle. The navigation flow
(Play → Results → Review) naturally enforces this. If a future feature ever allows
mid-game review, this invariant must be explicitly re-evaluated.

### Fallback plan

**Option A (now primary)**: The current decision — `stockfish@16.0.0` single-threaded,
HCE via `Use NNUE false`, NNUE via `Use NNUE true`. This was the original Fallback
Option A and is now the confirmed implementation path.

**Option B — Last resort**: Accept higher memory by removing the HCE/NNUE mode
distinction (always run with `Use NNUE true`). **Requires Formula 4 revision** — NNUE
resident for Play Mode raises `playEngineMB` from ~25 MB to ~80 MB, pushing peak
(both Workers) to ~185 MB, exceeding the 150 MB ceiling. Option B requires a new
spike to measure actual iPhone peak RSS, explicit TD sign-off, and a revision to this
ADR before any sprint work begins.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  App Main Thread                                                │
│  ┌──────────────────┐         ┌──────────────────────────────┐  │
│  │  Game Lifecycle  │         │  Post-Game Review            │  │
│  └────────┬─────────┘         └──────────┬───────────────────┘  │
│           │ playEngine.play(...)          │ reviewEngine.         │
│           │  → Promise<PlayResult>        │  analyze(...)         │
│           ▼                              │  → Promise<ReviewResult>│
│  ┌──────────────────────────────────┐   ▼                        │
│  │  ChessEngine Play wrapper         ──► ChessEngine Review wrapper│
│  │  (state machine: UCI lifecycle)  │   (state machine: lazy-load)│
│  └────────┬─────────────────────────┘   └───────────┬───────────┘ │
└───────────┼────────────────────────────────────────┼─────────────┘
            │ onCustomMessage (UCI)                  │ onCustomMessage (UCI)
            ▼                                        ▼
┌──────────────────────────────┐  ┌────────────────────────────────────┐
│  Web Worker                  │  │  Web Worker                        │
│  stockfish-nnue-16-single.js │  │  stockfish-nnue-16-single.js       │
│  + .wasm (562 KB)            │  │  + .wasm (562 KB)                  │
│  Use NNUE: false (HCE)       │  │  Use NNUE: true + nn-5af11.nnue    │
│  ~20–25 MB resident          │  │  ~75–85 MB resident (spike TBC)    │
│  Persistent for app lifetime │  │  Lazy-loaded on first Review call  │
│                              │  │  Terminated after 30s idle         │
└──────────────────────────────┘  └────────────────────────────────────┘

Memory model (Formula 4):
  Play-only:        ~25 (HCE Worker) + 0 (Review not loaded) + ~40 (app) = ~65 MB
  Play + Review:    ~25 (HCE) + ~80 (NNUE — spike TBC on iPhone) + ~40 (app) = ~145 MB
  Ceiling: 150 MB — ~5 MB margin; measured iPhone RSS (Criterion 2) may change this
```

### Key Interfaces

Both HCE and NNUE modes use the same JS/WASM files. The difference is the UCI option
set at boot and whether the NNUE network file is served. The `onCustomMessage` API
(not `postMessage`) is the correct send path for the single-threaded build.

```typescript
// Confirmed import pattern (spike 2026-05-28):
import sfJsUrl from 'stockfish/src/stockfish-nnue-16-single.js?url';
import sfWasmUrl from 'stockfish/src/stockfish-nnue-16-single.wasm?url';
import nnueUrl from 'stockfish/src/nn-5af11540bbfe.nnue?url';
// Worker uses locateFile to override WASM path; NNUE URL passed via EvalFile setoption.

// UCI options set once at boot (per GDD Core Rule 4):
// HCE Play Worker:    setoption name Use NNUE value false
//                     setoption name Hash value 16
//                     setoption name Threads value 1 (default, max for single-threaded)
// NNUE Review Worker: setoption name EvalFile value <nnueUrl>
//                     setoption name Use NNUE value true
//                     setoption name Hash value 32

// Public wrapper interface (defined in Chess Engine implementation story, not here):
// playEngine.play({ fen, skillLevel: 0–20, movetimeMs }) → Promise<PlayResult>
// reviewEngine.analyze({ fen, targetDepth?, movetimeMs? }, onProgress?) → Promise<ReviewResult>
```

## Alternatives Considered

### Alternative 1: nmrugg/stockfish.js for both builds

- **Description**: Use the `stockfish` npm package by nmrugg for both Play and Review
  modes. nmrugg's package provides a single-threaded WASM build without NNUE weights;
  Review Mode would analyze at higher depth but without the neural network evaluation.
- **Pros**: Single npm dependency; no NNUE complexity; confirmed npm publication history.
- **Cons**: No NNUE for Review Mode directly contradicts GDD Core Rule 1
  ("Review Engine: stockfish NNUE (lichess fork)"). NNUE evaluation produces
  meaningfully better positional assessments for the post-game review pillar
  (Pillar 2: Knowledge Connects to Play). nmrugg's package may be less actively
  maintained against current Stockfish releases.
- **Rejection Reason**: Removes the quality benefit of NNUE analysis from post-game
  review, contradicting the GDD's core architecture and Pillar 2.

### Alternative 2: Self-build from Stockfish source via emscripten

- **Description**: Clone the Stockfish GitHub repository, write a custom emscripten
  WASM build script, output both HCE and NNUE builds, commit them to the repo or host
  on a CDN. Gives full control over build flags, optimization levels, and exact version.
- **Pros**: Full control; can target SF16.1 or SF17 at any time; no dependency on
  third-party npm publication cadence.
- **Cons**: Requires emscripten toolchain setup, CI pipeline for WASM compilation,
  and ongoing maintenance. ~40 MB WASM binary commits inflate repo size. License and
  attribution must be manually managed. Significant overhead for a solo v0 project
  when the lichess fork already provides production-grade builds used by lichess.org at scale.
- **Rejection Reason**: Out of scope for v0. The complexity-to-benefit ratio is
  unfavorable; the lichess fork is battle-tested and sufficient.

### Alternative 3: Stockfish 17 (if lichess fork has published a build)

- **Description**: Target SF17 instead of SF16.1. Stockfish 17 (released June 2025)
  features a significantly stronger NNUE network and improved evaluation. If the lichess
  fork has a stable SF17 WASM build, it would provide better analysis quality.
- **Pros**: Stronger evaluation; updated NNUE network; ongoing upstream support.
- **Cons**: The GDD's acceptance criteria were written against SF16 skill-level
  behavior — particularly the ≥ 100 cp spread test between skill levels 0 and 20.
  SF17 recalibrated the skill level curve; all skill-level ACs would need re-validation
  before SF17 can be trusted for Play Mode. The lichess fork's SF17 WASM build
  availability is unconfirmed as of this ADR.
- **Rejection Reason**: Conservative choice for v0. SF17 adoption is a Phase 2
  decision with a dedicated ADR to cover the AC re-validation.

### Alternative 4: Single NNUE build for both Play and Review

- **Description**: Use only the NNUE build for both modes, eliminating the HCE build
  dependency entirely. Play Mode uses NNUE at low depth; Review Mode uses NNUE at high
  depth.
- **Pros**: Single WASM asset to manage; no HCE build spike needed; potentially
  stronger Play Mode evaluation.
- **Cons**: Violates Formula 4's memory budget. With NNUE resident during Play Mode,
  `playEngineMB` rises from ~25 MB to ~80 MB. Play-only total: ~120 MB.
  Peak (Play + Review active): ~185 MB — exceeding the 150 MB ceiling and entering
  the iPhone Jetsam kill zone (~200–280 MB on 3 GB iPhones).
- **Rejection Reason**: Formula 4 is a hard design constraint established by the GDD.
  The HCE/NNUE split is the mechanism that keeps the memory budget within the 150 MB
  ceiling. This alternative invalidates the entire memory model.

## Consequences

### Positive

- Resolves GDD Open Questions #5 and #6 before v0 implementation begins
- Memory budget is maintainable: Play-only ~65 MB; peak (both active) ~145 MB —
  within the 150 MB ceiling with a ~5 MB margin (pending spike confirmation)
- Skill-level differential ACs have a reproducible baseline anchored to pinned SF16.1
- Single source for both builds simplifies version management and cache key strategy
- Fallback paths (A and B) are documented before implementation begins — no
  undocumented decisions under time pressure

### Negative

- Two separate WASM assets to bundle, serve, and cache in the Service Worker
- HCE build file name and exact import path are unknown until the spike —
  implementation stories cannot be completed until spike resolves Validation Criterion 1
- CI bundle size verification cannot be configured until spike confirms actual file sizes
- The ~5 MB margin between peak estimated memory (~145 MB) and the ceiling (150 MB)
  is thin; if NNUE RSS exceeds 85 MB on iPhone, the ceiling is violated and the
  memory model must be revised

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| HCE build unavailable from lichess fork | Medium (pre-spike) | High — requires fallback | Fallback Option A (nmrugg HCE) is architecturally compatible; resolve in spike |
| NNUE resident RSS > 85 MB on iPhone | Unknown (pre-spike) | High — violates ceiling | Spike measures actual RSS; if exceeded, Option B or ceiling revision required |
| Lichess fork version drift (npm update) | Low | Medium — baseline shifts | Pin exact semver without `^` or `~`; Dependabot updates require ADR revision |
| SF17 build from lichess fork released mid-v0 | Low | Low — does not affect pinned version | Ignore until Phase 2; do not upgrade without re-validating skill-level ACs |

## GDD Requirements Addressed

| GDD System | Section / Requirement | How This ADR Addresses It |
|------------|----------------------|--------------------------|
| chess-engine-integration.md | Core Rule 1: Two engine instances, two builds (HCE for Play, NNUE for Review) | Locks both builds to the lichess fork; confirms the HCE/NNUE split as the implementation target |
| chess-engine-integration.md | Core Rule 2: Single-threaded WASM only, no SharedArrayBuffer | Both builds selected are single-threaded; no SharedArrayBuffer dependency; GitHub Pages compatible |
| chess-engine-integration.md | Core Rule 4: Per-engine UCI options set at boot | Key Interfaces section documents the `Hash`, `Threads`, `Ponder`, `MultiPV` values per build |
| chess-engine-integration.md | Open Question #5: Exact version pinning required before v0 | Pins Stockfish 16.1; documents rationale for rejecting SF17 for v0 |
| chess-engine-integration.md | Open Question #6: HCE build availability must be confirmed before v0 | Defines the 1-day spike as Validation Criterion 1; specifies fallback options A and B |
| chess-engine-integration.md | Formula 4: peakMemoryMB ≤ 150 MB | Locks `playEngineMB ≈ 25 MB` (HCE) and `reviewEngineMB ≈ 80 MB` (NNUE, pending spike) as design targets; worker co-residency invariant enforces that the formula holds |
| chess-engine-integration.md | External Dependencies table: `stockfish` (lichess fork) + `stockfish-nnue-16.wasm` | Converts the informal "lichess fork, stockfish 16+" reference to a versioned, sourced decision with fallback documentation |

## Post-Implementation Notes

> **Superseded (2026-06-02, S10-06)**：本節描述的是遷移前 SF16 的 NNUE 部署計畫。引擎已改為 Stockfish 18 Lite 單執行緒版（NNUE 內嵌於 WASM），已無獨立的 `nn-5af11540bbfe.nnue` 檔案可部署，Review 目前已在瀏覽器內真正跑 NNUE。詳見本 ADR 頂部的 amendment。

**Current deployment state (as of Sprint 6, 2026-05-30):**
`nn-5af11540bbfe.nnue` has NOT been deployed. The review engine is running in HCE mode
as a temporary fallback. The desktop HCE baseline (depth 27–29 per position) was
confirmed sufficient in the S5-03 spike, so review functionality is intact. NNUE
deployment is the next step to reach the originally planned evaluation quality.

**Sprint 7 deployment checklist:**

1. Locate `nn-5af11540bbfe.nnue` in `node_modules/stockfish/src/` (or download from
   the nmrugg/stockfish.js GitHub release matching v16.0.0)
2. Copy to `public/stockfish/nn-5af11540bbfe.nnue` — served as a static asset by Vite
   and cached by the Service Worker after first load
3. In `src/modules/chess-engine/review-engine.ts`, add to the UCI boot sequence:
   ```
   setoption name EvalFile value /stockfish/nn-5af11540bbfe.nnue
   setoption name Use NNUE value true
   ```
   Confirm the engine responds `Load eval file success: 1` then
   `info string NNUE evaluation enabled.`
4. Verify desktop memory stays within Formula 4 budget (`reviewEngineMB ≤ 85 MB`)
5. **Validation Criterion 2** — measure NNUE worker RSS on real iPhone Safari.
   This is the final open item blocking full ADR acceptance. Without it, the
   ~5 MB memory margin is unconfirmed on the target device.
   - If iPhone RSS > 85 MB: revise Hash setting downward (try `Hash=16`) and re-measure
   - If iPhone RSS ≤ 85 MB: mark Validation Criterion 2 resolved; ADR fully Accepted

## Performance Implications

- **CPU**: HCE is ~3× faster than NNUE for the same search depth (no neural network
  inference). Play Mode latency is well within the `playMaxMoveTimeMs = 6000 ms` budget.
  Formula 1 (`errorTimeoutMs = 2 × movetimeMs`) has adequate headroom.
- **Memory**: Play-only: ~65 MB. Peak (Play + Review both active): ~145 MB — within
  the 150 MB ceiling provided the worker co-residency invariant holds and NNUE RSS is
  confirmed at ≤ 85 MB by the spike. If the invariant is violated or the estimate is
  wrong, the ceiling may be breached.
- **Load Time**: Engine WASM (562 KB / 186 KB gzip) loads during app initialization
  with negligible impact on the < 3s mobile 4G cold-start budget. NNUE network
  (38.3 MB raw) is lazy-loaded only on first Review invocation; Service Worker Cache
  Storage caches it for subsequent sessions (see Edge Case M5 in the GDD for
  `QuotaExceededError` fallback).
- **Network**: NNUE first-load: 38.3 MB raw (32.5 MB gzip) on 4G — documented in
  architecture.md as HIGH risk and explicitly accepted in the GDD for v0. Phase 2 PWA
  caching ADR will govern the pre-caching strategy for returning users.

## Migration Plan

No existing implementation to migrate. This ADR establishes the ground-truth build
decisions for a new implementation.

## Validation Criteria

1. **[DONE 2026-05-28 — spike in `prototypes/hce-spike/`]**
   Results:
   - Package: `stockfish@16.0.0` (nmrugg). No standalone HCE binary exists; single
     `stockfish-nnue-16-single` build handles both modes via `Use NNUE false/true`.
   - WASM file: `stockfish-nnue-16-single.wasm` — 562 KB raw / 186 KB gzip ✅
   - NNUE file: `nn-5af11540bbfe.nnue` — 38.3 MB raw / 32.5 MB gzip ✅
   - HCE UCI handshake (`uci`→`uciok`→`isready`→`readyok`): **153 ms** ✅
   - NNUE UCI handshake (includes 38 MB file load from local disk): **453 ms** ✅
   - `info string classical evaluation enabled.` confirmed for HCE mode ✅
   - `info string NNUE evaluation enabled.` confirmed for NNUE mode ✅
   - No SharedArrayBuffer required for single-threaded build ✅
   - Skill Level 0–20 confirmed in UCI options ✅
   - Vite `?url` import compatibility: not yet confirmed in browser (requires ADR-0008 spike);
     the `locateFile` override pattern is the same as other Emscripten WASM builds and
     is expected to work without COOP/COEP headers.

2. **[BLOCKING — required before NNUE-dependent stories enter a sprint]**
   Smoke test on real iPhone Safari 16+:
   - Instantiate the NNUE Worker in a minimal test page (no app overhead)
   - Confirm `readyok` arrives within 5s (no WASM exceptions, no CSP block)
   - **Measure actual Worker RSS** using Safari Web Inspector memory timeline;
     record the peak RSS after `readyok` and after first `bestmove`
   - If measured RSS > 85 MB: open a follow-up decision — the 150 MB ceiling may
     need to be revised, or the `reviewEngineHashMb` tuning knob reduced

3. **[CI gate — now unblocked]**
   Add bundle size assertions in `vite.config.ts`:
   - WASM chunk (`stockfish-nnue-16-single.wasm`) ≤ 600 KB raw (observed: 562 KB)
   - NNUE asset (`nn-5af11540bbfe.nnue`) ≤ 40 MB raw (observed: 38.3 MB)
   - CI fails on any update that exceeds these bounds

4. **[Sprint 1 acceptance — anchors skill level to pinned version]**
   Skill-level differential integration test (GDD AC for Play Mode):
   - Run `play({ skillLevel: 0 })` and `play({ skillLevel: 20 })` each 10 times
     on a fixed mid-game position (to be defined in test fixtures)
   - Mean centipawn-loss differential (skill 20 vs skill 0) must be ≥ 100 cp
   - This test is the reproducibility anchor for the pinned SF16.1 build;
     if a future version upgrade changes the result, the ADR must be revised

## Related Decisions

- `design/gdd/chess-engine-integration.md` — the GDD this ADR implements; Core Rules,
  Formulas, and Open Questions are the primary source of requirements
- Future ADR: Stockfish UCI Wrapper Architecture — will define the TypeScript state
  machine, error handling, and public API surface in detail
- Future ADR: PWA Caching Strategy — will govern how the NNUE ~40 MB asset is
  pre-cached for offline use and handle iOS `QuotaExceededError`
- `docs/architecture/architecture.md` — the master architecture document that
  references this ADR's blocking status
