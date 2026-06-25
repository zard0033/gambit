# Control Manifest

> **Engine**: Web App — Vue 3 (Composition API) + TypeScript + Vite + vue3-chessboard (chessground 9.x) + Stockfish 18 Lite single-threaded WASM (`stockfish@18.0.7`, NNUE embedded, one build for Play+Review+Replay) + Pinia 2 + Vue Router 4. No traditional game engine.
> **Last Updated**: 2026-06-02
> **Engine note (S10-06)**: migrated SF16.1 two-build (HCE/NNUE) → SF18 Lite single-threaded (ADR-0001 amendment). The HCE/NNUE-split rules below (§Engine WASM chunk budgets, `Use NNUE` toggles, "Play=HCE / Review=NNUE") are stale — to be reconciled at the next `/create-control-manifest` regen.
> **Manifest Version**: 2026-05-29
> **ADRs Covered**: ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010
> **Status**: Active — regenerate with `/create-control-manifest update` when ADRs change.
>
> **Provenance caveat**: All 10 source ADRs are currently in `Proposed` status pending 7 BLOCKING spikes (see `production/session-state/active.md` Next Up §3). This manifest extracts rules as if those ADRs were Accepted, per Eason's 2026-05-29 decision. Re-run `/create-control-manifest update` after each spike resolves and may flip an ADR to Accepted with modified text. The TD-MANIFEST gate (2026-05-29) returned CONCERNS; all flagged gaps have been incorporated.

### ADR Re-Attestation TODO (added 2026-05-28 per TD-PHASE-GATE)

Each row below tracks an ADR's path from Proposed → Accepted via its BLOCKING spike. Re-run `/create-control-manifest update` whenever any row flips to Accepted — manifest rule text may shift if the spike forces a Decision-section revision.

|ADR|Status|BLOCKING spike(s)|Re-attestation trigger|Target|
|---|---|---|---|---|
|ADR-0001|Proposed|HCE build availability (lichess Stockfish fork npm audit)|Spike confirms HCE file name + size + UCI handshake on Chromium|Sprint 0 — 1 day|
|ADR-0002|Proposed|None (depends on ADR-0001 file names)|ADR-0001 reaches Accepted|After ADR-0001|
|ADR-0003|Proposed|en passant EPD convention (chess.js vs chess-openings)|Spike confirms EPD match or normalization needed|Sprint 0 — < 1 hr|
|ADR-0004|Proposed|None (404.html shim is verified post-first-deploy, not blocking)|First GitHub Pages deploy confirms `/play` deep-link resolves|After first deploy|
|ADR-0005|Proposed|None|ADR-0004 reaches Accepted|After ADR-0004|
|ADR-0006|Proposed|chessground 9.x `drawable.shapes` audit (arrowhead geometry + per-shape brush)|Spike answers: chessground sufficient OR custom SVG confirmed|Sprint 0 — 1 day|
|ADR-0007|Proposed|iPhone Safari depth-22 reachability + peak RSS measurement|Real-device spike returns measured depth + RSS; tuning knobs locked|Sprint 0 — 1 day on real iPhone|
|ADR-0008|Proposed|iOS Safari `<meta>` CSP `worker-src` + `'wasm-unsafe-eval'` honour|Real-device spike returns zero CSP violations + workers load|Sprint 0 — 30 min on real iPhone|
|ADR-0009|Proposed|3 spikes: drawable.shapes schema, focus-cell keydown, vue3-chessboard `boardRef` expose|All three spikes pass; fallbacks documented if any fail|Sprint 0 — 1 day combined|
|ADR-0010|Proposed|2 spikes: iOS user-activation pattern + `canShare({text})` reachability|Real-device spike confirms sync clipboard write succeeds + Tier-1 reachable|Sprint 0 — 30 min on real iPhone|

> **Recommended spike order** (from TD/PR 2026-05-28): ADR-0001 (HCE) → ADR-0008 (iOS CSP) → ADR-0007 (depth-22+RSS) first — highest-uncertainty trio. ADR-0003, 0006, 0009, 0010 follow. ADR-0002, 0004, 0005 promote derivatively once their dependencies land.

`Manifest Version` is the date this manifest was generated. Story files embed this date when created. `/story-readiness` compares a story's embedded version to this field to detect stories written against stale rules. Always matches `Last Updated` — they are the same date, serving different consumers.

This manifest is a programmer's quick-reference extracted from all Accepted-treated ADRs, technical preferences, and (n/a for this project) engine reference docs. For the reasoning behind each rule, see the referenced ADR.

---

