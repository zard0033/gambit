# Post-Game Review

> **Status**: In Design (round-2 review applied — 3 blockers resolved in-session; advisory follow-ups tracked in review log)
> **Author**: Eason + Claude
> **Last Updated**: 2026-05-28
> **Implements Pillar**: Pillar 3 (Single Player, No Pressure) — primary; Pillar 1 (Accumulation Over Sessions); **prepares for** Pillar 2 (Knowledge Connects to Play — v0 *names* the opening but does not yet *connect* knowledge to study; full connection is Phase 2)
> **Priority**: v0 / Feature
> **Depends on**: Game Lifecycle, Chess Engine Integration, Opening Identification, Move Annotation Display

## Overview

Post-Game Review is the system that transforms a completed chess game into an explorable learning artifact. On the technical side, it receives the `CompletedGame` record emitted by Game Lifecycle (full UCI move history, result, player color, per-player thinking times), drives the Chess Engine's review engine to sequentially analyze every position in the game, queries Opening Identification once for the game's opening name and book-exit point, and feeds the resulting per-position annotations and evaluation data to Move Annotation Display to render on the board.

From the player's perspective, Post-Game Review is the game's debrief. After finishing a game, the player taps "Review" and the board resets to the starting position. From there, the player steps forward move by move — seeing the engine's best move as a neutral arrow, the centipawn difference between what they played and what was optimal, and at the top, the name of the opening they reached. The language is entirely numeric and informational: no "Blunder!" badges, no "Brilliant!" bursts — just the gap between played and best, named and measured. The player's experience is reading a map, not receiving a report card: each move becomes legible, each mistake a data point rather than a verdict, and each game a named, navigable record rather than a fading memory.

## Player Fantasy

The player's fantasy is **curiosity answered, not performance graded**. After finishing a game — won or lost — they tap "Review" with the same quiet question: *"What was actually happening there?"* The review satisfies that question without ceremony. The board replays from the first move; the engine's arrow appears; the number beside it says how far the played move was from optimal. The player is not told how they did. They are shown what happened, and they read it.

The anchor moment is the step where the gap is largest — the player scrubs through moves and notices the evaluation swing, pauses, looks at the engine's arrow, and thinks: *"Oh. I could have gone there."* That moment of recognition — not shame, not congratulation, just clarity — is what the review exists to deliver.

When the player closes the review, they carry three things:
1. **A named game** — "I played the Italian Game, left book at move 9" — the vague memory sharpened into something they can look up, recognize next time, and study deliberately.
2. **A specific moment** — "Move 18 was where it slipped — that rook ending" — one concrete position from *this game* worth revisiting, surfaced by the biggest-swing marker. (Cross-game pattern aggregation — "I *consistently* miss rook endings" — is Phase 2 / Skill Scoring, not this system. v0 reports per-move swings within a single game and never forms a thematic verdict across games.)
3. **A trace left** — the knowledge that this game has been accounted for, reviewed, and will update their skill score. The session closed cleanly.

**Reference points:**
- **lichess analysis board** — arrows and numbers presented neutrally, no emotive labels, the position is the focus not the player's ego
- **Watching game film** — reviewing footage from a match: you see exactly what happened, the coach points at the screen, there's no praise or blame, just *what was there and what you missed*

