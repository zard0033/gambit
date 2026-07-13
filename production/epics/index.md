# Epics Index

**Last Updated**: 2026-06-22
**Engine**: Web App — TypeScript 5 · Vue 3 · Vite 5 · vue3-chessboard · stockfish@18.0.7 (SF18 Lite single-threaded, NNUE embedded; ADR-0001 amended 2026-06-02)
**Manifest Version**: 2026-05-29 (control-manifest.md)

## v0 Epics (all systems)

| Epic | Layer | Module | GDD | TR-IDs | ADR Coverage | Stories | Status |
|------|-------|--------|-----|--------|--------------|---------|--------|
| [chess-board](chess-board/EPIC.md) | Foundation | ChessBoard | chess-board-and-move-system.md | 7 | 7/7 ✅ | 7 stories | **Shipped** (S2) |
| [chess-engine](chess-engine/EPIC.md) | Foundation | ChessEngine | chess-engine-integration.md | 9 | 9/9 ✅ | 9 stories | **Shipped** (S2, NNUE S9) |
| [opening-id](opening-id/EPIC.md) | Foundation | OpeningIndex | opening-identification.md | 4 | 4/4 ✅ | 1 story | **Shipped** (S2) |
| [app-router](app-router/EPIC.md) | Foundation | AppRouter | navigation-and-routing.md | 6 | 6/6 ✅ | 2 stories | **Shipped** (S2) |
| [game-lifecycle](game-lifecycle/EPIC.md) | Core | GameLifecycle | game-lifecycle.md | 5 | 5/5 ✅ | 3 stories | **Shipped** (S3) |
| [move-annotation](move-annotation/EPIC.md) | Core | MoveAnnotationDisplay | move-annotation-display.md | 5 | 5/5 ✅ | 2 stories | **Shipped** (S3) |
| [post-game-review](post-game-review/EPIC.md) | Feature | PostGameReview | post-game-review.md | 7 | 7/7 ✅ | 5 stories | **Shipped** (S4) |
| [game-export](game-export/EPIC.md) | Feature | GameExport | game-export-share.md | 4 | 4/4 ✅ | 2 stories | **Shipped** (S4) |
| [opening-knowledge-cards](opening-knowledge-cards/EPIC.md) | Feature | (PostGameReview panel) | opening-knowledge-cards.md | 6 | 6/6 ✅ | 2 stories | **Shipped** (S6) |
| [visual-identity](visual-identity/EPIC.md) | Presentation | BoardTheme | visual-identity.md *(pending)* | 2 | 0/2 — no ADR yet | 1 story | **Backlog** |

## MVP Epics

| Epic | Layer | Module | GDD | TR-IDs | ADR Coverage | Stories | Status |
|------|-------|--------|-----|--------|--------------|---------|--------|
| [supabase](supabase/EPIC.md) | Persistence | useAuthStore + useDataSyncStore | supabase-integration.md | 13 | 13/13 (ADR-0011) | 8 stories | **Shipped** (S7) |
| [game-history](game-history/EPIC.md) | MVP Feature | useGameHistoryStore + HistoryView | game-history.md | 27 | ADR-0005 + ADR-0011 | 5 stories | **Shipped** (S8, QA approved w/ conditions — S8-06 iOS Magic Link 實機補測待辦) |

## Phase 2 Epics

| Epic | Layer | Module | GDD | ADR Coverage | Stories | Status |
|------|-------|--------|-----|--------------|---------|--------|
| [game-replay](game-replay/EPIC.md) | Feature (Phase 2) | ReplayView + review-engine | game-replay.md | ADR-0001/0003/0005 (no new ADR) | 6 stories | **Shipped** (S10 — QA APPROVED 2026-06-02；S10-01…04 done；S10-05 動畫 polish deferred) |
| [lesson-system](lesson-system/EPIC.md) | Feature (Phase 2) | LearnView + LessonView + useLessonProgressStore | lesson-system.md | ADR-0005 (no new ADR for v0) | 5 stories | **Built** (S01–04 shipped + tested：LearnView/LessonView/progress store/lessons data；S05 內容撰寫 ongoing) |
| [dungeon-puzzle](dungeon-puzzle/EPIC.md) | Feature (Phase 2) | DungeonMapView + DungeonPuzzleView + useDungeonProgressStore + use-dungeon-puzzle | dungeon-puzzle-mode.md | ADR-0005 (no new ADR for v0) | 7 stories (S13) | **Shipped (core)** — S13-01…05 done (map/solver/store/composable, Playwright-verified)；S13-06 謎題集撰寫 + Home 入口 **Backlog**；S13-07 sync code-complete，migration 待套 live |
| [learning-loop](learning-loop/EPIC.md) | Feature (Phase 2 connective) | concept SoT + 3 bridges (lesson↔puzzle↔game) + Concept Map | learning-loop.md | ADR-0012 | Phase A: 4 stories (S14)；B–D 待排 | **Phase A Shipped** — S14-01…04 done 2026-06-06（concept SoT + Bridge 1 完成卡 + D1 側門練習，zero dungeon mutation）；Phase B（Bridge 2 + Concept Map）/ C（Bridge 3）/ D 待排 |

## Phase 1 Differentiation Epics

| Epic | Layer | Module | GDD | TR-IDs | ADR Coverage | Stories | Status |
|------|-------|--------|-----|--------|--------------|---------|--------|
| [journal](journal/EPIC.md) | Phase 1 (diff) | useJournalStore + journal_entries + JournalView + HomeView peek | journal.md (v1: onset/arrival/solace) | 7 (TR-journal-001…007) | ADR-0013 (**Accepted** 2026-06-16) + ADR-0011 + ADR-0005 | 7 stories | **story-007 done (table live + RLS verified); 001–006 Ready to implement** |