## Foundation Layer Rules

*Applies to: routing, store, build-time data, CSP / deployment*

### Required Patterns

- **Use `createWebHistory()` for Vue Router**, not hash mode — source: ADR-0004 §1
- **Catch-all route `/:pathMatch(.*)*` MUST be the last entry in the `routes` array** — source: ADR-0004 §3
- **Lazy-load `PlayView` and `ReviewView`; eager-load `HomeView` and `NotFoundView`** — source: ADR-0004 §4
- **`router.onError` reloads exactly once via a session-scoped `reloadAttempted` flag** (chunk-load failure recovery) — source: ADR-0004 §4
- **Popstate guard while `isGameInProgress`: synchronously call `history.pushState(null, '', '/play')` BEFORE awaiting the confirm dialog** — source: ADR-0004 §5
- **Set `scrollBehavior: () => ({ top: 0 })`; focus primary `<h1>` via `router.afterEach`** — source: ADR-0004 §7
- **`404.html` SPA fallback shim committed at repo root** — captures `window.location.pathname`, redirects to `/index.html?redirect=<encoded>` — source: ADR-0004 §2
- **`beforeunload` listener armed/disarmed by `isGameInProgress` watcher directly** (independent of SPA guard state machine) — source: ADR-0004 §6
- **One canonical Pinia store in v0: `gameStore` only** — source: ADR-0005 §1
- **`completedGame` stored as `shallowRef<CompletedGame | null>` + `Object.freeze` at write time** — source: ADR-0005 §2
- **chess.js instance lives as a non-reactive `const` inside the GameLifecycle composable** — source: ADR-0005 §3
- **Cross-route game state transport: always via `gameStore.completedGame`**, never via route payload — source: ADR-0005 §4
- **`CompletedGame.moves` MUST be a cloned snapshot** at assembly time, not a reference to GameLifecycle's live internal array — source: ADR-0005 §4
- **Disarm-before-navigate order (exact, no synchronous gap)**: `setCompletedGame()` → `setGameInProgress(false)` → `router.push('/review')` — source: ADR-0005 §5
- **Terminal detection priority (5-stage, fixed)**: `isCheckmate()` → `isStalemate()` → `isThreefoldRepetition()` → `isInsufficientMaterial()` → `isDraw()` (fallthrough = fifty-move) — source: ADR-0005 §6
- **`playerMoveTimes[j]` is indexed against the j-th PLAYER move** (not the j-th ply); consumers MUST guard `playerMoveIndex[i] < completedGame.playerMoveTimes.length` — source: ADR-0005 §7
- **Opening index built at compile time via `scripts/build-opening-index.ts`**; output is a TypeScript `Map<string, { eco, name, ply }>` const — source: ADR-0003 §4
- **EPD derivation**: `chess.fen().split(' ').slice(0, 4).join(' ')` (first 4 FEN fields only) — source: ADR-0003 §2
- **Opening collision policy**: longest-name first; tie-break lexically-lower ECO code — source: ADR-0003 §3
- **Pin `chess-openings` and `stockfish` packages to exact versions** in `package.json` (no `^` or `~`) — source: ADR-0001 §Decision, ADR-0003 §1
- **CSP `<meta http-equiv="Content-Security-Policy">` tag MUST appear in `<head>` BEFORE any `<script>` or `<link rel="stylesheet">` tag**; CI enforces via `awk` precedence check — source: ADR-0008 §1 + Validation Criterion 3
- **CSP directive set (exact)**: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' data:; object-src 'none'; base-uri 'self'` — source: ADR-0008 §2

### Forbidden Approaches

