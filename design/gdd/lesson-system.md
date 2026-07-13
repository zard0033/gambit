# Lesson System (GDD)

> **Status**: Approved & Shipped (四階 21 課)
> **Tier**: Phase 2 (Feature layer)
> **Category**: Gameplay (Feature layer)
> **Depends on**: Chess Board & Move System (#1), Navigation & Routing (#4)

---

## 1. Overview

A guided, lesson-by-lesson tutorial track for beginners. Each lesson is a static, pre-scripted sequence of board positions where a coach explains chess concepts one step at a time. The player reads the coach's explanation, then is occasionally asked to play a specific demonstration move; playing it correctly advances the lesson, playing wrong shows a hint and lets them retry. Lessons unlock linearly so the player progresses from shallow to deep across four tiers: **基礎規則 (rules) → 基本戰術 (tactics) → 開局原則 (opening) → 殘局技術 (endgame)**. v0 scope: static scripted content (no AI, no backend) with localStorage progress tracking. Delivered in two waves: **v1 = Tier 1 + Tier 2** (rules + tactics, ~12 lessons), **v2 = Tier 3 + Tier 4** (opening + endgame, ~7 lessons). Phase 2b may later layer AI commentary on top of the same scripted steps.

**Content sourcing**: the curriculum progression takes inspiration from lichess's open-source Learn module (`lila/ui/learn`) but is **clean-room authored** — all FENs and coach text are original (lila is AGPL-3.0; we copy neither text nor code). Note lichess's Learn engine allows king-less FENs; we render via chess.js, so **every FEN must include both kings** (placed clear of the lesson focus).

---

## 2. Player Fantasy

> *"貝絲·哈蒙 (Beth Harmon) 坐在我旁邊。她不要我背棋步——她要我『看懂』為什麼。每一步她都先給我一個處境、一個問題，等我自己想通。學完一課，我發現我不是記住了招式，而是開始用她的眼睛看整個盤面。"*

**Coach persona — 貝絲·哈蒙 (Beth Harmon)**: the single, consistent coach voice across all lessons. Calm, precise, sees patterns not rules; encourages **understanding over memorisation** (her defining trait in *The Queen's Gambit*). She frames each lesson as a situation and asks "what's the idea here?" rather than dictating moves. (Persona is presentation/voice only — see {@link Licensing guardrail in EPIC.md}: personal-use; revisit if published.)

- Understanding, not memorising: every move comes with its **WHY**; the player learns the idea, not the notation
- Situational: each lesson opens with a concrete `scenario` (a position + a problem), so the player always knows *what they're trying to do*
- Spiral / 融會貫通: later lessons recall earlier concepts by name; each tier ends with a **capstone** that combines its ideas in one real situation
- Active, not passive: the player physically plays the demonstrated move, not just reads
- Forgiving: a wrong move is met with a hint, never a penalty or judgment
- Visible progress: completing a lesson unlocks the next, giving a sense of a path

---

## 3. Detailed Rules

### Curriculum (淺 → 深)

Lessons are grouped into four tiers by a `tier` field (1–4). The catalog displays lessons grouped by tier, in `order`. Linear unlock still applies globally across the whole catalog (tier is display grouping, not a separate unlock gate).

| Tier | 主題 | 課程（clean-room 自寫，參考 lichess Learn 編排） | Wave |
|------|------|------|------|
| 1 | 基礎規則 | 兵的走法與吃子 · 車與象 · 馬與后 · 王的走法與子力價值 · 將軍與解將 · 一步將死 · 特殊規則（王車易位／吃過路兵／升變／逼和） | v1 |
| 2 | 基本戰術 | 捉雙 (fork) · 牽制 (pin) · 串擊 (skewer) · 閃擊 (discovered attack) · 保護與閃將 | v1 |
| 3 | 開局原則 | 控制中心 · 快速出子 · 王翼安全（何時王車易位）· 別太早出后 | v2 |
| 4 | 殘局技術 | 兵的升變競賽 · 后王將殺 · 車王將殺 | v2 |

Catalog size is ~23 lessons total (each tier ends with a capstone integration lesson); exact count and ordering are content decisions made during authoring, not fixed by this GDD.

### Teaching Philosophy (Beth's method) — authoring rules

These are **binding rules** for every authored lesson, not decoration. They exist to fix the pain point that lichess/chess.com lessons teach moves without the *why*:

1. **Scenario first**: every lesson sets a `scenario` — a concrete situation and the problem to solve — shown before step 0. The player always knows what they are trying to achieve.
2. **WHY on every move**: an interactive step's `text` poses the idea as a question ("對手的王還在中間，你想怎麼利用？"); its `successText` explains *why the move worked* and states the **transferable principle**, never just "正確".
3. **Name the pattern**: tactics/principles are named so they become reusable vocabulary (牽制、捉雙…), and later lessons **recall earlier ones by name** (spiral).
4. **Capstone per tier**: the last lesson of each tier is an integration scenario combining that tier's concepts in one position.
5. **Voice**: written as Beth Harmon — calm, pattern-focused, treats the learner as capable; understanding over memorisation. The coach name is a UI label (`COACH` constant), not embedded in each `text`.

### Access

- Entry point: top-level route `/learn` → lesson list
- Click a lesson → `/learn/:lessonId` → coached lesson player
- Not auth-required (lessons are static content, usable signed-out)
- Progress persists locally (localStorage), independent of account

### Lesson Structure

A lesson is an ordered list of **steps**. Each step is bound to one board position (FEN). There are two step kinds:

| Step kind | Trigger to advance | Player action |
|-----------|--------------------|---------------|
| **Narration** | Player clicks "Next" | Reads coach text; may see arrows/highlights |
| **Interactive** | Player plays the `expectedMove` | Must make the one demonstrated move on the board |

### Step Display

1. **Board**: ChessBoard renders the step's FEN. Orientation follows the lesson's `playerColor` (default white).
2. **Coach panel**: shows the step's `text` (narration or the prompt for an interactive step).
3. **Visual elements**:
   - **Narration step**: `arrows` and `highlights` are shown immediately (the coach is teaching).
   - **Interactive step**: only `highlights` are shown by default (contextual framing of the relevant pieces/targets). The step's `arrows` are the **answer reveal** and are **NOT shown by default** — they appear only at hint stage 2 (see Hint System). The default board must never pre-reveal the move.
4. **Controls**: Narration step shows a "Next" button. Interactive step disables "Next", waits for the board move, and shows the **light-bulb (💡) hint button**.

### Interactive Step Flow

```
Show position + question (no answer shown)
   │
   ├─ player plays expectedMove ──► show successText (if any) ──► advance to next step
   │
   └─ player plays any other (legal) move ──► move is NOT applied (board snaps back to step FEN)
                                              ──► gentle "再想一次" + light-bulb pulses
                                              ──► (no hint auto-shown) player retries
```

- The board only commits the `expectedMove`. A wrong-but-legal move is rejected (board snaps back), treated as an incorrect attempt.
- Illegal moves are rejected by chess.js as usual and are not counted as attempts.

### Hint System (light bulb — Lucide `lightbulb` icon) — opt-in, two stages

> **Icon 規範**：本節的 💡（提示）／👁（揭曉答案）在 UI 中一律以 Lucide line icon
> （`lightbulb`／`eye`）呈現，**非 emoji 字元**（依 Gambit 視覺鐵則：絕不用 emoji 當功能 icon）。

Hints are **never shown automatically** — the player must opt in. This serves understanding over memorisation: those who want to think it through are never spoon-fed, and nobody can jump straight to the answer without first passing through the Socratic hint.

**Progressive reveal (one bulb → a second button appears):**

- **Default**: only the **light-bulb (💡) button** is shown. The answer button is **not** present yet (so it doesn't tempt the player). After the player's **first wrong-but-legal move**, the bulb **pulses** to signal "a hint is here if you want it" — but still does not open on its own.
- **Stage 1 — Socratic text** (tap 💡): shows the step's `hint` — a question about the **goal** or **what to avoid**, never naming the move (e.g. "你想讓黑后失去保護——什麼能逼王離開那條線？"). **Only after this** does a separate **「揭曉答案」(👁) button** appear below the hint.
- **Stage 2 — answer reveal** (tap 揭曉答案): draws the step's `arrows` (the move). The escape hatch for a player who has genuinely tried and is stuck. This button is reachable only after stage 1, so the hint is never skipped.
- Authoring: every interactive step MUST provide a Socratic `hint` (stage 1) and `arrows` describing the move (stage 2).

### Lesson Completion

- A lesson is **complete** when the player reaches the end of its steps (all interactive steps were played correctly).
- On completion, the lesson is marked done in progress storage and the next lesson (by `order`) unlocks.

### Unlocking

- Linear: lesson with `order = N` is unlocked only when the lesson with `order = N-1` is complete.
- The first lesson (`order = 1`) is always unlocked.
- Locked lessons appear in the list but are not clickable (show a lock badge).

### Progress Persistence

- Stored in localStorage under key `pgr:lessons:progress` (reuses the `pgr:` prefix convention from Game Replay rating).
- Shape: `{ completed: string[] }` — array of completed lesson IDs.
- No server sync in v0.

---

## 4. Formulas

### Curriculum Progress

```
progress = completedCount / totalLessons
where  completedCount = number of lesson IDs in pgr:lessons:progress.completed
       totalLessons   = number of lessons in the static catalog
       progress ∈ [0, 1]

Example: 3 of 4 lessons complete → progress = 0.75 → "75%"
```

### Lesson Unlock Predicate

```
isUnlocked(lesson) =
    lesson.order == 1
    OR  catalog[lesson.order - 1].id ∈ completed

Example: lesson order=3 is unlocked iff the order=2 lesson's id is in completed.
```

### Lesson Completion Predicate

```
lessonComplete = (currentStepIndex == lesson.steps.length)
i.e. the player advanced past the final step. Each interactive step can only be
passed by playing its expectedMove, so reaching the end implies all were played.
```

---

## 5. Edge Cases

- **EC-01**: Lesson with only narration steps (no interactive step) → player clicks through to the end; marked complete on reaching the final step.
- **EC-02**: Player plays a legal move that is not the `expectedMove` on an interactive step → move is not applied (board reverts), a gentle "再想一次" shows and the light bulb starts pulsing; the `hint` is **not** auto-shown (opt-in only). Attempt does not advance. No limit on retries (retry count is a tuning knob, default unlimited).
- **EC-03**: Direct navigation to `/learn/:lessonId` for a **locked** lesson → redirect to `/learn`.
- **EC-04**: Navigation to `/learn/:lessonId` for a **non-existent** lessonId → redirect to `/learn` (404 behavior).
- **EC-05**: Interactive step whose `expectedMove` is a promotion → comparison must match `from`, `to`, AND `promotion` (e.g. `e7e8q`); a same-from/to move with a different promotion piece counts as incorrect.
- **EC-06**: Corrupt or unparseable `pgr:lessons:progress` in localStorage → treat as empty progress (no lessons completed), do not throw.
- **EC-07**: Player refreshes mid-lesson → lesson restarts from step 0 (in-lesson step position is ephemeral, not persisted); completed lessons remain unlocked.

---

## 6. Dependencies

### Upstream

- **Chess Board & Move System (#1)** — `chess-board.vue` renders FEN, emits `move-made` (from/to/promotion/fen); the lesson player listens and validates against `expectedMove`. Uses `disabled` prop to lock the board on narration steps.
- **chess.js** (bundled with vue3-chessboard) — validates move legality before the expectedMove comparison.
- **chessground shapes** — draws coach arrows and square highlights (`use-board-input.ts` `buildLegalMoveShapes()` is the reference pattern).
- **Navigation & Routing (#4)** — adds `/learn` and `/learn/:lessonId` lazy-loaded routes following the existing router pattern.

### Downstream

- **(Phase 2b) AI tutor** — Claude API may generate dynamic coach commentary layered on the same scripted step structure.
- **Learning Loop — Concept Linking (#20)** — realises the bidirectional lesson ↔ game/puzzle linking (the deferred ADR #4, now `docs/architecture/adr-0012`). Lessons gain an optional `concepts?: ChessConcept[]` tag (additive); lesson completion hosts the「練習這個想法」course→puzzle CTA. See `design/gdd/learning-loop.md`.
- **Game Replay (Phase 2a)** — `game-replay.md` Downstream already names "(Phase 2c) Lesson Linking"; this GDD is the corresponding upstream side of that bidirectional reference.
- **Journal — 棋誌 (#21)** *(Phase 1 differentiation)* — subscribes to lesson-solved events (motif + `hintUsed`) and reads `lesson-progress.completed` + catalog stage to write ① epiphany (no-hint first solve) and ④ arrival (stage completion) entries. Read-only; never mutates lesson state. See `design/gdd/journal.md`.

---

## 7. Tuning Knobs

| Knob | Default | Range | Notes |
|------|---------|-------|-------|
| Steps per lesson | 6 | 3–12 | Keep beginner lessons short; cap to avoid fatigue |
| Hint retry limit | unlimited | 1–unlimited | Could limit retries before revealing the move |
| Unlock mode | linear | linear / all-open | All-open lets advanced users skip ahead |
| Coach arrow color | green | green / blue / yellow | chessground brush; avoid red (reads as "danger") |
| Catalog size (v0) | ~23 lessons | 12–28 | 4 tiers (rules/tactics/opening/endgame) + 1 capstone each; v1 ships tiers 1–2, v2 ships 3–4 |
| Hint trigger | manual (light bulb) | manual only | Hints never auto-show; player taps the 💡. Stage 1 = Socratic text, stage 2 = answer arrow |
| Light-bulb pulse | after 1st wrong move | 1–3 wrong | When the 💡 starts pulsing to invite a hint (still opt-in) |

---

## 8. Acceptance Criteria

- **AC-01**: `/learn` renders the lesson catalog with each lesson's title, difficulty, and completion state.
- **AC-02**: Locked lessons show a lock badge and are not navigable; the first lesson is always unlocked.
- **AC-03**: Completing a lesson marks it done and unlocks the next lesson by `order`.
- **AC-04**: Curriculum progress indicator reflects `completedCount / totalLessons`.
- **AC-05**: A narration step shows coach text and advances on "Next".
- **AC-06**: An interactive step accepts only the `expectedMove`; playing it shows `successText` (if any) and advances.
- **AC-07**: Playing a legal non-expected move on an interactive step does not advance, does not commit to the board, shows "再想一次", and makes the light bulb pulse — but does **not** auto-show the hint.
- **AC-08**: Narration-step coach arrows/highlights render immediately; interactive-step `highlights` render but `arrows` do not (they are gated behind hint stage 2).
- **AC-14**: Hints are opt-in and progressive. By default only the 💡 button shows. Tapping 💡 shows the Socratic `hint` text (no move named) and reveals a separate 「揭曉答案」button; tapping that draws the answer `arrows`. The answer button does not exist before the hint is shown, so the hint can never be skipped.
- **AC-09**: Progress persists to `pgr:lessons:progress` and reloads correctly on revisit; corrupt data is treated as empty without error.
- **AC-10**: Direct navigation to a locked or non-existent lessonId redirects to `/learn`.
- **AC-11**: Mobile layout (<768px): board full width, coach panel below, touch targets ≥44×44px.
- **AC-12**: Promotion `expectedMove` matches only when from/to/promotion all match.
- **AC-13**: The catalog groups lessons by `tier` (1→4), each tier shown under its heading, lessons within a tier ordered by `order`.

---

## Appendix: Lesson Data Schema

Static front-end data (no backend). S12 implementation places types in `src/types/lesson.ts` and content in `src/data/lessons/`.

```typescript
interface LessonStep {
  fen: string
  text: string                                   // coach narration / prompt
  arrows?: { orig: string; dest: string }[]      // chessground brush shapes
  highlights?: string[]                          // squares to highlight, e.g. ['e4','d4']
  expectedMove?: { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' }
  hint?: string                                  // shown after a wrong attempt
  successText?: string                           // shown after the correct move
}

interface Lesson {
  id: string
  title: string
  category: 'rules' | 'tactics' | 'opening-principles' | 'endgame'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tier: 1 | 2 | 3 | 4                            // curriculum tier (1:1 with category); groups the catalog
  order: number                                  // global position in the linear curriculum
  summary: string
  scenario?: string                              // situational set-up shown before step 0 (Teaching Philosophy rule 1)
  objectives: string[]                           // what the player will learn
  steps: LessonStep[]
  playerColor?: 'white' | 'black'                // board orientation, default 'white'
}
```