## Phase 2 Differentiation Epics

| Epic | Layer | Module | GDD | TR-IDs | ADR Coverage | Stories | Status |
|------|-------|--------|-----|--------|--------------|---------|--------|
| [memory](memory/EPIC.md) | Phase 2 (diff, ①) | memory_summaries + useMemoryStore + src/modules/memory + 棋憶 dashboard/slideshow + replay (PgnViewer reuse); read-only consumer of #7 | memory.md (Approved 2026-06-18, round 2 lean) | 11 (TR-memory-001…011) | ADR-0014 (**Accepted** 2026-06-20) + ADR-0011 + ADR-0007 + ADR-0005 + ADR-0006 | 11 stories (001…011) | **logic+persistence (001–005) shipped `a3caa1d`; UI 006–010 implemented + unit-green 2026-06-20; story-011 gate PASSED (migration live, probe 200/401, ADR-0014 Accepted). Remaining: browser/iPhone visual sign-off (008 motion / 009 board fidelity) — manual** |

## Process Epics

| Epic | Purpose | Stories |
|------|---------|---------|
| [planning](planning/) | Phase 2 prioritisation & design (S9-04) | story-001-phase2-design |
| [technical-debt](technical-debt/) | TR-registry maintenance (S9-05) | story-001-tr-registry-update |

## Summary

- **Feature/system epics**: 18 (10 v0 + 2 MVP + 4 Phase 2 + 1 Phase 1 diff + 1 Phase 2 diff)
- **Shipped**: 13 (9 v0 + supabase + game-history + game-replay + dungeon-puzzle core)
- **Built**: lesson-system（S01–04 已實作 + 測試；S05 內容撰寫 ongoing）
- **In Progress / Partial**: memory（001–005+007–010 已 shipped/unit-green，story-011 gate PASSED，待手動視覺 sign-off）；learning-loop（Phase A Shipped 2026-06-06；Phase B/C/D 待排）；journal（story-007 已完成 table+RLS；story-001–006 Ready to implement，尚未實作）
- **Backlog**: 1 (visual-identity — 棋盤主題 GDD + ADR pending)
- **Total TR-IDs**: 113 (55 v0 + 13 MVP supabase + 27 MVP game-history + 7 journal + 11 memory) + Phase 2 TRs (game-replay / lesson-system / dungeon-puzzle / learning-loop, in GDDs)
- **ADRs**: 16 Accepted/Proposed (ADR-0001…0016; ADR-0007/0008/0012 仍 Proposed; ADR-0011 supabase → Accepted pending S8-06 iOS 補測)

## Layer Order (implementation sequence)

```
v0 Foundation (Sprints 2–3):       chess-board → chess-engine → opening-id → app-router ✅
v0 Core (Sprint 3):                game-lifecycle → move-annotation ✅
v0 Feature (Sprints 4–6):          post-game-review → game-export → opening-knowledge-cards ✅
MVP Persistence (Sprint 7):        supabase (Auth #9 + Data Sync #11) ✅
MVP Feature (Sprint 8):            game-history (#12) ✅
Phase 2 (Sprint 10):               game-replay ← in progress
Phase 2 (Sprint 12):               lesson-system (designed)
Presentation:                      visual-identity (board theme) — Sprint TBD, GDD/ADR pending
```

## Story Count Summary

| Layer | Epics | Total Stories |
|-------|-------|---------------|
| Foundation | chess-board (7), chess-engine (9), opening-id (1), app-router (2) | 19 |
| Core | game-lifecycle (3), move-annotation (2) | 5 |
| Feature | post-game-review (5), game-export (2), opening-knowledge-cards (2) | 9 |
| Presentation | visual-identity (1) | 1 |
| Persistence (MVP) | supabase (8) | 8 |
| MVP Feature | game-history (5) | 5 |
| Phase 2 | game-replay (6), lesson-system (5), dungeon-puzzle (7), learning-loop (4) | 22 |
| Phase 1 (diff) | journal (7) | 7 |
| Phase 2 (diff) | memory (11) | 11 |
| **Total** | **18 feature epics** | **87 stories** |

## Next Steps

Sprint 10 shipped (Game Replay full feature; engine migrated SF16→SF18 Lite). Sprint 11 closed
the 2026-06-02 spec↔code drift audit: S11-01 move-annotation eval-bar GDD aligned to arctan code;
S11-02 game-export assembler aligned to the GDD "Coach" template + PGN tags; S11-03 `game_sessions.pgn`
now stores real PGN; S11-04 removed the dead `Use NNUE` no-op. 510 unit tests pass, build green.

Deferred (need Eason): **下一個 Phase 2 feature** — 試煉/Dungeon 謎題模式（藍圖 `DungeonScreen.jsx` 已備）
／開局資料庫／成就勳章 三選一（推薦試煉優先）；visual-identity（棋盤主題）優先度低；SF16→SF18
historical-docs reconciliation (S11-05)；iPhone on-device QA。

### 視覺重構（Gambit Design System，非 epic，記於此）

- **2026-06-05 完成**：`design/gambit-design-system/` 為新視覺 SoT，全 10 個 view + app-chrome 元件
  （app-nav / history-row / play-setup-modal / promotion-dialog / game-replay-rating /
  replay-analysis-overlay）已套 Gambit；LearnView 改章節卡片；SignIn 全屏；清 18 個 RPG 貼圖孤兒。
  棋盤/棋子/標註/eval 上游所有未動。536 unit tests 全過。commit 93e48f7 / ef781f9。

**Last Updated**: 2026-06-22