- **Never use hash-mode routing (`createWebHashHistory`)** — breaks shareable URLs, PWA `start_url`, SPA fallback intent — source: ADR-0004 Alt 1
- **Never include reserved routes (`/history`, `/history/:gameId`, `/settings`) in the v0 router config** — creates reachable-but-empty screens — source: ADR-0004 §3
- **Never both `return false` AND call `history.pushState` on the popstate path** — causes double URL restoration (visible flicker) — source: ADR-0004 §5
- **Never pass `CompletedGame` via Vue Router payload** (`router.push({ state: { game } })`) — lost on deep-link / refresh — source: ADR-0005 Alt 1
- **Never use a global EventBus as the transport for `CompletedGame` to PostGameReview** — fires before mount, race condition — source: ADR-0005 Alt 2
- **Never wrap the chess.js instance in `ref()` / `reactive()` / a Pinia ref** — deep-reactive proxy adds overhead on every `chess.move()` — source: ADR-0005 §3 + Alt 4
- **Never parse the opening TSV dataset at runtime** — violates < 150 KB gzip + sync-lookup constraints — source: ADR-0003 Alt 1
- **Never use a JSON blob for the opening index** (no benefit over generated TypeScript Map) — source: ADR-0003 Alt 2
- **Never use `_redirects` file (Netlify-only)** — ignored by GitHub Pages — source: ADR-0004 Alt 2
- **Never use `'unsafe-eval'` in CSP** — use `'wasm-unsafe-eval'` instead (targeted, does not enable `eval()` / `new Function()`) — source: ADR-0008 Alt 3
- **Never use `'unsafe-inline'` for `script-src`** — Vite produces no inline scripts — source: ADR-0008 §2
- **Never auto-upgrade `chess-openings` or `stockfish` via Dependabot without an ADR revision** — drift breaks opening-name ACs and SF skill-level baselines — source: ADR-0001 + ADR-0003 Risks
- **Never deploy without verifying `404.html` is present in the build output** — every deep link silently 404s — source: ADR-0004 Risks

### Performance Guardrails

- **Initial bundle (after lazy-splitting PlayView / ReviewView) targets `< 3s` on mobile 4G cold-start** — source: ADR-0004 Perf
- **Generated `opening-index.ts` ≤ 150 KB gzip; ≤ 1 MB resident** (CI gate) — source: ADR-0003 + GDD Formula 4
- **HCE WASM chunk ≤ 3 MB gzip; NNUE WASM chunk ≤ 45 MB gzip** (CI gate, set after Validation Criterion 1) — source: ADR-0001 §VC3
- **`shallowRef` + `Object.freeze` on `completedGame`** avoids deep-reactive traversal of moves array — source: ADR-0005 §2

---

## Core Layer Rules

*Applies to: chess engine integration, Worker IPC, chess board substrate + input model*

### Required Patterns

- **Pin Stockfish to SF16.1 (lichess WASM fork)** with exact semver — source: ADR-0001 §Decision
- **Two engine workers, one per mode**:
  - Play Mode (HCE): `Hash=16, Threads=1, Ponder=false, MultiPV=1`
  - Review Mode (NNUE): `Hash=32, Threads=1, Ponder=false, MultiPV=1`
  — source: ADR-0001 §Key Interfaces, ADR-0002 §7
- **Review Worker is lazy-created on first `analyze()`; auto-terminated after 30s idle; auto-respawns on next `analyze()`** — source: ADR-0002 §1
- **Worker co-residency invariant**: the Review Worker MUST NOT be instantiated until the Play Worker has completed its current search and entered the IDLE state — source: ADR-0001 §Worker co-residency
- **All cross-thread communication via `postMessage` / `onmessage` only** (no SharedArrayBuffer, no Atomics) — source: ADR-0002 §2
- **UCI handshake sequence (exact)**: spawn Worker → `uci` → `uciok` (5s timeout, else CRASHED) → `setoption ...` → `isready` → `readyok` (2s timeout, else CRASHED) → IDLE — source: ADR-0002 §7
- **Cancel-replace on new `analyze()` while THINKING**: send UCI `stop` → drain `info` lines until `bestmove` → if no `bestmove` within `stopDrainTimeout = 2000ms`, call `worker.terminate()` and transition to CRASHED — source: ADR-0002 §3
- **Each `analyze()` call increments a monotonic `requestId`**; the wrapper drops any `bestmove` whose `requestId` does not match the current latest — source: ADR-0002 §4
- **Use `AbortSignal` as the external cancellation API**; the wrapper listens on the signal and runs the same cancel-replace sequence — source: ADR-0002 §3
- **Nine-state engine state machine**: UNINITIALIZED, LOADING, HANDSHAKING, IDLE, THINKING, STOPPING, CRASHED, DISPOSED, IDLE_TERMINATED — source: ADR-0002 §5
- **`IDLE_TERMINATED` (timer) auto-respawns on next `analyze()`; `DISPOSED` (explicit) rejects synchronously with `EngineDisposedError` and never respawns** — must be tracked as distinct termination reasons, not a single dead-boolean — source: ADR-0002 §5
- **iOS visibility liveness protocol**: on `visibilitychange` → visible, if `(now - lastHeartbeatTs) >= 60_000ms`, send `isready` + start 1000ms timer. If `readyok` arrives → alive. If timer expires → terminate, respawn from checkpoint `{ fen, requestId, lastForwardedDepth }` — source: ADR-0002 §6
- **`requestId` is preserved through Worker respawn** so any stale post-respawn `bestmove` is dropped by the race guard — source: ADR-0002 §6
- **Typed error surface only**: `CanceledError`, `EngineUnavailableError`, `EngineDisposedError`, `EngineTimeoutError` (never unhandled promise rejection) — source: ADR-0002 §5
- **Send `ucinewgame` to the review engine before the first `analyze()` of any new review session** (clears transposition table) — source: ADR-0007 §1
- **chess.js is the sole authoritative game state**; `ChessBoard.vue` receives only `fen` / `playerColor` / `disabled` props and emits `move-made` events — source: ADR-0005 §3, ADR-0009 §1
- **`ChessBoard.vue` is a thin adapter** around `<TheChessboard>` — do NOT leak chessground's config API (`brushes`, `movable`, `events`, `animation`) to parent components — source: ADR-0009 §1
- **Keyboard nav via `useBoardKeyboard` composable + single roving focus cell** (one absolutely-positioned transparent `<div tabindex="0" opacity:0 pointer-events:none>`) — source: ADR-0009 §2
- **Board wrapper has `tabindex="-1"`; focus cell has `tabindex="0"`** (single tab stop per GDD) — source: ADR-0009 §2
- **`squareToRect(square)` returns BOARD-LOCAL coordinates** relative to `boardRef`'s top-left, orientation-aware — source: ADR-0009 §4
- **Selection overlays (legal-move dots + capture rings) MUST use chessground's `config.drawable.shapes`** — source: ADR-0009 §3
- **`drawable.shapes` (selection) and the ADR-0006 SVG overlay (annotations) coexist at different z-indices** — they are separate rendering layers, not alternatives — source: ADR-0009 §3
- **`move-made` event payload shape (exact)**: `{ from, to, promotion?, fen, animationDoneAt: Promise<void> }` — source: ADR-0009 §1
- **Promotion dialog implements focus trap** (WCAG 2.1 AA) — source: ADR-0009 §Decision

