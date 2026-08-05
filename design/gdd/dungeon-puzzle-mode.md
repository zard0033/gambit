# Dungeon Puzzle Mode (GDD)

> **Status**: **Partially superseded 2026-08-05（定位 v2 的 D2）**
> **Tier**: Phase 2 (Feature layer)
> **Category**: Gameplay (Feature layer)
> **Depends on**: Chess Board & Move System (#1), Navigation & Routing (#4)

> ### 這份 GDD 有一半已經不存在了
>
> **已刪除（外殼）**：關卡地圖與其節點／掛鎖／線性解鎖（`DungeonMapView.vue`）、
> `dungeon-progress` store 與 `dungeon_progress` 雲端表的讀寫、`/dungeon` 路由、底部 tab 的「試煉」格、
> 首頁的試煉統計卡、視覺藍圖 `DungeonScreen.jsx`。理由（`production/positioning-v2-2026-08-02.md` D2）：
> 為了送 30 個 FEN 蓋了地圖＋掛鎖＋進度＋雲端表，而素材需要的只是一個陣列和一顆「下一題」。
>
> **仍然有效（解題本體）**：Appendix 的 Puzzle Data Schema（`src/types/puzzle.ts`、
> `src/data/puzzles/` 30 題）、§3.2 的解題迴圈（交替 solution、錯手回彈、兩段式提示）、
> Bridge-2 的概念複習連結。這些活在 `PracticePuzzleView.vue`（路由 `/practice/:puzzleId`）——
> 只有練習模式，沒有鎖也沒有進度，解出來只記進 concept-progress 的 `practiceSolved`。
> 入口是棋憶回放的概念路標。
>
> **`dungeon_progress` 表與其 migration 刻意保留未 drop**，資料還在。

---

## 1. Overview

A single-player tactics-puzzle track called **試煉道場 (Dungeon)**. The player works
through a curated set of chess positions, each asking them to find the one winning
idea — win material, land a fork, deliver mate. A puzzle presents a position with the
side-to-move being the player's; the player plays moves on the real board, the mode
validates each against the authored solution line (auto-playing the opponent's scripted
replies for multi-move puzzles), and on completion shows a calm "正確" with the
transferable principle. Puzzles are grouped into **levels** shown as a vertical **climb
map** (a bottom-to-top serpentine path that recedes into perspective toward a distant
summit); clearing puzzles unlocks the next node linearly. v0 scope: static, clean-room
authored puzzle data (no AI, no backend engine call required for validation) with
localStorage progress that mirrors the Lesson System's progress-store pattern, plus Supabase sync (`dungeon_progress` table, shipped — see §3.6).

**Per the Gambit design rule (`無 streak / timer / leaderboard`), this mode has NO
streak counter, NO timer, and NO leaderboard.** The blueprint's「連殺」streak is
explicitly dropped (design decision 2026-06-05); progress is expressed only as calm
counts — puzzles solved, nodes completed.

**Content sourcing** (revised 2026-06-05 — Eason): puzzle **positions** may be imported
from the **lichess puzzle database**, which is released under **CC0 (public domain)** —
free for commercial use, modification, and redistribution (verified: database.lichess.org;
~5.9M puzzles as CSV with FEN / solution moves / rating / themes). We map lichess themes
to our `motif` set and transform the lichess move format (FEN-then-opponent-setup-move) to
our schema (FEN side-to-move = player; see §3.4 note). The **teaching text** (`hint`,
`successText`, `title`, `prompt`) is **clean-room authored in 繁中** — never copied from
lila. **Do NOT port lila code or its Learn-module text** (`lila` is AGPL-3.0, `chessops`
GPL-3.0 — strong copyleft). All FENs include both kings (chess.js) and pass the data test.

---

## 2. Player Fantasy

> *"我坐下來解一題。盤面安靜地等我。沒有倒數、沒有分數壓著我——只有一個問題：這裡最強的一步是什麼？我看了一會兒，看見了那個圖案，落子。盤面回我一句『正確』，告訴我為什麼這步好。我往地圖深處再走一格。"*

- **低壓力的專注**：解題是冥想式的，不是競技。沒有計時、沒有連殺斷掉的焦慮；想多久都可以。
- **看見圖案**：每題圍繞一個可命名的戰術主題（捉雙、牽制、將死），解開後說出原理，讓玩家把圖案帶到實戰。
- **穩定的前進感**：地圖節點一格格點亮，給「我在變強」的具體軌跡，但不靠數字攀比。
- **寬容**：走錯只得到「再想想」與可選提示，永不扣分、不中斷、不評判。
- **承接課程**：與 Lesson System 同源詞彙（后/城堡/騎士/主教、捉雙/牽制），上完課來這裡練手。

---

## 3. Detailed Rules

### 3.1 Structure

- The mode has two views, mirroring the blueprint:
  - **Map view** (`/dungeon`): a vertical **climb** — a bottom-to-top serpentine path of
    circular jade "coin" nodes that funnels in perspective from a wide, near base (order 1)
    to a narrow, far summit (the highest locked levels), fading into a distance haze. Each
    node = one puzzle with a `state`: `done` / `current` / `locked`. Tapping the `current`
    node enters its puzzle; `done` nodes are replayable; `locked` nodes are not enterable.
    The three `level` groups are marked by floor-threshold dividers crossed while climbing.
    Done + current nodes stay full-size (legibility + ≥44px touch); only the locked future
    tapers smaller/dimmer to read as "far away". On load the map centres the current node.
    *(Deviation from the original "vertical diamond-node path": the diamond/zig-zag read
    as casual-mobile-game and flattened the level structure; the climb-funnel keeps the
    intended bottom-to-top accumulation + light game-feel while aligning with Gambit's
    calm, mature tone and surfacing the 3-level structure. Approved 2026-06-09.)*
  - **Puzzle view** (`/dungeon/:puzzleId`): the board + a prompt panel + 提示 / actions.
- Puzzles carry a `level` (1–3 for v0) used only for grouping/labelling on the map and
  in the puzzle header. **Unlock is global and linear by `order`** (level is display
  grouping, not a separate gate) — identical to the Lesson System's rule.

### 3.2 The puzzle data model

Each puzzle is static authored data (no runtime generation):

| Field | Meaning |
|-------|---------|
| `id` | stable slug, e.g. `fork-knight-01` (used in the route + progress key) |
| `level` | 1–3, display grouping on the map |
| `order` | global 1-based position; drives linear unlock |
| `motif` | one of the puzzle themes (see 3.3); drives the default prompt + success copy |
| `title` | short node label on the map, e.g.「棋子取奪」 |
| `prompt` | the ask shown above the board, e.g.「白方走步，一步將死」 |
| `fen` | start position; side-to-move = the player's side (derived, not stored separately) |
| `solution` | ordered list of moves `{ from, to, promotion? }` — **alternating** player / opponent plies, starting with the player |
| `hint` | Socratic hint (the idea / what to look for — never the move text) |
| `successText` | the transferable principle, shown on solve (never just「正確」) |
| `acceptAnyMate` | optional bool; for mate-in-1 puzzles, accept **any** legal move that delivers checkmate, not only `solution[0]` |

`playerColor` is derived from the FEN's side-to-move. The board orients to the player.

### 3.3 Motifs (v0 set)

`capture`（贏取子力）· `fork`（捉雙）· `pin`（牽制）· `mate-in-1`（一步將死）·
`mate-in-2`（兩步將死）. Each motif supplies a default `prompt` and `successText`
scaffold; an authored puzzle may override either. Motifs echo the Lesson System tactics
tier so vocabulary transfers.

### 3.4 Solving flow (single source of truth for validation)

State machine per puzzle: `solving → solved` (plus transient `wrong` and `hinted`
flags). The board uses chess.js (bundled with vue3-chessboard) as the rules authority.

1. Player makes a legal move on the board (illegal moves are rejected by chessground/
   chess.js before reaching this logic — they never count as "wrong").
2. **Correctness check** for the current player ply `p` (= `solution[2k]`):
   - If `motif === 'mate-in-1'` and `acceptAnyMate`: correct **iff** the move is legal
     and results in `chess.isCheckmate()`.
   - Otherwise: correct **iff** the move equals `solution[p]` (from/to/promotion).
3. **On correct, not-final**: animate the scripted opponent reply `solution[p+1]` after
   a short beat, advance the ply pointer, return to step 1 for the next player ply.
4. **On correct, final player ply**: transition to `solved`; show the solved panel with
   `successText`; mark the puzzle done in progress; offer 下一題 (next puzzle by `order`)
   and 回地圖.
5. **On wrong-but-legal**: snap the piece back, set `wrong` (board shows a brief
   destination-square error tint), show「再想想」under the prompt. No penalty, no state
   loss; the player retries freely.

### 3.5 Hints

- 提示 button reveals the puzzle's `hint` (the Socratic idea), and **on a second press**
  draws the first solution move as a board arrow (opt-in move reveal — same two-stage
  pattern as lessons: idea first, move second).
- Using a hint does **not** penalise (no streak to break — consistent with the no-streak
  rule). It only sets a `hintUsed` flag stored with progress, so a future "solved without
  hint" badge could read it, but v0 surfaces no judgement either way.

### 3.6 Progress & unlock

- Progress is keyed by puzzle `id`: `{ solved: boolean, hintUsed: boolean }`.
- A node's map `state`:
  - `done` if `solved`.
  - `current` = the lowest-`order` puzzle that is not solved **and** whose predecessor
    is solved (or `order === 1`).
  - `locked` otherwise.
- Persistence: a Pinia store (`useDungeonProgressStore`) mirroring `useLessonProgressStore`
  exactly — localStorage as the offline cache for instant paint + unauthenticated play,
  **and Supabase (`dungeon_progress` table, via the data-sync store per ADR-0011) as the
  cross-device source of truth once logged in**. Progress is monotonic (solved never
  un-sets), so reconciliation on login is a union — local and cloud never conflict
  (`hintUsed` resolves by OR). SSR-safe guards as in the lesson store.

### 3.7 Access

- Home entry: the Home dashboard's「今日謎題 即將推出」card is **renamed「試煉」** and
  becomes the live entry to `/dungeon` (single dungeon path; no daily-puzzle concept —
  Eason decision 2026-06-05).
- Routes: `/dungeon` (map) and `/dungeon/:puzzleId` (solver), lazy-loaded, mirroring
  `/learn` + `/learn/:lessonId`. No auth required (progress is local), matching `/learn`.

---

## 4. Formulas

The mode is rule-driven, not numeric; the only computed quantities are unlock state and
progress counts.

### 4.1 Current-node selection

Let puzzles be sorted ascending by `order`, `P = [p_1 … p_n]`, and `solved(p)` the
progress predicate.

```
current_index = min { i : solved(p_i) = false }      (1-based; the first unsolved puzzle)
state(p_i) =
    done     if solved(p_i)
    current  if i = current_index
    locked   if i > current_index
```

- Range: `current_index ∈ [1, n]`. If all solved, there is no `current` node (map shows
  all `done` + a「全部完成」state).
- Example: with 5 puzzles where p1,p2 solved → `current_index = 3`; p1,p2 = done,
  p3 = current, p4,p5 = locked. (Matches the blueprint's node layout exactly.)

### 4.2 Progress count (Home + map header)

```
solvedCount  = | { p : solved(p) = true } |
totalCount   = n
percent      = round(100 × solvedCount / totalCount)      (0 when n = 0)
```

- Used for the calm progress indicator that **replaces** the blueprint's streak pill.
- Example: 2 of 5 solved → `solvedCount = 2`, `percent = 40`.

### 4.3 Ply pointer (solving)

For a puzzle with `solution` of length `L` (alternating player/opponent, player first):

```
player plies   = solution[0], solution[2], solution[4], …      (even indices)
opponent plies = solution[1], solution[3], …                   (odd indices)
ply pointer p starts at 0; advances +2 per correct player move (after auto-opponent reply)
solved when p ≥ L − 1 after a correct final player move
```

- A well-formed puzzle has **odd** `L` (ends on a player ply). The data test asserts this.

---

## 5. Edge Cases

- **Mate-in-1 with multiple mating moves**: when `acceptAnyMate` is set, any legal move
  giving `isCheckmate()` is accepted, even if it differs from `solution[0]`. `successText`
  still shows. Authoring rule: set `acceptAnyMate` only when alternative mates are
  acceptable teaching outcomes.
- **Promotion in the solution**: the expected move includes `promotion`; a player move to
  the back rank without the matching promotion piece is treated as wrong-but-legal (snap
  back, hint available). The promotion picker is the existing board component's.
- **Player plays a different but also-winning move** (non-mate puzzles): treated as wrong
  for v0 (only the authored line advances). This is a deliberate scope limit — documented
  so QA does not file it as a bug; a future story may widen acceptance via engine eval.
- **Deep-link to a locked puzzle** (`/dungeon/:puzzleId` for a not-yet-unlocked id):
  redirect to `/dungeon` (map). Deep-link to an unknown id: redirect to `/dungeon`.
- **Deep-link to a `done` puzzle**: allowed (replay); solving it again is a no-op on
  progress (stays solved).
- **All puzzles solved**: map shows every node `done`, header shows 100%, puzzle view's
  下一題 from the last puzzle returns to the map.
- **Empty / malformed puzzle set**: if `n = 0`, the map renders an empty-state ("謎題即將
  加入") and the Home card stays informative rather than crashing. The data test prevents
  shipping malformed FENs or even-length solutions.
- **localStorage unavailable / SSR**: progress reads default to "nothing solved" (only
  puzzle 1 unlocked); writes are wrapped in the same guard as the lesson store (no throw).
- **prefers-reduced-motion**: the opponent-reply animation and node breathe-ring respect
  the existing `use-reduced-motion` composable — reduced to instant/static.
- **Wrong move during the opponent-reply animation**: input is locked while the scripted
  reply animates; the player cannot move out of turn.

---

## 6. Dependencies

- **Chess Board & Move System (#1)** — board rendering, move input, promotion picker,
  arrows/highlights, orientation. The Dungeon puzzle view embeds `chess-board.vue`.
  *(Reciprocal: chess-board GDD lists Dungeon Puzzle Mode as a consumer.)*
- **Navigation & Routing (#4)** — adds `/dungeon` and `/dungeon/:puzzleId`; Home card +
  bottom-nav entry. *(Reciprocal: navigation GDD route table to add these.)*
- **Lesson System** — pattern source only: `useDungeonProgressStore` mirrors
  `useLessonProgressStore`; puzzle data model mirrors the `Lesson`/`LessonStep` schema;
  shares the tactics vocabulary so concepts transfer. No code dependency (separate store
  + separate data module).
- **chess.js** (bundled with vue3-chessboard) — rules authority for legality and
  `isCheckmate()` validation. No new dependency added.
- **Gambit Design System** — visual SoT。（`DungeonScreen.jsx` 已隨 D2 刪除。）原文：the screen follows `DungeonScreen.jsx` minus
  the streak elements. Dark dungeon surface, jade "coin" climb nodes (same beveled
  map-tile vocabulary as the Concept Map), gold for the current node + CTA + the
  already-climbed trail only.
- **Data Sync (#11) + Authentication (#9)** — cross-device progress sync via the data-sync
  store and a new `dungeon_progress` table (ADR-0011), mirroring `lesson_progress`. Progress
  is local-first; sync reconciles (union) on login. *(Reciprocal: supabase-integration GDD
  to list `dungeon_progress`.)*
- **Learning Loop — Concept Linking (#20)** *(downstream consumer)* — maps each puzzle `motif` to a
  shared `ChessConcept` (`MOTIF_TO_CONCEPT`); the puzzle player hosts a「複習這個概念」back-link to the
  teaching lesson, and is the route target of the course→puzzle CTA. **The CTA enters in a side-door
  "practice mode" (`?from=lesson` route intent) that the entry guard honours for that one puzzle id even
  when `nodeState` is `locked` — a practice solve does NOT call `markSolved`, does NOT advance
  `currentOrder`, and does NOT touch `isUnlocked`.** The linear map, `solved` set, and unlock semantics
  are therefore **unchanged** (Learning Loop D1, round-2 spec — the earlier "unlock exemption" idea was
  dropped because it broke the linear-map invariant). See `design/gdd/learning-loop.md` + ADR-0012.
- **Out of scope (v0)**: Stockfish/engine call for validation, AI hints.

---

## 7. Tuning Knobs

| Knob | Default | Safe range | Affects |
|------|---------|-----------|---------|
| `OPPONENT_REPLY_DELAY_MS` | 450 | 200–800 | beat before the scripted opponent reply animates; too low feels abrupt, too high feels sluggish (reduced-motion → 0) |
| `WRONG_TINT_DURATION_MS` | 600 | 300–1200 | how long the error tint shows on a wrong move |
| `levels` (count) | 3 | 1–6 | number of map level groupings; purely display |
| puzzle set size per level | ~3–5 | 1–12 | content volume; map readability degrades beyond ~12 nodes per screen |
| `HINT_ARROW_ON_SECOND_PRESS` | true | bool | whether the 2nd 提示 press reveals the move arrow |
| `acceptAnyMate` (per-puzzle) | false | bool | widen mate-in-1 acceptance to any mating move |

All tuning lives in a `dungeon-tuning.ts` config module (data-driven per coding
standards); puzzle content lives in a `data/puzzles/` module, never hardcoded in views.

---

## 8. Acceptance Criteria

1. **Map renders & gates**: given a progress state, the map shows each node as
   done/current/locked per §4.1; only the `current` node is enterable; tapping it routes
   to its puzzle. *(Unit test on the selection function + UI walkthrough.)*
2. **Correct single-move solve**: playing the authored move on a 1-move puzzle transitions
   to `solved`, shows `successText`, and marks the puzzle done in the progress store.
   *(Unit test on the validator + store; UI walkthrough.)*
3. **Multi-move solve**: on a mate-in-2, the correct first move triggers the scripted
   opponent reply, and the correct second (mating) move solves it; a wrong move at either
   ply snaps back without losing progress. *(Unit test on the ply state machine.)*
4. **Mate flexibility**: a mate-in-1 with `acceptAnyMate` accepts any legal checkmating
   move; one without it accepts only the authored move. *(Unit test.)*
5. **Wrong move is forgiving**: a wrong-but-legal move shows「再想想」, snaps back, keeps
   state, and never alters progress. *(Unit test + UI walkthrough.)*
6. **Hints are two-stage & non-penalising**: 1st press shows the idea, 2nd press draws the
   move arrow; using a hint sets `hintUsed` but does not block solving or alter unlock.
   *(UI walkthrough + store assertion.)*
7. **No streak / timer / leaderboard**: no streak counter, no timer, no leaderboard exists
   anywhere in the mode; progress is shown only as solved/total counts. *(Code review +
   UI walkthrough — grep for streak/timer in the module returns nothing.)*
8. **Unlock persistence + cross-device sync**: solving a puzzle unlocks the next; reloading
   the app preserves solved state via localStorage; once logged in, solved progress writes
   to Supabase (`dungeon_progress`) and is restored on another device (union reconcile on
   login, mirroring `lesson_progress`). *(Store unit test for reconcile union + documented
   playtest for the device round-trip.)*
9. **Deep-link safety**: `/dungeon/:puzzleId` for a locked or unknown id redirects to the
   map; a done id is replayable. *(Unit test on the route guard + walkthrough.)*
10. **Data integrity**: an automated test asserts every puzzle FEN is legal (both kings,
    parseable by chess.js), every `solution` is a legal line from the FEN, `solution`
    length is odd, and `order` values are unique and contiguous. *(Blocking data test.)*
11. **Gambit compliance**: dark dungeon surface, jade "coin" climb nodes, gold only on the
    current node/CTA/already-climbed trail (never as body text); bottom-to-top perspective
    funnel centred on screen; 3-level floor dividers; Lucide icons (no emoji); 西洋棋用語
    (后/城堡/騎士/主教); interactive (done/current) touch targets ≥ 44×44px. *(Visual review.)*
12. **Reduced motion**: with `prefers-reduced-motion`, the puzzle view's opponent replies
    are instant. (The climb map carries no looping animation.) *(Walkthrough.)*

---

## Appendix: Puzzle Data Schema (TypeScript)

```ts
export type PuzzleMotif = 'capture' | 'fork' | 'pin' | 'mate-in-1' | 'mate-in-2'

export interface PuzzleMove {
  from: string
  to: string
  promotion?: 'q' | 'r' | 'b' | 'n'
}

export interface Puzzle {
  id: string
  level: 1 | 2 | 3
  order: number            // global, unique, contiguous; drives unlock
  motif: PuzzleMotif
  title: string            // map node label
  prompt: string           // ask shown above the board
  fen: string              // both kings; side-to-move = player
  solution: PuzzleMove[]   // alternating player/opponent, player first, odd length
  hint: string             // Socratic idea, never the move
  successText: string      // transferable principle
  acceptAnyMate?: boolean  // mate-in-1 only: accept any mating move
}
```
