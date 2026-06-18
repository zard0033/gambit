# 棋憶 (Memory)

> **Status**: Draft (revised after design-review 2026-06-18 — MAJOR REVISION applied)
> **System**: #22 (Phase 2 differentiation — the moat)
> **Design SoT (approved demo)**: [design/demos/highlight-replay-demo.html](../demos/highlight-replay-demo.html) (v9, 7 rounds, Eason approved 2026-06-17)
> **Differentiation north star**: [production/gambit-differentiation-vision.md](../../production/gambit-differentiation-vision.md)
> **Voice SoT**: [design/gambit-design-system/persona-neve.md](../gambit-design-system/persona-neve.md) (§「回顧態」register + §「Neve 視覺嗓音」)

---

## Overview

棋憶 ("chess-memory" — a pun on 記憶, echoing "Neve remembers you") reframes the post-game
experience from a 40-move scrollthrough into a calm, **dashboard-first memory of one game**.
The dashboard opens with a Neve qualitative line, a quiet **shape-of-the-game** eval view (tap →
move-by-move replay), and a short list of **0–5 highlighted moments** (tap → an animated slideshow
that re-plays the moment). It is the UX layer of Phase 2 ① — *"the lessons grow on your own
games"* — and the product's largest moat.

棋憶 runs **no new Stockfish analysis**: it is a selection-and-presentation layer over the data
Post-Game Review (#7) already computed (`analysisResults`, `cpLoss[]`, `biggestSwingCursor`) and the
mistake classifier Learning Loop (#20) already provides (`classify()`, `selectMistakeSignposts()`).
It does derive a few presentation values itself (a White-normalized eval series for the trend chart,
a favorable-swing quantity) from #7's stored results — see F2. **The whole feature is zero-AI** in
v1 (Stockfish cpLoss + the `classify()` rule engine + Neve text templates). (v2, deferred to last:
free-form explanation of any position via Claude API / BYOK.)

---

## Player Fantasy

**The intended feeling: calm reflection, not a report card.** The player just finished a game.
Instead of a wall of 40 moves and per-move grades, 棋憶 hands them a small, legible memory:

- *"Neve looked at my game and noticed something about how I'm playing."* — the dashboard opens
  with a warm, second-person line in Neve's voice, framed as encouragement or a gentle invitation
  to look at something together — never a verdict or a ranking of weaknesses.
- *"I don't have to hunt for what mattered."* — at most a handful of moments are surfaced; a
  steady game surfaces almost nothing, and that is itself a calm signal (寧少勿濫 — fewer beats
  noise).
- *"I can see the shape of the whole game at a glance, and dive in if I want."* — the eval view is
  the whole arc in one quiet line; tapping it opens the full move-by-move replay for the curious.
  It is the *shape* of the game, not a performance score.
- *"The lesson is about *my* move, not an abstract puzzle."* — each surfaced moment shows *your*
  move vs. the better move, with Neve explaining why, in plain language.
- *"This game becomes part of a book that gets thicker."* — every game is silently saved as one
  journal entry (②/③); the running totals ("Neve remembers N games") live on the 棋誌 page, not
  here — 棋憶 stays single-game and quiet.

**Explicitly NOT:**
- No streak, timer, leaderboard, rating curve, or numeric "ability score" (the vision's anti-juice
  rule; the quantitative skill-score version is **cut**).
- **No cross-game weakness verdict** ("your endgame is your weakest stage" is a rating by another
  name — the vision's 「棋誌不是數據／不是評分」 guardrail and #7's "never forms a thematic verdict
  across games" both forbid it; cut from F4).
- No per-move letter grades. The only commentary is the few selected moments and one Neve line;
  everything else is silent.
- No engine vocabulary on the surface (the player never sees the internal moment taxonomy named).
- No AI-generated prose in v1 — every Neve sentence is a template filled from rule output.
- Not a re-skin of chess.com's analysis board: the default surface is the calm dashboard, and the
  dense board+eval+movelist replay is opt-in, one tap away.

---

## Detailed Design

### Core Rules

#### Group 1: Entry and Structure

1. 棋憶 is entered when the player opens a completed game's review — either from the Game Over
   screen (replacing today's direct-to-`ReviewView` entry) or by tapping that game's entry on the
   棋誌 page. The entry point change is a redesign of #7's `ReviewView` interaction model, not a
   new analysis pass. Back from the dashboard returns to **wherever the user came from** (Game Over
   or 棋誌), not a fixed destination.
2. 棋憶 has **three views**, navigated as a shallow stack (dashboard is the root; the other two are
   pushed and pop back to dashboard, including via the OS/browser back gesture):
   - **Dashboard** (root, landing) — Neve line + shape-of-game eval view + moment list.
   - **Moment slideshow** — one moment at a time, board with animated re-play of the moment.
   - **Move-by-move replay** — full board + eval bar + move list + prev/next, the dense surface.
3. **Dashboard vertical order** (v9 定版, reframed): (a) Neve line → (b) shape-of-game eval view →
   (c) moment list. Neve leads as the opening voice (深青卡＋頭像＋文楷, per visual-voice SoT). The
   eval view and moment list are present but **quiet** — the eval view reads as "the shape of the
   game," not a score, and the moment list is **chronological, not a severity ranking** (Rule 13);
   no verdict sentence sits above them.
4. Analysis is **not re-run on 棋憶 entry** when results already exist for this game. 棋憶 consumes
   `analysisResults` from #7's review store. If entered before analysis is COMPLETE, the dashboard
   renders progressively (EC-3); selection (F1) runs only at COMPLETE, so no moment is shown that
   will later disappear (pre-COMPLETE shows a quiet "still refining…" cue, never a vanishing card).

#### Group 2: Dashboard — Neve Line

5. The Neve card shows **one** qualitative line (F4), in Neve's 「回顧態」register: second-person
   ("你…"), active voice, does not impute intent, mistakes stated neutrally, good moves not
   reflexively praised.
6. The line is **encouragement** (an improving trend) or a **gentle invitation** (a recurring theme
   worth looking at together — "這個我們可以一起多看幾次"), or a calm single-game line. It is **never
   a weakness ranking or a verdict** (F4 has no `weak(stage)` branch). If the cross-game sample is
   insufficient (EC-7), the card shows a gentle single/first-game line, never a fabricated trend.
7. The Neve card carries no number bar, no score, no rating. It is text only (plus avatar). A bare
   count inside the sentence ("你最近{n}盤…") is allowed; a running total is not (that lives on 棋誌).

#### Group 3: Dashboard — Shape-of-Game Eval View (→ replay)

8. The eval view is a self-drawn SVG line chart (no chart library — "整包框架不裝" guardrail) of the
   **White-normalized** eval `E_white[i]` across the whole game (F2), White-advantage up /
   Black-advantage down, clamped to ±4 pawns for legibility. It is framed and labeled as the *shape*
   of the game, not a performance graph.
9. The chart opens move-by-move replay (at the anchor ply by default). The tap is a **deliberate,
   drift-guarded** target (a touch that moves beyond a small threshold is treated as a scroll, not a
   tap — EC-12) and is exposed as a real, keyboard-focusable button (not a bare `div`). The selected
   moments are marked on the curve with small colored dots (same color as their list card) as a
   visual cue; the dots are **not** separate tap targets.
10. White-advantage / Black-advantage labels sit on the **left** edge with a backing plate so the
    curve never overlaps them.

#### Group 4: Dashboard — Moment List

11. The list shows the selected moments (F1), each as a card carrying: a **kind icon + color**, the
    moment's **plain-language short name** (e.g. "漏掉一個主教", "你穩住了自己", "被他推著走的一段"),
    the played move, and the swing value. **No engine-taxonomy category label is shown** — the icon,
    the plain name, and (in the slideshow) Neve's sentence carry the meaning. Tapping a card opens
    the slideshow at that moment; the card's affordance signals "看這一手" (distinct from the eval
    view's "逐手覆盤", so the two doors are predictable before the tap — EC-13).
12. There are **three internal moment kinds**, each driving an icon + color + animation, never a
    visible label:
    - **tactical** — `classify()` hit a concept (`material` | `mate`; future fork/pin…). Warning
      icon, danger color.
    - **pivotal/bright** — the anchor (largest swing) and/or the player's brightest move (a
      recovery / good move). Star icon, success color. *(Open: R-1 — the anchor in a loss is the
      player's costly turning point; whether it should share the celebratory star/success hue with a
      bright recovery is flagged for the UX pass.)*
    - **plain swing** — a large swing where `classify()` returned `none`. Neutral icon, muted color
      (prefer-silence — surfaced gently, never as a "mistake").
13. The list order follows **ply order** (chronological), not severity — the slideshow reads as a
    re-telling of the game in sequence. The anchor carries an emphasis flag but is not reordered.

#### Group 5: Moment Slideshow

14. Each moment shows the board at the moment's pre-move FEN, a dot band (one dot per moment, the
    current one elongated), and a moment card: kind icon, plain name, swing value, the move
    comparison, and Neve's per-moment explanation (F3 template).
15. The **move comparison** uses one type size; role is differentiated by **color/weight AND a
    non-color cue** (a leading word — "你走了 …" vs "更好的是 …" / "· 這手很好"): a mistake shows
    `你走了 <played>` (muted) │ `更好的是 <best>` (gold); a good move shows
    `你走了 <played> · 這手很好` (green). Color is never the sole differentiator (EC-14).
16. On entering a moment, an **animation re-plays it** (F5 choreography), respecting
    `prefers-reduced-motion` (EC-5). A single tap/key **skips the in-flight animation to its
    end-state** (control without a pause UI). A "重播這一手" button re-runs it.
    - **Mistake** (has a better move): pause → play *your* move → pause to read → move your piece
      back → play the *better* move (highlighted).
    - **Good move** (no better move): play your move → animate the opponent's forced/actual reply
      that your move provoked (e.g. the knight chased back to b6).
17. The player moves between moments by: prev/next chevrons on the card, left/right swipe on the
    board, or arrow keys (desktop). Going before the first or after the last moment returns to the
    dashboard **with a visible cue** (not a silent jump — EC-15).

#### Group 6: Move-by-Move Replay

18. The dense surface: full board + self-drawn eval chart (with a gold cursor at the current ply) +
    scrollable move list + prev/next. This **reuses the shipped PgnViewer** and Move Annotation
    Display; the demo's hand-rolled board/list is illustrative only.
19. Prev/next animate the piece **sliding** (not teleporting), including captures and castling
    (rook moves with the king). Animation is interruptible (a new step supersedes an in-flight one).
20. The move list marks each scored move with its cpLoss chip and color (bad/good/mild per #7's
    display contract, F2), the anchor with a left accent bar, and the current ply highlighted +
    auto-scrolled into view.
21. Replay can be opened **at a specific ply** (from the trend chart it opens at the anchor ply by
    default; deep-linkable to any ply for the 棋誌 ②/③ coupling). A slideshow moment offers a
    cross-link into replay at that moment's ply (EC-13) so the two views are not silos.

#### Group 7: 棋誌 (Journal) Coupling

22. **One game always produces exactly one journal entry** (a ②/③ entry), independent of whether the
    player opens 棋憶 — confirmed model. Therefore the dashboard shows **no "saved to journal"
    action prompt** (it is automatic, not an action).
23. Tapping a journal entry on the 棋誌 page opens **this** 棋憶 view for that game (the entry *is*
    the link). The deep-link reuses `gameId + ply` (the same handle #7 exposes to #21).
24. Running totals across all games (Neve remembers N games / N journal entries / N days together)
    belong on the **棋誌 page** (the existing `JournalView`), not the 棋憶 dashboard. 棋憶 stays
    single-game focused and calm — a deliberate prior decision (a version with global totals was
    built and removed).

### States and Transitions

| State | Entry | Exit | Description |
| ----- | ----- | ---- | ----------- |
| DASHBOARD | 棋憶 opened | Tap eval view (→ REPLAY) or a moment card (→ SLIDESHOW); back → entry point (Game Over / 棋誌) | Root view: Neve line + shape-of-game eval + moment list. Renders progressively if #7 still ANALYZING (selection only at COMPLETE). |
| SLIDESHOW | Tap a moment card | Prev-before-first / next-past-last (visible cue) / back → DASHBOARD | One moment at a time; animated re-play (skippable); swipe/chevron/arrow nav. |
| REPLAY | Tap eval view, "逐手覆盤", or a slideshow cross-link | Back → DASHBOARD | Dense board + eval cursor + move list + prev/next; reuses PgnViewer. |

### Interactions with Other Systems

| System | Direction | Data / Call | Notes |
| ------ | --------- | ----------- | ----- |
| Post-Game Review (#7) | Reads | `analysisResults[]` (`evalCp/evalMate`, `bestMove`, `pv`, `pass`, `depthReached`), `cpLoss[]`, `biggestSwingCursor` | 棋憶 never re-runs analysis. It **derives** `E[i]` and `E_white[i]` from `analysisResults` itself (F2) — #7 stores `evalCp` side-to-move-relative and does not expose a White-normalized series. |
| Learning Loop (#20) | Calls | `classify()` per player move; `selectMistakeSignposts()` for ranking | Produces the tactical candidate set + the link node (Bridge 3); prefer-silence on ambiguity. |
| Journal (#21) | Writes / links | One ②/③ entry per game; bi-directional `gameId+ply` deep-link | Entry creation is automatic (Rule 22). 棋憶 is the destination opened from a journal entry (Rule 23). |
| Game History (#12) / Data Sync (#11) | Reads / persists | Per-game `MemoryGameSummary` (F4) persisted via Data Sync | Read-only accumulation source for the cross-game line; durably stored with `schemaVersion`. |
| Opening Identification (#3) | Reads | `bookExitPly` (F5 opening boundary), opening name (subtitle) | Reused; not recomputed. |
| PgnViewer / Move Annotation (#6) | Sends | FEN at ply, arrow shapes, eval | Replay reuses the shipped viewer + Wood12/Gioco theme (visual SoT). |
| Chess Board (chessground) | Sends | FEN + arrows for slideshow/replay | Board is a renderer; 棋憶 owns cursor/animation state. |

---

## Formulas

### F1: Key-Moment Selection (generation logic)

The heart of the feature. **Count is not fixed** — cap ~5, floor 0 (a truly steady game surfaces
nothing). F1 selects and orders; it does not analyze.

**Eval inputs (derived, not handed over).** #7 stores `analysisResults[i].evalCp` in **side-to-move
convention** (positive = the side to move at position `i` is better), with mate mapped to
`±MATE_CP` (#7 F4). 棋憶 reads:

```
E[i] = analysisResults[i].evalCp           # side-to-move convention; ±MATE_CP if evalMate present
isMate[i] = analysisResults[i].evalMate != null
```

**Step 1 — Candidate gathering (three sources), over each player-move position `i`** (`isPlayerMove[i]`,
excluding the last move; uses #7's `cpLoss[i]` and `classify()` from #20):

```
cp  = cpLoss[i]                             # F2 of #7, centipawns, ≥ 0
fav = -(E[i] + E[i+1])                       # favorable swing (player outperformed); > 0 = good move
concept = classify({ fen[i], playerMoveUci[i], opponentReplyUci[i], signals[i] })   # #20; 'material'|'mate'|'none'
            # signals[i].allowedForcedMate comes from #7's F2b mate-transition detection at i.

(A) tactical : concept != 'none'                                  → kind=tactical,     weightedScore = cp + CONCEPT_BONUS
(B) anchor   : i == biggestSwingCursor (and it is non-null)        → flag anchor,        weightedScore = cp
    bright   : fav >= MEMORY_BRIGHT_GATE AND NOT isMate[i] AND NOT isMate[i+1]  (max 1)  → kind=bright, weightedScore = fav
(C) plain    : concept == 'none' AND cp >= MEMORY_MOMENT_CP_GATE   → kind=plain swing,   weightedScore = cp
```

> **Mate guard (B):** the bright source excludes positions where either eval is a mate score — #7
> maps mate to ±`MATE_CP` (30000), so without this guard `fav` could spike to ~+60000 and fire a
> spurious "bright move!" while the player is actually being mated.

**Step 2 — Same-ply merge (resolve one move matching multiple sources).** A single ply can match
several sources (the worked example's ply 13 matches A *and* B). Collapse all matches at the same
`i` into **one** candidate, choosing the displayed kind by priority **tactical > anchor > bright >
plain**, and carrying `anchor`/`bright` as flags (not extra cards). The merged `weightedScore` is
the max across its matched sources.

**Step 3 — Gate.** Drop any candidate whose `cp < MEMORY_MOMENT_CP_GATE`, **except** (a) a confirmed
bright move and (b) the anchor when its `cp >= MEMORY_ANCHOR_FLOOR` (default 0 → the anchor is
gate-exempt whenever `biggestSwingCursor` is non-null). The anchor exemption keeps 棋憶 consistent
with #7's own "Biggest swing" tag — if #7 marks an anchor, 棋憶 shows it. A steady game where
`biggestSwingCursor` is null and nothing else clears the gate yields **zero moments** (EC-1).

**Step 4 — Rank, force-include, cap.** Sort survivors by `weightedScore` desc, tie-break lower ply
index (matches `selectMistakeSignposts`). **Force-include the anchor and the bright move first
(pre-cap reservation)**, then fill remaining slots up to `MEMORY_MOMENT_MAX` (default 5) from the
sorted rest — so a high-`CONCEPT_BONUS` cluster can never evict the "always-retained" anchor.

**Step 5 — Order for display.** Re-sort the kept set by **ply index ascending** (chronological). The
anchor carries its flag for emphasis but is not reordered to the front.

**Degenerate paths:** `biggestSwingCursor == null` (steady game, #7 Rule 32) → no anchor candidate
(`i == null` never matches); the set may still be non-empty via tactical/plain, or empty (EC-1).
`>MAX` candidates all tied → lower-ply tie-break makes selection deterministic.

**Variables / ranges:**

| Var | Meaning | Default | Safe range |
| --- | ------- | ------- | ---------- |
| `MEMORY_MOMENT_CP_GATE` | min cpLoss (centipawns) to surface a swing | 60 | 50–150 |
| `MEMORY_ANCHOR_FLOOR` | min cpLoss for the anchor to show (0 = always if non-null) | 0 | 0–80 |
| `MEMORY_BRIGHT_GATE` | min favorable swing (cp) to surface a bright move | 120 | 80–250 |
| `CONCEPT_BONUS` | rank boost (cp-equivalent) for a classified concept | 100 | 0–300 |
| `MEMORY_MOMENT_MAX` | hard cap on moments shown | 5 | 3–6 |

> **OQ-1 resolved:** default gate set to **60** (was 80) so the approved demo's −0.7 (70cp)
> 「沒有戰術的轉折」 moment reproduces. Still inside the calm range; final value confirmed in playtest.

**Worked example (the demo game — Italian, White, loss):**

| Ply | Move | cpLoss | concept | sources | after merge → kept |
| --- | ---- | ------ | ------- | ------- | ------------------ |
| 13 | Re1 | 290 (−2.9) | material | A + B(anchor) | **one** card, kind=tactical, anchor flag ✓ |
| 15 | d3 | fav≈recovery | none | B(bright) | bright card ✓ |
| 17 | Bg5 | 70 (−0.7) | none | C (≥ gate 60) | plain-swing card ✓ |

### F2: cpLoss + Eval Series (reuse + derive)

棋憶 consumes `cpLoss[i] = max(0, E[i] + E[i+1])` exactly as defined in Post-Game Review GDD §F2
(centipawns, side-to-move convention, mate normalized to ±`MATE_CP`). It adds no new cpLoss math.
`fav = −(E[i] + E[i+1])` is the same expression read for the opposite sign.

**White-normalized series for the trend chart (Rule 8):** `E[i]` is side-to-move-relative, so a raw
plot zig-zags by whose turn it is. 棋憶 normalizes to White's perspective:

```
E_white[i] = (i is even) ? E[i] : -E[i]
```

- Position `i` is the state after `i` plies; `i` even → White to move → `E[i]` is already White's
  view; `i` odd → Black to move → negate. (This is the normalization #7 defers to Move Annotation
  Display per its Rule 24; 棋憶 performs it for its own chart.)
- Mate values (±`MATE_CP`) are clamped to the chart's ±4-pawn display bound before plotting.

### F3: Per-Moment Explanation Template (Neve, zero-AI)

Each moment's explanation is a **template keyed on kind + concept**, filled with the moment's moves.
No free-form generation.

```
tactical/material : "你的{piece}留在 {square}，沒人守著。與其走 {played}，不如先 {bestPhrase}
                     ——{bestRationale}。"
tactical/mate     : "這裡你忽略了對手的將殺威脅。{played} 之後對手能{mateLine}；先 {best} 擋住。"
bright            : "你{recoveryVerb}——把{piece}{playedPhrase}，{consequence}，奪回主導權。"
plain swing       : "這裡沒有戰術可抓。你走 {played}，{drift}；先走 {best} 會穩一些。"
```

- Phrases (`bestPhrase`, `recoveryVerb`, `drift`, …) come from a small fixed phrase bank per concept;
  piece/square/move tokens come from the analyzed line.
- **Register guardrails (回顧態):** "你"-subject, active voice, never imputes intent ("你想…" is
  forbidden), mistakes neutral (no "blunder"/"錯"), good moves stated not gushed, the plain kind
  prefers the quietest phrasing.
- v2 (deferred): replace templates with Claude API / BYOK free-form explanation.

### F4: Cross-Game Qualitative Line (rule-based, zero-AI)

The dashboard's Neve line is chosen by a **rule over recent games**, then a template fills the
numbers. **No score, no rating, no weakness verdict, no AI.**

**Step 1 — Per-game tagging (computed at #7 COMPLETE, persisted):** each selected moment is tagged
with a **stage** (F5) and its **concept** (or `none`). A compact `MemoryGameSummary` per game is
stored (F4-schema below).

**Step 2 — Window:** consider the last `OBS_WINDOW` games (default 10) with summaries. If fewer than
`OBS_MIN_SAMPLE` (default 6) exist → emit a first/few-games line, not a trend (EC-7).

**Step 3 — Signal selection (pick one; no `weak(stage)`):**

```
improving(stage)   : gated-moment rate in `stage` dropped by >= OBS_IMPROVE_DELTA from the older half
                     to the recent half of the window — REQUIRES both halves have >= OBS_MIN_STAGE
                     gated moments in that stage (else the stage is skipped: no rate, no division by
                     zero, no trend off one noisy game).
recurring(concept) : one concept dominates conceptCounts across the window (>= OBS_CONCEPT_FRAC).
```

Priority: a clear **improving** signal (encouraging) > a **recurring concept** (framed as a gentle
invitation, not a flaw) > a neutral steady line. Exactly one line is emitted. The product
deliberately has **no branch that names a weakest stage**.

**Step 4 — Template fill:**
- improving → `"你最近{n}盤的{stage}，比之前穩了一些——我們慢慢練。"`
- recurring → `"{conceptPhrase}這個，我們之後可以一起多看幾次。"`
- neutral → a calm steady line (e.g. `"最近這幾盤都走得挺穩的。"`).

**F4-schema — `MemoryGameSummary` (persisted via Data Sync #11):**

```
{ schemaVersion: number,            // bump when F1/F5 tuning changes selection; enables migration
  gameId: string,
  stageCounts: {opening,middlegame,endgame},   // GATED-candidate counts (pre-cap, F1 Step 3), not displayed counts
  conceptCounts: Record<concept, number>,
  anchorStage: stage | null }        // null when biggestSwingCursor was null
```

> **Durability note:** #7 Rule 28 persists no `analysisResults` across sessions, so a tuning change
> cannot recompute old summaries from source. `schemaVersion` lets F4 **ignore** summaries written
> under an incompatible version (degrade to a smaller window / first-game line) rather than mix
> inconsistent data — accepted; recompute-on-tune is out of scope.

**Variables:**

| Var | Meaning | Default | Safe range |
| --- | ------- | ------- | ---------- |
| `OBS_WINDOW` | games considered for the trend | 10 | 5–20 |
| `OBS_MIN_SAMPLE` | min games before any trend (else first-game line) | 6 | 4–10 |
| `OBS_MIN_STAGE` | min gated moments per half in a stage before comparing rates | 3 | 2–5 |
| `OBS_IMPROVE_DELTA` | fractional drop in a stage's gated-moment rate to call it "improving" | 0.30 | 0.2–0.5 |
| `OBS_CONCEPT_FRAC` | fraction of gated moments one concept must hold to be "recurring" | 0.5 | 0.4–0.7 |

### F5: Stage Classification (opening / middlegame / endgame)

Each moment's stage is derived from ply count + material, **no engine call**:

```
nonPawnMaterial = total value of all non-pawn, non-king pieces on the board at ply i  (Q=9,R=5,B=3,N=3)
                  # full board starts at 62 (31 per side)

endgame   : nonPawnMaterial <= ENDGAME_MATERIAL          (default 12)        # checked first
opening   : (ply <= bookExitPly) OR (ply <= OPENING_PLY_MAX AND nonPawnMaterial >= OPENING_MATERIAL)
middlegame: otherwise                                                          # catch-all, no gap
```

`endgame` is checked first (material is the stronger late signal); the branches are mutually
exclusive and `middlegame` is the catch-all, so every position classifies (no gap, no overlap).
`bookExitPly` comes from Opening Identification (#3, reused). **Invariant: `ENDGAME_MATERIAL <
OPENING_MATERIAL` must hold** (the tuning ranges preserve this).

| Var | Meaning | Default | Safe range |
| --- | ------- | ------- | ---------- |
| `ENDGAME_MATERIAL` | non-pawn material at/below which it's endgame | 12 | 6–16 |
| `OPENING_PLY_MAX` | max ply still considered opening (when out of book) | 16 | 10–24 |
| `OPENING_MATERIAL` | non-pawn material above which early plies are opening | 56 | 48–62 |

---

## Edge Cases

**EC-1: Steady game — zero moments.** `biggestSwingCursor` is null (no positive cpLoss anywhere) and
no candidate clears the gate. The moment **section is replaced** by a single calm, non-congratulatory
line component (e.g. "這盤你走得很穩，沒有需要特別停下來看的地方") — not a labeled list with one
apologetic row. The eval view + replay remain available. Intended "寧少勿濫" outcome, not an error.

**EC-2: Exactly one moment.** The slideshow shows one card; the dot band is hidden (a lone dot reads
as "still loading"); prev/next both return to dashboard. No "1 of 1" awkwardness.

**EC-3: Entered before #7 COMPLETE.** 棋憶 renders progressively; **selection (F1) runs only at
COMPLETE**, so the moment list shows a quiet "still refining…" cue rather than partial moments — a
moment shown is never later removed (#7 Rule 30: the anchor does not move once set). The eval view
fills in as positions deepen.

**EC-4: Analysis budget cut (some positions stay preview-depth).** Selection runs over whatever #7
finalized. If the anchor fell back to a preview pair (#7 Rule 30 fallback), its card carries the
same "preliminary" treatment #7 uses — never dim text below WCAG 1.4.3 contrast.

**EC-5: `prefers-reduced-motion`.** Slideshow and replay skip animation. For a **mistake**, the
static end-state must still convey **both** halves of the comparison — both the played-to and the
better-to squares highlighted simultaneously (not only the correction), so the board agrees with the
"你走了 X │ 更好的是 Y" text. For a **good move**, show played→provoked-reply statically. Replay
teleports between plies. No information is lost.

**EC-6: Guest / first game (no cross-game history).** The Neve card shows a first/few-games line
(F4 Step 2). Per-game moments still work fully.

**EC-7: Insufficient cross-game sample (< `OBS_MIN_SAMPLE`).** No trend is fabricated; a gentle
single/few-game line is shown. A wrong trend is worse than no trend.

**EC-8: Unknown opening.** F5 falls back to `ply <= OPENING_PLY_MAX` for the opening boundary (no
`bookExitPly`). The subtitle omits the opening name (matches #7 EC-5).

**EC-9: Very short game (resign in opening / scholar's mate).** May produce 0–1 moments. A single
forced-mate loss surfaces one tactical/mate moment as the whole memory; the eval view is short but
valid.

**EC-10: Concept misfire risk.** `classify()` only returns `material`/`mate` on high confidence,
`none` otherwise (prefer-silence). A `none` large swing is shown as a plain swing with neutral copy —
never labeled with a concept it doesn't have.

**EC-11: Adjacent moments collapse.** Two large swings one ply apart (a blunder then the forced
reply) — F1 Step 4's sort + the existing dedup intent keeps one; combined with Step 2's same-ply
merge, a single tactical event never becomes two cards.

**EC-12: Accidental chart tap while scrolling.** The eval view sits in the scrollable dashboard. A
touch that moves beyond a small threshold before release is treated as a scroll, not a tap, so
scrolling past the chart does not yank the user into replay.

**EC-13: Two doors / silos.** The eval view (→ replay) and a moment card (→ slideshow) have visually
distinct affordances signaling their destinations before the tap; a slideshow moment offers a
cross-link into replay at that ply, so the two views are not dead-end silos.

**EC-14: Color-vision deficiency.** Each moment kind is distinguishable without color: a distinct
**icon shape** (warning triangle / star / circle-with-line) on cards and the move comparison's
leading **words** carry the meaning. The curve dots, being color-only, are a redundant cue, not the
sole channel (the card list is the primary, shape-bearing surface).

**EC-15: Advancing past the last moment.** Returns to the dashboard with a visible cue (a brief
transition / "回棋憶"), never a silent unsignalled exit.

---

## Dependencies

### Upstream (systems 棋憶 depends on)

| System | What 棋憶 requires |
| ------ | ------------------ |
| **Post-Game Review (#7)** | `analysisResults[]`, `cpLoss[]`, `biggestSwingCursor`, the per-move display contract. 棋憶 re-runs no analysis and **derives `E[i]`/`E_white[i]` itself** (F2) — #7 does not expose a White-normalized series. |
| **Learning Loop — Concept Linking (#20)** | `classify()` and `selectMistakeSignposts()` (prefer-silence). Optionally the `recommended()` link node for tactical moments. |
| **Journal — 棋誌 (#21)** | One ②/③ entry per game (auto), `gameId+ply` deep-link contract (both directions). |
| **Game History (#12) / Data Sync (#11)** | Persisted per-game `MemoryGameSummary` (with `schemaVersion`) for the cross-game line (F4). |
| **Opening Identification (#3)** | `bookExitPly` for the F5 opening boundary, and opening name for the subtitle. |
| **PgnViewer / Move Annotation (#6)** | Renders the replay board; 棋憶 supplies FEN/arrows/eval. Reuses Wood12 + Gioco theme. |

### Downstream (systems that depend on 棋憶)

| System | What they expect from 棋憶 |
| ------ | -------------------------- |
| **Journal — 棋誌 (#21)** | 棋憶 is the destination view opened from a journal entry. Must accept a `gameId+ply` to open at a specific game/moment/ply. |
| **棋誌 page accumulation header** *(future, not this GDD)* | Reads the running totals 棋憶's per-game summaries feed; the header itself is a separate future task. |

### Bidirectional Notes

- **Post-Game Review (#7)** lists 棋憶 (#22) as a downstream consumer of its `cpLoss`,
  `biggestSwingCursor`, and stored evals (done in #7's downstream table). 棋憶 derives its own
  normalized series — #7 owes only the raw side-to-move results.
- **Journal (#21)**: the "tap a journal entry → opens 棋憶" link is the realization of #21's
  Phase-2 coupling; #21's doc should reference 棋憶 as the review destination.
- **Cross-game accumulation** (F4) reads only persisted `MemoryGameSummary` rows; 棋憶 does not
  re-analyze past games, and tolerates `schemaVersion` mismatch by ignoring incompatible rows.

---

## Tuning Knobs

| Knob | Default | Range | Affects |
| ---- | ------- | ----- | ------- |
| `MEMORY_MOMENT_CP_GATE` | 60 cp | 50–150 | How readily a swing surfaces. Lower = more moments (risk: noise); higher = quieter. |
| `MEMORY_ANCHOR_FLOOR` | 0 cp | 0–80 | Min cpLoss for the anchor to show. 0 = always show if non-null (consistent with #7). Raise if tiny anchors feel noisy. |
| `MEMORY_BRIGHT_GATE` | 120 cp | 80–250 | How good a move must be to be celebrated as a bright moment. |
| `CONCEPT_BONUS` | 100 cp | 0–300 | How much a classified tactical concept outranks a same-size plain swing. |
| `MEMORY_MOMENT_MAX` | 5 | 3–6 | Hard cap on moments. The whole "calm, not a wall" promise rests here. |
| `OBS_WINDOW` | 10 games | 5–20 | How far back the cross-game line looks. |
| `OBS_MIN_SAMPLE` | 6 games | 4–10 | Games needed before any trend vs. a first-game line. |
| `OBS_MIN_STAGE` | 3 | 2–5 | Min gated moments per half in a stage before a rate is computed (noise floor). |
| `OBS_IMPROVE_DELTA` | 0.30 | 0.2–0.5 | Sensitivity of the "improving" signal. |
| `OBS_CONCEPT_FRAC` | 0.5 | 0.4–0.7 | Dominance fraction for a "recurring" concept. |
| `ENDGAME_MATERIAL` | 12 | 6–16 | Stage boundary into endgame (must stay < `OPENING_MATERIAL`). |
| `OPENING_PLY_MAX` | 16 | 10–24 | Stage boundary out of opening (when out of book). |
| `OPENING_MATERIAL` | 56 | 48–62 | Non-pawn material above which early plies are opening. |
| Animation: first-move pre-pause | 650 ms | 400–900 | Slideshow pacing — the calm beat before the first move (OQ-2). |
| Animation: move duration | 380 ms | 250–500 | Per-piece slide in slideshow/replay. |
| Animation: read pauses | 700 / 520 ms | 300–900 | Hold after your move / after moving back, before the better move. |

> Animation knobs are demo-tuned (v9), pending final sit-with-it sign-off (OQ-2). All timings
> respect `prefers-reduced-motion` (EC-5), and a tap/key skips to the end-state (Rule 16).

---

## Acceptance Criteria

> **Test-frozen config:** all logic ACs reference frozen test constants, not live tuning defaults
> (so retuning a knob can't flip a fixture's pass/fail).

**Logic (BLOCKING — unit-testable, `tests/unit/memory/`):**

- **AC-1** Opening a completed game lands on the **dashboard** (not the dense move list); the DOM
  order is Neve line → eval view → moment list; **no ranking/verdict element is rendered** (assert
  absence of any "weakest"/score node — the report-card layout is *not* a pass condition).
- **AC-2** Given ≥1 player move with `cpLoss ≥ GATE`, `selectMoments()` returns 1…`MAX` moments,
  never more than `MAX`, in ascending ply order.
- **AC-2b** Given >`MAX` gated candidates including the anchor ranked outside the top `MAX` by
  `weightedScore`, the result is exactly `MAX` and **includes the anchor** (force-include); ties
  resolve to lower ply index.
- **AC-2c** Gate boundary: a candidate with `cp == GATE` is kept, `cp == GATE−1` is dropped; a
  bright move with `fav ≥ BRIGHT_GATE` but `cp < GATE` is kept (Step 3 exemption); the anchor is
  kept when `cp ≥ ANCHOR_FLOOR` even if `< GATE`.
- **AC-2d** A ply matching multiple sources (tactical + anchor, like the worked-example ply 13)
  yields **one** card, kind = highest-priority (tactical), carrying the anchor flag (Step 2 merge).
- **AC-3** Given a game where F1 returns 0 moments, `selectMoments()` returns `[]` AND the dashboard
  renders the zero-state component (not the list); eval view + replay remain mounted/tappable; the
  zero-state copy equals the approved fixture string and contains none of the banned celebratory
  tokens (`['做得好','恭喜','完美']`).
- **AC-4** The anchor (`biggestSwingCursor`, when non-null and ≥ `ANCHOR_FLOOR`) appears with its
  flag; when `biggestSwingCursor` is null no anchor moment exists.
- **AC-5** Adjacent-ply candidates collapse to one card (verifiable on a blunder-then-forced-reply
  pair).
- **AC-6** A move `classify()` returns `none` for is never shown as tactical; it appears (if it
  clears the gate) only as a plain swing.
- **AC-11b** Every Neve sentence is template-derived (assert no network/API call) and obeys the
  banned-token lint (`['你想','blunder','錯','恭喜']`); F4 emits **no** weakest-stage line under any
  window (assert no `weak`-branch output).
- **AC-12** With `< OBS_MIN_SAMPLE` prior games, a first/few-games line is shown, never a fabricated
  trend; with ≥ sample, exactly one line is emitted.
- **AC-12b** F4 priority: when both `improving(endgame)` and `recurring(material)` hold, the
  improving line wins; the `OBS_IMPROVE_DELTA` boundary (drop == delta fires, delta−ε does not) is
  asserted; a stage with `< OBS_MIN_STAGE` moments in either half yields no trend (no div-by-zero).
- **AC-13** F5 stage classification is deterministic and unit-tested against fixtures **including the
  boundaries**: `nonPawnMaterial == ENDGAME_MATERIAL` (endgame edge), the `ply <= bookExitPly`
  opening path, the out-of-book `ply ≤ OPENING_PLY_MAX && material ≥ OPENING_MATERIAL` path, an
  unknown-opening (no `bookExitPly`) position, and a low-material-at-low-ply position (endgame-first
  ordering wins).
- **AC-14** Opening 棋憶 does **not** trigger analysis when `analysisResults` already exist (spy on
  `reviewEngine.analyze`, assert 0 calls on re-entry).

**UI / routing (Playwright — DOM, not chessground gestures):**

- **AC-7** A tap at the eval chart's geometric center (not on a dot) opens replay at the anchor ply;
  tapping a curve dot opens the same replay (dots are not separate handlers); a scroll gesture over
  the chart does **not** open replay (EC-12).
- **AC-10** The move comparison renders both halves at the same `font-size`, differentiated by
  color/weight **and** a leading word (played = muted, better = gold, good = green) — verifiable by
  computed style + text content.
- **AC-15** Exactly one journal entry exists per completed game regardless of whether 棋憶 was
  opened; a journal entry opens this game's 棋憶, and the deep-link `(gameId, ply=N)` mounts replay
  with the cursor at ply N.

**Visual / animation (split — DOM half automatable, motion half = manual evidence in
`production/qa/evidence/`):**

- **AC-8** Replay move list: current ply highlighted + auto-scrolled into view, anchor shows its
  accent bar (Playwright DOM). The sliding piece animation incl. capture + castling = manual
  evidence (chessground synthetic events are not Playwright-drivable — see technical-preferences).
- **AC-9** Reduced-motion static end-state conveys **both** halves of a mistake comparison
  (played-to + better-to highlighted) — computable end-state, unit-testable. The full
  mistake/good-move choreography + the v9 timings = manual playtest evidence (EC-5, OQ-2).
- **AC-16** Replay mounts the shipped `PgnViewer` (assert `lichess-pgn-viewer` root present, not the
  demo's hand-rolled board) and board-theme asset URLs carry `import.meta.env.BASE_URL` (avoids the
  `/gambit/` 404 trap). Visual fidelity (Wood12 board, Gioco pieces, no lichess dark board leaking) =
  screenshot sign-off.
- **AC-17** Every dashboard and slideshow action is reachable and activatable by keyboard alone (the
  eval view and moment cards are real buttons); any interactive dot has a ≥44px hit area, or dots are
  non-interactive. (a11y conformance against the house standard — manual + axe.)

---

## Open Questions

- **OQ-2 (animation pacing):** the remaining 待拍板 from the demo — is the v9 timing (650 ms
  first-move pre-pause, 380 ms slides, 700/520 ms read holds) calm enough? Sit-with-it sign-off.
- **OQ-R1 (anchor hue in a loss):** the anchor (your costly turning point in a loss) currently shares
  the star/success color with a bright recovery (Rule 12). Decide in the UX pass whether the anchor
  should get a neutral "turning point" treatment instead of the celebratory hue.
- **Deferred to a UX spec / frontend pass (fix #5):** the two-door affordance differentiation +
  slideshow↔replay cross-link (EC-13), chart drift-guard (EC-12), color-blind channel (EC-14),
  reduced-motion full-comparison (EC-5), keyboard parity + ≥44px dot targets (AC-17), back-navigation
  targets per entry point (Rule 1). These are conformance against the existing house a11y/visual
  standard, scheduled with the UX spec — not GDD design holes.

**Resolved in this revision:** OQ-1 (gate → 60 to match the approved demo); the `E[i]`
availability/normalization gap (F2); mate-poisoned bright detection (F1 mate guard); same-ply
double-card + anchor-eviction nondeterminism (F1 Steps 2/4); the `weak(stage)` vision violation
(cut from F4); `MemoryGameSummary` durability (`schemaVersion`, F4-schema).
