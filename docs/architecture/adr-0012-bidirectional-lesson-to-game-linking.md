# ADR-0012: Bidirectional Lesson-to-Game Linking via a Shared Concept Tag

## Status
Accepted (2026-07-13)

> **2026-07-13 Eason 裁決轉 Accepted（回填）**：本 ADR 自訂的觸發條件早已跨過——Learning Loop GDD
> `/design-review` 於 2026-06-06 判 APPROVED（`design/gdd/reviews/learning-loop-review-log.md`），
> Phase A–C 已上線（`b44bd43`）。Phase D 未實作、另行追蹤。
>
> Realises the long-standing **Required ADR #4「Bidirectional lesson-to-game linking」**
> (technical-preferences.md, "Required ADRs to author before Production phase"). Authored alongside
> `design/gdd/learning-loop.md` (system #20). Move to **Accepted** after `/design-review` of the
> Learning Loop GDD passes and before any Learning Loop story begins.

## Date
2026-06-06

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web App — TypeScript 5, Vue 3, Pinia 2, chess.js (bundled with vue3-chessboard); no traditional game engine |
| **Domain** | Feature / cross-system connective layer (Lesson System, Dungeon Puzzle Mode, Post-Game Review) |
| **Knowledge Risk** | LOW for the tag/lookup mechanism (plain TS data + existing Pinia stores). MEDIUM for the Phase-C mistake classifier (heuristic chess pattern detection over chess.js — new logic, false-positive risk; mitigated by a conservative "prefer silence" policy). |
| **References Consulted** | `design/gdd/learning-loop.md`; `design/gdd/lesson-system.md`; `design/gdd/dungeon-puzzle-mode.md`; `design/gdd/post-game-review.md`; `design/gdd/game-concept.md` (Pillar 2); `docs/architecture/adr-0005` (Pinia store boundaries); `docs/architecture/adr-0011` (Supabase sync) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Behavioral (unit tests on `motifToConcept`, mastery-state predicates, `recommended()`, and the Phase-C `classify()` against fixed FEN/pv fixtures). No spikes required for Phases A–B; Phase C wants a small fixture corpus to tune classifier precision. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0005 (Accepted) — store boundaries; the loop adds no cross-store coupling beyond reads. ADR-0011 (Accepted pending S8-06) — lesson/dungeon progress already sync via the data-sync store; the loop consumes those predicates, adds no new table in v1. |
| **Enables** | Learning Loop stories (Phases A–D); a future Skill Scoring (#13) input keyed on per-concept mastery. |
| **Blocks** | None — Phase A can be implemented immediately; later phases are independently shippable. |
| **Ordering Note** | Tag the concept SoT (Phase A data) before any bridge story. The Phase-C classifier must not be implemented before the conservative-policy invariant below is encoded as a test. |

## Context

### Problem Statement

The project's Pillar 2 hook — "課程連回你自己的棋局" (game-concept.md) — and the Required ADR #4 have
never been implemented. The Lesson System (#18), Dungeon Puzzle Mode (#19), and Post-Game Review (#7)
each teach, drill, or surface the *same* chess ideas (捉雙／牽制／棋子取奪／將殺) but share no machine-
readable link, so the three are isolated: finishing a lesson leads nowhere, puzzles are solved in a
vacuum, and the game review reports a centipawn number but never names *why* material was lost.

Two structural questions must be decided before building the Learning Loop (GDD #20):

1. **What is the linking medium** that connects "what a lesson teaches" ⇄ "what a puzzle drills" ⇄
   "what a player did in their game"?
2. **How does the game→lesson direction behave** without violating Post-Game Review's deliberate,
   non-negotiable design that the review is *neutral and number-only* — "no prescriptive study, no
   thematic verdict" (post-game-review.md Player Fantasy "Explicitly NOT")?

### Constraints

- **Post-Game Review's neutrality is binding** — the review must not gain "Blunder!"-style thematic
  labels or a study report card. Any linking on the game side must be *additive and opt-in*, never a
  change to the neutral default render (post-game-review.md Visual Requirements; Pillar 3).
- **Static / offline / zero-API for v1** — the standing decision (story-001-phase2-design): coach
  content is static, the data layer is front-end, deterministic, offline-capable. No Claude API
  dependency for the loop to function.
- **No new vocabulary invented** — the link must reuse names already present in lessons and puzzles,
  not introduce a parallel taxonomy authors must maintain.
- **Linear unlock is owned upstream** — Dungeon unlock by `order` (#19) and lesson unlock by `order`
  (#18) are authoritative; the loop must respect them (never deep-link a locked node).
- **No new cross-store coupling** — per ADR-0005, the loop reads existing progress predicates; it does
  not make one feature store write into another.

### Requirements

- A single linking medium usable by all three surfaces and by a future Concept Map.
- The game→lesson direction must be able to say "this mistake was a fork" *only when confident*, and
  stay silent (leaving the neutral review intact) otherwise.
- Bridges must work signed-out on localStorage (lesson/dungeon progress are local-first).
- Adding content (a new puzzle/lesson) must extend the links with no code change (data-driven).

## Decision

### 1. The linking medium is a shared **Concept tag**, not per-FEN position indexing

A closed, static `ChessConcept` union (`src/types/concept.ts`) is the connective primitive. Each
concept records the lesson(s) that teach it; each puzzle `motif` maps to a concept via a total
`MOTIF_TO_CONCEPT` table; each classifiable game mistake is assigned at most one concept. All three
bridges and the Concept Map are then **pure lookups** over this tag plus the existing progress stores.

**Why concept tags, not per-FEN indexing** (the considered alternative): indexing every lesson/puzzle
position by FEN and matching it against game positions would be brittle (exact-FEN matches are rare in
real games), expensive, and would still not explain *why* a position matters. A named-concept tag is
how a human coach connects "you were forked" to "the fork lesson" — it is coarse, robust, content-light,
and directly produces teachable links. It also reuses vocabulary the lessons/puzzles already use
(no parallel taxonomy).

### 2. The game→lesson direction is a **conservative classifier that prefers silence**

Bridge 3 reuses Post-Game Review's existing per-move `cpLoss` + biggest-swing eligibility and adds a
**pure** classifier `classify(mistake) → ChessConcept | none`. **Invariant (must be encoded as a test):
the classifier returns a concept only when an exact predicate fires; otherwise it returns `none` and
the review renders exactly as today.** The loop only ever *adds* an optional, **neutral, opt-in**
signpost **outside** the review's default neutral render — never a verdict, never homework, never in
the default view (design-review round 1 found a Beth-voiced「你被捉雙了 · 練 3 題」on the neutral
surface conflicts with #7's no-verdict rule). A wrong label is worse than silence, so the per-game cap
is low (default 1).

**Scope correction (design-review round 1):** the first draft classified from `pv[0]` (the engine's
best continuation) over four motifs (hanging/fork/pin/mate). Review found this unreliable — `pv[0]`
is not the move that *actually punished* the player, and multi-step fork/pin are silently missed.
The revised v1 classifier reads the **actual game continuation** (`completedGame.moves`), not `pv`, and
fires on only **two reliably-detectable signals**: `mate` (allowed forced mate — already detected by
#7's F2b, zero new logic) and `material` (hung **undefended** material with a no-recapture clause).
**Fork/pin mistake-classification is deferred** to a follow-up (Phase C+) pending a precision spike with
a fixture corpus and measured hit-rate. (The first draft's `hanging` concept is also renamed `material`
and re-grounded — its lesson/puzzle/review semantics were inconsistent; see learning-loop.md §3.1.)

### 3. Phasing isolates risk

- **Phase A** (low risk, no AI): concept SoT + tag lessons + `MOTIF_TO_CONCEPT` + Bridge 1 (lesson→puzzle).
- **Phase B** (low risk): Bridge 2 (puzzle→lesson) + Concept Map (已學/已練).
- **Phase C** (medium risk): the conservative classifier + Map's 對局 column.
- **Phase D** (optional, Phase 2b): Claude API dynamic commentary keyed on the same tags — not required.

### 4. No new persistence in v1

Mastery state is *derived* from existing `lesson_progress` and `dungeon_progress` (localStorage +
Supabase per ADR-0011). The Phase-C "encountered in your games" state is derived from Game History
(#12); no new table is introduced for the loop in v1.

## Consequences

### Positive

- Delivers the Pillar 2 hook / Required ADR #4 with minimal new surface — three bridges are routes +
  lookups over data the app already has.
- Differentiated and on-brand: "the lessons that know what you played", calm and offline, with no
  streak/XP — something neither lichess Learn nor chess.com Lessons does for beginners.
- Content-scalable: new puzzles/lessons extend the links automatically; the concept set grows by data.
- Post-Game Review's neutrality is provably preserved (its full AC suite must still pass; the loop adds
  only an opt-in node on confident matches).

### Negative / Risks

- **Classifier precision (Phase C)** is the real engineering risk: deriving "you were forked" from
  cpLoss + pv is new heuristic logic with false-positive potential. Mitigation: conservative
  "prefer silence" policy, high confidence bar, low per-game cap, a fixture corpus to tune precision,
  and v1 scope limited to four motifs. Positional/time/endgame mistakes stay unclassified by design.
- **Coarse matching**: concept tags are deliberately coarse; they will not catch every nuance (e.g.
  mate-distance degradation, which the review's F4 already flattens). Acceptable for a beginner tool.
- **Catalog coverage gaps**: concepts taught by a lesson but lacking drill puzzles (skewer/discovered/
  center in v1) have a dormant Bridge 1 until content is added — surfaced as a calm "即將加入" state,
  not a broken link.

### Neutral

- Lessons gain an optional `concepts?: ChessConcept[]` field (additive; existing lessons unaffected).
- The Concept Map's placement (sub-route vs Learn panel) is left to the UX spec; this ADR fixes only
  the data model and the neutrality invariant.

## GDD Requirements Addressed

| GDD | Requirement | How this ADR addresses it |
|-----|-------------|---------------------------|
| `learning-loop.md` §3.1 | Shared concept primitive (closed static set) | Decision 1 — `ChessConcept` union + `MOTIF_TO_CONCEPT` as SoT |
| `learning-loop.md` §3.4, EC-4, AC-9 | Game→lesson links must never degrade the neutral review | Decision 2 — conservative classifier, "prefer silence" invariant as a test |
| `learning-loop.md` §3.6 | Phased, independently shippable landing | Decision 3 — Phase A–D risk isolation |
| `learning-loop.md` §4.2, §3.5 | Mastery state derived, no XP/streak, no new table | Decision 4 — derive from existing progress + Game History |
| `lesson-system.md` Downstream「(Future) Lesson ↔ Game linking … ADR #4」 | The deferred bidirectional link | This ADR is its realisation |
| `post-game-review.md` "prescribe study is Phase 2 territory" | The deferred study-prescription hook | Decision 2 — added as an opt-in, confident-only link |
| technical-preferences.md Required ADR #4 | "Bidirectional lesson-to-game linking — how positions are indexed and matched" | Decision 1 — matched by **concept tag**, not FEN index (with rationale) |