### Forbidden Approaches

- **Never run Stockfish on the main thread** — blocks UI for 6 full seconds during Play search — source: ADR-0002 Alt 1
- **Never enable SharedArrayBuffer or multi-threaded Stockfish** — no COOP/COEP on GitHub Pages; no iOS 16.0–16.3 support — source: ADR-0002 Alt 2
- **Never queue analyze() requests** — cancel-replace only; queuing delivers stale results for positions the player already left — source: ADR-0002 Alt 3 + GDD Core Rule 7
- **Never share a single Worker between Play and Review modes** — different binaries, different lifecycle, demultiplexing complexity — source: ADR-0002 Alt 4
- **Never use `BroadcastChannel` for engine results** — multi-tab cross-contamination — source: ADR-0002 Alt 5
- **Never use NNUE for Play Mode without an ADR revision** — Formula 4 ceiling (~185 MB peak) breached — source: ADR-0001 Alt 4
- **Never use FEN equality as the requestId discriminant** — the same FEN can recur (threefold) — source: ADR-0002 §4
- **Never treat `messageerror` as CRASHED** — drop the message, stay in the current state — source: ADR-0002 Risks
- **Never collapse `IDLE_TERMINATED` and `DISPOSED` into a single "dead" boolean** — wrong respawn semantics — source: ADR-0002 §5
- **Never fork chessground / vue3-chessboard** for keyboard nav — maintenance burden, divergence risk — source: ADR-0009 Alt 2
- **Never render legal-move dots / capture rings as Vue-reactive SVG `<circle>` elements** — full vDOM diff on every PIECE_SELECTED (up to 27 dots) — source: ADR-0009 Alt 3
- **Never expose `squareToRect()` as viewport-relative; never subtract `boardRef.getBoundingClientRect()` in consumers** — board-local convention is authoritative — source: ADR-0009 §4
- **Never animate `width` / `height` / `top` / `left` / `box-shadow`** — use `transform` + `opacity` only (60fps budget) — source: ADR-0009 Constraints
- **Never use a 64-cell transparent div grid overlay** for keyboard nav — O(64) vDOM diff per move — source: ADR-0009 Alt 1

### Performance Guardrails

