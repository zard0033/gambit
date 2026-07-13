# Opening Identification

> **Status**: Approved & Shipped (v0)
> **Author**: Eason + Claude
> **Last Updated**: 2026-05-27
> **Implements Pillar**: Pillar 2 (Knowledge Connects to Play) — turns an abstract move sequence into a named opening the player can recognize and study
> **Priority**: v0 / Foundation
> **Depends on**: None (Foundation layer)
> **Depended on by**: Post-Game Review

## Overview

Opening Identification is a pure lookup system: given the sequence of moves played in a game (or a position reached during it), it returns the most specific known opening — a human-readable name (e.g., "Italian Game: Giuoco Pianissimo") and its ECO code (e.g., "C53") — drawn from the lichess [`chess-openings`](https://github.com/lichess-org/chess-openings) database. It owns no game state, no engine, no UI; it is a stateless TypeScript function/composable over a pre-built lookup index.

The core problem it solves is **specificity with stability**: as moves are played, the named opening grows more specific (Open Game → King's Pawn Game → Italian Game → Italian Game: Giuoco Pianissimo), and once the players leave the book, the system locks the *last* recognized opening rather than reporting "unknown." It also handles **transposition** — two different move orders that reach the same position should resolve to the same opening — by keying the index on the board position (EPD) rather than the literal move string.

The player never calls this system. They experience it once, in Post-Game Review, as a single line of text at the top of their game: "You played the Italian Game." That one line is the entire payoff — a name attached to the moves they made, connecting their game to a body of knowledge they can study.

## Player Fantasy

The player finishes a game, opens the review, and sees a name they can hold onto: *"This was the Italian Game."* The moves they made — which felt improvised, or copied from half-remembered advice — turn out to have a name, a history, and a place in chess theory. The abstract becomes legible. The player can now search "Italian Game" on chess.com or lichess, recognize it next time, and feel the quiet satisfaction of *"I know what I played."*

This is knowledge connecting to play (Pillar 2): the opening name is the first thread linking a real game the player played to the larger map of chess they are slowly learning. Over many games, the player starts to see their own repertoire emerge — "I keep ending up in the Caro-Kann" — without anyone grading them for it.

The tone is strictly informational, never evaluative (Pillar 3: No Pressure). The system reports *what* opening was played, never whether it was a *good* opening, never "you should have played X," never a difficulty or accuracy rating. "Italian Game" is a label, not a score. If the game left known theory at move 3, the system says so plainly ("Italian Game — left book at move 3"), with no implication that leaving book early is a mistake.

**Reference points:**
- **lichess opening explorer / analysis board** — names the opening at the top of the board, neutrally, as you play through moves
- **A reference librarian** — tells you what a thing is called and where to read more, never judges your taste

**Explicitly NOT this system's job:**
- No "good opening / bad opening" judgment, no opening-quality score, no win-rate statistics (that is data this app deliberately does not surface — Pillar 3)
- No move-quality display — that is Post-Game Review's job (a neutral pawn-swing number from Chess Engine eval deltas; no "inaccuracy / mistake / blunder" classification ladder)
- No suggestion of what opening the player *should* play, no repertoire coaching (Phase 2 territory at most)
- No engine analysis — this is a dictionary lookup, not an evaluation

The fantasy is recognition, not correction. The player leaves the review knowing the *name* of what they did, which is the first step toward studying it deliberately.

## Detailed Design

### Core Rules

1. **Data source**: The lichess `chess-openings` dataset — five TSV files (`a.tsv`–`e.tsv`, one per ECO volume), each row containing `eco`, `name`, and `pgn` (SAN move sequence). The dataset is ~3,500 named opening positions. It is bundled as a **build-time-compiled lookup index**, not parsed from TSV at runtime.

2. **Position-keyed index (transposition handling is structural, not special-cased)**: Each dataset row's `pgn` is replayed through `chess.js` to derive the position's **EPD** (Extended Position Description — the first four FEN fields: piece placement, side to move, castling rights, en passant target; **halfmove clock and fullmove number are dropped**). The index is a `Map<epd, { eco, name, ply }>` where `ply` is the move count at which that named position is reached. Because two different move orders that reach the same legal position produce the same EPD, transposition resolves automatically — no separate transposition table or alias list is needed.

3. **Input — a game is identified from its full move sequence**: The primary entry point accepts the ordered list of moves of a game and returns the identification result. **Move encoding is UCI long-algebraic** (e.g., `e2e4`, `e7e8q`), aligned with the frozen Chess Engine GDD's `PlayResult.bestMove` UCI output. Each move is **normalized through `chess.js` before being applied**, so SAN is also accepted as a tolerated alternative (chess.js disambiguates either form against the current position). Internally it walks the moves ply by ply, computing the EPD after each ply and checking the index.

4. **Longest-prefix match (most specific known opening wins)**: As the system walks the move sequence, every ply whose resulting EPD is in the index is a *candidate*. The system keeps the candidate reached at the **highest ply** — the deepest (most specific) recognized position. Example: after 1.e4 e5 the index matches "King's Pawn Game" (ply 2); after 2.Nf3 Nc6 3.Bc4 it matches "Italian Game" (ply 5). The system reports the Italian Game (ply 5), because it is the deepest position still in the book, even though shallower positions also matched.

5. **Last-known-opening lock (leaving the book)**: Once the move sequence reaches a ply whose EPD is **not** in the index, and no deeper ply is in the index either, the identification is **locked to the deepest matched opening so far**. The system records the ply at which the game left the book (`bookExitPly` = first unmatched ply after the deepest match). The opening name does not change for the rest of the game, no matter how many more moves are played. A game can re-enter and exit the book multiple times (rare transpositions back into theory); the rule is always "deepest matched EPD across the whole walk wins."

6. **Result contract** — the system returns a single structured `OpeningResult`. This interface is the **single source of truth** for the API surface (the Pillar-enforcement type-check AC asserts against exactly these fields):

   ```typescript
   interface OpeningResult {
     eco: string | null;          // ECO code (e.g., "C53"); null if no position ever matched
     name: string | null;         // full opening name (e.g., "Italian Game: Giuoco Pianissimo"); null if no match
     matchedPly: number;          // ply at which the deepest match was reached; 0 if no match
     bookExitPly: number | null;  // ply at which the game left known theory; null if it never left the book
     isUnknown: boolean;          // true if no position in the entire sequence matched the index
     epd: string;                 // EPD of the matched position; empty string if unknown
   }
   ```

   - `eco` — ECO code (e.g., "C53"), or `null` if no position ever matched
   - `name` — full opening name (e.g., "Italian Game: Giuoco Pianissimo"), or `null` if no match
   - `matchedPly` — ply at which the deepest match was reached (0 if no match)
   - `bookExitPly` — ply at which the game left known theory; `null` if the game never left the book (every played ply matched up to game end) — distinct from a game that never entered it
   - `isUnknown` — `true` if no position in the entire sequence matched the index (not even ply 1–2)
   - `epd` — the EPD of the matched position (for downstream cross-referencing / Phase 2 linking); empty string if unknown

7. **Position-only entry point (for replay scrubbing)**: A secondary entry point accepts a **single EPD** (or full FEN, from which EPD is derived) and returns `{ eco, name } | null` for *that exact position*. This is the "what is the name of this specific position" lookup used when the player scrubs to an arbitrary move in Post-Game Review. It does **not** do longest-prefix logic — it is a single `Map.get`. The walk-the-whole-game entry point (Rule 3) is what produces the locked headline opening; the position-only entry point answers "what is the board showing *right now*."

8. **Move-number / side-to-move convention**: "Ply" counts half-moves (1.e4 = ply 1, 1...e5 = ply 2). "Move N" in player-facing strings uses standard full-move numbering (`Math.ceil(ply / 2)`) with side annotation if needed. `bookExitPly` is reported to the player as a full move number ("left book at move 4").

9. **Determinism and statelessness**: Given the same move sequence and the same pinned dataset version, the result is byte-for-byte identical every call. The system holds no mutable state between calls; the index is immutable and shared (built once, read-only).

10. **No engine, no network, no async at lookup time**: The index is in memory after a one-time build/load. A single lookup is synchronous. (Index *construction* may be a build step or a one-time async module load — see Formula 4 and Edge Cases — but per-position lookup is sync `Map.get`.)

### Identification Walk (algorithm summary)

```
walk(moves):
  best = { eco: null, name: null, matchedPly: 0, epd: "" }
  bookExitPly = null
  board = startingPosition()
  for i in 0 .. moves.length - 1:
    board.apply(moves[i])
    ply = i + 1
    hit = index.get(board.epd())
    if hit != null:
      if ply > best.matchedPly:
        best = { eco: hit.eco, name: hit.name, matchedPly: ply, epd: board.epd() }
      bookExitPly = null            // still in book; clear pending exit
    else if best.matchedPly > 0 and bookExitPly == null:
      bookExitPly = ply             // first unmatched ply AFTER a real match
  isUnknown = (best.matchedPly == 0) or (best.matchedPly < minMatchPlyToReport)
  if isUnknown:
    return { eco: null, name: null, matchedPly: 0, bookExitPly: null, isUnknown: true, epd: "" }
  return {
    ...best,
    bookExitPly: (best.matchedPly == moves.length) ? null : bookExitPly,
    isUnknown: false,
  }
```

`minMatchPlyToReport` (Tuning Knobs, default `1`) gates the final result: a match shallower than this threshold is collapsed to the unknown result so the system never reports a name it considers too generic to be useful. At the default of `1`, any real match (matchedPly ≥ 1) reports normally.

The walk is **O(number of plies)** — one `Map.get` per ply, never a scan of the ~3,500-entry dataset. This is the performance requirement from the system brief (Formula 3).

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Post-Game Review** | IN ← | Calls `identifyOpening(moves)` once with the completed game's full move list — **moves are UCI long-algebraic** (aligned with Chess Engine `PlayResult.bestMove`); SAN also accepted (chess.js-normalized) |
| **Post-Game Review** | OUT → | Returns `OpeningResult` (headline opening for the game) |
| **Post-Game Review** | IN ← | (Optional, replay scrubbing) Calls `identifyPosition(fenOrEpd)` per displayed position |
| **Post-Game Review** | OUT → | Returns `{ eco, name } | null` for the single position |

**Cross-system notes** (documented for downstream GDDs, not owned here):
- **Move-quality display** is Post-Game Review's job via Chess Engine eval deltas (a neutral pawn-swing number, no classification ladder) — Opening ID never evaluates quality.
- **Move list / annotation rendering** (where the "Italian Game" headline is *placed* on screen, fonts, layout) is owned by Post-Game Review + Move Annotation Display, not this system. Opening ID returns strings only.
- **Phase 2 bidirectional lesson linking** may consume the `epd` field to match a played opening to lessons about that opening. That linking logic is out of scope here; this system only guarantees a stable EPD key.

## Formulas

This system has one core matching algorithm (already given in pseudocode above) plus three design-level numeric/throughput constraints. There is no probability, scoring, or balance math — opening identification is deterministic lookup.

### Formula 1: Longest-prefix specificity selection

`matchedPly = max{ ply ∈ [1, N] : epd(after ply) ∈ index }`

`result = index.get(epd(after matchedPly))`

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| `N` | int | 0–600+ | Total plies in the game (typical game 40–80 plies; legal max far higher) |
| `ply` | int | 1–N | Half-move index being tested |
| `epd(after ply)` | string | — | EPD of the board position after applying plies 1..ply |
| `matchedPly` | int | 0–N | Deepest ply whose position is in the index; **0 means no match at all** |

**Output range:** `matchedPly ∈ [0, N]`. The result is the index entry at `matchedPly`, or the empty/`null` result when `matchedPly = 0`.

**Why "max ply" and not "first match":** shallower positions (King's Pawn Game at ply 2) are *also* in the index, but the deepest match (Italian Game at ply 5) is the most specific and most useful name. Taking the max ply is the entire point of "longest-prefix."

**Example:** Moves `1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.d3 d6` (8 plies). Index hits at ply 2 (King's Pawn Game), ply 4 (King's Knight Opening), ply 5 (Italian Game), ply 6 (Italian Game: Giuoco Pianissimo), ply 7/8 (deeper Giuoco Pianissimo lines if present). `matchedPly = 8` if ply 8's EPD is in the index, else the deepest that is. Result = the name at `matchedPly`.

### Formula 2: Book-exit ply

`bookExitPly = min{ ply ∈ (matchedPly, N] : epd(after ply) ∉ index }`, or `null` if no such ply exists (game ended still in book) **and** `matchedPly > 0`.

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| `matchedPly` | int | 0–N | Deepest matched ply (Formula 1) |
| `N` | int | 0–600+ | Total plies |
| `bookExitPly` | int \| null | matchedPly+1 .. N, or null | First ply after the deepest match that is not in the index |

**Output range:** `bookExitPly ∈ [matchedPly+1, N]` or `null`.
**Edge of definition:** if `matchedPly = 0` (never matched), `bookExitPly = null` and `isUnknown = true` — the concept of "leaving the book" does not apply to a game that never entered it. If `matchedPly = N` (every ply matched to game end — only possible for very short games that are entirely book), `bookExitPly = null`.

**Example:** Game above, suppose ply 6 (Giuoco Pianissimo) is the deepest index hit and ply 7 is not in the index. Then `matchedPly = 6`, `bookExitPly = 7` → player-facing "left book at move 4" (`ceil(7/2) = 4`).

### Formula 3: Lookup time complexity (performance constraint)

`lookupCost = N × c_get` where `c_get` = cost of one `Map.get(epd)` (hash lookup, ~O(1) amortized).

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| `N` | int | 0–600+ | Plies in the game |
| `c_get` | time | ~constant | One hash-map lookup over the index |
| `lookupCost` | time | — | Total identification time for one game |

**Output range / target:** For a typical 80-ply game, `lookupCost` ≈ 80 hash lookups + 80 incremental `chess.js` move applications + 80 EPD string derivations. Target **< 5ms** on desktop, **< 20ms** on iPhone Safari — negligible against the post-game review budget. **This formula exists to forbid the naive implementation**: scanning all ~3,500 dataset rows per ply (which would be `N × 3500` string comparisons, ~280,000 ops for an 80-ply game) is **prohibited** by Rule 2 (position-keyed `Map`).

**Example:** 80-ply game → ~80 `Map.get` calls. A full-table-scan implementation would do ~280,000 comparisons. The hash-index approach is ~3,500× faster and is the required design.

### Formula 4: Index build size / load budget (constraint)

`indexEntries ≈ datasetRows` (≈ 3,500); `indexMemoryMB ≈ indexEntries × bytesPerEntry / 1e6`

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| `datasetRows` | int | ~3,000–4,000 | Number of named opening positions in pinned dataset |
| `bytesPerEntry` | int | ~120–250 | EPD key (~40–60 bytes) + name (~30–80) + eco (3) + ply (int) + Map overhead |
| `indexMemoryMB` | float | ~0.5–1.0 | Total resident index size |
| `bundleKB` (gzipped) | int | 80–200 | Pre-compiled index shipped in the JS bundle (gzipped) |

**Output range:** Index resident memory ~0.5–1MB — trivial against the 150MB app ceiling. Gzipped bundle contribution target **≤ 150KB** (EPD strings compress well due to shared prefixes; names have high redundancy). **Why a constraint, not a knob:** these values are *measured* from the pinned dataset, not configured. The design rule they enforce: **the index must be pre-built at compile time** (a generated `.ts` or `.json` module), never parsed from raw TSV in the browser at runtime (which would cost a TSV download + 3,500 `chess.js` replays on the user's device — wasteful and slow on mobile).

## Edge Cases

**Match / specificity edge cases:**
- **If a game never matches any indexed position** (e.g., 1.a4 a5 2.h4 h5 — a legal but un-named sequence not in the dataset): `matchedPly = 0`, `isUnknown = true`, `eco = null`, `name = null`, `bookExitPly = null`, `epd = ""`. Post-Game Review displays "Unknown opening" (or omits the opening line — its choice). The system does **not** invent a name or fall back to a generic label.
- **If only the first one or two plies match** (e.g., 1.e4 then immediately into an un-named line): the system reports the shallow opening (e.g., "King's Pawn Game") and `bookExitPly` at the first unmatched ply. A very generic name is still a real name — this is correct, not an error.
- **If the deepest matched position is reached by transposition** (e.g., 1.Nf3 Nc6 2.e4 e5 3.Bc4 → same position as the Italian Game reached via 1.e4): because the index is EPD-keyed, the transposed sequence resolves to the **same** opening name as the canonical move order. The reported `matchedPly` reflects the actual ply count of *this* game's path, which may differ from the dataset row's canonical ply — that is expected and acceptable.
- **If a game leaves the book, then transposes back into a named position later** (rare): the walk continues checking every ply, so a later in-book ply *can* become the new deepest match and **resets `bookExitPly` to `null`** until the next unmatched ply. "Deepest matched EPD across the whole walk wins" is the invariant (Rule 5).
- **If two dataset rows map to the same EPD with different names** (data ambiguity within the dataset itself): the index build must be **deterministic** — on EPD collision during build, keep the row with the **longer/more-specific name** (longer `pgn`, i.e., higher canonical ply); if still tied, keep the lexicographically first `eco` for stability. This collision policy is applied at **build time** and logged, never resolved at runtime. (See Open Question #2.)

**Input / data edge cases:**
- **If the move list is empty** (`N = 0`, game has no moves — shouldn't happen post-game but defend anyway): return `isUnknown = true`, all fields null/0/empty. The starting position itself is **not** treated as a named opening (the dataset's empty/start row, if present, is excluded at build time — "Starting Position" is not a useful opening name to display).
- **If a move in the list is illegal / cannot be applied by `chess.js`**: this is a programmer/data-integrity bug, not a player concern (the move list comes from a completed, validated game). The walk **stops at the last successfully applied ply**, returns the deepest match found *up to that point*, and logs a console error. It does not throw — Post-Game Review still gets a usable (possibly shallower) result rather than crashing the review screen.
- **If the input is given as a FEN/EPD for the position-only entry point and the FEN is malformed**: canonicalize via `chess.js.load(fen)`; if `chess.js` rejects it, return `null` (no match) and log a console error. Never throw to the caller.
- **If the position-only entry point is given a full FEN that differs from an indexed EPD only in halfmove/fullmove counters**: it still matches, because the lookup derives EPD (drops those two fields) before `Map.get`. This is the *intended* behavior — a position is the same opening regardless of the move clock.
- **Move input format (UCI-first)**: the entry point contract is **UCI long-algebraic** (e.g., `e2e4`, `e7e8q`), to align with the frozen Chess Engine GDD's `PlayResult.bestMove` UCI output. The wrapper **always normalizes via `chess.js` before applying** each move, so SAN input is also accepted (chess.js disambiguates either form against the current position). There is no format ambiguity: UCI is the declared contract, SAN is a tolerated alternative, both pass through chess.js normalization. (Resolved — see Open Question #1.)

**Index / build edge cases:**
- **If the pre-built index module fails to load** (corrupt build artifact, bundler misconfiguration): the system raises at module init, not at lookup — surface loudly during build/test, never silently return "unknown" for every game in production. A missing index is a build failure, not a runtime degradation.
- **If the pinned dataset version changes between builds** (lichess updates `chess-openings`): opening names for some positions may shift (lichess renames/reclassifies over time). The dataset version is pinned in an ADR and the index is regenerated only on a deliberate dependency bump — never auto-fetched at runtime. Phase 2 note: persisted historical games store the *resolved name string* at review time, so a later dataset bump does not retroactively rewrite a player's past game labels (the name shown when they reviewed it is the name kept). (See Open Question #3.)
- **If two builds of the same dataset produce different indexes** (non-deterministic Map insertion order affecting collision resolution): the build collision policy (longer name, then lexical `eco`) makes the output **order-independent and reproducible** — required by the project's determinism testing standard.

**En passant / castling EPD subtlety:**
- **If two positions look identical on the board but differ in en passant availability or castling rights** (e.g., a pawn that just made a double-step creates an en passant target square in the EPD): EPD **includes** castling rights and the en passant target field, so these are correctly treated as *different* positions. This matters: the same piece arrangement with vs without a live en passant target is genuinely a different position for opening-theory purposes, and the lichess dataset's FEN keys already encode this. The build must use the **same en passant convention as the dataset** (lichess records the en passant target square whenever a double pawn push occurs, regardless of whether a capture is actually legal). (See Open Question #4 — confirm `chess.js` EPD en passant convention matches the dataset's, or normalize.)

**Player-facing string edge cases:**
- **If the opening name contains a colon-delimited variation** (lichess style: "Sicilian Defense: Najdorf Variation"): pass the full string through unchanged. Do not truncate or split — Post-Game Review decides whether to show the full name or the base name.
- **If `bookExitPly` equals `matchedPly + 1` and `matchedPly` is very deep** (game followed theory deep then deviated): "left book at move N" with a large N is correct and informative — no special handling.

## Dependencies

### Upstream dependencies (this system depends on)

**None.** This is a Foundation-layer system with no internal dependencies. It does not depend on Chess Engine Integration (no evaluation), Game Lifecycle, or any UI system.

### External dependencies (third-party libraries / data)

| Dependency | Version | Purpose | Replaceable? |
|------------|---------|---------|--------------|
| `chess-openings` (lichess) | pinned (ADR) | Source data: ECO code + name + move sequence per opening position | Yes — could swap for `eco.json` or another ECO dataset; would change name coverage and require re-deriving EPD keys |
| `chess.js` | (bundled with vue3-chessboard) | Replays move sequences to derive EPD at build time and at lookup time | Yes — could swap for chessops, but the project standardizes on chess.js (Chess Board GDD) |

> **Pinning decision**: The `chess-openings` dataset version must be pinned in an ADR. Lichess updates names and classifications over time; an unpinned dependency would make opening labels non-reproducible across builds and could silently change a player's historical game labels. The ADR records the exact dataset commit/version and the build step that compiles it into the index module.

> **Build-time vs runtime**: `chess.js` is used at **build time** to derive EPD keys for ~3,500 dataset rows (generating the index module) and at **runtime** only to replay the *current game's* moves (~80 applications). The raw TSV files are **not** shipped to the browser.

### Downstream dependents (systems that depend on this)

| System | What they need from us | Interface |
|--------|----------------------|-----------|
| **Post-Game Review** | The headline opening name + ECO for a completed game | `identifyOpening(moves: Move[]) → OpeningResult` |
| **Post-Game Review** | (Optional) the opening name of a specific scrubbed-to position | `identifyPosition(fenOrEpd: string) → { eco, name } | null` |
| **Opening Knowledge Cards** (system #8b, v0, added 2026-05-28) | The ECO code from `OpeningResult.eco` to look up a hand-authored knowledge card (one-paragraph description of the opening's core idea). Reads the same `OpeningResult` Post-Game Review already has; does NOT call `identifyOpening` separately. | (consumes existing `OpeningResult.eco` field — no new interface required) |

### Bidirectional consistency notes (handoff to Post-Game Review)

When the **Post-Game Review** GDD is authored, it must declare:
- Calling `identifyOpening(moves)` **once** with the completed game's full move list, and consuming the `OpeningResult` (headline opening shown at the top of the review).
- **Handling `isUnknown = true`** explicitly — deciding whether to render "Unknown opening" or omit the opening line entirely. Opening ID returns `null` name/eco; the *display decision* is Post-Game Review's.
- **Rendering `bookExitPly`** (if shown) as a neutral, non-evaluative string ("Left book at move N"), never as criticism — to preserve Pillar 3. Opening ID supplies the ply number only; the wording and the "no judgment" framing is enforced in Post-Game Review's copy.
- **Owning move-quality display** (a neutral pawn-swing number via Chess Engine eval deltas; no classification ladder) — Opening ID contributes nothing to per-move quality.
- That the move-input **format** passed to `identifyOpening` matches this system's contract: **UCI long-algebraic** (aligned with Chess Engine `PlayResult.bestMove`), SAN tolerated via chess.js normalization (Open Question #1, resolved).
- (Phase 2) If lesson linking is built, it may consume the `epd` field of `OpeningResult` to match the played opening to opening lessons — Opening ID guarantees a stable EPD key but owns no linking logic.

### Soft dependencies (enhanced by but not required)

- **None.** This system runs fully standalone with only its bundled index. It has no Audio, no UI, no engine, and no persistence dependency. (Persistence of the *resolved name* with a saved game is Game History's concern — see the dataset-version edge case.)

## Tuning Knobs

This system is deterministic lookup with almost nothing to tune — there are no thresholds, weights, or timing values that change the *result*. The few configurable values are build-policy and presentation toggles, not gameplay tuning.

| Knob | Default | Safe Range | What breaks if too high | What breaks if too low / wrong |
|------|---------|-----------|------------------------|-------------------------------|
| `datasetVersion` (pinned) | latest ADR-pinned commit | any released `chess-openings` version | Newer dataset may rename openings, shifting labels on re-review; must regenerate index | Older dataset misses recently-named openings; more games report shallower or unknown names |
| `excludeStartPosition` | `true` | `true` / `false` | If `false`, every game matches the start position and reports a useless "Starting Position" name | If `true` (default), games with zero real opening match return `isUnknown` cleanly |
| `collisionPolicy` | `longest-name-then-lexical-eco` | `longest-name-then-lexical-eco` only (others non-deterministic) | Any other policy risks non-reproducible builds (violates determinism standard) | — (this is the only safe policy) |
| `nameStyle` | `full` (lichess colon-style) | `full` / `base` (strip after first colon) | `base` loses variation specificity ("Sicilian Defense" instead of "Najdorf Variation") — less useful in review | `full` is the safe default; presentation trimming is better done in Post-Game Review's display layer |
| `minMatchPlyToReport` | `1` | `0`–`2` | Gates the final result in the walk's return logic: a match with `matchedPly < minMatchPlyToReport` is collapsed to the unknown result. If raised to 2+, very short games that only match ply 1 report `isUnknown` even though a (generic) name exists — discards real info | `0` would let the start position match (conflicts with `excludeStartPosition`) |

### Interaction notes

- **`datasetVersion` is the only consequential knob** and it is *not* a runtime setting — it is an ADR-pinned build input. Changing it regenerates the index and may change labels; it must be a deliberate, reviewed bump, never automatic.
- **`collisionPolicy` must stay `longest-name-then-lexical-eco`** to satisfy the project's determinism testing standard (tests must produce the same result every run). Any "pick first seen" policy depends on dataset row order and is forbidden.
- **`nameStyle` vs Post-Game Review trimming**: prefer keeping `full` here and letting Post-Game Review trim for display, so the full name is always available for Phase 2 lesson linking. `base` here would discard data permanently.
- **None of these knobs affect the matching *algorithm*** — longest-prefix + last-known lock is fixed design, not tunable. There is intentionally no "fuzzy match threshold" or "similarity score": opening identification is exact-position lookup, not approximate matching.

### Source of truth

The dataset version, collision policy, and exclusion flags live in the **index build script / config** (e.g., `tools/build-openings-index.ts` + `src/config/openings.ts`), executed at build time to emit a generated index module (e.g., `src/data/openings-index.generated.ts`). Presentation knobs (`nameStyle`) that affect runtime are read by the lookup composable but **not** exposed to end users via Settings — these are system-level, not preference-level.

## Acceptance Criteria

### Longest-prefix matching

- **GIVEN** the move sequence `1.e4 e5 2.Nf3 Nc6 3.Bc4`, **WHEN** `identifyOpening(moves)` is called, **THEN** `name` equals the exact `name` string AND `eco` equals the exact `eco` code that the **pinned dataset version** records for this ply-5 EPD AND `matchedPly = 5`. <!-- TODO(OQ#6): pin dataset, then fill the concrete name/eco as a fixture constant (expected ~"Italian Game" / "C5x"). -->
- **GIVEN** the move sequence `1.e4 e5` only, **WHEN** `identifyOpening` is called, **THEN** `name` equals the exact King's-Pawn-family name string the **pinned dataset** records for this ply-2 EPD AND `matchedPly = 2` AND the result is **not** `isUnknown`. <!-- TODO(OQ#6): pin dataset, then fill the concrete name/eco fixture constant. -->

> **Name/ECO fixtures pending dataset pin**: Acceptance criteria that assert a specific opening *name* or *eco* string are written against the **pinned `chess-openings` dataset version**. The concrete expected strings are filled in as fixture constants once Open Question #6 (dataset version pin) and Open Question #2 (collision policy verification) are resolved. Until then, these ACs assert "the exact value the pinned dataset records for this EPD" with a TODO marker — they are verifiable the moment the dataset is pinned.
- **GIVEN** a sequence where the deepest indexed position is at ply 6 but plies 2, 4, and 5 also match, **WHEN** `identifyOpening` is called, **THEN** `matchedPly = 6` (the deepest, not the first) AND the returned name corresponds to the ply-6 position (Formula 1).

### Transposition

- **GIVEN** two move sequences that reach an identical legal position via different orders — `1.e4 e5 2.Nf3 Nc6 3.Bc4` and `1.Nf3 Nc6 2.Bc4 e5 3.e4` — **WHEN** `identifyOpening` is called on each, **THEN** both return the **same** `name`, the **same** `eco`, and the **same** `epd` (transposition resolves to one opening; only `matchedPly` may differ per path).
- **GIVEN** a game that leaves the book at ply 5 then transposes back into a named position at ply 9, **WHEN** `identifyOpening` is called, **THEN** `matchedPly = 9` (the later, deeper match wins) AND `bookExitPly` reflects the first unmatched ply *after* ply 9, or `null` if the game ended in book (Rule 5 invariant).

### Book exit / last-known lock

- **GIVEN** a game that follows the Italian Game to ply 6 then plays an un-named move at ply 7 and continues for 40 more plies, **WHEN** `identifyOpening` is called, **THEN** `name` is the ply-6 opening (locked) AND `matchedPly = 6` AND `bookExitPly = 7` AND the name does **not** change due to the later moves.
- **GIVEN** a very short game that stays entirely in book to its final ply, **WHEN** `identifyOpening` is called, **THEN** `bookExitPly = null` AND `isUnknown = false` (distinguishable from a never-matched game).

### Unknown / never-matched

- **GIVEN** a legal but un-named sequence (e.g., `1.a4 a5 2.h4 h5`), **WHEN** `identifyOpening` is called, **THEN** `isUnknown = true` AND `eco = null` AND `name = null` AND `bookExitPly = null` AND `matchedPly = 0` AND `epd = ""`.
- **GIVEN** an empty move list (`N = 0`), **WHEN** `identifyOpening([])` is called, **THEN** `isUnknown = true` AND no exception is thrown AND the start position is **not** reported as a named opening (`excludeStartPosition` honored).

### Position-only entry point

- **GIVEN** the EPD of a known Italian Game position, **WHEN** `identifyPosition(epd)` is called, **THEN** it returns `{ eco, name }` for exactly that position via a single map lookup (no prefix walk).
- **GIVEN** a full FEN of a known opening position that differs from the indexed EPD only in the halfmove clock and fullmove number, **WHEN** `identifyPosition(fen)` is called, **THEN** it still returns the correct `{ eco, name }` (EPD derivation drops the two clock fields before lookup).
- **GIVEN** a malformed FEN string, **WHEN** `identifyPosition(badFen)` is called, **THEN** it returns `null` AND logs a console error AND does **not** throw.
- **GIVEN** a legal but un-named position's EPD, **WHEN** `identifyPosition(epd)` is called, **THEN** it returns `null`.

### En passant / castling distinction

- **GIVEN** two positions with identical piece placement but differing en passant target squares (one immediately after a double pawn push, one not), **WHEN** each EPD is looked up, **THEN** they are treated as distinct positions (EPD includes the en passant field) AND match the dataset's corresponding distinct entries (or both miss, consistently).
- **GIVEN** two positions identical except for castling rights (one side has lost the right to castle), **WHEN** each EPD is looked up, **THEN** they are treated as distinct positions.

### Determinism & build

- **GIVEN** the same pinned dataset version, **WHEN** the index is rebuilt twice, **THEN** the two generated index modules are byte-identical (collision policy makes the build order-independent).
- **GIVEN** the same move sequence and pinned dataset, **WHEN** `identifyOpening` is called repeatedly, **THEN** the result is identical every call (no mutable state, no time/random dependence) — satisfies the determinism testing standard.
- **GIVEN** two dataset rows that resolve to the same EPD with different names, **WHEN** the index is built, **THEN** the entry kept is the one with the longer name (then lexically-first `eco` on tie) AND a build-time log records the collision.
- **(Build-time, en passant convention)** **GIVEN** a named position in the dataset that is reached by a double pawn push and has **no legal en passant capture available**, **WHEN** the build replays that row's `pgn` through `chess.js` to produce its EPD, **THEN** the en passant target field of the generated EPD matches the en passant field the lichess dataset expects for that row's FEN — OR the build applies the **same en passant normalization** to both the dataset-derived keys and the runtime lookup keys, so the two conventions can never silently diverge (lands the Open Question #4 risk as a verifiable build gate).

### Robustness

- **GIVEN** a move list containing an illegal move at ply K (data-integrity bug), **WHEN** `identifyOpening` is called, **THEN** the walk stops at ply K−1, returns the deepest match found up to ply K−1, logs a console error, and does **not** throw (Post-Game Review still receives a usable result).
- **GIVEN** the pre-built index module is missing or corrupt, **WHEN** the module initializes, **THEN** the failure surfaces at build/init time (loud error), **not** as silent per-game "unknown" results in production.

### Pillar enforcement (structural)

- **GIVEN** the public TypeScript type `OpeningResult`, **WHEN** the type definition is statically inspected (compiler check or `expect-type` assertion), **THEN** it contains ONLY the fields `eco`, `name`, `matchedPly`, `bookExitPly`, `isUnknown`, `epd` — and explicitly **NOT** any of: `quality`, `rating`, `score`, `goodness`, `winRate`, `recommendation`, `judgment`, `accuracy`, or any evaluative/comparative field name. (Anchors Pillar 3 "No Pressure" — opening identification is information, never grading — and Pillar 2 "Knowledge Connects to Play" into the API surface; quality lives in Post-Game Review, not here.)

### Performance

- **GIVEN** an 80-ply game, **WHEN** `identifyOpening` is called on a desktop Chromium CI runner, **THEN** it completes in **< 5ms** AND performs at most `N` index lookups (verified via a `Map.get` spy: call count ≤ N, never ≈ 3,500 × N — Formula 3 forbids the full-scan implementation).
- **GIVEN** the built openings index, **WHEN** its gzipped bundle contribution is measured, **THEN** it is **≤ 150KB gzipped** (Formula 4) AND its resident memory is **≤ 1MB**.
- **GIVEN** an 80-ply game on a real iPhone Safari 16+ device (manual evidence, ADVISORY), **WHEN** `identifyOpening` is timed, **THEN** it completes in **< 20ms** — documented in `production/qa/evidence/`.

## Open Questions

### Design questions

1. **Move-input format contract** — **RESOLVED (2026-05-27)**: The input contract is **UCI long-algebraic** (e.g., `e2e4`, `e7e8q`), aligned with the frozen Chess Engine GDD's `PlayResult.bestMove` UCI output so the two systems share one move encoding. The wrapper **always normalizes each move through `chess.js` before applying**, which means SAN is also consumable as a tolerated alternative — chess.js disambiguates either form against the current position. Downstream (Post-Game Review) converts to/from UCI via chess.js as needed. No further alignment required.

2. **EPD collision resolution within the dataset**: Confirm the lichess dataset actually contains FEN-key duplicates (same position, different names), and that "longer name, then lexical `eco`" is the desired tiebreak. If the dataset guarantees unique FEN keys, this collision handling is defensive-only. **Owner**: Eason (data inspection during prototype). **Resolution**: Before v0 — inspect the pinned dataset; lock the policy in the build ADR.

3. **Historical-game label stability across dataset bumps**: When the dataset is updated and an opening is renamed, should a player's *already-reviewed* games keep the old name (snapshot at review time) or adopt the new one? Recommendation: snapshot the resolved name with the saved game (Game History stores the string), so past labels never silently change. **Owner**: Game History GDD (MVP) + this system's ADR. **Resolution**: Before Game History is implemented; document the intent in the Opening ID ADR now.

4. **`chess.js` EPD en passant convention vs dataset**: lichess records an en passant target square on every double pawn push (even when no capture is legal); some FEN generators only record it when a capture is actually available. If `chess.js`'s EPD output diverges from the dataset's convention, otherwise-identical positions will fail to match. **Owner**: gameplay-programmer (verify during prototype). **Resolution**: Before v0 — confirm conventions match, or normalize the en passant field on both the index keys and lookup keys consistently. **Blocking**: yes (a convention mismatch silently breaks a class of matches). A build-time AC now exists (Acceptance Criteria → Determinism & build) to lock this as a verifiable gate.

7. **Illegal-move failure philosophy (cross-system, pending alignment)**: On a data-integrity bug (an illegal move in the supposedly-validated game list), this system currently stops the walk at the last applied ply, returns the deepest match so far, logs a console error, and does **not** throw (Edge Cases → Input/data; Acceptance Criteria → Robustness). Whether Post-Game Review should *surface* this degraded result to the player (and how — silent shallower name, a diagnostic banner, or suppress the opening line) must align with Post-Game Review's degradation UX. **Owner**: Post-Game Review GDD author + Eason. **Resolution**: When Post-Game Review is authored. **Note**: this is a handoff-alignment question only — the internal failure behavior here is **not** being changed; only the downstream presentation contract is open.

### Technical questions

5. **Index artifact format**: Generated `.ts` module (tree-shakeable, type-safe, larger source) vs generated `.json` loaded via `import` (smaller source, runtime parse) vs a compact binary/packed string. Recommendation: generated `.ts` with a plain object literal for v0 simplicity; revisit if bundle budget (Formula 4) is exceeded. **Owner**: ui-programmer. **Resolution**: During v0 implementation — measure against the ≤150KB gzipped budget.

6. **Dataset version pinning ADR**: A short ADR is required to lock the exact `chess-openings` dataset version/commit and document the build step that compiles it into the index. Mirrors the Chess Engine GDD's Stockfish-pinning ADR. **Owner**: technical-director + Eason. **Resolution**: Before v0 implementation begins. **Blocking**: yes (without a pinned version, opening labels are not reproducible across builds — fails the determinism standard).
