# Chess Engine Integration

> **⚠️ Engine superseded (2026-06-02, S10-06):** This GDD describes the original SF16 two-build
> design — **HCE Play engine + NNUE Review engine (separate WASM builds)**, with a 40 MB external
> NNUE network and a Formula-4 memory budget split. The implementation migrated to **Stockfish 18
> Lite single-threaded** — one build for Play+Review+Replay, NNUE embedded in the ~7.3 MB WASM, no
> external network, always-NNUE (no `Use NNUE` toggle). The HCE/NNUE-split rules, OQ#6, and the
> two-build memory budget below are historical. Current engine of record: ADR-0001 (amendment 2026-06-02).
>
> **Status**: Superseded (2026-06-02) — OQ#6/HCE spike moot under the current design; engine of record is Stockfish 18 Lite single build (ADR-0001 amendment), shipped and in production
> **Author**: Eason + Claude
> **Last Updated**: 2026-05-27
> **Implements Pillar**: Pillar 2 (Knowledge Connects to Play) — the engine is what makes every move legible and every review meaningful
> **Priority**: v0 / Foundation
> **Depends on**: None (Foundation layer)
> **Depended on by**: Game Lifecycle, Post-Game Review, Difficulty System
> **Creative Director Review (CD-GDD-ALIGN)**: CONCERNS (accepted) 2026-05-27 — #1 resolved via structural Pillar enforcement AC; #2 and #3 documented as cross-GDD handoff requirements to Game Lifecycle and Post-Game Review respectively
> **Specialists consulted**: creative-director (Player Fantasy framing), systems-designer (Section C critique + Section D formula discovery + Section E edge cases), gameplay-programmer (Section C feasibility), qa-lead (Section H AC review), creative-director (CD-GDD-ALIGN pillar review)

## Overview

The Chess Engine Integration is the AI brain of the app — a TypeScript wrapper around `stockfish.wasm` that exposes a clean, promise-based interface for other systems to send positions and receive analysis results. It runs Stockfish in a dedicated Web Worker to keep the UI thread free, communicates via the UCI protocol, and manages the lifecycle of analysis sessions (start, stop, depth/time budget enforcement).

This system has two operating modes: **Play Mode**, where it generates a single best move for a given position and skill level; and **Review Mode**, where it evaluates every position in a completed game and returns a scored line with the best move and evaluation delta for each ply. Consumers — Game Lifecycle for play, Post-Game Review for analysis — call a simple async API and receive structured results; they have no knowledge of UCI, Web Workers, or WASM internals.

The player never interacts with this system directly. They experience it as the AI opponent that responds to their moves, and as the analytical voice that explains their game afterward. Its correctness and performance — especially on iPhone Safari — determine whether the app's core value proposition is credible.

## Player Fantasy

During play, the AI opponent should feel like a reasonable mind on the other side of the board — not a difficulty rating to beat, not a leaderboard ghost, just a presence that makes each position genuinely contested. There is no taunting clock, no opponent profile, no celebratory animation when the player blunders. The pressure is the position's own pressure, not the app's. The player thinks freely, knowing the AI is calibrated to their level and will simply play the position as it stands.

After the game, the analytical voice arrives as a compass reading, not a grade. For each move, it shows what the position called for — "you had something better here" — without ceremony, badges, or stars. The evaluation delta is information, not judgment. Over many games, the player begins to see the gap between their intuition and the truth of the position slowly closing — and that closing gap, made visible through accumulated skill scores and game history, is the progress they came to see.

**Reference points:**
- **lichess analysis** — clean, numeric, free of moralizing language (no "Brilliant!" / "Blunder!" labels during play)
- **A patient coach reviewing footage** — states what happened and what could have happened, never inflates praise or sharpens criticism

**Explicitly NOT this system's job:**
- No "Brilliant!" / "Mistake!" / "Blunder!" labels (chess.com-style emotive grading) — Post-Game Review owns move classification with neutral terminology
- No opponent personality, avatar, or styled "thinking" animation
- No celebration on AI mistakes or player good moves during play
- No competitive framing (rating, win streak, ELO change) — that's chess.com's territory, not this app's

The engine's job is to be a credible opponent and a trustworthy analyst — nothing more, nothing less. Player emotion comes from the player's own engagement with the position, not from the system reacting to them.

## Detailed Design

### Core Rules

1. **Two engine instances, two builds:**
   - **Play Engine**: stockfish HCE (no NNUE), ~1-2MB, single-threaded WASM, lives for the app's lifetime once first used
   - **Review Engine**: stockfish NNUE (lichess fork), single-threaded WASM, lazy-loaded only when Review mode is first invoked; terminated after 30s idle to reclaim memory
2. **Single-threaded WASM only.** No SharedArrayBuffer, no COOP/COEP headers, no multithreaded builds. Trade ~3× search speed for deployment simplicity (GitHub Pages-friendly) and iOS Safari 16.0-16.3 compatibility.
3. **UCI protocol — strict handshake on engine boot:**
   - Send `uci` → await `uciok` (timeout 5s; on timeout → CRASHED)
   - Send `setoption` for all configured options
   - Send `isready` → await `readyok` (timeout 2s)
   - Engine is now IDLE and ready to accept `position` + `go`
   - Send `ucinewgame` before analyzing an unrelated position (clears transposition table)
4. **Per-engine UCI options (set once at boot):**
   - Play: `Hash=16`, `Threads=1`, `Ponder=false`, `MultiPV=1`
   - Review: `Hash=32`, `Threads=1`, `Ponder=false`, `MultiPV=1` (Phase 1; MultiPV=3 deferred to Phase 2 lesson features)
5. **Play Mode — one move per call:**
   - Input: `{ fen, skillLevel: 0-20, movetimeMs }` where `movetimeMs ∈ [3000, 8000]` (`playMaxMoveTimeMs` default 6000)
   - Engine sends: `position fen [fen]`, `setoption name Skill Level value [n]`, `go movetime [ms]`
   - Output: `Promise<{ bestMove, ponder?, evalCp?, evalMate?, depthReached }>` resolves on `bestmove`
   - Skill-level-to-difficulty mapping is **not** owned by this system — see Open Question #1 + future Difficulty System GDD
