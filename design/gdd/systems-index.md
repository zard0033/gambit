# Systems Index: Chess Training Companion

> **Status**: Draft
> **Created**: 2026-05-27
> **Last Updated**: 2026-06-15
> **Source Concept**: [design/gdd/game-concept.md](./game-concept.md)

---

## Overview

The Chess Training Companion is a single-player web app, not a traditional game. Its systems split into three concerns: (1) **chess core** — playing a game against Stockfish; (2) **review & accumulation** — turning each game into measurable improvement; (3) **infrastructure** — authentication, sync, app shell, platform support.

The product is built in two phases. **v0 (Minimum Playable)** delivers the core value loop — play a game, see Stockfish's review, export to Claude.ai for natural-language analysis. **MVP (Full Phase 1)** adds the accumulation systems (skill scores, level, history) and cross-device sync that make the product motivating over time. Polish systems (PWA, audio, settings) come last.

Lichess open-source components (chessground, stockfish.wasm, chess-openings) provide the chess foundation; Vue 3 + Supabase + Tailwind build the surrounding application.

---

## Systems Enumeration

| # | System Name | Category | Priority | Status | Design Doc | Depends On |
|---|-------------|----------|----------|--------|------------|------------|
| 1 | Chess Board & Move System | Core | v0 | Approved | [chess-board-and-move-system.md](./chess-board-and-move-system.md) ([review log](./reviews/chess-board-and-move-system-review-log.md)) | — |
| 2 | Chess Engine Integration | Core | v0 | Approved | [chess-engine-integration.md](./chess-engine-integration.md) ([review log](./reviews/chess-engine-integration-review-log.md)) | — |
| 3 | Opening Identification | Gameplay | v0 | Approved | [opening-identification.md](./opening-identification.md) | — |
| 4 | Navigation & Routing | UI | v0 | Approved | [navigation-and-routing.md](./navigation-and-routing.md) | — |
| 5 | Game Lifecycle | Gameplay | v0 | Approved | [game-lifecycle.md](./game-lifecycle.md) | Chess Board, Chess Engine |
| 6 | Move Annotation Display | UI | v0 | Approved | [move-annotation-display.md](./move-annotation-display.md) ([review log](./reviews/move-annotation-display-review-log.md)) | Chess Board |
| 7 | Post-Game Review | Gameplay | v0 | Approved | [post-game-review.md](./post-game-review.md) ([review log](./reviews/post-game-review-review-log.md)) | Game Lifecycle, Chess Engine, Opening ID, Move Annotation |
| 8 | Game Export / Share | Gameplay | v0 | Approved | [game-export-share.md](./game-export-share.md) | Game Lifecycle |
| 8b | Opening Knowledge Cards | Gameplay | v0 | Not Started | — | Opening Identification, Post-Game Review |
| 9 | Authentication | Persistence | MVP | Designed | [supabase-integration.md](./supabase-integration.md) | — |
| 10 | Difficulty System | Gameplay | MVP | Not Started | — | Chess Engine |
| 11 | Data Sync (Supabase) | Persistence | MVP | Designed | [supabase-integration.md](./supabase-integration.md) | Authentication |
| 12 | Game History | Gameplay | MVP | Approved | [game-history.md](./game-history.md) ([review log](./reviews/game-history-review-log.md)) | Game Lifecycle, Data Sync |
| 13 | Skill Scoring | Progression | MVP | Not Started | — | Post-Game Review, Data Sync |
| 14 | Level Progression | Progression | MVP | Not Started | — | Skill Scoring, Difficulty System |
| 15 | PWA Support | Meta | Polish | Shipped (2026-07-10, vite-plugin-pwa + ADR-0016) | — | — |
| 16 | Audio System | Audio | Polish | Not Started | — | — |
| 17 | Settings | UI | Polish | Not Started | — | Multiple |
| 18 | Lesson System | Gameplay | Phase 2 | Shipped (四階 21 課) | [lesson-system.md](./lesson-system.md) | Chess Board, Navigation & Routing |
| 19 | Dungeon Puzzle Mode | Gameplay | Phase 2 | Approved | [dungeon-puzzle-mode.md](./dungeon-puzzle-mode.md) ([review log](./reviews/dungeon-puzzle-mode-review-log.md)) | Chess Board, Navigation & Routing, Lesson System (pattern) |
| 20 | Learning Loop (Concept Linking) | Gameplay (connective) | Phase 2 | Approved | [learning-loop.md](./learning-loop.md) ([review log](./reviews/learning-loop-review-log.md)) | Lesson System (#18), Dungeon Puzzle Mode (#19), Post-Game Review (#7) |
| 21 | Journal (棋誌) | Gameplay (differentiation) | Phase 1 (diff) | Designed (v1: onset/arrival/solace) | [journal.md](./journal.md) ([review log](./reviews/journal-review-log.md)) | Lesson System (#18), Game History (#12), Data Sync (#11); Post-Game Review (#7) → Phase 2 only |
| 22 | 棋憶 (Memory) | Gameplay (differentiation) | Phase 2 (diff, ①) | Approved (2026-06-18, round 2 lean) | [memory.md](./memory.md) ([review log](./reviews/memory-review-log.md)) | Post-Game Review (#7), Learning Loop (#20), Journal (#21), Game History (#12), Opening ID (#3) |

---

## Categories

This project uses a reduced set of categories — chess is a constrained genre with no narrative, no economy, and no multiplayer:

| Category | Description | Systems |
|----------|-------------|---------|
| **Core** | Foundation systems everything depends on | Chess Board, Chess Engine |
| **Gameplay** | Systems that produce the chess experience | Game Lifecycle, Opening ID, Difficulty, Post-Game Review, Game Export, Game History |
| **Progression** | How the player measurably improves | Skill Scoring, Level Progression |
| **Persistence** | Save state, auth, and sync | Authentication, Data Sync |
| **UI** | Player-facing screens and overlays | Navigation, Move Annotation, Settings |
| **Audio** | Sound effects | Audio System |
| **Meta** | Outside the core loop | PWA Support |

Categories explicitly NOT used (removed from the template): **Economy** (no resources/currency), **Narrative** (no story), **Combat AI** (chess engine is the only AI).

---

## Priority Tiers

This project uses two custom tiers (v0 → MVP) instead of the standard four-tier model. The standard tiers don't map cleanly because there's no "vertical slice of one area" concept — chess is the only area.

| Tier | Definition | Goal | When to Build |
|------|------------|------|---------------|
| **v0** | Minimum Playable. Validates "can I play, see useful review, and get AI analysis via Claude.ai?" | First runnable build, ~1-2 months part-time | FIRST |
| **MVP** | Full Phase 1. Adds accumulation (scoring, level, history) and cross-device sync. Validates the unique hook. | Production-ready Phase 1 release, ~3-4 months total | SECOND |
| **Polish** | PWA install, audio, settings panel. Quality-of-life. | After MVP is shipped | LAST |
| **Phase 2** (future) | Lessons, bidirectional linking, in-app AI explanations. Out of current scope. | TBD | NOT NOW |

---

## Dependency Map

### Foundation Layer (no internal dependencies)

1. **Chess Board & Move System** — Pure UI primitive: renders chessground, handles drag/click input, owns the board state for the current position. Bottleneck — everything visual depends on it.
2. **Chess Engine Integration** — Stockfish Web Worker wrapper. UCI message protocol. Bottleneck — play and review both depend on it.
3. **Authentication** — Supabase Auth + Magic Link flow. Bottleneck for sync.
4. **Navigation & Routing** — App shell, Vue Router setup. Bottleneck for multi-screen flows.
5. **PWA Support** — Build-time config (vite-plugin-pwa), service worker, manifest. Independent.
6. **Audio System** — Sound playback wrapper. Used by many but depends on nothing.
7. **Opening Identification** — Pure FEN-to-opening lookup using chess-openings database.

### Core Layer (depends on Foundation)

1. **Game Lifecycle** — depends on: Chess Board, Chess Engine. Owns start/end conditions, turn management, result determination (win/draw/resign).
2. **Difficulty System** — depends on: Chess Engine. Configures Stockfish skill level and thinking time per AI opponent.
3. **Move Annotation Display** — depends on: Chess Board. Draws arrows, highlights, evaluation badges on top of the board.
4. **Data Sync (Supabase)** — depends on: Authentication. Bottleneck — all persistent feature systems route through this.

### Feature Layer (depends on Core)

1. **Post-Game Review** — depends on: Game Lifecycle, Chess Engine, Opening ID, Move Annotation. Re-analyzes the completed game and shows each move's centipawn swing as a neutral pawn-unit number (no judgment labels) plus the engine's best line; surfaces the single biggest-swing moment as the anchor.
2. **Game History** — depends on: Game Lifecycle, Data Sync. Persists completed games as PGN; lists past games; supports re-watching.
3. **Game Export / Share** — depends on: Game Lifecycle (current game), optionally Game History (past games). Generates PGN + pre-formatted Claude.ai prompt, copies to clipboard.
4. **Skill Scoring** — depends on: Post-Game Review, Data Sync. Computes per-game deltas for Opening/Tactics/Endgame scores; persists them.
5. **Level Progression** — depends on: Skill Scoring, Difficulty System. Sets level thresholds, unlocks harder Difficulty presets, fires level-up notifications.

### Polish Layer

1. **Settings** — depends on: many systems (theme, sound mute, board orientation defaults). Single shared settings store.

---

## Recommended Design Order

Combining dependency layer + priority tier. Within the same row of a layer, systems can be designed in parallel (independent).

### Phase: v0 (Minimum Playable)

| Order | System | Layer | Est. Effort | Notes |
|-------|--------|-------|-------------|-------|
| 1 | Chess Board & Move System | Foundation | M | Bottleneck — design first |
| 2 | Chess Engine Integration | Foundation | M | Parallel with #1 |
| 3 | Opening Identification | Foundation | S | Parallel with #1, #2 |
| 4 | Navigation & Routing (basic) | Foundation | S | Parallel with #1-3 |
| 5 | Game Lifecycle | Core | M | Needs #1, #2 |
| 6 | Move Annotation Display | Core | S | Needs #1, parallel with #5 |
| 7 | Post-Game Review | Feature | L | Needs #2, #3, #5, #6 — largest v0 system |
| 8 | Game Export / Share | Feature | S | Needs #5 |
| 8b | Opening Knowledge Cards | Feature | XS | Needs #3, #7 — data-only (~20 ECO→markdown blurbs), surfaced inside Review panel |

**v0 completion**: 9 GDDs. Estimated effort: ~13 design sessions.

### Phase: MVP (Full Phase 1)

| Order | System | Layer | Est. Effort | Notes |
|-------|--------|-------|-------------|-------|
| 9 | Authentication | Foundation | S | Supabase Auth wrapper |
| 10 | Difficulty System | Core | S | Needs Chess Engine (already designed) |
| 11 | Data Sync (Supabase) | Core | M | Needs #9; defines schema for all later systems |
| 12 | Game History | Feature | M | Needs #5, #11 |
| 13 | Skill Scoring | Feature | L | Needs #7, #11 — scoring formula is design-heavy |
| 14 | Level Progression | Feature | M | Needs #10, #13 |

**MVP completion**: 14 GDDs total. Estimated effort: ~10 additional design sessions.

### Phase: Polish

| Order | System | Layer | Est. Effort | Notes |
|-------|--------|-------|-------------|-------|
| 15 | PWA Support | Foundation | S | Build config + manifest |
| 16 | Audio System | Foundation | S | Sound playback wrapper |
| 17 | Settings | Polish | S | Settings panel UI |

---

## Circular Dependencies

None found. The Level Progression → Difficulty System link is one-way: Level reads Difficulty's preset list to know what's unlocked, but Difficulty doesn't read Level state.

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| **Chess Engine Integration** | Technical | stockfish.wasm performance on iPhone Safari is unpredictable. Deep analysis may take too long. | Prototype Stockfish on iPhone Safari before designing Post-Game Review. Set analysis depth caps. |
| **Post-Game Review** | Technical | Stockfish analysis for a full game (20–40 positions at depth 22) may exceed 10 s on iPhone Safari, blocking the review UX. | Validate per-position timing on device. Consider two-pass optimization (OQ-2) if latency is a pain point. |
| **Skill Scoring** | Design | Scoring formula either feels stagnant (no growth) or chaotic (random shifts). Hardest design problem in the project. | Author an explicit formula ADR. Reference common chess rating systems (Elo, Glicko). Tune from playtest. |
| **Data Sync (Supabase)** | Technical | Sync conflict resolution when same account plays on two devices simultaneously. Offline behavior on iPhone PWA. | Define schema with conflict-resolution policy in ADR. Start with "last write wins" + game history as append-only. |
| **Game Export / Share** | Scope | "Pre-formatted Claude.ai prompt" needs to produce useful analysis when pasted — quality depends on prompt design, not just PGN. | Iterate on prompt template. Test with real Claude.ai sessions during v0 build. |

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified | 21 (#21 Journal / 棋誌 added 2026-06-16, Phase 1 differentiation) |
| Design docs started | 12 (#8b Opening Knowledge Cards skeleton; #9+#11 combined; #12 Game History 2026-06-01) |
| Design docs reviewed | 8 |
| Design docs approved | 8 |
| v0 systems designed | 8/9 (Opening Knowledge Cards GDD pending — skeleton exists) |
| MVP systems designed | 11/15 (#9+#11 combined as supabase-integration.md; #12 game-history.md designed 2026-06-01) |
| Polish systems designed | 10/18 |

---

## Next Steps

- [ ] Approve this systems index
- [ ] Design v0 Foundation systems first — start with `/design-system chess-board-and-move-system`
- [ ] Author key ADRs alongside Foundation GDDs:
  - Stockfish integration strategy (Web Worker, UCI protocol, performance caps)
  - Supabase schema design (deferred until MVP phase begins)
- [ ] Prototype Stockfish on iPhone Safari early — validates the highest technical risk
- [ ] Iterate Game Export prompt template during v0 build via real Claude.ai testing
- [ ] After v0 GDDs complete, run `/design-review` on each before implementation