- **Memory budget — two-tier (per TD-PHASE-GATE 2026-05-28)**: **Working target ≤ 120 MB** (the budget code is designed against); **hard ceiling 150 MB** (the platform breakage threshold). Play-only ~65 MB, Play + Review ~145 MB is the previously-published estimate but leaves only 5 MB headroom on unmeasured iPhone — too thin. The 120 MB working target reserves ~30 MB for unmeasured iOS Safari baseline + PWA service worker + Vue runtime overhead. Re-baseline both numbers after ADR-0007 spike returns real iPhone SE2 / iPhone 12 RSS measurements. Three-ADR consensus — sources: ADR-0001 §Perf, ADR-0002 §Out-of-Scope C5 (iPhone SE2 130 MB sub-threshold), ADR-0007 (Pass 2 RSS measurement)
- **NNUE Worker RSS target ≤ 85 MB on iPhone Safari** (spike-gated by ADR-0001 VC2) — source: ADR-0001 §VC2
- **HCE evaluation ≈ 3× faster than NNUE** for the same search depth; Play Mode latency well within `playMaxMoveTimeMs = 6000ms` — source: ADR-0001 §Perf
- **`stopDrainTimeout = 2000ms`** — terminate Worker if no `bestmove` after `stop` — source: ADR-0002 §3
- **`backgroundThresholdMs = 60_000ms`**, liveness probe timer `1000ms` — source: ADR-0002 §6
- **Chess Board subsystem bundle ≤ 120 KB gzipped** (GDD constraint) — source: ADR-0009 §Perf
- **O(1) DOM update per focused-square change** (single roving cell) — source: ADR-0009 §Perf

---

## Feature Layer Rules

*Applies to: Post-Game Review analysis loop, Game Export delivery*

### Required Patterns

- **Two-pass sequential analysis** (v0 requirement, not deferred optimization):
  - Pass 1 (Preview): `depth=12`, `movetime=1500ms`, ALWAYS completes all N positions
  - Pass 2 (Deep): `depth=22` (provisional), `movetime=10000ms`, hard ceiling `90000ms` total — source: ADR-0007 §1
- **Each analysis result stamped with `pass: 'preview' | 'deep'`** — source: ADR-0007 §1
- **`AbortController` stored with `markRaw()`**: `shallowRef<AbortController>(markRaw(new AbortController()))` — source: ADR-0007 §2
- **Reset between sessions**: create a new `AbortController` wrapped in `markRaw`; never reuse an aborted controller — source: ADR-0007 §2
- **sessionStorage key format**: `pgr:analysis:<gameId>` where `gameId = completedGame.completedAt.toString()` — source: ADR-0007 §3
- **Strip `pv` from persisted records** (30–60 UCI strings per position is too large) — source: ADR-0007 §3
- **Wrap every `sessionStorage.setItem` in `try/catch`**; set `persistenceAvailable = false` on error; never surface to player — source: ADR-0007 §3
- **Throttle sessionStorage writes** (rAF-piggybacked or 500ms debounce); NOT synchronous per position — source: ADR-0007 §3
- **`biggestSwingCursor` computed EXACTLY ONCE on transition to COMPLETE**; never updated during analysis — source: ADR-0007 §4
- **Eligibility for `biggestSwingCursor`**: `isPlayerMove[i] === true` AND both results non-null AND both `pass: 'deep'` AND `next.bestMove !== null`; tie-break = lowest index — source: ADR-0007 §4
- **F2 cpLoss formula**: `cpLoss[i] = max(0, E[i] + E[i+1])` (side-to-move convention; clamped to 0) — source: ADR-0007 §6
- **Depth-comparability guard (Rule 22a)**: if `|depthReached[i] - depthReached[i+1]| > 4`, mark value preliminary regardless of pass label — source: ADR-0007 §6
- **Display contract precedence (first match wins)**: not-applicable → pending → confirming → mate transition → value — source: ADR-0007 §6
- **Tuning knobs live in `src/config/engine-tuning.ts`** as named exported constants (never inline numbers in feature code) — source: ADR-0007 §7
- **`assembleExportPayload(game, config): string` MUST be pure synchronous** — no `async` keyword, no `await`, return type is `string` not `Promise<string>` — source: ADR-0010 §1
- **`ExportConfig` fields use `readonly` modifiers**; accept a frozen `CompletedGame` — source: ADR-0010 §1
- **Tier (Web Share vs Clipboard vs Fallback) decision MUST be made synchronously inside the tap handler BEFORE any `await`** — source: ADR-0010 §2
- **`canShare({ text: payload })` probe MUST use exactly the same `{ text }` shape** that `navigator.share` will be called with — source: ADR-0010 §2
- **`useGameExport` is a Vue composable, NOT a Pinia store**; timers cleared via `onScopeDispose` — source: ADR-0010 §3
- **FALLBACK textarea rendered via `v-if`** (conditional, not persistent hidden); `nextTick(() => el.select())` on mount — source: ADR-0010 §4
- **FALLBACK dismiss is a real `<button>` element** (not glyph, not click-outside region); ≥ 44×44 px — source: ADR-0010 §4
- **Button bound to `:disabled="state === 'SHARING' || state === 'COPYING'"`** for in-flight tap suppression — source: ADR-0010 §6