6. **Review Mode — one position per call (consumer loops):**
   - Input: `{ fen, targetDepth?, movetimeMs?, multiPV? }` defaults: `targetDepth=22`, `movetimeMs=10000`
   - Engine sends: `position fen [fen]`, `go depth [d] movetime [ms]` — Stockfish honors whichever hits first
   - Output: `Promise<{ bestMove, evalCp?, evalMate?, depthReached, pv }>` + optional `onProgress(progress)` callback
   - Worker filters `info` lines: only forward when `depth` increases OR every 200ms, never raw `currentmove`/`nps`/`hashfull`
7. **Cancellation protocol:**
   - `AbortSignal` is the cancellation primitive (consumer composes with route guards / cleanup)
   - On abort: send UCI `stop`, drain incoming messages until `bestmove` arrives, then resolve as `CanceledError`
   - Stockfish's `bestmove` after `stop` is the "best so far" — capture it but do NOT return as a real move; the request was canceled
   - **Never queue searches** — second call while first is in-flight: cancel first (its promise rejects with `CanceledError`), start second
8. **requestId tagging** (race condition guard):
   - Every `analyze()` call increments an internal `requestId`
   - When `bestmove` arrives, the worker tags it with the originating `requestId`
   - Main thread drops any `bestmove` whose `requestId` ≠ current latest. **Do NOT use FEN comparison** — same FEN can recur
9. **Engine asset loading:**
   - Vite worker bundling: `new Worker(new URL('./stockfish.worker.ts', import.meta.url), { type: 'module' })`
   - WASM via `import wasmUrl from 'stockfish-*.wasm?url'`, passed to worker via `postMessage`; Emscripten `Module.locateFile` overridden to return that URL
   - All engine assets cached in Service Worker Cache Storage on first visit (returning users get instant boot)
10. **CSP additions required:** `script-src 'self' 'wasm-unsafe-eval'`; `worker-src 'self' blob:`
11. **Visibility handling (`document.visibilitychange`):**
    - On `hidden`: snapshot in-flight Review state `{ fen, lastProgress, requestId }`; allow worker to continue (Safari may suspend automatically)
    - On `visible` after >60s hidden: ping `isready`, await `readyok` with 1s timeout; on timeout → assume worker dead, respawn from snapshot
    - Play mode is interactive — no special handling; if backgrounded mid-Play, on resume the move arrives whenever Stockfish was unsuspended
12. **Failure modes (consumer-visible errors):**
    - `EngineUnavailableError`: WASM blocked by CSP, network failure during asset fetch, or `WebAssembly` undefined
    - `EngineTimeoutError`: handshake timeout, no `bestmove` within `2 × movetimeMs` safety window
    - `CanceledError`: `AbortSignal` triggered or superseded by newer request
    - On `EngineUnavailableError`: app degrades to "two-human local play"; Review is unavailable
13. **No telemetry to external services in v0.** Local-only stats (NPS, depth-reached per device class) written to `localStorage` for future tuning.

### States and Transitions

Each engine instance has its own state machine:

| State | Description | Valid input | Transitions |
|-------|-------------|-------------|-------------|
| **UNINITIALIZED** | Wrapper created, worker not yet spawned | `init()` | → LOADING |
| **LOADING** | Worker spawned, WASM downloading + instantiating | None | → HANDSHAKING (instantiate complete) / CRASHED (network/CSP/timeout) |
| **HANDSHAKING** | UCI handshake in progress (`uci` → `uciok` → `setoption` → `isready` → `readyok`) | `analyze()` (deferred — held internally until IDLE is reached, then starts normally) | → IDLE (handshake complete; deferred analyze proceeds if pending) / CRASHED (timeout) |
| **IDLE** | Engine ready; no analysis in flight | `analyze()`, `dispose()` | → THINKING (analyze called) / IDLE_TERMINATED (30s idle timer fires) / DISPOSED (dispose() called) |
| **THINKING** | `go` sent, awaiting `bestmove`; `info` lines flow | `AbortSignal`, second `analyze()` (auto-cancels first) | → STOPPING (cancel requested) / IDLE (`bestmove` arrives) |
| **STOPPING** | `stop` sent, draining `info` lines, awaiting `bestmove` | None (queued analyze pending) | → IDLE (`bestmove` arrives; current request rejected as CanceledError) |
| **CRASHED** | Worker terminated (error, OOM, timeout); cannot recover without respawn | `init()` (respawn) | → LOADING |
| **DISPOSED** | Worker terminated via explicit `dispose()` call; wrapper permanently unusable | None (`analyze()` rejects synchronously with `EngineDisposedError`) | (terminal) |
| **IDLE_TERMINATED** | Worker terminated by 30s idle timer (Review Mode only); wrapper auto-respawnable | `analyze()`, `init()` | → LOADING (respawn triggered automatically) |

**Notes:**
- Concurrent `analyze()` calls are not queued: each call cancels and replaces the previous one.
- `ucinewgame` is sent before a `position` from an unrelated game (Play between games, Review when starting a new game's analysis); not sent between adjacent positions in the same Review session. The wrapper detects "a new game" via a `gameId` passed by the caller (the review session's `gameId`) — callers never send `ucinewgame` manually; the wrapper emits it on first analysis of a `gameId` it has not seen, which prevents transposition-table state from leaking between consecutive games' reviews.
- Worker may transition to CRASHED at any state on worker `error` / `messageerror` / 30s heartbeat timeout.
- **DISPOSED vs. IDLE_TERMINATED are distinct states with opposite respawn behaviour.** IDLE_TERMINATED is entered only by the 30s idle timer (Review worker only); calling `analyze()` from IDLE_TERMINATED triggers automatic respawn (LOADING → HANDSHAKING → IDLE). DISPOSED is entered only by an explicit `dispose()` call; calling `analyze()` from DISPOSED rejects synchronously with `EngineDisposedError` and does NOT respawn. Implementation must track the reason for worker termination to select the correct path.

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Game Lifecycle** | IN ← | Calls `playEngine.play({ fen, skillLevel, movetimeMs })` when it's AI's turn |
| **Game Lifecycle** | OUT → | Returns `Promise<PlayResult>` with `bestMove` (UCI long algebraic) |
| **Post-Game Review** | IN ← | Calls `reviewEngine.analyze({ fen, targetDepth, movetimeMs })` per position in completed game (sequential loop) |
| **Post-Game Review** | OUT → | Returns `Promise<ReviewResult>` per position; optional `onProgress` callback for UI |
| **Difficulty System** (MVP) | IN ← | Provides skill level (0-20) and time budget per difficulty preset; passed through to `playEngine.play()` |
| **Audio System** (future, Polish) | OUT → | Emits `engine-thinking-started` / `engine-thinking-finished` events for optional "thinking" ambient cue |