**Explicitly NOT this system's job:**
- No "You lost 4 pawns of value on move 12!" headlines — numbers are per-move, not accumulated into a verdict
- No "Great game!" or "Tough luck" end-of-review message — the review ends when the player stops navigating, not on a note
- No recommendation to "study the Italian Game" in the **default** review — that is Phase 2 territory (bidirectional lesson linking). The default review names the opening and reports the gap; it does not prescribe the study. *(Reciprocal, Learning Loop #20 D2: an **opt-in** concept tag may surface a lesson/drill link behind the Show-detail affordance — never in the default render, never as a verdict. To support its test gate, #7's opt-in detail container must carry a stable `data-testid="review-detail-panel"`.)*
- No timer pressure — the player can linger on any position as long as they want

## Detailed Design

### Core Rules

#### Group 1: Entry and Initialization

1. Post-Game Review is entered when the player taps the "Review" button on the Game Over screen (per AC-20, Game Lifecycle).
2. On entry, `usePostGameReviewStore` initializes: loads `CompletedGame` from the **Pinia game store** (where Game Lifecycle Rule 7 wrote it on terminal — *not* a route payload, since Vue Router history mode cannot carry object payloads), resets the position cursor to 0, and initializes `analysisResults` as an array of `null` values of length N.
3. `identifyOpening(completedGame.moves)` is called once immediately on entry; the result is stored in the review store for the duration of the session.
4. An `AbortController` is created with `markRaw(new AbortController())` and stored in the review store — not wrapped in Vue reactivity, to prevent the abort signal from being replaced by a reactive proxy.
5. The board renders position 0 (the starting position) immediately on entry, before analysis begins.

#### Group 2: Position Sequence

6. The game contains N moves and N+1 positions. Position 0 is the starting position; position `i` is the state after move `i` has been played (1 ≤ i ≤ N).
7. Analysis covers positions 0 through N−1. Position N (the terminal state after the last move) is excluded from analysis; `analysisResults[N]` is never populated.
8. For position `i` (0 ≤ i ≤ N−1): the played move is `completedGame.moves[i]` and the best move is `analysisResults[i].bestMove`.

#### Group 3: Analysis Loop (two-pass)

Analysis runs in **two passes** so the whole game becomes legible quickly on mobile, then sharpens. This is a v0 requirement, not an optimization deferred to later (see Performance Notes and OQ-2).

9. **Pass 1 (Preview)**: immediately after initialization the loop analyzes positions 0..N−1 sequentially at `REVIEW_PREVIEW_DEPTH` with `movetimeMs: REVIEW_PREVIEW_MOVE_TIME_MS`. Preview depth is shallow (~12); each position is capped at `REVIEW_PREVIEW_MOVE_TIME_MS`, so a full 40-ply game finishes in **up to ~1.5N seconds** worst case (the per-position cap is 1 500 ms, not 1 000 ms — do not quote "~N seconds"), giving the player a complete preliminary read of every move before the deep pass begins. Before the first `analyze()` of the game, the review engine is reset for this session's `gameId` (the engine wrapper sends `ucinewgame` — see Chess Engine Integration — so no transposition state leaks from a previously reviewed game); the first call may also incur a one-time NNUE worker load, which the progress UI surfaces distinctly from analysis (EC-3).
10. **Pass 2 (Deep)**: after Pass 1 completes, the loop re-analyzes positions 0..N−1 sequentially at `REVIEW_TARGET_DEPTH` with `movetimeMs: REVIEW_MAX_MOVE_TIME_MS`, overwriting each `analysisResults[i]` with the deeper result. Pass 2 is bounded by `REVIEW_TOTAL_TIME_BUDGET_MS` (Rule 14).
11. Each `analyze()` returns `{ bestMove, evalCp?, evalMate?, depthReached, pv }` — the engine does **not** return `pass` (it has no concept of preview vs deep; this matches the Chess Engine Integration contract and the Dependencies table below). As each position completes, the store writes `analysisResults[i]` immediately (progressive disclosure) and **stamps `pass: 'preview' | 'deep'` onto the stored entry** according to which pass issued the call. The store also records `depthReached` per position so the cpLoss display can apply the depth-comparability guard (F2 / Rule 22a).
12. The progress indicator reflects the active pass: "Analyzing… X/N" during Pass 1, then "Refining… X/N" during Pass 2 (where X is the count completed in the current pass). It disappears when Pass 2 ends (COMPLETE) or is abandoned (budget reached / abort).
13. Before starting each `analyze()` call (either pass), the loop checks `abortController.signal.aborted`; if true, the loop exits without issuing further calls.
14. **Total-time budget**: the loop tracks elapsed wall-time. If cumulative analysis time reaches `REVIEW_TOTAL_TIME_BUDGET_MS` during Pass 2, Pass 2 stops issuing further calls; positions not yet deepened retain their Pass-1 preview result (with `pass: 'preview'`), and the store transitions to COMPLETE. Pass 1 is never cut by the budget — a complete preview is guaranteed. When all positions reach deep analysis (or Pass 2 stops on budget), the store transitions to COMPLETE.

#### Group 4: Navigation

15. The player navigates via Previous and Next buttons.
16. The Previous button is visible at cursor = 0 but rendered as disabled. The Next button is visible at cursor = N but rendered as disabled.
17. Each Next press increments the cursor by 1 (maximum N). Each Previous press decrements by 1 (minimum 0).
18. The board updates synchronously on cursor change to display the position at the new cursor index.

#### Group 5: Per-Position Display

19. At each cursor position `i`, the board displays the FEN for position `i`.
20. Both `moves[i]` and `analysisResults[i].bestMove` are UCI long-algebraic strings; `normalize(m)` lowercases the UCI string (so a promotion suffix `e7e8Q` compares equal to `e7e8q`) and is otherwise identity — the move comparison below is a lowercase-UCI string equality. If `analysisResults[i]` is available and `moves[i]` exists:
    - If `normalize(moves[i]) === normalize(analysisResults[i].bestMove)`: display a single arrow in the **best-move color** (the played move was optimal; using the same color as the best-move arrow signals "engine's choice" without introducing a separate reward hue; no separate played-move arrow is shown).
    - If `normalize(moves[i]) !== normalize(analysisResults[i].bestMove)`: display both a best-move arrow and a played-move arrow in distinct role colors.
21. If `analysisResults[i]` is not yet available, no best-move arrow is shown for that position; the cpLoss slot follows Rule 22 ("…" pending for an analyzing player move, "—" otherwise).
22. The cpLoss slot for position `i` follows this **display contract**. The branches form an **ordered precedence ladder** — evaluate top to bottom and stop at the first match. The terminal and mate branches MUST be checked before the numeric branch, so a `null` move or a mate score (±`MATE_CP`) can never reach the F2 number formatter:
    1. **not-applicable** → `"—"`: `isPlayerMove[i]` is false, OR `i = N−1` (last position, Rule 23), OR `analysisResults[i].bestMove` is null (terminal position, EC-8), OR the store is COMPLETE but `analysisResults[i]` or `analysisResults[i+1]` is null (engine error).
    2. **pending** → spinner / `"…"` (visually distinct from `"—"`): `isPlayerMove[i]` is true, the store is ANALYZING, and `analysisResults[i]` or `analysisResults[i+1]` is still null.
    3. **confirming (chip omitted)**: `isPlayerMove[i]` is true and `normalize(moves[i]) === normalize(analysisResults[i].bestMove)` (Rule 20) — omit the chip entirely; the confirming arrow already signals the player matched the engine. Chip omission is keyed on the **move**, not the number: a non-best move whose cpLoss merely clamps to 0 (EC-9 depth artifact) is NOT confirmed and falls through to branch 5 (it shows a "0.0" chip).
    4. **mate transition** → F2b label, **no number**: `isPlayerMove[i]`, both results available, and either `analysisResults[i]` or `analysisResults[i+1]` carries `evalMate`. Take the F2b label path — never the F2 number. If both the "missed" and "allowed" conditions match (the player lost a forced mate *and* walked into one against them), the tie resolves to **"Missed forced mate."**
    5. **value** → the F2 pawn number (pawns primary, raw cp on tap; see Visual Requirements): `isPlayerMove[i]`, both `analysisResults[i]` and `analysisResults[i+1]` available, neither carries `evalMate`. **Preliminary marker**: if either result is still `pass: 'preview'`, OR the pair fails the depth-comparability guard (Rule 22a), show the value with a "preliminary" treatment — a `"~"` prefix plus a non-opacity marker that preserves text contrast (do not dim the text; that risks failing WCAG 1.4.3). It is a real preview number, not yet final.

22a. **Depth-comparability guard**: F2 subtracts evals from two independent `analyze()` calls. A cpLoss is only a trustworthy *final value* when `analysisResults[i]` and `analysisResults[i+1]` were analyzed at comparable depth: `|depthReached[i] − depthReached[i+1]| ≤ DEPTH_MISMATCH_TOLERANCE`. If they differ by more than the tolerance, the value falls back to the **preliminary** treatment (Rule 22) instead of a final number — preventing a depth artifact from masquerading as a real swing (which would otherwise corrupt the biggest-swing marker, Rule 30).
23. The last move (position N−1) always shows "—" for cpLoss because `analysisResults[N]` is never populated.
24. The evaluation display is sent to Move Annotation Display as `{ evalCp: analysisResults[i].evalCp, evalMate: analysisResults[i].evalMate, sideToMove }`, where `sideToMove` is derived from the position at cursor `i` (`i` even → White to move, `i` odd → Black to move) — it is NOT read from the engine result, which does not carry it. Post-Game Review does NOT pre-flip the value; Move Annotation Display normalizes to White's perspective internally.
25. The opening header is shown at positions 1 through N when `openingResult.isUnknown` is false. The header shows the opening name (e.g., "Italian Game"). The cursor is a **0-based position index** (position `i` = the state after `i` plies); `bookExitPly` is a **1-based ply count** (Opening Identification GDD Rule 8; 1.e4 = ply 1). Because the position index `i` numerically equals the number of plies played to reach it, the 0-based cursor and the 1-based `bookExitPly` are directly comparable: at `cursor = bookExitPly` exactly `bookExitPly` plies are on the board (the first out-of-book ply included), so `cursor >= bookExitPly` first fires at that position — correct, no off-by-one. When `cursor >= bookExitPly` (the player is at or past the position where book ended), append " — left book at move X" where X = `Math.ceil(bookExitPly / 2)` per F5 — do **not** add +1.

#### Group 6: Exit

26. The player exits by tapping the back/close button.
27. On exit: `abortController.abort()` is called, the analysis loop exits at its next abort-signal check, and the router navigates back to the Game Over screen.
28. The review store state is cleared on exit; no analysis results are persisted across separate review sessions.
29. If the browser tab is killed mid-analysis and the user returns, the partial `analysisResults` are restored from `sessionStorage` (see EC-3 for the persisted schema and size guard). The loop resumes by pass: if any entry is still `null`, Pass 1 resumes from the first `null`; once every entry exists, Pass 2 resumes from the first entry still marked `pass: 'preview'`. If `sessionStorage` is unavailable or throws, analysis restarts from position 0, Pass 1.

#### Group 7: Biggest-Swing Marker (Anchor)

30. **The biggest-swing anchor is computed once the store reaches COMPLETE — not during ANALYZING, and it does not move thereafter.** On COMPLETE the store computes `biggestSwingCursor` = the eligible player-move position with the maximum cpLoss, ranking **only among positions where both `analysisResults[i]` and `analysisResults[i+1]` reached `pass: 'deep'`** — so a preview artifact can never win the ranking (this closes the gap that the pairwise depth guard in Rule 22a leaves open against a *global* max). Eligible = player moves only; excludes the last move and any not-applicable position. **Tie-break: lowest position index.** If a total-time budget cut (Rule 14) left *no* position with a deep pair, fall back to ranking over preview pairs and render the resulting anchor with the preliminary treatment. Because it is computed once at COMPLETE, the anchor is presented a single time and **does not relocate while the player is reading** (delivering the Player Fantasy's "one specific moment").
31. When the store is COMPLETE, the eval bar marks `biggestSwingCursor` with a peak marker (a tick/dot at that move's location, see Visual Requirements), that position's cpLoss chip carries the "Biggest swing" tag (the one labelled moment, per F2), and a "Jump to biggest swing" button moves the cursor directly there. **The peak marker, the tag, and the jump button are shown only when the store is COMPLETE** — while ANALYZING they are hidden, so the player is never offered an anchor that will later move.
32. If no eligible player move has a positive cpLoss (every move matched the engine, or the game is too short), `biggestSwingCursor` is null: the peak marker, tag, and jump button are not shown, and the UI shows a neutral, non-congratulatory empty-state line (e.g. "No big swings this game — steady throughout"). This is the v0 minimum-viable substitute for the full move list (OQ-1) — it surfaces the single anchor moment the Player Fantasy depends on without the full panel.

### States and Transitions

| State | Entry | Exit | Description |
| ----- | ----- | ---- | ----------- |
| LOADING | Player taps "Review" | Opening identified; board at position 0 | Initialization: loads CompletedGame, calls identifyOpening, creates AbortController, renders starting position |
| ANALYZING | LOADING completes | Pass 2 finishes or `REVIEW_TOTAL_TIME_BUDGET_MS` reached (→ COMPLETE), or abort signaled (→ CANCELLED) | Two-pass loop running (Pass 1 preview, then Pass 2 deep); player may navigate concurrently; UI shows progressive + preliminary results |
| COMPLETE | Pass 2 deepened all positions, OR total-time budget reached (remaining positions keep their Pass-1 preview results) | Player exits | No further analyze() calls; some positions may remain preview-depth if the budget was hit |
| CANCELLED | abortController.abort() called | Player exits | Analysis cut short by exit; partial results remain available |

### Interactions with Other Systems

| System | Direction | Data / Call | Notes |
| ------ | --------- | ----------- | ----- |
| Game Lifecycle | Receives | `CompletedGame` via the Pinia game store (written by Lifecycle Rule 7 on terminal) | `moves`, `playerColor`, `result`, `playerMoveTimes`, `completedAt` |
| Chess Engine Integration | Calls | `reviewEngine.analyze({ fen, targetDepth, movetimeMs })` per position | Sequential loop positions 0..N−1; abort via AbortController |
| Opening Identification | Calls | `identifyOpening(moves)` → `OpeningResult` | Called once on entry; `isUnknown=true` → opening header omitted |
| Move Annotation Display | Sends | `Annotation[]`, `{ evalCp?, evalMate?, sideToMove }` | evalCp is raw side-to-move convention; Post-Game Review does not pre-flip |
| Chess Board (chessground) | Sends | FEN at current cursor; arrow shape configurations | Post-Game Review owns cursor and arrow state; board is a renderer only |

## Formulas

### F1: Position Count

```
N = len(completedGame.moves)
```

- `N`: total number of half-moves (plies) in the game
- Position sequence is 0..N; analysis covers positions 0..N−1

### F2: Centipawn Loss

```
cpLoss[i] = max(0, E[i] + E[i+1])
```

**Inputs (both in side-to-move convention — positive = the side that moves at that ply is better):**
- `E[i]`: centipawn value for position `i` (the moving player's perspective before their move)
- `E[i+1]`: centipawn value for position `i+1` (the *opponent's* perspective after the player's move)

**Why addition captures the swing:** The side-to-move flips at each ply, so `E[i+1]` is already from the opponent's perspective. When `E[i+1]` is large and positive, the opponent has a big advantage — the player just made things worse for themselves. `E[i] + E[i+1]` measures the total swing: the player was up `E[i]` before; the opponent is up `E[i+1]` after. A negative raw result (player outperformed the engine at the analyzed depth) is clamped to 0; per Rule 22 it then shows a "0.0" value chip if the move was *not* the engine's best (a depth artifact), or is chip-omitted if the move *was* the best. **Both evals must be at comparable depth for this number to be trustworthy** — see the depth-comparability guard (Rule 22a), since EC-11 permits per-position depth to vary.

**Worked examples:**

| Scenario | E[i] | E[i+1] | Raw | cpLoss | Notes |
| -------- | ---- | ------ | --- | ------ | ----- |
| Best move | +100 | −100 | 0 | 0 | Opponent is now 100cp down — player maintained advantage |
| Inaccuracy | +100 | −50 | 50 | 50 | Player gave up some advantage |
| Blunder | +50 | +300 | 350 | 350 | Opponent went from losing to winning by 300cp |
| Recovery | −200 | −50 | −250 | 0 | Player improved; clamped to 0 |

*Note: E[i+1] is from the **opponent's** perspective. E[i+1] = +300 means the opponent (not the player) is now 300cp ahead.*

**Mate normalization (F2a) — handle all four combinations before applying F2:**

| E[i] source | E[i+1] source | Action |
|---|---|---|
| evalCp | evalCp | No substitution needed |
| evalCp | evalMate | E[i+1] = evalToCp(evalMate at i+1) |
| evalMate | evalCp | E[i] = evalToCp(evalMate at i) |
| evalMate | evalMate | Both: evalToCp(evalMate) for each independently |

**When cpLoss is not-applicable (display as "—"):** `analysisResults[i]` or `analysisResults[i+1]` is null, or `isPlayerMove[i]` is false. See three-state display contract in Rule 22.

**Display: the pawn number alone — no per-move word.**

The chip displays the swing in **pawn units** only (`cpLoss ÷ 100`, one decimal, shown as a loss, e.g. "−0.7"). The raw centipawn value is secondary and revealed on tap (Q2 decision — resolves OQ-4; beginners do not parse raw centipawns). **There is no per-move qualitative word.** A per-move adjective ("Minimal/Minor/Moderate/Major") is a per-move grade, which the project ethos excludes (see Player Fantasy "Explicitly NOT" — numbers are per-move, never a verdict). A single descriptive tag appears on **one** position only — the biggest-swing anchor (Rule 31), which carries a "Biggest swing" tag — because one labelled moment is the entire point of the feature.

| Case | Chip |
|---|---|
| move = best (Rule 20 confirming) | *(chip omitted — confirming arrow signals the player matched the engine)* |
| non-best player move, value final | the pawn number, e.g. "−0.7" |
| non-best move whose cpLoss clamps to 0 (EC-9 depth artifact) | "0.0" (NOT chip-omitted — chip omission is keyed on the move, not the number, Rule 22) |
| value still preview / fails depth guard (Rule 22a) | preliminary treatment: `"~"` prefix, e.g. "~−1.5" |
| mate transition (evalMate present) | F2b label, no number |

The number names the **size of the swing**, neutrally. "Mistake" / "Blunder" — and any ordinal magnitude word — are deliberately not used. Mate transitions use the F2b label path, not this table.

### F2b: Mate Transition Display

F2a maps mate scores to `±MATE_CP` so F2 still produces an *ordered* cpLoss for ranking (the biggest-swing marker, Rule 30). But a pawn/centipawn **number** derived from a mate score is meaningless to display ("−292.0 pawns" / "60000 cp"). So when either `analysisResults[i]` or `analysisResults[i+1]` carries `evalMate` (not `evalCp`), the chip shows a **mate-aware label with no number**, by swing direction:

| Transition | Label |
|---|---|
| Player had forced mate (E[i] = +MATE_CP), lost it (E[i+1] no longer mate-for-player) | "Missed forced mate" |
| Player allowed a forced mate against them (E[i+1] = opponent mate) where none existed at E[i] | "Allowed forced mate" |
| Player was already being mated and still is (E[i] = −MATE_CP, no swing) | chip omitted / "—" — nothing was lost |
| Player stayed on a winning mate (still mating) | chip omitted — confirming |

For Rule 30 ranking, "Missed forced mate" / "Allowed forced mate" sort above any centipawn swing (largest possible error). **Known v0 limitation (F4):** mate *distance* degradation (mate-in-2 played as mate-in-8) is invisible — both map to `+MATE_CP`, cpLoss 0, chip omitted. Acceptable for a beginner tool; revisit if it becomes a teaching gap.

### F3: Player Move Index

Determines whether position `i` is a player move and maps it to the correct index in `playerMoveTimes`.

```
isPlayerMove[i] =
  (playerColor === 'white' && i % 2 === 0) ||
  (playerColor === 'black' && i % 2 === 1)

playerMoveIndex[i] =
  playerColor === 'white' ? i / 2 : (i − 1) / 2
```

- `playerColor`: from `completedGame.playerColor` ('white' | 'black')
- `i`: ply index (0-based)
- `playerMoveIndex[i]` is only valid when `isPlayerMove[i]` is true
- Guard: assert `playerMoveIndex[i] < completedGame.playerMoveTimes.length` before reading

Examples:
- White player, position i=4: `isPlayerMove = true`, `playerMoveIndex = 2` → `playerMoveTimes[2]`
- Black player, position i=3: `isPlayerMove = true`, `playerMoveIndex = 1` → `playerMoveTimes[1]`

### F4: Mate Score Mapping

```
MATE_CP = 30_000

evalToCp(evalMate) =
  evalMate > 0 ? +MATE_CP : −MATE_CP
```

- Used in F2 when a position has a forced-mate evaluation instead of a centipawn evaluation
- `evalMate > 0`: side-to-move has forced mate → treated as +30 000 cp
- `evalMate < 0`: side-to-move is being mated → treated as −30 000 cp
- `evalMate === 0`: the position **is** terminal (checkmate/stalemate already on the board) and the engine pairs it with `bestMove = null`. This value never reaches `evalToCp`: Rule 22 branch 1 (not-applicable / EC-8) intercepts a null `bestMove` before the mate and numeric branches, so `evalToCp` is only ever called with a non-zero `evalMate`.

### F5: Book Exit Move Display

```
bookExitMoveNumber = Math.ceil(bookExitPly / 2)
```

- `bookExitPly`: from `OpeningResult.bookExitPly` — **1-based ply index** (Opening Identification GDD Rule 8: 1.e4 = ply 1, 1...e5 = ply 2)
- `bookExitMoveNumber`: 1-based move number displayed to the player
- Displayed in the opening header as "left book at move X"
- Example: `bookExitPly = 9` (White's 5th move, 1-based) → `Math.ceil(9 / 2) = 5` → "left book at move 5"
- Example: `bookExitPly = 10` (Black's 5th move, 1-based) → `Math.ceil(10 / 2) = 5` → "left book at move 5"
- **Convention alignment**: Post-Game Review uses the same formula as Opening Identification GDD Rule 8 (`Math.ceil(ply / 2)`). Do not add +1 — the 1-based convention is already accounted for.

## Edge Cases

**EC-1: Last move has no cpLoss**
Position N−1 is the last played position; `analysisResults[N]` is never populated because position N is excluded from analysis. cpLoss for the last move is always "—". This is expected behavior, not an error.

**EC-2: Analysis interrupted by exit**
If the player exits mid-analysis, `abortController.abort()` is signaled. The analysis loop exits at its next position boundary. Partial `analysisResults` remain valid for positions already analyzed. No error is raised.

**EC-3: Browser tab killed mid-analysis (iOS)**
On next visit the partial `analysisResults` are restored from `sessionStorage` and the two-pass loop resumes per Rule 29. **Persisted schema (size-guarded):** only `{ bestMove, evalCp?, evalMate?, depthReached, pass }` per position is stored — the `pv` (principal variation) is stripped before persisting, since it can run 30–60 ply and is only needed for the currently-viewed position. Key: `pgr:analysis:<gameId>`. Every `setItem` is wrapped in try/catch; a `QuotaExceededError` or any throw (e.g. Safari Private Mode, where `sessionStorage` throws on access) is treated identically to "unavailable" — persistence is skipped and, on reload, analysis restarts from position 0, Pass 1 (no error surfaces to the player). Persistence writes are **throttled** (piggybacked on the rAF flush / debounced), not issued synchronously per analyzed position, to keep `sessionStorage` serialization off the 60 fps hot path.

**EC-4: Zero-move game**
If `completedGame.moves` is empty (N = 0), there are no positions to analyze and no moves to display. The board shows the starting position only. The opening header is omitted (no moves played). Previous and Next buttons are both disabled.

**EC-5: Unknown opening**
If `openingResult.isUnknown` is true, the opening header is omitted entirely for all cursor positions. No fallback label (e.g., "Unknown Opening") is shown.

**EC-6: Opening with no book exit (entire game was in book)**
If `bookExitPly` equals N or exceeds the game length, the " — left book at move X" suffix is never appended. The header shows only the opening name for all positions.

**EC-7: evalMate present instead of evalCp**
When `analysisResults[i].evalMate` is set and `evalCp` is undefined, F4 maps the mate score to ±30 000 cp before applying F2. Both positions in the cpLoss calculation may independently carry evalMate; each is mapped separately.

**EC-8: bestMove is null (game-over position)**
For terminal positions (checkmate, stalemate), `reviewEngine.analyze()` may return `bestMove = null`. In this case: no best-move arrow is shown, and cpLoss for that position is "—" regardless of player-move status.

**EC-9: cpLoss is negative before clamping**
The `max(0, …)` clamp in F2 ensures this never displays as negative. A negative raw result (player move was better than the engine's suggested continuation at the analyzed depth) is clamped to 0 and displayed as "0".

**EC-10: playerMoveTimes shorter than expected**
If `playerMoveIndex[i] >= completedGame.playerMoveTimes.length`, the F3 guard prevents the out-of-bounds read and `playerMoveTimes[playerMoveIndex[i]]` is treated as unavailable. Thinking time is not a displayed UI element in v0, so this only guards the data access — no display change. Can occur if the game ended during the opponent's turn (per EC-11, Game Lifecycle).

**EC-11: Analysis depth lower than REVIEW_TARGET_DEPTH**
If Stockfish returns `depthReached < REVIEW_TARGET_DEPTH` (e.g. `movetimeMs` timeout on iPhone), the result is used as-is; no retry. The eval is valid at the depth reached — but because cpLoss pairs two positions' evals, the **depth-comparability guard (Rule 22a)** shows the cpLoss as *preliminary* rather than final when the two positions' depths differ by more than `DEPTH_MISMATCH_TOLERANCE`, preventing a depth artifact from reading as a real swing.

## Dependencies

### Upstream (systems this GDD depends on)

| System | What Post-Game Review requires |
| ------ | ------------------------------ |
| **Game Lifecycle** | `CompletedGame` record delivered via the Pinia game store (Lifecycle Rule 7 writes it on terminal). Requires: `moves[]`, `playerColor`, `result`, `playerMoveTimes[]`, `completedAt`. |
| **Chess Engine Integration** | `reviewEngine.analyze({ fen, targetDepth, movetimeMs })` API available and returning `{ bestMove, evalCp?, evalMate?, depthReached, pv }`. evalCp in side-to-move convention. |
| **Opening Identification** | `identifyOpening(moves)` API available and returning `OpeningResult` with `{ eco, name, bookExitPly, isUnknown }`. |
| **Move Annotation Display** | Accepts `Annotation[]` and `{ evalCp?, evalMate?, sideToMove }` and renders them on the board. Normalizes evalCp to White's perspective internally. |

### Downstream (systems that depend on this GDD)

| System | What they expect from Post-Game Review |
| ------ | -------------------------------------- |
| *(none in v0)* | Post-Game Review is a terminal feature in v0 — no other system reads its output. |
| **Learning Loop — Concept Linking (#20)** *(Phase 2)* | Reads the existing per-move `cpLoss`, biggest-swing eligibility, and `pv` to run a **conservative mistake classifier** (Bridge 3) that, *only on a high-confidence match*, adds an opt-in concept link (lesson + drill puzzles) on the anchor moment. **Invariant: the loop never alters the neutral, number-only default render** — it only adds a link node on confident classification, stays silent otherwise. This realises the "prescribe study is Phase 2 territory (bidirectional lesson linking)" hook this GDD's Player Fantasy defers. See `design/gdd/learning-loop.md` §3.4 + ADR-0012. |
| **Journal — 棋誌 (#21)** *(Phase 1 differentiation)* | At analysis completion, reads per-move `cpLoss`, biggest-swing / pivotal-move eligibility, and `gameId+ply` to capture a ② "calm/beautiful move" journal entry (event-time, ephemeral source). Read-only; **never alters the neutral default render**. The replay deep-link reuses `gameId+ply`. See `design/gdd/journal.md`. |
| **棋憶 — Memory (#22)** *(Phase 2 differentiation)* | Consumes (does not re-run) `analysisResults`, per-move `cpLoss`, the eval series `E[i]`, and `biggestSwingCursor` to build a calm dashboard-first review: a key-moment selection (1–5), an eval-trend chart, and a move-by-move replay. Read-only over #7's output; the dense replay reuses #7's per-move display contract. See `design/gdd/memory.md`. |

### Bidirectional Notes

- **Chess Engine Integration** (OQ#2): move classification thresholds are owned by Post-Game Review, not Chess Engine Integration. Post-Game Review defines what cpLoss ranges mean to the player.
- **Opening Identification** (OQ#7): Post-Game Review decides whether to show "Unknown opening" or omit the header when `isUnknown = true`. Decision: omit.
- **Game Lifecycle** (EC-11): `playerMoveTimes[j]` indexes player moves only, not global ply index. Post-Game Review must apply F3 to map ply index to the correct `playerMoveTimes` slot.

## Tuning Knobs

| Knob | Default | Safe Range | Affects |
| ---- | ------- | ---------- | ------- |
| `REVIEW_PREVIEW_DEPTH` | 12 | 8–16 | Pass-1 (preview) depth. Shallow so the whole game reads quickly (≤1.5 s/position, capped by `REVIEW_PREVIEW_MOVE_TIME_MS`). Below 8 produces unreliable evaluations. |
| `REVIEW_PREVIEW_MOVE_TIME_MS` | 1 500 ms | 500–3 000 ms | Pass-1 per-position time cap. Keeps the preview pass fast on mobile. |
| `REVIEW_TARGET_DEPTH` | 22 | 12–26 | Pass-2 (deep) depth. Higher = more accurate cpLoss but slower. **Default pending the OQ-7 iPhone Safari depth-reachability spike — may be lowered if depth 22 is not reachable within the per-position cap on the reference device.** |
| `REVIEW_MAX_MOVE_TIME_MS` | 10 000 ms | 3 000–30 000 ms | Pass-2 per-position time cap. Lower values speed up review but may leave `depthReached < REVIEW_TARGET_DEPTH` on slow devices (handled by Rule 22a guard + EC-11). |
| `REVIEW_TOTAL_TIME_BUDGET_MS` | 90 000 ms | 30 000–300 000 ms | Hard ceiling on the **deep** pass (Rule 14). When reached, Pass 2 stops and remaining positions keep their Pass-1 preview result. Pass 1 is never cut. Bounds total review time for long games. |
| `DEPTH_MISMATCH_TOLERANCE` | 4 | 2–8 | Max `abs(depthReached[i] − depthReached[i+1])` for a cpLoss to display as a final value (Rule 22a). Above this, the value is shown as preliminary to avoid depth-artifact swings. |
| `MATE_CP` | 30 000 | 10 000–32 000 | Centipawn value representing a forced mate in F2 ranking (F2a/F4). Affects only swing *ordering*; mate transitions display via F2b labels, not this number. |
| `SHOW_BEST_MOVE_ARROW` | true | true / false | Whether to display the engine's best-move arrow during review. Disabling removes the main teaching signal; intended as an accessibility or preference toggle only. |

## Performance Notes

This is the project's highest-risk system on iPhone Safari. Constraints and the round-1 reconciliation:

- **Time budget**: `technical-preferences.md` states "Stockfish analysis ≤ 5 s" — that figure is **per position**, not per review. A whole-game review is governed instead by the two-pass design: Pass 1 gives a complete preview in ~N seconds; Pass 2 is bounded by `REVIEW_TOTAL_TIME_BUDGET_MS` (default 90 s). *(Action item outside this GDD: clarify the wording of the technical-preferences "≤5s" line so it reads "per position".)*
- **Depth on mobile**: depth 22 may be unreachable within the per-position cap on a slow iPhone; EC-11 + the Rule 22a depth guard handle inconsistent depth without fabricating swings. The OQ-5 device spike must confirm the default before implementation.
- **Memory** (≤150 MB total ceiling, shared with the stockfish.wasm worker): `analysisResults` entries are written once and never mutated, so each entry is stored with `markRaw()` to avoid deep Vue-reactivity proxy overhead over 40+ objects; only the array length, the cursor, and the progress count need to be reactive. The `pv` is kept only for the currently-viewed position, not retained for all positions. Note that `markRaw` + pv-stripping is primarily a **CPU/reactivity** saving (the data itself is only ≈KB); the dominant memory consumer is the stockfish.wasm heap + its transposition Hash table, which OQ-5 must measure and pin (a Hash-size tuning knob) — the ≤150 MB ceiling is currently asserted, not measured.
- **60 fps under concurrent navigation**: while ANALYZING the player may scrub (Rule 18) as results stream in (Rule 11). Streamed writes are batched (flush on `requestAnimationFrame`, not one synchronous store mutation per result) so rapid scrub + result streaming does not blow the 16.6 ms frame budget.

## Visual/Audio Requirements

### Default Presentation (Mobile / Beginner) — calm default, opt-in detail

The review is for **chess beginners** on iPhone (390 px). Showing every available signal at once overloads the audience the product is built for — and the GDD itself admits "a beginner cannot decode three arrow types unaided" (Arrows §). To honour Pillar 3 (Single Player, No Pressure), the **mobile default presentation deliberately hides advanced signals** behind an opt-in "Show detail" toggle. The systems below still compute everything — only the *default render* is reduced.

**Mobile default (on by default on viewports < 768 px):**
- **Arrows:** only the **best-move arrow** at the current position. The played-move arrow is **not** drawn by default (even when played ≠ best); the confirming case (played == best) shows the same single best-move arrow per Rule 20 — there is no behavioural difference for the player between "you matched the engine" and "you didn't" on the default view, beyond the cpLoss chip and the eval badge.
- **Eval bar:** **off**. Only the **numeric eval badge** (per Move Annotation Display Rule 4 / Formula 1) is shown alongside the board. Forced-mate is rendered as `M3` / `M-3` text on the badge, not a full-bar fill.
- **cpLoss chip:** shown only when the value is **final** (per Rule 22 / 22a). Preliminary (`~`) chips are **not rendered by default**; during ANALYZING the slot is empty for non-final positions instead of mutating in front of the reader. (Pending `"…"` and not-applicable `"—"` are still shown per Rule 22.)
- **Biggest-swing anchor:** **shown** (Rules 30–32). This is the one curated moment the Player Fantasy depends on — it stays in the calm default.
- **Opening header, navigation, progress indicator, jump button:** all shown as specified elsewhere — these are not the overload.

**Opt-in "Show detail" toggle:** reveals the played-move arrow (Rule 20 two-arrow case + non-color distinguishing channel), the eval bar with peak marker, and the preliminary `~` chip treatment. Toggle state may persist across sessions (Settings, Polish phase).

**Desktop default (≥ 768 px):** all systems on by default — there is room for them, and the desktop audience is more likely to expect a richer analysis surface.

The downstream UX spec (`design/ux/post-game-review.md`) owns the exact toggle UI, breakpoint, and persistence — but the default-rendering policy above is binding: the mobile calm default is **not** something the UX spec can opt out of.

### Arrows

- **Best-move arrow**: indicates "engine recommends this" (suggested: yellow/amber, matching lichess convention)
- **Played-move arrow**: indicates "you played this" (suggested: blue or semi-transparent white)
- **Confirming case (played == best)**: reuse the **best-move arrow color** with no separate hue (Rule 20) — a single arrow already signals "engine's choice." Do **not** introduce a green/separate "confirming" hue: green reads as "correct" (a judgment the ethos excludes), and Move Annotation Display has no separate confirming role
- **Role must NOT be encoded by color alone** (project a11y bar / color-blind users): each role carries a non-color channel — e.g. solid line = best, dashed = played — and/or a small text tag ("best" / "you") at the arrowhead. Amber/green and blue/green are common deuteranope confusions, so hue is a secondary cue only.
- **Legend**: a compact persistent key (or a one-time first-use coachmark) explains the arrow roles; a beginner cannot decode three arrow types unaided.
- Arrow opacity: sufficient contrast on both light and dark squares; validate against a WCAG-style contrast/CVD check, not just the suggested hues.
- Arrow head size: large enough to identify the target square on mobile (44 px touch-target equivalent)

### Evaluation Bar

- Vertical bar alongside the board; white fills from one end, black from the other
- Updates immediately when cursor changes to a position with available analysis
- **No-data treatment**: when a position has no analysis yet (pending), the bar shows a distinct "no data" state (greyed / hatched / empty) — NOT a centered 50/50 split, which would falsely read as "equal position"
- **Preliminary treatment**: when the current value is preview-depth or fails the depth guard (Rule 22a), the bar reflects the preliminary value with a subtle marker matching the cpLoss chip's preliminary treatment
- **Biggest-swing peak marker** (Rule 31): a tick/dot on the bar marks the position of `biggestSwingCursor`; hidden when it is null (Rule 32)
- Forced mate: bar shows fully white or fully black (not a gradual fill)

### Progress Indicator

- Two-pass aware: "Analyzing… X/N" during Pass 1, "Refining… X/N" during Pass 2 (Rule 12), X and N integers
- Visible only during ANALYZING state
- Distinguish "reloading engine" from "analyzing" on resume so the player is not staring at a frozen count (EC-3 cold-start)
- Disappears when COMPLETE (no transition animation required in v0)

### Error State

- If the store reaches COMPLETE but all/most `analysisResults` are null (engine failure), show an explicit error state ("Couldn't analyze this game" + Retry / Exit) — distinct from the per-move "—" not-applicable token, so the player has recourse rather than an unexplained blank review
- If only some positions failed, those positions show "—" and the rest of the review remains usable

### Opening Header

- Plain text, no icon or badge treatment — neutral, non-evaluative
- Book exit suffix uses the same weight as the opening name; not styled differently
- Hidden when `isUnknown = true` (no placeholder text)

### Audio

- No audio requirements for v0. Post-Game Review is a silent reading experience by design.

## UI Requirements

> **Flag for UX design**: This system has real player-facing UI. A UX spec should be authored at `design/ux/post-game-review.md` before implementation begins.

### Required UI Elements

1. **Chess board** — shows the current position at cursor; full chessground instance in read-only mode
2. **Previous / Next navigation buttons** — always visible; rendered as disabled at boundary positions
3. **Opening header** — one line above or below the board; shown from position 1 onward when opening is known
4. **cpLoss display** — swing for the current move in pawn units (player moves only), with neutral magnitude label (F2); "—" / "…" per Rule 22; raw cp on tap
5. **Evaluation bar** — vertical bar alongside the board reflecting the position's eval, with the biggest-swing peak marker (Rule 31)
6. **Progress indicator** — "Analyzing… X/N" (Pass 1) / "Refining… X/N" (Pass 2) shown during ANALYZING state
7. **Jump to biggest swing button** — moves the cursor to `biggestSwingCursor` (Rule 31); disabled when null (Rule 32)
8. **Arrow legend** — compact key (or first-use coachmark) for the three arrow roles
9. **Exit / Back button** — returns the player to the Game Over screen

> **Mobile layout (390 px) is a hard constraint, not a detail.** The UX spec must prove **all nine elements above** fit an iPhone (390×844, board ≥ 320 px, all touch targets ≥ 44 px) on-device before implementation — likely a single column: header → board → thin eval strip → cpLoss chip → nav row → "Jump to biggest swing" button, with the eval bar horizontal rather than stealing board width, and the arrow legend delivered as a first-use coachmark + on-demand "?" affordance (a persistent 3-role key does not fit the budget). The sketch is illustrative — it is **not** a licence to drop the jump button or the legend, the two elements added in round-1.

### Constraints

- All interactive elements (Previous, Next, Exit) must have touch targets ≥ 44×44 px (iPhone Safari requirement)
- No hover-only interactions; all controls must be functional with tap/click only
- No timer, countdown, or pressure UI of any kind
- No emotive labels, badges, or result summaries anywhere on this screen

## Acceptance Criteria

**AC-1** — Given a CompletedGame with N>0 moves, when the player enters Post-Game Review, then the first `reviewEngine.analyze()` call issued is for position 0 (asserted via spy, before any other position) and the progress indicator shows "Analyzing… 0/N". *(No wall-clock threshold — startup latency is tracked by a separate performance benchmark, not this AC.)*

**AC-2** — Given `isPlayerMove[i]` is true, the store is ANALYZING, and `analysisResults[i]` or `analysisResults[i+1]` is still null, when the player navigates to position i, then cpLoss shows the pending token "…" (visually distinct from "—"), not a value.

**AC-3** — Given `analysisResults[i]` and `analysisResults[i+1]` are both available, `isPlayerMove[i]` is true, neither carries `evalMate`, and the pair passes the depth guard (Rule 22a), when the player views position i, then the displayed final cpLoss equals `max(0, E[i] + E[i+1])`, where E[i], E[i+1] are the F2/F2a-normalized centipawn values.

**AC-4** — Given `isPlayerMove[i]` is false (opponent's move), when the player views position i, then cpLoss shows "—" regardless of analysis availability.

**AC-5** — Given position N−1 is a player move, when the player views position N−1, then cpLoss always shows "—".

**AC-6** — Given the played move at position i equals `analysisResults[i].bestMove`, when the player views position i, then exactly one arrow is shown in the **best-move color** (the confirming case reuses the best-move role per Rule 20, with no separate hue); no separate played-move arrow is shown.

**AC-7** — Given the played move at position i differs from `analysisResults[i].bestMove`, when the player views position i, then a best-move arrow and a played-move arrow are shown; the two roles are distinguished by a non-color channel (line style and/or text tag) in addition to hue (Visual Requirements).

**AC-8** — Given `openingResult.isUnknown` is false, when the player is at any position 1..N, then the opening name is shown in the opening header.

**AC-9** — Given the cursor is at or past `bookExitPly` (cursor ≥ bookExitPly), when the player views that position, then the opening header appends " — left book at move X" where X = `Math.ceil(bookExitPly / 2)` (matching F5/Rule 25 — no +1).

**AC-10** — Given `openingResult.isUnknown` is true, when the player views any position, then no opening header text is shown.

**AC-11** — Given the player is at cursor = 0, when they tap Previous, then the Previous button is visible and disabled; the cursor remains at 0.

**AC-12** — Given the player is at cursor = N, when they tap Next, then the Next button is visible and disabled; the cursor remains at N.

**AC-13** — Given analysis is running, when the player taps Exit, then `abortController.abort()` is called, no further `reviewEngine.analyze()` calls are issued, and the router navigates to the Game Over screen.

**AC-14** — Given partial analysis persisted under `sessionStorage` key `pgr:analysis:<gameId>` with indices 0–3 populated and 4+ null, when the review loads after tab restoration, then indices 0–3 display their cpLoss without re-analysis (assert `analyze()` is NOT called for 0–3) and analysis resumes at index 4 (Rule 29); persisted entries contain no `pv` field (EC-3).

**AC-15** — Given `analysisResults[i].evalMate` is set and `evalCp` is undefined, when position i is displayed, then `evalMate` maps to ±`MATE_CP` per F4 for ranking, and the chip shows the F2b mate label ("Missed forced mate" / "Allowed forced mate") with no centipawn number.

**AC-16** — Given the store reaches COMPLETE (Pass 2 finished OR `REVIEW_TOTAL_TIME_BUDGET_MS` reached), when COMPLETE is entered, then the progress indicator disappears from the UI.

**AC-17** — Given a CompletedGame with N moves, when each pass runs, then positions are analyzed sequentially (0, 1, …, N−1) within the pass, and Pass 2 does not begin before Pass 1 has produced a result for every position. Pass 1 calls use `REVIEW_PREVIEW_DEPTH`/`REVIEW_PREVIEW_MOVE_TIME_MS` and Pass 2 calls use `REVIEW_TARGET_DEPTH`/`REVIEW_MAX_MOVE_TIME_MS` (asserted per pass, so "two-pass" means two depths, not merely two loops).

**AC-18** — Given the `AbortController` is instantiated in `usePostGameReviewStore`, when inspected in unit tests, then it is created with `markRaw()` and is not wrapped in Vue reactive state.

**AC-19** — Given `analysisResults[i].bestMove` is null (terminal position, EC-8), when the player views position i, then no arrow of any role is shown and cpLoss shows "—", even if `isPlayerMove[i]` is true.

**AC-20** — Given the store is COMPLETE and `analysisResults[i]` is null (engine error), when the player views position i, then cpLoss shows "—" (not the pending token) and the progress indicator is hidden.

**AC-21** — Given `sessionStorage` is unavailable or throws on access (e.g. Safari Private Mode), when the review loads, then analysis starts from position 0 / Pass 1 and no error surfaces to the player (EC-3).

**AC-22** — Given `playerMoveIndex[i] >= completedGame.playerMoveTimes.length`, when position i is processed, then the F3 guard prevents an out-of-bounds read and no exception is thrown (EC-10).

**AC-23** — Given the played move at position i equals `analysisResults[i].bestMove`, when viewed, then no cpLoss chip is rendered (only the confirming arrow); and given the move differs from best but cpLoss clamps to 0 (EC-9 depth artifact), then a "0.0" chip IS rendered alongside the two arrows.

**AC-24** — Given the store is COMPLETE and exactly one eligible player move has the strictly-largest cpLoss (deterministic fixture, no ties), when `biggestSwingCursor` is computed, then the eval bar shows a peak marker at that position, that move's chip carries the "Biggest swing" tag, and "Jump to biggest swing" moves the cursor there. The marker, tag, and button are NOT shown while the store is ANALYZING, and `biggestSwingCursor` does not change after COMPLETE (Rule 30/31). Given no eligible player move has cpLoss > 0 (Rule 32), the marker/tag/button are hidden and the neutral empty-state line is shown.

**AC-25** — Given `analysisResults[i]` and `analysisResults[i+1]` differ in `depthReached` by more than `DEPTH_MISMATCH_TOLERANCE`, OR either is `pass: 'preview'`, when the player views position i, then the cpLoss is shown with the preliminary treatment (reduced opacity + "~" prefix), not as a final value (Rule 22 / 22a).

**AC-26** — Given the deep pass reaches `REVIEW_TOTAL_TIME_BUDGET_MS` with positions still `pass: 'preview'`, when the budget is hit, then Pass 2 stops issuing `analyze()` calls, the store transitions to COMPLETE, and the un-deepened positions retain their preview results (Rule 14).

**AC-27** — Given a CompletedGame with N=0 moves (EC-4), when the player enters review, then `reviewEngine.analyze()` is never called, the board shows position 0 only, the opening header is absent, and both Previous and Next are visible-and-disabled.

**AC-28** — Given `bookExitPly >= N` (entire game in book, EC-6), when the player views any position, then the opening header shows the opening name only and never appends " — left book at move X".

**AC-29** — Given all N entries are persisted and present with indices 0–2 marked `pass: 'deep'` and 3+ marked `pass: 'preview'`, when the review loads after tab restoration, then Pass 1 is skipped entirely (assert no `REVIEW_PREVIEW_DEPTH` call) and Pass 2 resumes from index 3 — the first `pass: 'preview'` entry — at `REVIEW_TARGET_DEPTH` (Rule 29).

**AC-30** — Given the store reaches COMPLETE with all `analysisResults` null (engine failure), then the explicit error state ("Couldn't analyze this game" + Retry + Exit, Visual Requirements) is shown instead of a board full of "—"; Retry re-enters analysis and Exit returns to the Game Over screen.

## Open Questions

**OQ-1: Full move list panel (Phase 2) — PARTIALLY RESOLVED**
A full scrollable move-list panel (all moves + cpLoss, click-to-jump) remains deferred to Phase 2 (significant UI surface). **However**, the round-1 review established that the Player Fantasy's anchor moment cannot be button-only: the v0 minimum-viable substitute — biggest-swing peak marker + "Jump to biggest swing" button (Rules 30–32) — is now in scope. The full move list is the Phase-2 upgrade of this affordance.

**OQ-2: Two-pass analysis — RESOLVED (now a v0 requirement)**
Resolved in round-1 review: two-pass (preview depth-12 → deep depth-22) is a **v0 requirement**, not a deferred optimization (Group 3, Rules 9–14). The mobile-timing math made preview-pass latency a certainty, not a maybe. Tuning via `REVIEW_PREVIEW_DEPTH` / `REVIEW_TOTAL_TIME_BUDGET_MS`.

**OQ-3: Evaluation bar animation**
Should the evaluation bar animate smoothly between positions on navigation, or jump immediately to the new value? Smooth animation would feel more polished but requires care to avoid artifacts when quickly skipping through positions. Left to UI implementation; no design constraint specified.

**OQ-4: cpLoss display format — RESOLVED**
Resolved in round-1 review: **pawn units are primary** ("−0.7"), raw centipawn secondary (revealed on tap). Beginners do not parse raw centipawns; the lichess centipawn convention is wrong for this audience (F2 labels table).

**OQ-5: iPhone depth-reachability spike (blocks finalization)**
`REVIEW_TARGET_DEPTH = 22` default is provisional. The engine GDD's OQ#6/OQ-7 Stockfish-on-iPhone-Safari spike must run before implementation to confirm whether depth 22 is reachable within `REVIEW_MAX_MOVE_TIME_MS` on the reference device; if not, lower the default. The depth-comparability guard (Rule 22a) mitigates inconsistent depth but does not remove the need for the spike. The same spike must **measure peak memory** (Safari Web Inspector) during an 80-ply two-pass review and pin the stockfish.wasm Hash size as a tuning knob (the <150 MB ceiling is asserted, not yet measured). **Scope of the block:** OQ-5 blocks *finalization of the depth/Hash defaults and perf sign-off* — it does **not** block store/UI implementation, which can proceed against the provisional default because the Rule 22a guard absorbs inconsistent depth.