### Forbidden Approaches

- **Never use single-pass deep analysis** — ~400s before first result on mobile — source: ADR-0007 Alt 1
- **Never run parallel `analyze()` calls** — cancel-replace + single-thread WASM makes it impossible — source: ADR-0007 Alt 2
- **Never persist `pv` in sessionStorage** — quota concern — source: ADR-0007 Alt 3
- **Never use IndexedDB for v0 review persistence** — sessionStorage is sufficient at ~2.4 KB/game — source: ADR-0007 Alt 4
- **Never recompute `biggestSwingCursor` during analysis** — anchor must be stable while player reads — source: ADR-0007 Alt 5
- **Never wrap `AbortController` in `ref()` or `reactive()`** — Vue proxy breaks `.abort()` event dispatch — source: ADR-0007 §2 + GDD AC-18
- **Never make `assembleExportPayload` `async` or return `Promise<string>`** — silently breaks iOS user-activation; TypeScript compile error required — source: ADR-0010 Alt 1
- **Never call `navigator.clipboard.writeText` after `navigator.share` rejects on iOS** — gesture spent, `NotAllowedError` — source: ADR-0010 §2
- **Never pre-build the export payload on mount and read at tap time** — staleness, solves a non-problem — source: ADR-0010 Alt 2
- **Never drop Tier 1 (Web Share)** — contradicts GDD Player Fantasy ("hand the scoresheet to a coach") — source: ADR-0010 Alt 3
- **Never call `fetch`, `supabase`, or `sessionStorage` from `src/modules/game-export/`** — verified by static grep — source: ADR-0010 §VC9
- **Never auto-trigger or auto-navigate after export success** (Pillar 3: No Pressure) — source: ADR-0010 Constraints

### Performance Guardrails

- **`REVIEW_PREVIEW_DEPTH = 12`, `REVIEW_PREVIEW_MOVE_TIME_MS = 1000ms`** (Pass 1 cap) — source: ADR-0007 §7 (OQ-5 resolved 2026-06-25: per-move 1500→1000ms)
- **`REVIEW_TARGET_DEPTH = 16`** (OQ-5 resolved 2026-06-25: lowered 22→16 for iPhone ~20s review UX; depth 16 still ≫ beginner play), **`REVIEW_MAX_MOVE_TIME_MS = 4000ms`** (Pass 2 cap, lowered 10000→4000) — source: ADR-0007 §7
- **`REVIEW_TOTAL_TIME_BUDGET_MS = 12000ms`** (Pass 2 hard ceiling — positions not yet deepened keep their Pass-1 preview result; OQ-5 resolved 2026-06-25: lowered 90000→12000) — source: ADR-0007 §7
- **`DEPTH_MISMATCH_TOLERANCE = 4`** (depth guard threshold) — source: ADR-0007 §7
- **`MATE_CP = 30000`** (mate-to-centipawn sentinel) — source: ADR-0007 §7
- **Export handler synchronous-portion budget**: < 5 ms total — source: ADR-0010 §Perf
- **Export payload size**: 1–3 KB typical (GDD Formula 1) — source: ADR-0010 §Perf

---

## Presentation Layer Rules

*Applies to: Move Annotation Display (SVG overlay + eval bar) + cross-cutting accessibility*

### Required Patterns