**Cross-system notes** (not owned by this system but documented for downstream GDDs):
- **Player per-move thinking time tracking** is Game Lifecycle's job (it knows when the player started thinking and when they moved); Post-Game Review aggregates it for progress trends. Chess Engine has no visibility into player time.
- **Move-quality display** is Post-Game Review's job, not this system's: it renders the raw `evalCp` / `evalMate` delta as a neutral pawn-swing number (no "inaccuracy / mistake / blunder" classification ladder — that was removed in Post-Game Review's round-2 review). This system only returns the raw `evalCp` / `evalMate` delta between played move and bestmove.
- **Opening detection** is Opening Identification's job using `chess-openings` database, not this system.

## Formulas

This system has four design-level formulas — three timing/throttle predicates and one memory budget constraint. Stockfish-internal evaluation math (`evalCp`, NNUE inference, search tree) is **not** owned by this GDD.

### Formula 1: Engine error timeout

`errorTimeoutMs = movetimeMs × timeoutMultiplier`

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| `movetimeMs` | int | 3000–10000 | Per-request time budget (Play: 6000 default; Review: 10000 default) |
| `timeoutMultiplier` | float | 1.5–3.0 | Safety factor. Default `2.0`. Lower = faster crash detection but more false positives on slow devices |
| `errorTimeoutMs` | int | 4500–30000 | Wrapper declares `EngineTimeoutError` if no `bestmove` arrives within this window |

**Output range:** 4.5s to 30s under normal play.
**Example:** Review with `movetimeMs=10000`, multiplier 2.0 → timeout fires at 20s. Stockfish should have returned by 10-11s in practice; 20s is a "definitely dead" threshold, not a "running slowly" threshold.

### Formula 2: Info-line forward cadence (worker-side throttle)

`shouldForward = (currentDepth > lastForwardedDepth) OR (now - lastForwardTs ≥ throttleMs)`

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| `currentDepth` | int | 1–40+ | Depth on the most recent `info` line |
| `lastForwardedDepth` | int | 0–40+ | Depth of the most recent forwarded message |
| `now` | int (ms) | — | Current timestamp |
| `lastForwardTs` | int (ms) | — | Timestamp of last forwarded message |
| `throttleMs` | int | 100–500 | Minimum interval between forced forwards. Default `200` (≈12 frames at 60fps — leaves UI breathing room) |

**Output:** boolean. If `true`, post one `info` to main thread; update `lastForwardedDepth` and `lastForwardTs`.
**Example:** Deep search emits 300 info lines in 1 second across depths 18→24. Without throttle: 300 postMessages. With this formula: ~7 forwards (one per depth jump + at-most-one per 200ms gap).

### Formula 3: Visibility liveness check (two-formula pair)

`shouldPingIsReady = (now - lastHeartbeatTs) ≥ backgroundThresholdMs`

`workerIsDead = (now - pingSentTs) ≥ readyTimeoutMs AND !readyokReceived`

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| `lastHeartbeatTs` | int (ms) | — | Timestamp of the last successful worker round-trip |
| `backgroundThresholdMs` | int | 30000–120000 | How long the tab can be hidden before we distrust the worker. Default `60000` |
| `pingSentTs` | int (ms) | — | When `isready` was sent on visibilitychange resume |
| `readyTimeoutMs` | int | 500–2000 | How long to wait for `readyok` before declaring worker dead. Default `1000` |

**Output:** booleans. `shouldPingIsReady=true` triggers a probe; `workerIsDead=true` triggers respawn from snapshot.
**Example:** User locks phone for 90s during Review. On unlock, 90s > 60s → ping sent. If `readyok` arrives in 300ms → worker alive, resume. If 1000ms passes silently → worker dead, respawn.

The **60:1 ratio** (tolerance:response) is intentional: tolerate long backgrounding (mobile reality), but once we doubt, fail fast.

### Formula 4: Concurrent engine memory budget

`peakMemoryMB = playEngineMB + (reviewLoaded ? reviewEngineMB : 0) + appOverheadMB`

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| `playEngineMB` | float | 15–30 | Play worker resident memory (HCE build + 16MB hash + JS heap). Estimate: ~25 |
| `reviewEngineMB` | float | 70–90 | Review worker resident memory (NNUE weights ~40MB + 32MB hash + JS heap). Estimate: ~80 |
| `reviewLoaded` | bool | — | True after first Review invocation, false after 30s idle terminates the worker |
| `appOverheadMB` | float | 30–50 | Vue + Pinia + chessground + app JS heap. Estimate: ~40 |
| `peakMemoryMB` | float | 55–170 | Total resident |

**Output range and behavior at extremes:**
- Play-only (Review not yet invoked): `25 + 0 + 40 = 65MB` — safe on all devices
- Play + Review active: `25 + 80 + 40 = 145MB` — within the project's 150MB ceiling, **but very close to iPhone Safari's per-tab kill zone (~200-280MB) once other browser overhead is counted**
- Worst case (both loaded, NNUE weights doubly resident during init): `25 + 80 + 40 = 145MB + transient 40MB = 185MB` — Jetsam risk on 3GB iPhones (SE2, mini)

**Why this is in Formulas and not Tuning Knobs:** Each variable is *measured* not *configured*. The formula's value is enforcing the design constraint: **Review worker MUST be lazy-loaded and MUST terminate when idle** — without those rules, `peakMemoryMB` exceeds the 150MB ceiling.

**Example:** During post-game review, Play is idle but worker stays alive: `25 + 80 + 40 = 145MB`. Player closes review and returns to results screen for 30+s: Review worker terminates → `25 + 0 + 40 = 65MB`. This formula is why Core Rule 1 says "terminated after 30s idle."

## Edge Cases

**Engine bootstrap edge cases:**
- **If `WebAssembly` is undefined** (locked-down enterprise browser, very old iOS): feature-detect at boot → `EngineUnavailableError`; app degrades to "two-human local play" mode (Review unavailable, Play replaced by manual second-player input).
- **If WASM download fails or times out** (network drop, 5xx, CSP block): retry once with exponential backoff (1s, 3s); on second failure, raise `EngineUnavailableError`. Do not retry beyond 2 attempts.
- **If `uciok` never arrives within 5s of sending `uci`**: terminate worker → CRASHED → surface `EngineUnavailableError`.
- **If `readyok` never arrives within 2s of sending `isready`**: same as above.
- **If Stockfish emits non-UCI debug lines on init** (e.g., `"Stockfish 16 by..."`): parser must skip lines not starting with a recognized UCI keyword (`uciok`, `readyok`, `bestmove`, `info`, `option`, `id`, `info string`).
- **If cached WASM is stale after build deploy** (cryptic `WebAssembly.LinkError` from N/N+1 mismatch): version-stamp Service Worker cache key with WASM file hash; on `LinkError` during init, purge cache entry and retry once.
- **If cache write was partial** (SW killed mid-`cache.put()`, `WebAssembly.CompileError`): validate cached blob length against `Content-Length` before serving; on mismatch, purge and refetch.
- **If `cache.put()` fails with `QuotaExceededError`** (iOS Safari ~50MB per-origin in some configs, NNUE is ~40MB): catch quota error, fall back to in-memory fetch (no caching), log telemetry; do not block Review mode.

**API contract / invariant edge cases:**
- **If `analyze()` is called with neither `movetimeMs` nor `targetDepth`**: reject synchronously — never emit bare `go` (would become `go infinite` and hang).
- **If `movetimeMs` > internal `errorTimeoutMs`**: enforce invariant `errorTimeoutMs ≥ 1.5 × movetimeMs` at request construction; throw on violation.
- **If FEN is malformed**: canonicalize via `chess.js.load(fen).fen()` in the wrapper before sending `position fen`; if `chess.js` itself rejects, raise `EngineUnavailableError` (programmer bug, surface loudly). Never trust caller-provided FEN string.

**Concurrent call edge cases:**
- **If `analyze()` is called while engine is THINKING**: cancel the in-flight request (its promise rejects with `CanceledError`), wait for state to return to IDLE, then start the new request. Never queue.
- **If `analyze()` is called while engine is HANDSHAKING**: wait for handshake to complete via internal `ready` promise, then start the request. Caller does not need to await `init()` separately.
- **If `analyze()` is called while engine is CRASHED**: trigger respawn (LOADING → HANDSHAKING → IDLE), then start the request. Caller sees a one-time longer latency but the call succeeds.
- **If first call to Play and Review init simultaneously**: serialize first-time WASM fetch via shared `Promise<ArrayBuffer>` cache keyed by URL — avoid double network cost.

**Cancellation edge cases:**
- **If `AbortSignal` fires before `go` is even sent**: do not send `go`; immediately reject with `CanceledError`.
- **If `AbortSignal` fires while in STOPPING state** (already canceling): no-op; the existing cancellation completes normally.
- **If Stockfish never sends `bestmove` after `stop`** (engine deadlock): apply Formula 1's `errorTimeoutMs` — after `2 × movetimeMs` since `go`, force `worker.terminate()`, mark CRASHED, reject all pending promises.

**Race condition edge cases:**
- **If `bestmove` arrives with a stale `requestId`** (request already superseded): drop silently. Do not invoke any callback, do not log error.
- **If consumer changes position via new `analyze()` but the previous Stockfish thread completes naturally first**: same as above — `requestId` mismatch causes silent drop.
- **If two `bestmove` lines arrive for the same `requestId`** (Stockfish bug or duplicate handler): accept the first, ignore subsequent.

**Mobile / iOS Safari edge cases:**
- **If tab is hidden mid-Review for >60s**: on `visible`, apply Formula 3 — ping `isready`; if `readyok` doesn't arrive within 1s, assume worker dead, respawn from snapshot `{ fen, lastForwardedDepth, requestId }`, restart analysis on the same position.
- **If `visibilitychange` returns `visible` before the 60s timer fires**: clear the pending liveness timer (don't fire stale ping after user already returned).
- **If PWA standalone mode emits `pagehide` instead of `visibilitychange` on screen lock**: listen to both `visibilitychange` and `pagehide`/`pageshow`; treat `pagehide` with `persisted=true` as hidden.
- **If PWA cold-start after iOS purge** (worker dead, JS object retained, `postMessage` silent no-op): on app foreground, always send `isready` probe before next `analyze()`; respawn on timeout.
- **If iOS Safari OOM-kills the tab during Review**: page reload from scratch — this is outside this system's recovery scope. Game Lifecycle should persist Review-in-progress state (which game, which position) so the user can resume.
- **If `worker.postMessage` is called on a terminated worker** (silent no-op on iOS): wrapper must track liveness independently — on next `analyze()` call, detect via heartbeat ping before sending UCI commands.
- **If iOS Low Power Mode is active** (CPU throttled ~50%): no explicit detection; Formula 1's 2× safety margin should absorb the slowdown. If consistent timeout failures occur, surface telemetry to localStorage for future tuning.

**UCI parser edge cases:**
- **If Stockfish emits `info string ...` lines** (init warnings or post-`go` notices like `"NNUE evaluation using ..."`): parser short-circuits on `info string` prefix and discards (do not try to extract depth/cp).
- **If `info` line has no `pv` field** (early shallow lines like `info depth 1 ... score cp 23 nodes 20 time 1` with no `pv`): tolerate missing `pv`; do not emit a "current best move" update for pv-less infos.
- **If `bestmove` line includes a `ponder` field anyway** (some builds emit even with Ponder=false): regex must be `/^bestmove (\S+)(?: ponder \S+)?$/`.
- **If stdout chunk arrives mid-line** (`onmessage` delivers a partial UCI line, e.g., `info depth 12 score c` followed by `p 45 pv e2e4\n` in next message): worker-side line buffer must accumulate until `\n`; never parse partial.
- **If stdout chunk contains multiple lines** (multiple `info` + `bestmove` in one `onmessage` payload): split on `\n`, iterate; do not assume one message = one UCI line.

**Position / eval edge cases:**
- **If position is checkmate or stalemate** (no legal moves): Stockfish responds with `bestmove (none)` or `bestmove 0000`. Parser recognizes this; return `{ bestMove: null, evalMate: 0 }` rather than treating as error.
- **If `position` command is missing before `go`**: protocol enforces this in the wrapper — `analyze()` always sends `position` before `go`.
- **If Stockfish returns `bestmove 0000` from a non-mate/stalemate position** (Skill Level 0 quirk: intentional resign on losing positions): surface as `{ kind: 'resign' }` distinct from `{ kind: 'gameOver' }`. Consumer decides whether to accept resign or force a move (e.g., Difficulty System may override).
- **If Stockfish returns a mate score** (`info ... score mate N`): emit raw `evalMate` with engine's sign convention (**positive = side-to-move wins, negative = side-to-move is being mated**). Display layer flips sign if rendering from White's perspective.
- **If Stockfish returns no eval at very low depth** (rare, e.g., interrupted before any depth completed): return `{ bestMove, evalCp: undefined, evalMate: undefined, depthReached: 0 }`. Consumer should display "—" rather than "0".
- **If `multipv: 3` is requested on a position with only 1 legal move**: parser must not block waiting for `multipv 2` and `multipv 3` — finalize on `bestmove`.

**Repetition / draw edge cases:**
- **If position is a threefold-repetition draw but caller sends FEN only**: Stockfish doesn't see history → plays into a draw it doesn't recognize. Wrapper accepts optional `moveHistory: string[]` and emits `position fen <fen> moves <uci-list>` when provided. Without history, this limitation is documented and accepted.
- **If 50-move counter inside FEN is high but depth is low**: do not assume `evalCp=0` means draw; surface raw cp/mate only, let UI layer interpret halfmove clock.

**Worker lifecycle edge cases:**
- **If `dispose()` is called while THINKING**: send `stop`, wait up to 500ms for `bestmove` (graceful), then `worker.terminate()` regardless. Pending promise rejects with `CanceledError`.
- **If two consecutive `init()` calls** (caller bug): second call is a no-op if state is LOADING / HANDSHAKING / IDLE; respawns if CRASHED / DISPOSED.
- **If `messageerror` event fires** (structured-clone failure on postMessage payload): log + drop the message but do not transition to CRASHED. Distinct from `error` (worker script threw) which → CRASHED.

**Future / non-v0 concerns (documented, not blocking v0):**
- **Two browser tabs of the same app open** → 4 workers = ~210MB across tabs, double NNUE network cost. Phase 2: `BroadcastChannel` or `navigator.locks` to serialize NNUE warm-up. v0: document and accept.
- **HMR worker leaks during dev** → register `import.meta.hot.dispose(() => engine.dispose())` in the engine module. Dev-time only.
- **`multipv` runtime change** (currently MultiPV=1; future =3 for lesson features): UCI spec requires `setoption` between `go` calls only — enforce IDLE-only when feature lands.
- **`multipv` lines arriving interleaved across depths**: when MultiPV=3 ships, parser keys lines by `(depth, multipv)` tuple; on `bestmove`, emit max-depth complete set, not the latest line.
- **Locale-dependent number parsing**: Stockfish emits `.` only; all engine-emitted numbers use `Number()` not locale parsers. Display layer uses `toLocaleString` only at render edge.

## Dependencies

### Upstream dependencies (this system depends on)

**None.** This is a Foundation-layer system with no internal dependencies.

### External dependencies (third-party libraries)

| Dependency | Version | Purpose | Replaceable? |
|------------|---------|---------|--------------|
| `stockfish` (HCE build) | lichess fork, stockfish 16+ | Play Mode engine — ~1-2MB single-threaded WASM | Yes — could swap for nmrugg/stockfish.js or self-built; minimal API surface change |
| `stockfish-nnue-16.wasm` | lichess fork | Review Mode engine — ~40MB NNUE network + ~1-2MB glue | Yes — could swap for different NNUE network or non-NNUE deeper search; would change memory budget |
| `chess.js` | (bundled with vue3-chessboard) | FEN validation and canonicalization before sending to UCI | Yes — could swap for chessops, but Chess Board GDD already standardizes on chess.js |

> **Pinning decision**: Stockfish builds must be pinned to a specific version (e.g., `stockfish-16.1`). Behavior across major versions can shift (skill level calibration, NNUE format changes, UCI option naming). An ADR is required before v0 implementation to lock the build and document the source URL.

### Downstream dependents (systems that depend on this)

| System | What they need from us | Interface |
|--------|----------------------|-----------|
| **Game Lifecycle** | AI's move during opponent turn | `playEngine.play({ fen, skillLevel, movetimeMs }) → Promise<PlayResult>` |
| **Post-Game Review** | Per-position evaluation for completed game | `reviewEngine.analyze({ fen, targetDepth, movetimeMs }, onProgress?) → Promise<ReviewResult>` (caller loops over all positions) |
| **Difficulty System** (MVP) | Skill level + time budget per difficulty preset | Passes `skillLevel` and `movetimeMs` through Game Lifecycle to `playEngine.play()` |
| **Audio System** (future, Polish) | Optional "thinking" ambient cue | Emits `engine-thinking-started` / `engine-thinking-finished` events |

### Bidirectional consistency notes

- When **Game Lifecycle** GDD is authored, it must declare calling `playEngine.play()` with `{ fen, skillLevel, movetimeMs }` and consuming `Promise<PlayResult>` with UCI long algebraic `bestMove`
- When **Post-Game Review** GDD is authored, it must declare:
  - Looping `reviewEngine.analyze()` sequentially over completed-game positions
  - Owning the move-quality display logic (`evalCp` delta → a neutral pawn-swing number; no classification ladder)
  - Persisting Review-in-progress state for resume after iOS tab kill
- When **Difficulty System** GDD is authored, it must declare:
  - Skill-level-to-difficulty mapping (Engine GDD accepts only raw 0-20)
  - Handling Skill Level 0 quirk (`bestmove 0000` as resign signal)

### Soft dependencies (enhanced by but not required)

- **Audio System** (future, Polish tier): If present, consumes `engine-thinking-*` events. This system functions silently if Audio System is absent.
- **Service Worker / PWA Support** (future, Polish tier): If present, caches WASM + NNUE assets for instant subsequent boots. If absent, every cold load re-downloads (~40MB on 4G).

## Tuning Knobs

| Knob | Default | Safe Range | What breaks if too high | What breaks if too low |
|------|---------|-----------|------------------------|----------------------|
| `playMaxMoveTimeMs` | 6000 | 3000–8000 | Player waits too long for AI; "thinking" feels excessive | AI plays too shallowly; weak moves even at high skill level |
| `reviewTargetDepth` | 22 | 14–25 | Per-position analysis exceeds 10s budget; total review time balloons | Move classification loses accuracy; subtle inaccuracies missed |
| `reviewMaxMoveTimeMs` | 10000 | 5000–15000 | Single position blocks review queue; tab kill risk on iPhone | Deep tactical positions not fully resolved; eval unreliable |
| `playEngineHashMb` | 16 | 8–32 | Play worker resident memory grows; pressure on memory budget | Play search loses transposition table benefit; weaker moves at fixed skill |
| `reviewEngineHashMb` | 32 | 16–64 | Review worker memory pressure; iPhone OOM risk | Review re-explores same positions across game; slower total |
| `errorTimeoutMultiplier` | 2.0 | 1.5–3.0 | Dead engines linger; user stares at spinner | False-positive timeouts on slow devices (iPhone SE2 / Low Power Mode) |
| `infoLineThrottleMs` | 200 | 100–500 | UI updates feel choppy or stale (>12 frames between updates) | postMessage flood; main thread drops frames below 60fps |
| `reviewIdleTerminateMs` | 30000 | 10000–120000 | Memory held longer than needed; Play feels sluggish if Review re-summoned right after | Review worker churn: terminated then immediately respawned, full handshake cost |
| `backgroundThresholdMs` | 60000 | 30000–120000 | False trust in suspended worker after long background; respawn happens too late | Premature ping/respawn on brief tab switches; unnecessary handshake |
| `readyTimeoutMs` | 1000 | 500–2000 | Slow respawn detection; user sees lingering spinner | False-positive respawn on slow devices; loses in-flight progress |
| `wasmFetchRetryCount` | 1 | 0–3 | Long boot delay on flaky network; user thinks app broken | Single-failure abandons too quickly on transient hiccups |
| `wasmFetchRetryBackoffMs` | [1000, 3000] | 500–10000 per step | Total retry window exceeds patience | Retries hammer failed network too fast |

### Interaction notes

- **`playMaxMoveTimeMs` ↔ Player Fantasy "thoughtful opponent"**: too low (≤3s) breaks the "considering" feeling; too high (≥8s) breaks "no pressure" by inverting frustration onto the player. The 5-8s sweet spot was set by user playtest tolerance.
- **`reviewTargetDepth` ↔ `reviewMaxMoveTimeMs`**: Stockfish honors whichever hits first. On a fast desktop, depth 22 completes in 2-3s; on iPhone, the same depth may exceed 10s, so movetime caps protect the queue. **Do not raise depth without also raising movetime** (would silently degrade to time-capped shallow search).
- **`playEngineHashMb` + `reviewEngineHashMb` feed Formula 4 (memory budget)**: combined hash > 100MB pushes `peakMemoryMB` past the 150MB ceiling. Tune together, not independently.
- **`errorTimeoutMultiplier` ≥ 1.5 is a hard invariant** (enforced in Edge Cases): lower values guarantee false-positive timeouts. Below 1.5 = bug.
- **`reviewIdleTerminateMs` ↔ Player Fantasy "compass reading"**: terminate too aggressively and the second Review of the session pays full handshake cost (jarring); keep too long and Review memory squats during Play (Formula 4 penalty). 30s is a compromise — long enough to handle "view review, look at board, return to review" but short enough to free memory before next game.
- **`backgroundThresholdMs` : `readyTimeoutMs` ratio (default 60:1)** is intentional — see Formula 3 commentary. Adjusting one without considering the ratio invites stale-worker bugs.

### Source of truth

These values live in a TypeScript config file (e.g., `src/config/engine-tuning.ts`) as named exports. Difficulty System (MVP) consumes `playMaxMoveTimeMs` per difficulty preset; Settings (Polish) does not expose these to end users (they're system-level, not preference-level).

## Visual/Audio Requirements

**N/A** — This system has no direct visual or audio output.

- Visual feedback during AI "thinking" (spinner, dimmed board, status text) is owned by **Game Lifecycle** (Play Mode) and **Post-Game Review** (Review Mode). Those GDDs reference this system's `engine-thinking-started` / `engine-thinking-finished` events.
- Audio cues for engine activity (optional "thinking" ambient) are owned by **Audio System** (Polish tier), gated on the same engine events.
- This system does not emit any UI primitive, sound, or animation directly.

## UI Requirements

**N/A** — This system has no UI surface.

- AI thinking indicator, Review progress bar, and result rendering are all owned by their consuming systems (Game Lifecycle, Post-Game Review). Those systems consult `/ux-design` in Pre-Production.
- This system exposes only a TypeScript API (`playEngine.play()`, `reviewEngine.analyze()`) and event emitters; no DOM, no Vue components, no CSS.

## Acceptance Criteria

### Engine bootstrap

- **GIVEN** a fresh app load, **WHEN** `playEngine.init()` is called, **THEN** the engine reaches IDLE within 2s on desktop Chromium (Vitest with mocked worker).
- **GIVEN** `WebAssembly` is unavailable (test stub), **WHEN** `playEngine.init()` is called, **THEN** `init()` rejects with `EngineUnavailableError` AND state transitions to CRASHED.
- **GIVEN** WASM download fails with 500, **WHEN** `playEngine.init()` is called, **THEN** retry occurs after 1s ± 200ms backoff (verified via `vi.useFakeTimers`), then rejects with `EngineUnavailableError` after second failure (mocked `fetch` surface).
- **GIVEN** Stockfish emits non-UCI banner lines on init (e.g., `"Stockfish 16 by..."`), **WHEN** handshake runs, **THEN** parser does not throw AND reaches `uciok` → `readyok` → IDLE normally.
- **GIVEN** handshake hangs (no `uciok` within 5s timeout, test stub), **WHEN** `init()` is called, **THEN** rejects with `EngineUnavailableError` (handshake variant) AND state → CRASHED at the 5s mark ± 200ms.

### Play mode

- **GIVEN** engine in IDLE, **WHEN** `play({fen: startpos, skillLevel: 5, movetimeMs: 1000})` is called, **THEN** promise resolves within 1500ms with `{ bestMove: valid-UCI }` (validated via `chess.js`).
- **GIVEN** engine in IDLE, **WHEN** `play()` is called without `movetimeMs`, **THEN** promise rejects synchronously with a contract violation error AND `worker.postMessage` spy shows zero `go` commands emitted.
- **GIVEN** engine in IDLE, **WHEN** `play()` is called twice within the same microtask (before first promise settles), **THEN** the first promise rejects with `CanceledError` AND the second resolves with valid move.
- **GIVEN** an already-aborted `AbortSignal`, **WHEN** `play({signal})` is called, **THEN** rejects synchronously with `CanceledError` AND no UCI `go` is emitted.
- **GIVEN** engine in THINKING with active `AbortSignal`, **WHEN** signal fires, **THEN** UCI `stop` is sent within 50ms AND promise rejects with `CanceledError` AND state transitions THINKING → STOPPING → IDLE (verified via state observer).
- **GIVEN** `play({skillLevel: 0})` vs `play({skillLevel: 20})` on a fixed mid-game position, **WHEN** each is sampled 10 times against a fixed reference best-move, **THEN** centipawn loss differential (skill 0 vs skill 20) ≥ 100cp on average — proves skill level parameter has behavioral effect (statistical Integration test).

### Review mode

- **GIVEN** `reviewEngine` in IDLE, **WHEN** `analyze({fen: startpos, targetDepth: 10, movetimeMs: 2000})` is called, **THEN** promise resolves within 2500ms with `{ bestMove, evalCp, depthReached ≥ 10, pv: non-empty array }`.
- **GIVEN** `reviewEngine` analyzing, **WHEN** `onProgress` callback is provided, **THEN** for every distinct depth value D observed in `info` lines, `onProgress` is invoked with `depth=D` at least once.
- **GIVEN** `reviewEngine` has been IDLE for 30s (`vi.useFakeTimers` advance), **WHEN** no further `analyze()` calls have happened, **THEN** `Worker.prototype.terminate` spy was invoked exactly once AND state is DISPOSED.
- **GIVEN** `reviewEngine` is DISPOSED due to idle timeout, **WHEN** `analyze()` is called, **THEN** engine respawns through LOAD → HANDSHAKE → IDLE → THINKING (full sequence verified via state observer) AND completes the request.

### Formula verification

- **GIVEN** `play({movetimeMs: 6000})` and the worker never emits `bestmove` (test stub), **WHEN** 12000ms elapse, **THEN** promise rejects with `EngineTimeoutError` at 12000ms ± 200ms (Formula 1: `errorTimeoutMs = 2 × movetimeMs`).
- **GIVEN** `reviewEngine` emits `info` lines at 10ms intervals from the worker (test stub), **WHEN** `onProgress` is observed for 1 second, **THEN** call count is between 5 and 7 (Formula 2: ~one call per 200ms `infoLineThrottleMs` window, plus depth-increase forwards).
- **GIVEN** both `playEngine` and `reviewEngine` are active after one full play+analyze cycle on Chromium with COOP/COEP headers, **WHEN** `performance.measureUserAgentSpecificMemory()` is sampled 3 times 1s apart and averaged, **THEN** mean ≤ 170MB. Marked `@flaky-tolerant` with 3 retry policy (Formula 4 verification; ADVISORY in CI, BLOCKING in pre-merge gate).
- **GIVEN** `reviewEngine` THINKING with memory sampled at t=0, **WHEN** engine idle-terminates at t=30s, **THEN** post-termination sample (t=30+1s) shows ≥ 60MB reduction from t=0.

### Cancellation and races

- **GIVEN** engine in THINKING, **WHEN** `stop` is requested via wrapper, **THEN** UCI `stop` is sent AND `bestmove` arrives AND promise rejects with `CanceledError` AND no `bestMove` value leaks to caller (callback spy zero-call).
- **GIVEN** a stale `bestmove` arrives (requestId mismatch from test stub), **WHEN** parser processes it, **THEN** no callback fires AND `logger.error` spy is zero-call AND no unhandled promise rejection occurs.
- **GIVEN** `playEngine` THINKING AND `reviewEngine` THINKING concurrently, **WHEN** both complete naturally, **THEN** each resolves with its own valid `bestMove` AND no cross-routing of `info` lines or `bestmove` between callers (verified via per-engine spies).

### Visibility / mobile

- **GIVEN** engine in THINKING, **WHEN** `document.visibilitychange` fires `hidden=true` then `visible=true` 65s later, **THEN** `isready` ping is sent on resume (Formula 3 part 1).
- **GIVEN** the above setup AND `readyok` does NOT arrive within 1s, **WHEN** the 1s timeout fires, **THEN** worker respawn is triggered (`worker.terminate` + new spawn) AND analysis resumes from snapshot FEN (Formula 3 part 2).
- **GIVEN** tab returns to `visible` within 30s of hiding, **WHEN** `visibilitychange` fires, **THEN** no `isready` ping is sent (spy on `postMessage('isready')` zero-call; timer cleared).

### State machine invariants

- **GIVEN** engine in state in {LOADING, HANDSHAKING, IDLE, THINKING, STOPPING, CRASHED}, **WHEN** `dispose()` is called, **THEN** `worker.terminate()` happens within 500ms AND state transitions to DISPOSED (table-driven across each enumerated state).
- **GIVEN** engine in DISPOSED via explicit `dispose()` (not idle-termination), **WHEN** `analyze()` is called, **THEN** rejects synchronously with `EngineDisposedError` AND does NOT respawn (contrasts with idle-DISPOSED behavior in earlier AC).
- **GIVEN** worker emits an `error` event (simulated via test stub), **WHEN** the wrapper observes it, **THEN** state transitions to CRASHED AND any in-flight promise rejects with `EngineUnavailableError`.
- **GIVEN** worker emits a `messageerror` event, **WHEN** the wrapper observes it, **THEN** the offending message is dropped AND state stays in current state (no CRASHED transition).

### Performance (CI)

- **GIVEN** `play({movetimeMs: 6000})` on Chromium with `Emulation.setCPUThrottlingRate({rate: 4})` (Playwright), **WHEN** measured 5 times, **THEN** every run's `bestmove` arrives within [5500, 7500]ms (engine respects time budget ±500ms).
- **GIVEN** `reviewEngine` analyzing on Chromium with 4× CPU throttle, **WHEN** in-page `performance.getEntriesByType('longtask')` is collected over a 10s analysis window, **THEN** zero longtasks > 50ms AND total longtask count ≤ 10 (no flood-induced jank).

### Pillar enforcement (structural)

- **GIVEN** the public TypeScript types `PlayResult` and `ReviewResult`, **WHEN** the type definitions are statically inspected (TypeScript compiler check or `expect-type` assertion), **THEN** `PlayResult` contains ONLY the fields `bestMove`, `kind?`, `evalCp?`, `evalMate?`, `depthReached`, `pv`, `ponder?` (where `kind?: 'move' | 'resign' | 'gameOver'` is a structural discriminant for the Skill Level 0 resign edge case — not an evaluative label); and `ReviewResult` contains ONLY `bestMove`, `evalCp?`, `evalMate?`, `depthReached`, `pv` — and explicitly NOT any of: `quality`, `label`, `judgment`, `rating`, `classification`, `brilliant`, `blunder`, `mistake`, or any emotive/evaluative field name. (Anchors Pillar 3 "No Pressure" and Player Fantasy "compass not grade" into the type system; move classification belongs to Post-Game Review GDD, not this system's API surface.)

### Real-device evidence (ADVISORY)

- **GIVEN** `play({movetimeMs: 6000})` on real iPhone Safari 16+ on real 4G, **WHEN** measured manually, **THEN** documented in `production/qa/evidence/` that AI move arrives within [5.5, 8]s (Visual/Feel evidence, not blocking CI).
- **GIVEN** `reviewEngine` analyzing fixture game `production/qa/fixtures/40-move-test.pgn` on real iPhone Safari 16+, **WHEN** total wall time is measured, **THEN** documented as ≤ 8 minutes (Visual/Feel, ADVISORY).

## Open Questions

### Design questions

1. **Skill-level-to-difficulty mapping**: This GDD only accepts raw UCI `skillLevel: 0-20`. The mapping from human-facing difficulty tiers ("Beginner / Intermediate / Advanced") to skill levels — and the handling of Skill Level 0's intentional-resign quirk — is owned by the future **Difficulty System GDD** (MVP tier). **Owner**: Difficulty System GDD author. **Resolution**: Before MVP implementation.
2. **Move-quality display**: This GDD returns raw `evalCp` deltas. Post-Game Review (now designed, round-2 approved) renders these as a neutral pawn-swing number and uses cpLoss magnitude only to rank the single biggest-swing moment — it does **not** define "inaccuracy / mistake / blunder" label thresholds (that ladder was removed in round-2). **RESOLVED** — no classification threshold table is needed.
3. **MultiPV=3 timing**: Phase 1 ships MultiPV=1. Phase 2 lesson features (which surface alternative top-3 lines) will need MultiPV=3. **Owner**: Phase 2 ADR + Post-Game Review v2. **Resolution**: When Phase 2 lesson system is scoped. Not blocking v0.
4. **Threefold-repetition move history**: This GDD documents that without `moveHistory`, Stockfish cannot detect threefold repetition. Whether downstream consumers (Game Lifecycle, Post-Game Review) always send history is their decision. **Owner**: Game Lifecycle + Post-Game Review GDDs. **Resolution**: Before v0 implementation of those systems.

### Technical questions

5. **Stockfish build version pinning**: ADR required to lock the exact Stockfish version (e.g., 16.1) and its source URL (lichess fork vs nmrugg vs self-built). Behavior across major versions can drift (skill calibration, UCI option naming, NNUE format). **Owner**: technical-director + ui-programmer. **Resolution**: Before v0 implementation begins. **Blocking**: yes (without a pinned version, AC 11 — skill level differential test — cannot have a reproducible baseline).
6. **HCE build availability**: Locked design says Play uses HCE (no NNUE), Review uses NNUE. **Both builds from the lichess fork must be confirmed available** as separate distributions. If only NNUE is distributed, fallback options: (a) use vanilla Stockfish HCE compile, (b) accept NNUE for Play too and revise Formula 4. **Owner**: ui-programmer. **Resolution**: Before v0 implementation — verify with a 1-day spike.
7. **iPhone Safari real-device performance baseline**: Tuning defaults (`reviewTargetDepth=22`, `reviewMaxMoveTimeMs=10000`) are educated guesses for iPhone. Real measurement on iPhone SE2 / 12 / 14 needed to confirm full-game review stays under 8 minutes (AC 30, ADVISORY). **Owner**: gameplay-programmer + Eason. **Resolution**: Prototype iPhone before Post-Game Review GDD is finalized. **Note**: This is also Open Question #4 in the Chess Board GDD — same prototype task resolves both.
8. **Service Worker / WASM caching strategy**: This GDD assumes Cache Storage for `~40MB NNUE` weights. iOS Safari's per-origin storage limits (~50MB in some configs per Edge Case M5) may force a fallback. **Owner**: PWA Support GDD (Polish tier) + ui-programmer. **Resolution**: Before NNUE assets ship — verify quota on real device + add `QuotaExceededError` fallback path.
9. **COOP/COEP decision finality**: Single-threaded NNUE was chosen for GitHub Pages deployment simplicity. If desktop browser performance proves insufficient and threading becomes desirable later, the deployment + headers + cross-origin embed implications must be re-scoped. **Owner**: ui-programmer + devops-engineer. **Resolution**: Re-evaluate after v0 real-device measurement. Not blocking v0.
10. **Telemetry collection (future)**: v0 writes engine performance stats (NPS, depth-reached, abort rate per device class) to `localStorage` only. When/if to add server-side telemetry collection (for cross-user tuning) is a Phase 2+ decision. **Owner**: Analytics direction TBD. **Resolution**: After v0 launch + user feedback signals tuning need.
