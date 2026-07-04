# Learning Loop — Concept Linking (GDD)

> **Status**: APPROVED (round-2 re-review, 2026-06-06) — 3 product decisions resolved by Eason; the one
> round-2 blocker (D1 spec'd against the wrong dungeon gate) corrected to side-door practice mode. Ready
> for epic/story breakdown. See `reviews/learning-loop-review-log.md`.
> **Tier**: Phase 2 (Feature layer)
> **Category**: Gameplay (Feature layer; connective system #20)
> **Depends on**: Lesson System (#18), Dungeon Puzzle Mode (#19), Post-Game Review (#7), Navigation & Routing (#4), Game History (#12)
> **Realises**: the deferred Required ADR #4「Bidirectional lesson-to-game linking」(technical-preferences.md → `docs/architecture/adr-0012`) and Pillar 2「Knowledge Connects to Play」(game-concept.md)

> **✓ 3 decisions resolved by Eason (2026-06-06)**: (D1) Bridge-1 CTA opens the concept's puzzle in a
> **side-door practice mode** that bypasses the dungeon lock and **does not mutate the linear map**
> (re-specified round 2 — the original "unlock exemption" was found to break #19's map invariant); (D2)
> Bridge-3 link is a **neutral opt-in tag behind the detail affordance** (no verdict); (D3) Concept Map's
> 「在你對局中出現過」column **omitted in v1** — Map ships on 已學/已練 only.

---

## 1. Overview

The Learning Loop is a **connective system**, not a new screen. It introduces a single shared
primitive — a closed vocabulary of named chess **concepts**（捉雙、牽制、子力、將殺…）— and uses it to
stitch the three currently-isolated learning surfaces into one loop:

- **Lesson System (#18)** teaches a concept by name.
- **Dungeon Puzzle Mode (#19)** drills the same concept (its `motif` is the concept in practice).
- **Post-Game Review (#7)** is where a concept shows up — or fails to — in the player's *own* game.

Today these three never talk to each other. The Learning Loop closes that gap with three lightweight
bridges driven by the shared concept tag:

1. **課程 → 試煉**: completing a concept lesson offers matching-concept puzzles to practise.
2. **試煉 → 課程**: a puzzle exposes a calm back-link to the lesson that teaches its concept.
3. **對局 → 課程／試煉** *(the differentiator)*: when a move matches a **reliable signal** (§3.4), the
   review tags it with a related concept — a neutral, opt-in signpost to the relevant lesson + drill. The
   review never "judges" the move; it attaches a concept label only when a signal definitively matches.

A fourth surface — the **Concept Map** — is the loop's navigation hub: a calm view of which concepts you
have met and practised（已學 / 已練），replacing the streak/XP competitors use. *(v1 shows two boolean
states, not a deepening gradient — see §3.5 / D3 honesty note.)*

**v1 scope is tag-matching, not generation — zero AI, zero new backend.** The concept vocabulary is
static front-end data; bridges 1–2 and the Concept Map are pure lookups over existing local progress.
Bridge 3 is deliberately **scoped to only the mistakes the review can reliably detect** (see §3.4) and
is the last phase. Dynamic Beth commentary via Claude API (Phase 2b) is an **optional** later layer
over the same tags — never a dependency.

**Why this is market-differentiating**: neither lichess Learn (mechanics in isolation) nor chess.com
Lessons (generic, gamified challenges) connects what it teaches to *your* games. The Learning Loop's
hook is "the lessons that know what you played" — personalised, calm, free, offline. This is the
Pillar 2 hook the project's own concept docs promised and the Required ADR #4 it never wrote.

> **Honesty note (post-review)**: design-review round 1 found that, on real data, both flagship paths
> *under-fire* unless designed around — Bridge 1's fork/pin CTAs hit the dungeon's linear lock, and
> Bridge 3's classifier cannot reliably read fork/pin from the engine line. This revision fixes Bridge 1
> (D1) and narrows Bridge 3 to reliably-detectable signals, deferring fork/pin mistake classification.
> The loop's value is real but **smaller and more honest** than the first draft implied.

---

## 2. Player Fantasy

> *"我學完『牽制』，課程結束時看到一個安靜的邀請：『想趁熱練幾題嗎？』我點下去，幾個盤面接住我，
> 那個圖案開始變熟。隔天我打了一盤棋，賽後檢討還是那張平靜的地圖、那些中立的數字——但在我輸掉一子
> 的那一手旁，多了一個低調的標記：『這個位置和「子力」有關』。我自己點開，又看了一次那一課。沒有人
> 罵我、沒有人說我笨——是我自己的棋把我帶回了該複習的地方。課程、練習、和我的對局，講的是同一件事。"*

- **學了就用得到**：學完一個概念，馬上有對應練習接住我；不必自己去別的分頁大海撈針。
- **我的棋會把我帶回去**：賽後檢討維持它原本的中立——不評判、只給數字和地圖（#7 的鐵則）。當它**有把握**
  認出我犯的是哪一類錯時，只多一個**安靜、可選、由我自己點開**的入口，絕不主動指認、絕不派作業。
- **平靜地變強**：進度不是連續天數、不是分數攀比，而是「我對牽制的掌握在加深」這種具體、無壓力的軌跡。
- **永不被誤導**：賽後檢討只在「高把握」時才給概念入口；認不出來就完全沉默，維持原本的數字檢討。
  錯標比沉默更糟——所以預設沉默。

> **v1 範圍誠實聲明（回應 review）**：上面的願景情境用「掛子力」當例子——那在 v1 *會*兌現。但**賽後路標
> 在 v1 只認得兩種訊號：走進強制將殺、與送掉無保護的子力**（§3.4）。整套詞彙的兩個招牌戰術——捉雙、牽制
> ——在 v1 的**賽後方向不會觸發**（pv 不可靠，延到 Phase C+）。換言之：被捉雙輸了一隻子，你看到的是
> 「子力」標記，不是「捉雙」。捉雙/牽制在課程（Bridge 1）和試煉（Bridge 2）裡完整教與練——只有「從你
> 的對局回推」這條路先收窄。這條迴圈是真的，但比初稿小、誠實。

**聲音的分工（修訂後，回應 review）**：貝絲的**人格聲音只活在課程裡**（她在那裡問「what's the idea
here?」）。試煉與賽後檢討維持各自既有的調性——試煉是平靜的「正確 + 原理」，賽後檢討是**無人格的中立
數字**。三道橋是**安靜的路標，不是貝絲在賽後檢討裡開口說話**。§1 的「同一件事」指的是**同一套概念詞彙**
貫穿三者，不是同一個人格聲音覆蓋三者——後者會違反 #7 的中立鐵則。

**對照市場**：lichess 教機制但與我的棋局無關；chess.com 有考題但是通用的、且用 XP／等級遊戲化。
Gambit 的迴圈是「知道我剛剛下了什麼的課程」——個人化、平靜、免費、離線。

---

## 3. Detailed Design

### 3.1 The shared primitive — Concept

A **Concept** is a named, beginner-level chess idea drawn from vocabulary the three systems already
use. The set is **closed and static** (a TS union; see Appendix). Each concept records the lesson(s)
that teach it (by **real lesson id**) and the puzzle `motif`(s) that drill it.

> **Namespace note (rec 8)**: `lesson.order` and `puzzle.order` are **two independent linear axes**
> (each 1-based and contiguous within its own catalog; e.g. both a lesson and a puzzle currently hold
> `order: 15`). Concepts link the two catalogs by **id / motif**, never by comparing `order` across
> them. Every `order` reference in §4 is scoped to a single catalog.

v1 concept set (each verified against real lesson ids in `src/data/lessons/` and real motifs in #19):

| Concept id | 繁中 | Taught by (real lesson id) | Drilled by (puzzle motif) | Bridge 1/2 live in v1? |
|---|---|---|---|---|
| `material` | 子力（得失／無保護的子） | `king-and-value` | `capture` | ✅ both |
| `fork` | 捉雙 | `fork` | `fork` | ✅ |
| `pin` | 牽制 | `pin` | `pin` | ✅ |
| `mate` | 將殺 | `checkmate-in-one` *(+ capstones recall it)* | `mate-in-1`, `mate-in-2` | ✅ |
| `skewer` | 串擊 | `skewer` | — *(no puzzles yet)* | lesson-only |
| `discovered` | 閃擊 | `discovered-attack` | — *(no puzzles yet)* | lesson-only |
| `defense` | 保護 | `protection` | — *(no puzzles yet)* | lesson-only |
| `center` | 控制中心 | `control-the-center` | — *(no puzzles yet)* | lesson-only |

**Fix (blocker 1): `hanging` → `material`.** The first draft's `hanging`/「棋子取奪」was mis-mapped:
the `king-and-value` lesson teaches piece *value*, the `capture` puzzles drill *winning undefended
material*, and「取奪」means active capture — four different things. The shared idea all three actually
hold is **子力得失**（material: its value, winning it when undefended, losing it when you hang it). The
concept is renamed `material`, label「子力」, and its review heuristic (§3.4) is specifically "hung
**undefended** material", which is the value lesson's transferable point. This keeps §1's "no new
vocabulary invented" honest — `material` is a name all three surfaces genuinely share.

**Fix (rec 10): added `defense`(保護).** The real `protection` lesson had no concept to tag; added.

Concepts with no drill puzzles (`skewer`/`discovered`/`defense`/`center`) are valid catalog members;
their "course → puzzle" bridge shows a calm "謎題即將加入" state (EC-1). Adding a matching puzzle lights
the bridge with no code change (data-driven). To avoid the Concept Map "permanent half-lit" anxiety
(rec 7), these lesson-only concepts are **not shown as「未達成」** on the Map (§3.5).

### 3.2 Bridge 1 — 課程 → 試煉 (practice continuation)

- On **lesson completion**, if the lesson carries `concepts` with drill puzzles, the completion panel
  shows a calm **invitation** (not a command): **「想趁熱練幾題『牽制』嗎？」** — phrased to preserve the
  lesson's completion feeling, not turn it into a to-do (rec 11).
- Tapping it routes to the concept's recommended puzzle (§4.3) in the existing Dungeon player.

**【D1 — DECIDED 2026-06-06 (re-specified round 2): side-door practice mode, dungeon map untouched】 The
dead-end fix.** Lesson progress and dungeon unlock are **decoupled** linear tracks (design-review blocker
2): a player who just finished the `fork` lesson has almost never solved dungeon up to the `fork` puzzles'
order, so under the first draft's "only offer unlocked puzzles" rule the fork/pin CTA was *normally* the
locked-hint fallback — the flagship case rarely fired.

> **Round-2 correction (decisive systems finding).** The first revision proposed adding a
> `lessonOriginUnlocked` exemption to *#19's unlock predicate*. Round-2 review found this is specified
> against the **wrong gate**: the puzzle player guards entry on `nodeState(puzzle) === 'locked'`
> (`src/views/DungeonPuzzleView.vue`), where `nodeState` returns `'locked'` for everything that is not
> `solved` or the single `currentOrder` frontier (`src/stores/dungeon-progress.ts`). Patching `isUnlocked`
> alone is therefore a **no-op** (the CTA still bounces back to `/dungeon`); patching `nodeState` to honour
> the exemption produces a **gap-toothed "done island"** on the map (a solved node far ahead of the
> frontier) that breaks #19's「一格格點亮」feel and its contiguous-solved-prefix invariant.

> **Adopted fix — side-door practice mode (Eason, 2026-06-06).** The Bridge-1 CTA opens the concept's
> lowest-order **unsolved** puzzle in a **practice entry-path** that bypasses the dungeon's linear
> `nodeState` gate (a `?from=lesson` route intent the entry guard honours for exactly that one puzzle id).
> Solving it in practice mode counts **only** toward `practiced(c)` / the Concept Map — it does **not**
> write the dungeon `solved` set, does **not** advance `currentOrder`, and does **not** touch
> `isUnlocked`. **The dungeon's linear map is completely unchanged**: no done-island, no N+1 unlock leak,
> **zero change to #19's unlock semantics.** The unified-progress feel is carried by the Concept Map's
> 已練 state, not by mutating the dungeon map. Trade-off (accepted): a puzzle practised from a lesson is
> re-solved later when the player linearly reaches it in the dungeon — for a calm training app this is
> benign, even desirable (spaced repetition).

Rejected alternative: a true unlock exemption that marks the node `solved` and defines a new "solved-ahead"
map state (keeps one progress set, but adds map complexity and a real #19 semantic change). The side-door
keeps the two tracks cleanly separable and #19 untouched. Concepts with no puzzles → EC-1.

- The bridge is optional/non-blocking; the lesson is already complete. Concepts with no puzzles → EC-1.

### 3.3 Bridge 2 — 試煉 → 課程 (just-in-time teaching)

- The Dungeon puzzle view exposes a **calm, always-visible**「複習這個概念」link (in the hint/overflow
  area) to the lesson teaching the puzzle's concept, when that lesson exists.
- **Fix (rec, game-designer)**: the first draft escalated this link after counting 2 wrong attempts —
  an implicit failure counter that reads as "you're struggling, go study." Removed. The link is
  **always present and unchanging**, never tied to wrong-attempt count, honouring #19's "no penalty,
  no judgment" rule. (`PUZZLE_FAIL_THRESHOLD` knob is dropped.)
- If the puzzle's concept has no teaching lesson, the link is absent (EC-3).

### 3.4 Bridge 3 — 對局 → 課程／試煉 (the differentiator, scoped honestly)

Post-Game Review (#7) computes per-move centipawn loss and surfaces the single biggest-swing moment,
but **deliberately stays neutral and number-only** ("prescribe study is Phase 2 territory", #7 Player
Fantasy). Bridge 3 is that Phase-2 hook — but design-review found the first draft both (a) put a
Beth-voiced verdict on #7's neutral surface, and (b) relied on `pv[0]` to classify fork/pin, which is
unreliable. This revision fixes both.

**(a) Reliable signals only — fork/pin classification deferred.** Classification reads the **actual
game continuation** (`completedGame.moves`), i.e. *what actually happened to the player*, not the
engine's hypothetical `pv` line. v1 fires on exactly two reliably-detectable signals:

1. **`mate` — allowed forced mate**: the review *already* detects this via F2b (#7); zero new logic,
   100% reliable. The mistake that walked into a forced mate → concept `mate`.
2. **`material` — hung undefended material**: a defined predicate (§4.4) — after the player's move, the
   opponent's **actually-played** next move captured a player piece that was undefended, and no
   recapture restores the material. Reliable from the real game line.

**Fork and pin mistake-classification are explicitly deferred** out of v1 (design-review blocker 3):
`pv[0]` is the engine's best continuation, not necessarily the move that punished the tactic; multi-step
forks and "bigger tactic available" cases make a pv-based heuristic silently miss, and there is no
reliable single-ply predicate. They return when a precision spike (a fixture corpus + measured hit-rate)
validates a detector — tracked as a follow-up, not shipped on a guess. (Bridges 1–2 still teach/drill
fork & pin fully; only the *game-mistake* direction defers them.)

**(b) Neutral, opt-in signpost — no verdict. 【D2 — DECIDED 2026-06-06】** When a signal fires, the
review shows a **neutral, opt-in** affordance, consistent with #7's existing "Show detail" opt-in model:
a quiet tag on that move — **「相關概念：子力」** — that the player **chooses** to open, revealing the
lesson + drill links. It is **not** a second-person verdict (no「你被…了」), carries **no homework
quantifier** (no「練 3 題」), and **does not appear in #7's default neutral render** — it lives behind
the same opt-in detail the review already gates advanced signals behind. This preserves #7's "no
teacher, just a map, no judgment" fantasy (design-review blocker 5 / rec 5). **Eason confirmed
(2026-06-06): the neutral opt-in tag behind the detail affordance.** Binding constraint: neutral,
opt-in, no verdict, not in the default render.

- **Link attaches to the classified move itself** (fix, internal inconsistency): the signpost sits on
  the move the signal fired on. It is **not** forced onto the biggest-swing anchor; if the anchor itself
  is classifiable, the signpost is there, otherwise it is on its own move. `MISTAKE_CONCEPT_MAX_LINKS`
  (default 1) caps how many such signposts a review shows, ranked by cpLoss.
- **Silence is the default and correct** (EC-4/EC-10): if neither signal fires, no signpost; the review
  is unchanged.

### 3.5 The Concept Map (loop spine, replaces XP/streak)

> **2026-06-21 重構（supersedes the `?from=concept` side-door of `quick-specs/concept-tab-tactic-entry.md`）**:
> 每個概念卡不再側門跳進入門課，而是通向該戰術的**深化頁**（`/learn/concept/:conceptId`，更深一層的
> transfer-focused 迷你課）。入門課留在線性 track；側門/`sideLearned`/`lesson_side_learned` 整套拆除，
> 已學改只讀線性 `completed`。已學/已練兩訊號不變，深化完成為第三個獨立安靜狀態（卡片「深入/重溫」文字，
> 非彩點）。詳見 `quick-specs/concept-deepening-page.md`。下文 §3.5 既有條目維持其「平靜反映面」靈魂不變。

- A calm view (route `/learn/concepts` or a Learn panel) showing each concept's standing.
- **v1 shows 已學 / 已練 only** (§4.2). **Fix (rec 7)**: to avoid checklist/progress anxiety, the Map
  **does not render un-started concepts as「未達成」/待辦**; it surfaces lit concepts and keeps the rest
  visually quiet (no "X/8 done" framing, no completion bar). It answers "你對哪些圖案熟了" — not "你還
  差幾個".
- **【D3 — DECIDED 2026-06-06: omit in v1】 The「在你對局中出現過」column.** The first draft proposed a
  third state showing which concepts appeared as mistakes in the player's games. Design-review (rec 6)
  flagged this as a **cross-game negative error tally**, which #7 explicitly refuses ("never forms a
  thematic verdict across games"). **Eason's decision (2026-06-06): omit this column out of v1**; the Map
  ships on 已學/已練 only. If built later, it must be framed neutrally ("最近在你的對局中相關", a discovery
  hook) — never as a「你犯過的錯」history.
- No streak, timer, leaderboard, points, or XP anywhere (Gambit rule).
- Each row links to the concept's **deepening page** (`/learn/concept/:id`; the Map is the door to go deeper). *(2026-06-21 重構: was「lesson and drill puzzles」side-door — see §3.5 note.)*

### 3.6 Phasing (recommended landing order)

| Phase | Scope | New work | Risk | AI? |
|---|---|---|---|---|
| **A** | Concept SoT + tag lessons + motif→concept map + **Bridge 1** (incl. D1 side-door practice mode) | data + 1 CTA + practice entry-path (`?from=lesson`) | low–med | none |
| **B** | **Bridge 2** + **Concept Map** (已學/已練 only) | 1 link + 1 view | low | none |
| **C** | **Bridge 3** (mate + material signals only) | classifier (2 predicates) in review | medium | none |
| **C+** *(follow-up)* | fork/pin mistake detection after a precision spike | classifier extension | medium–high | none |
| **D** *(optional)* | Claude API dynamic Beth commentary over the same tags | Edge Function + prompt | — | yes (2b) |

Phase A is the minimum viable first cut (pending D1). Each phase is independently shippable.

### 3.7 Access & routing

- Bridges 1–3 live inside existing screens (no new top-level nav).
- Concept Map (Phase B): a Learn sub-route, lazy-loaded, no auth (mirrors `/learn`). Placement is a
  UX-spec decision; this GDD requires only that it is reachable from Learn and obeys the calm rules.

---

## 4. Formulas

### 4.1 motif → concept map (single source of truth for the inverse index)

```
motifToConcept : PuzzleMotif → ChessConcept          (total; TS Record<PuzzleMotif,…> enforces totality at compile time)
  capture     ↦ material
  fork        ↦ fork
  pin         ↦ pin
  mate-in-1   ↦ mate
  mate-in-2   ↦ mate

conceptToMotifs(c) = { m : motifToConcept(m) = c }    (DERIVED, not stored; may be ∅, e.g. skewer/discovered/defense/center)
```

- Total over the current `PuzzleMotif` set (#19). Adding a motif without a row fails to compile
  (`Record<PuzzleMotif, …>`), so the map can never silently miss a motif (rec, nice-to-have).
- Example: `conceptToMotifs(mate) = { mate-in-1, mate-in-2 }`; `conceptToMotifs(skewer) = ∅`.

### 4.2 Concept mastery state (v1: two states)

For concept `c`, with `teaches(c)` = lessons that teach it, and existing predicates `completed(l)` (#18)
and `solved(p)` (#19):

```
learned(c)    = teaches(c) ≠ ∅  AND  ∀ l ∈ teaches(c): completed(l)
practiced(c)  = | { p : motifToConcept(motif(p)) = c  AND  solved(p) } | ≥ CONCEPT_PRACTICED_THRESHOLD
```

- Each ∈ {true,false}. The `teaches(c) ≠ ∅` guard prevents vacuous-truth `learned` on empty teaches.
- `CONCEPT_PRACTICED_THRESHOLD` default 1 (range 1–5; **0 would mark every concept practised
  unconditionally — excluded**, §7).
- For lesson-only concepts (`conceptToMotifs(c)=∅`), `practiced(c)` is always false — so the Map shows
  them as 已學-only and never as a half-lit「未達成」(§3.5).
- `encountered(c)` (the third state) is **deferred — see §3.5 D3**.

### 4.3 Lesson → puzzle recommendation

For a just-completed lesson teaching concept `c`, puzzles sorted ascending by **puzzle** `order`:

```
candidates(c)     = [ p : motifToConcept(motif(p)) = c, sorted by puzzle.order ]      (may be ∅: skewer/discovered/defense/center)
recommended(c, N) = first N of candidates(c), preferring unsolved(p) before solved(p)  (0 ≤ |·| ≤ N)
practiceTarget(c) = first unsolved(p) of candidates(c), else first solved(p) (replay)  (the side-door CTA target, D1)
```

- **D1 side-door (round-2 spec): `candidates(c)`, not `enterable(c)`.** Because the CTA opens the puzzle
  in **practice mode** (bypasses the dungeon `nodeState` lock, §3.2), recommendation no longer filters by
  dungeon unlock at all — every puzzle of the concept is a legitimate practice target. The first-draft
  `enterable(c)` / `lessonOriginUnlocked(p)` predicates are **removed** (they were specified against the
  wrong gate). `practiceTarget(c)` is the single puzzle the CTA deep-links into (`?from=lesson`).
- `N = LESSON_TO_PUZZLE_COUNT` (default 3). If `candidates(c)` is empty (lesson-only concept) → no CTA,
  calm "謎題即將加入" line instead (EC-1).
- **Practice solve is side-channel**: solving `practiceTarget(c)` increments `practiced(c)` (Concept Map)
  but does **not** call the dungeon store's `markSolved` / advance `currentOrder` (§3.2). The dungeon
  `solved` set and linear map are untouched.
- **Difficulty-match (rec 9)**: for `mate`, `recommended` prefers puzzles whose `motif` matches the
  lesson's level — a player who finished `checkmate-in-one` is offered `mate-in-1` puzzles before
  `mate-in-2`. Encoded as a secondary sort key (motif-affinity) within `candidates(mate)`.

### 4.4 Mistake classification & link selection (Phase C — reliable signals only)

`classify` is a **pure function** over the actual game line — no engine call beyond what #7 already ran:

```
classify(i) : (fen_i, playerMoveUci_i, opponentReplyUci_{i+1}, reviewSignals_i) → ChessConcept | none

  // Signal M (mate): reuse #7's F2b detection
  if reviewSignals_i.allowedForcedMate:           return 'mate'

  // Signal H (material): defined predicate on the ACTUAL continuation
  if hungUndefendedMaterial(fen_i, playerMoveUci_i, opponentReplyUci_{i+1}):  return 'material'

  return none      // fork/pin and everything else → silence (deferred / unclassifiable)

hungUndefendedMaterial(...) :=
     opponentReply is a normal capture of a player piece P on square s          (see exclusions)
  ∧  "undefended": NO legal move exists for the player that recaptures on s     (legality-based, not geometric)
  ∧  "no compensation": NO legal recapture on s captures a piece of value ≥ value(P)   (existential, ONE ply only — no SEE)
  (all computed by replaying with chess.js — same technique as puzzles.test.ts)

  Definitional clauses (round-2, systems-designer), so the AC-5/6 fixtures are writable:
  - "defender" / "recapture" is defined by chess.js LEGALITY, not geometry: a piece that is absolutely
    pinned cannot legally recapture, so it does NOT count as a defender. This is the conservative reading
    (prefer-silence): if the only "defender" is pinned, the player genuinely can't recapture.
  - One-ply only: the predicate does NOT evaluate whether the recapturing piece is itself then hanging
    (no static-exchange eval — that would need an engine call #7 didn't run). Existence of any legal
    recapture of value ≥ value(P) ⇒ "compensated" ⇒ none.
  - EXCLUDED from v1 classification (return none, not a guess): en-passant captures (the captured pawn
    is not on the move's destination square — the predicate's "piece on square s" assumption breaks) and
    promotion-captures (value accounting differs). These are rare; v1 stays silent rather than mislabel.

classified  = [ (i, c) : isPlayerMistake(i) ∧ classify(i) = c ≠ none ], sorted by cpLoss(i) desc
shownLinks  = first MISTAKE_CONCEPT_MAX_LINKS of classified                   (default 1)
```

- `isPlayerMistake(i)`: reuses #7's eligibility (player move, final large cpLoss).
- `MISTAKE_CONCEPT_MAX_LINKS=0` → never shows (excluded; range 1–3).
- Worked example: player hangs a knight; opponent's actual next move captures it, knight had 0
  defenders, no recapture → `classify = material`; signpost on that move.
- Counter-example (EC-10): opponent could capture but the player has an equal recapture → predicate
  false → `none` (no false-positive label).

---

## 5. Edge Cases

- **EC-1 — Concept taught, no drill puzzles** (`skewer`/`discovered`/`defense`/`center`): lesson
  completion shows a calm "這個概念的試煉即將加入" line, not a CTA. Lights up when a puzzle is authored.
- **EC-2 — Concept has puzzles but all are dungeon-locked**: with the D1 side-door (§3.2) this is **no
  longer an edge case** — practice mode bypasses the dungeon lock, so any concept with ≥1 puzzle always
  has a `practiceTarget`. The only no-CTA case is a concept with **zero** puzzles, which is EC-1.
- **EC-3 — Puzzle motif with no teaching lesson**: Bridge-2「複習」link absent. (None in v1: every
  motif's concept has a teaching lesson — verified.)
- **EC-4 — Mistake unclassifiable** (the majority — positional/time/endgame, and v1-deferred fork/pin):
  `classify` returns `none`; no signpost; review unchanged. The default path; not a failure state.
- **EC-5 — Both signals could fire on one move** (a move that both hangs material *and* allows mate):
  precedence is **fixed and explicit** — `mate` before `material` (the larger error). Returns exactly
  one concept (§3.4 ordering is the tie-break; no undefined cross-signal "confidence" comparison).
- **EC-6 — Logged out / no reviewed games**: Bridges 1–2 and the Map's 已學/已練 work fully on
  localStorage; Bridge 3 needs game history — absent when logged out / no games, the signpost simply
  never appears.
- **EC-7 — All drill puzzles for a concept already solved**: Bridge-1 CTA still offers them (replay,
  per #19), labelled calmly ("再練一次"); `practiced(c)` stays true; `recommended` falls back to
  order-sorted solved puzzles.
- **EC-8 — Lesson teaches multiple concepts**: one CTA per concept that has puzzles (capped at
  `LESSON_TO_PUZZLE_COUNT` concepts for readability); `learned` is evaluated **per concept
  independently**; `teaches(c)=∅` never learned.
- **EC-9 — Concept SoT references a non-existent lesson id** (authoring error): build-time data test
  fails (AC-1); never ships. At runtime a missing reference degrades to "no link", never a crash.
- **EC-10 — Classifier false-positive risk**: the two predicates are exact (allowed-mate from F2b;
  hung-undefended-material with a no-recapture clause). A borderline case that fails the predicate
  returns `none`. A wrong thematic label is worse than silence, so the predicates are strict, not fuzzy.

---

## 6. Dependencies

### Upstream

- **Lesson System (#18)** — `completed(l)`; LessonView completion panel hosts the Bridge-1 invitation;
  lessons gain optional `concepts?: ChessConcept[]` (additive). *(Reciprocal noted in lesson-system.md.)*
- **Dungeon Puzzle Mode (#19)** — `solved(p)` + `markSolved(p)`; existing puzzle player as the Bridge-1
  target; `motif` as the drill tag; puzzle view hosts the Bridge-2 link. **D1 (round-2 spec): the
  Bridge-1 CTA opens the puzzle in a side-door practice mode that bypasses the `nodeState` entry guard
  (`DungeonPuzzleView.vue`) for one puzzle id (`?from=lesson`), and a practice solve does NOT call
  `markSolved` / advance `currentOrder`.** This is **NOT** a change to #19's unlock semantics — the
  linear map, `isUnlocked`, `nodeState`, and the `solved` set are all untouched; #19 only gains a
  practice entry-path on its puzzle view. *(Reciprocal — practice-mode entry param — noted in
  dungeon-puzzle-mode.md.)*
- **Post-Game Review (#7)** — Bridge 3 reuses cpLoss eligibility + F2b allowed-mate detection + the
  actual move line; adds an opt-in signpost **outside** the neutral default render (D2). Must not alter
  #7's default. **Two reciprocal #7 updates required (round-2):** (1) #7's "the review does not prescribe
  study" boundary must be amended to read "the *default* review does not prescribe study; an opt-in
  concept tag (Learning Loop Bridge 3) may surface a link behind the Show-detail affordance" — otherwise
  #7's own GDD contradicts Bridge 3; (2) #7 must expose a stable `data-testid="review-detail-panel"` on
  its opt-in detail container so AC-9b can assert the signpost is a descendant of it. *(Reciprocal noted
  in post-game-review.md Downstream.)*
- **Game History (#12)** — the set of reviewed games for Bridge 3 (and a deferred Map column, D3).
- **Navigation & Routing (#4)** — Concept Map sub-route (Phase B); bridges reuse existing routes.
- **chess.js** (bundled) — replays the actual line for the Phase-C `hungUndefendedMaterial` predicate.

### Downstream

- **(Phase 2b) AI tutor (Claude API)** — optional dynamic Beth commentary over the same tags; not required.
- **(Future) Skill Scoring (#13)** — could read per-concept mastery; out of scope here.

### ADR

- **ADR-0012 — Bidirectional lesson-to-game linking** (realises Required ADR #4): concept tag as the
  linking medium (vs per-FEN indexing); the "links only add, never degrade the neutral review"
  invariant; the conservative-classifier / prefer-silence policy.

---

## 7. Tuning Knobs

| Knob | Default | Safe range | Affects |
|------|---------|-----------|---------|
| `LESSON_TO_PUZZLE_COUNT` | 3 | 1–5 | drill puzzles the Bridge-1 invitation offers (0 → never offers; excluded) |
| `CONCEPT_PRACTICED_THRESHOLD` | 1 | 1–5 | puzzles solved before a concept counts 已練 (0 → all concepts unconditionally practised; excluded) |
| `MISTAKE_CONCEPT_MAX_LINKS` | 1 | 1–3 | concept signposts per game review (0 → never shows; excluded) |
| `CLASSIFIER_SIGNALS` | mate, material | subset | which signals Bridge 3 attempts in v1; fork/pin deferred to Phase C+ |
| `SHOW_CONCEPT_MAP` | true | bool | Phase-B Concept Map on/off |

> **Status note（2026-07-03）**：`LESSON_TO_PUZZLE_COUNT` 與 `SHOW_CONCEPT_MAP` 已自
> `learning-loop-tuning.ts` 移除——兩者從未被程式讀取（Bridge-1 邀請數的消費端未實作；概念地圖
> 已是常駐正式功能、無開關需求）。表中保留為設計參考；若日後實作再恢復常數。
> `CLASSIFIER_SIGNALS` 同日已接線（Eason 拍板「接」）：`classify()` 依此清單決定啟用哪些偵測器，
> 從清單移除訊號即停用；Phase C+ 擴 fork/pin 時擴充 `ClassifierSignal` union 並加入清單。

`PUZZLE_FAIL_THRESHOLD` from the first draft is **removed** (Bridge-2 link is now always-visible, §3.3).
The「在你對局中出現過」column knob is deferred with D3. All tuning lives in `learning-loop-tuning.ts`;
the concept vocabulary lives in `src/types/concept.ts` + `src/data/concepts/`, never hardcoded in views.

---

## 8. Acceptance Criteria

> ACs are split into **automated** (vitest / Playwright — blocking) and **manual** (walkthrough —
> advisory) per qa-lead review. Vague adjectives ("calm", "Beth-voiced") are removed from automated
> ACs and moved to the manual set.

**Automated (blocking):**

1. **Concept SoT integrity** *(data test, mirrors `puzzles.test.ts`)*: every `ConceptMeta.label` is a
   non-empty string (`.trim().length > 0`); every id in every `teaches` resolves to an existing lesson
   id (`new Set(lessons.map(l=>l.id))`); `Object.keys(MOTIF_TO_CONCEPT)` **equals** an explicit runtime
   `ALL_PUZZLE_MOTIFS` const **adjacent to the `PuzzleMotif` type** (NOT `puzzles.map(p=>p.motif)`, which
   passes vacuously when a motif has no authored puzzle — systems-designer round 2); `conceptToMotifs` is
   computed (derived), so no stored-inverse cross-check is needed. **Bidirectional tag integrity**: every
   concept's `teaches` lesson, when loaded, carries that concept in its `concepts` field (catches a
   lesson that has the id but was never tagged — qa round 2).
2. **Bridge 1 — `recommended()` / `practiceTarget()` pure functions**: given fixtures, `recommended`
   returns ≤ N candidate puzzles, unsolved-first, difficulty-matched for `mate` (§4.3); `practiceTarget`
   returns the lowest-order unsolved puzzle, **and when all of `c`'s puzzles are solved, falls back to
   the lowest-order solved puzzle (replay, EC-7) — never ∅ when the concept has ≥1 puzzle**. *(Unit test
   — covers both the unsolved path and the all-solved replay branch.)*
3. **Bridge 1 — concept with no puzzles → hint not CTA**: when `candidates(c)=∅` (lesson-only concept),
   the completion panel renders `data-testid="lesson-practice-hint"` and **no**
   `data-testid="lesson-practice-cta"`. *(Component test — EC-1.)*
2b. **Bridge 1 — side-door practice mode does not mutate dungeon progress (D1, round-2 BLOCKING)**: when
   the CTA opens `practiceTarget(c)` via the practice entry-path and the puzzle is solved, the **dungeon**
   progress store's `solved` set and `currentOrder` are **unchanged** (store snapshot identical except a
   separate practice/`practiced(c)` signal), and `nodeState` for every dungeon node is unchanged (no
   done-island, no N+1 unlock). A second concept's practice solve still does not advance the dungeon
   frontier. *(Store + unit test — asserts the zero-#19-mutation invariant that the side-door rests on.)*
4. **Bridge 2 — always-visible back-link, no failure counter**: the puzzle view renders
   `data-testid="concept-review-link"` whenever the concept has a teaching lesson, **independent of
   wrong-attempt count**; clicking it leaves the progress store snapshot unchanged and triggers no
   automatic navigation. *(Component + store test.)*
5. **Bridge 3 — `classify()` pure function, positive fixtures**: for a fixture
   `{fen, playerMoveUci, opponentReplyUci, reviewSignals}` where the player walks into a forced mate →
   `classify = 'mate'`; where the player hangs an undefended piece the opponent then captures with no
   legal recapture → `classify = 'material'`. *(Unit test with fixed inputs, chess.js replay.)*
6. **Bridge 3 — negative fixtures (false-positive suppression, EC-10)**: each → `classify = 'none'`:
   (a) captured piece had a **legal** recapture of value ≥ it; (b) the only "defender" is an absolutely
   **pinned** piece (no legal recapture — conservative silence per §4.4); (c) an **en-passant** or
   **promotion-capture** punished the move (excluded from v1 classification, §4.4); (d) a fork/pin
   situation (v1 deferred). *(Unit test — this is what distinguishes conservative silence from a broken
   classifier; covers the round-2 legality/exclusion clauses.)*
7. **Bridge 3 — precedence (EC-5)**: a move that both hangs material and allows mate → `classify =
   'mate'` (fixed precedence), exactly one concept. *(Unit test.)*
8. **Concept Map states**: `learned(c)`/`practiced(c)` pure functions return per §4.2 from a mock
   progress store; completing the lesson flips 已學, solving ≥ threshold puzzles flips 已練; lesson-only
   concepts never render as「未達成」. *(Unit + component test.)*
9. **Review default unchanged (structural invariant, not byte-for-byte)**: for a fixture game where
   `classify` returns `none` for every move, the review's rendered DOM contains **no**
   `data-testid="concept-signpost"` node and its set of existing `data-testid` nodes equals a
   **committed golden set** of #7's testids (the baseline is an explicit committed fixture, NOT a
   runtime "loop-off" render — qa round 2): `loopOnTestids \ {concept-signpost} == goldenSet`. The full
   #7 AC suite continues to pass in CI. *(Component test + CI.)*
9b. **Signpost opt-in gating, positive case (D2, round-2 BLOCKING)**: for a fixture where a signal DOES
   fire (`material` or `mate`), the **default** review render contains **no**
   `data-testid="concept-signpost"`; after the Show-detail opt-in is activated, the signpost node **is**
   present AND is a descendant of `data-testid="review-detail-panel"` (#7's reciprocal testid), never a
   sibling of the default neutral render. *(Component test — the automatable half of D2; AC-11b keeps
   only the subjective "reads as neutral, not a verdict" voice judgment.)*
10. **No streak/timer/leaderboard/XP**: grep of components + i18n strings matches none of
    `streak|timer|leaderboard|xp|points|連勝|計時|排行`. *(Automated grep.)*
11a. **Gambit compliance — automatable**: grep finds no emoji (`/\p{Emoji_Presentation}/u`) in
    components/strings; grep finds no 象棋用語 `車|馬|象` in any string resource (must use 城堡/騎士/主教);
    Playwright asserts every bridge interactive target ≥ 44×44px (`boundingBox()`). *(Blocking.)*

**Manual (advisory walkthrough):**

11b. **Gambit compliance — visual**: Beth's calm voice in the lesson-side copy; deep-jade anchor, gold
    only on focus/CTA; Bridge-3 signpost reads as a neutral observation, not a verdict; signpost is
    absent from #7's default render (opt-in only). *(Narrative + visual sign-off.)*
12. **Logged-out walkthrough**: bridges 1–2 + Map 已學/已練 work signed-out; Bridge-3 signpost absent
    with no game history. *(Walkthrough — EC-6.)*

---

## Appendix: Concept Schema (TypeScript)

Static front-end data. Type + table in `src/types/concept.ts`; SoT in `src/data/concepts/` (mirrors the
lessons/puzzles convention). Lessons gain an optional `concepts` field; puzzles are unchanged (their
`motif` is the drill tag via `MOTIF_TO_CONCEPT`). All `teaches` ids below are **real** lesson ids.

```ts
import type { PuzzleMotif } from './puzzle'

export type ChessConcept =
  | 'material'     // 子力（得失／無保護的子）
  | 'fork'         // 捉雙
  | 'pin'          // 牽制
  | 'mate'         // 將殺（含底線／基本殺王）
  | 'skewer'       // 串擊        (lesson-only in v1)
  | 'discovered'   // 閃擊        (lesson-only in v1)
  | 'defense'      // 保護        (lesson-only in v1)
  | 'center'       // 控制中心     (lesson-only in v1)

export interface ConceptMeta {
  id: ChessConcept
  label: string           // 繁中, e.g. '捉雙'
  teaches: string[]       // REAL lesson ids, e.g. ['fork']; AC-1 asserts each resolves
}

// Single source of truth for the drill mapping (§4.1). Total over PuzzleMotif (compile-time enforced).
export const MOTIF_TO_CONCEPT: Record<PuzzleMotif, ChessConcept> = {
  capture: 'material',
  fork: 'fork',
  pin: 'pin',
  'mate-in-1': 'mate',
  'mate-in-2': 'mate',
}

// Real lesson ids per concept (v1):
//   material→['king-and-value']  fork→['fork']  pin→['pin']  mate→['checkmate-in-one']
//   skewer→['skewer']  discovered→['discovered-attack']  defense→['protection']  center→['control-the-center']
//
// Lesson gains (additive, optional — does not break existing lessons):
//   concepts?: ChessConcept[]
//
// NOTE: lesson.order and puzzle.order are SEPARATE namespaces (§3.1). Concepts link by id/motif.
```