- **Annotation substrate (provisional, OQ#1 spike pending)**: custom `pointer-events: none` SVG element absolutely-positioned over `boardRef`, sized to match exactly — source: ADR-0006 §1
- **Annotation SVG attributes (mandatory)**: `aria-hidden="true"`, `pointer-events: none`, `z-index: 10` (above chessground pieces, below promotion dialog) — source: ADR-0006 §2
- **Use `squareToRect()` (board-local) values directly as SVG coordinates** — NO `boardRef.getBoundingClientRect()` subtraction needed or correct — source: ADR-0006 §2 (2026-05-29 doc-drift correction) + ADR-0009 §4 (authoritative)
- **Arrowhead terminates at destination square EDGE** (not center): use `computeArrowTip(fromCenter, toCenter, squarePx)` with trig + rectangular-clip edge intersection — source: ADR-0006 §3
- **Arrowhead base MUST stay outside `pieceGlyphRadius = squarePx × 0.40` keep-clear disc** — source: ADR-0006 §3
- **`ResizeObserver` on `boardRef` → rAF-throttled SVG geometry recompute** (Formula 4) — source: ADR-0006 §2
- **`Annotation.role` MUST be one of**: `'bestMove' | 'playedMove' | 'alternateLine' | 'threat' | 'keySquare' | 'from' | 'to'` (Pillar 3 structural — no emotive labels) — source: ADR-0006 §Key Interfaces
- **Eval bar lives in surrounding layout, NOT inside the annotation SVG** — substrate must not couple to eval bar placement — source: ADR-0006 §1
- **Two `aria-live` regions mounted in page layout, OUTSIDE the board's DOM subtree**:
  - `#board-assertive` (`aria-live="assertive"`, `aria-atomic="true"`)
  - `#board-polite` (`aria-live="polite"`, `aria-atomic="false"`) — source: ADR-0009 §5
- **100ms merge policy for aria-live**: queue assertive announcements; debounce 100ms; join with `"; "` separator — source: ADR-0009 §5
- **WCAG 2.1 AA keyboard model**: arrow / Home / End / PgUp / PgDn / Enter / Space / Escape — all orientation-aware — source: ADR-0009 §2
- **Forced-colors fallback**: arrow outlines use system colors — source: ADR-0006 Constraints

### Forbidden Approaches

- **Never let chessground `drawable` render the post-game review annotation arrows** — arrowhead-at-center cannot meet ≥70% glyph rule (Provisional; revisited by OQ#1 spike) — source: ADR-0006 Alt 1
- **Never use Canvas 2D for annotations** — DPR overhead, no per-element `aria-hidden` — source: ADR-0006 Alt 2
- **Never use CSS-rotated `<div>` for arrows** — wrong tool for vector drawing — source: ADR-0006 Alt 3
- **Never put the annotation SVG inside the board DOM subtree such that screen readers re-announce on board re-render** — aria-live regions must be siblings, not descendants — source: ADR-0009 §5
- **Never include text nodes or `aria-label` containing "eval" inside the annotation SVG** (eval output lives in separate layout elements) — source: ADR-0006 §VC5
- **Never include emotive role labels** (`'blunder'`, `'brilliant'`, `'mistake'`, `'quality'`, `'lastMove'`) in `Annotation.role` — Pillar 3 — source: ADR-0006 §VC4
- **Never allow hover-only interactions** anywhere on the board or annotation surface (mobile has no hover state) — source: technical-preferences.md Platform Notes
- **Mobile calm default (< 768px) is BINDING — UX spec cannot override**: hide played-move arrow, eval bar, preliminary `~` chips; show best-move arrow + biggest-swing anchor + opening header + final cpLoss chips. `Show detail` is the opt-in path — source: ADR-0007 §5

### Performance Guardrails

- **60fps animation budget (16.6ms/frame)** for all board + annotation interactions — source: ADR-0009 Constraints
- **Arrow geometry computation for 4 arrows is O(1) per frame** — source: ADR-0006 §Perf
- **SVG re-render for 4 arrows + 4 highlights ≈ 8 nodes; vDOM diff < 0.1ms** — source: ADR-0006 §Perf

---

## Global Rules (All Layers)

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes / Interfaces / Types | PascalCase | `ChessGame`, `ReviewSession`, `BoardConfig`, `CompletedGame` |
| Variables / functions | camelCase | `moveHistory`, `analyzePosition` |
| Vue components (in templates) | PascalCase | `<ChessBoard />` |
| Vue components (filenames) | kebab-case | `chess-board.vue` |
| Composables | camelCase with `use` prefix | `useStockfish`, `useReviewSession`, `useBoardKeyboard` |
| Pinia stores | camelCase, `use` prefix + `Store` suffix | `useGameStore` |
| Files (`.ts`) | kebab-case | `chess-engine.ts`, `assemble.ts` |
| Constants | UPPER_SNAKE_CASE | `MAX_DEPTH`, `REVIEW_TARGET_DEPTH`, `MATE_CP` |

### Performance Budgets

| Target | Value | Source |
|--------|-------|--------|
| Framerate | 60 fps | technical-preferences.md |
| Frame budget | 16.6 ms | technical-preferences.md |
| Memory — working target | ≤ 120 MB (design against this number) | TD-PHASE-GATE 2026-05-28 + ADR-0007 spike pending |
| Memory — hard ceiling | 150 MB (platform breakage threshold) | technical-preferences.md + ADR-0001/0002/0007 consensus |
| Initial load | < 3s on mobile 4G | technical-preferences.md |
| Stockfish analysis (Play Mode, per position) | ≤ 5s on iPhone Safari — **bounded by Post-Game Review's own time budgets (`REVIEW_TOTAL_TIME_BUDGET_MS` etc.) during a review pass; the 5s figure is per-position only and does NOT bound a full review** | technical-preferences.md + ADR-0007 §1 |
| Touch targets | ≥ 44 × 44 px | technical-preferences.md (iOS) |

### Approved Libraries (Phase 1 — v0)

| Package | Purpose | Source |
|---------|---------|--------|
| `vue` ^3.x | Frontend framework | vuejs.org |
| `vue-router` ^4.x | Routing | Vue official |
| `pinia` ^2.x | State management | Vue official |
| `typescript` ^5.x | Language | Microsoft |
| `vite` ^5.x | Dev server + bundler | Community |
| `vite-plugin-pwa` ^0.x | PWA support | Community |
| `tailwindcss` ^3.x | Utility CSS | Community |
| `vue3-chessboard` ^1.x | Chess board Vue component (wraps chessground 9.x) | qwerty084 |
| `chess.js` | Chess rules (bundled with vue3-chessboard) | Community |
| `stockfish` (WASM, lichess fork) | Chess engine — pin to SF16.1 exact version | lichess |
| `chess-openings` | Opening name database — pin to exact version | lichess |
| `@supabase/supabase-js` ^2.x | Cloud DB + Auth (Phase 1 reserved for Auth Magic Link) | Supabase |
| `vitest` ^1.x | Unit test framework | Community |
| `@playwright/test` ^1.x | E2E test framework | Microsoft |

### Forbidden / Deferred Libraries (Phase 2 — DO NOT add until v0 MVP ships)

- `@lichess-org/pgn-viewer` — PGN replay viewer
- `@anthropic-ai/sdk` — Claude API client (server-side via Supabase Edge Functions)

> **Guardrail**: Adding Phase 2 libraries early creates unused code and configuration overhead. Reject any PR that imports them before v0 ships.

### Forbidden APIs (Web Platform / Browser)

These APIs are unavailable, deprecated, or unverified for the project's deployment + platform combination:

- **`SharedArrayBuffer`, `Atomics`** — no COOP/COEP on GitHub Pages, no iOS Safari 16.0–16.3 support — source: ADR-0002 §2
- **`'unsafe-eval'`** in CSP — use `'wasm-unsafe-eval'` instead — source: ADR-0008 Alt 3
- **`'unsafe-inline'`** for `script-src` in CSP — Vite produces no inline scripts — source: ADR-0008 §2
- **`report-uri` / `report-to`** in `<meta>` CSP — not supported by `<meta>` delivery mechanism — source: ADR-0008 §2
- **`_redirects` file** — Netlify-only, ignored by GitHub Pages — source: ADR-0004 Alt 2
- **Hover-only interactions** — mobile has no hover state — source: technical-preferences.md Platform Notes
- **Synchronous `JSON.parse` of the opening dataset at runtime** — use compile-time generated TypeScript Map — source: ADR-0003 Alt 1
- **`Object.assign` / in-place mutation on frozen `CompletedGame`** — throws in strict mode — source: ADR-0005 §2

### Cross-Cutting Constraints

1. **Provenance — ADR status**: All 10 source ADRs are currently `Proposed` pending 7 BLOCKING spikes. This manifest treats them as Accepted per Eason's 2026-05-29 decision. Re-run `/create-control-manifest update` after each spike resolves; any rule may shift if a spike forces a Decision-section change.
2. **No traditional game engine** — this is a Web App project. Engine-specialist agents (godot/unity/unreal) do not apply. Use general `/code-review` skill with TypeScript + Vue 3 + Tailwind + a11y focus.
3. **Single-threaded WASM only** — no `SharedArrayBuffer`, no COOP/COEP headers. Multi-threaded Stockfish is permanently out of scope for v0.
4. **iPhone Safari 16+ is the primary mobile target** with named device floors: **iPhone SE 2nd gen** (lowest RAM target, ~3 GB) and **iPhone 12** (mid-range). PWA-enabled via vite-plugin-pwa.
5. **GitHub Pages is the deployment target** — static files only, no HTTP response header injection. CSP must be delivered via `<meta>` tag; SPA fallback via `404.html` shim.
6. **`chess.js` is the sole authoritative game state**. The chess board is a renderer; PostGameReview / OpeningIndex / GameExport read `completedGame.moves` or replay locally — never the live chess.js instance.
