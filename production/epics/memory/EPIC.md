# Epic: 棋憶 (Memory)

> **Layer**: Feature — Phase 2 Differentiation ① (the moat)
> **GDD**: design/gdd/memory.md (Approved 2026-06-18, round 2 lean — review log `design/gdd/reviews/memory-review-log.md`)
> **Architecture Module**: `memory_summaries` table + `useDataSyncStore` memory methods + `useMemoryStore` (cross-game window) + `src/modules/memory/*` (pure F1/F2/F4/F5 + templates) + 棋憶 dashboard/slideshow views + move-by-move replay (reuses shipped PgnViewer); read-only consumer of `usePostGameReview` (#7)
> **Status**: ADR-0014 **Accepted** 2026-06-20 (story-011 gate PASSED: migration live + anon REST probe 200/401). 001–005 shipped (`a3caa1d`); UI 006–010 implemented + unit-green 2026-06-20. Remaining = browser/iPhone visual sign-off (manual).
> **Stories**: story-001…011 created 2026-06-18 (see table below) — all **Ready**; recommended start order 002 → 003 (pure, zero-dep) → 005 → 004 → 001 → 006 → 007 → 008/009 → 010 → 011

## Overview

棋憶 (#22) is Phase 2 ①, the product's largest moat: it reframes the post-game experience from a
40-move scrollthrough into a calm, **dashboard-first memory of one game** — a Neve qualitative line,
a quiet shape-of-the-game eval view (tap → move-by-move replay), and 0–5 highlighted moments
(tap → an animated slideshow). It is a **selection-and-presentation layer**, not new analysis: it
consumes #7's `analysisResults`/`cpLoss`/`biggestSwingCursor` read-only, reuses #20's `classify()`,
and is **zero-AI in v1** (Stockfish cpLoss + rule engine + Neve templates).

Two architectural halves (both fixed by ADR-0014): **(1)** the only durable artifact is a per-game
`MemoryGameSummary` feeding the F4 cross-game line — stored in a new owner-scoped `memory_summaries`
table with the ADR-0013 journal pattern (guest localStorage → login union reconcile,
`UNIQUE(user_id, game_id)`, `schema_version` ignore-on-mismatch). **(2)** Per-game selection
(F1/F2/F5) is pure functions in `src/modules/memory/` over #7's composable; `useMemoryStore` holds
only the cross-game window; `/review` becomes the 棋憶 dashboard and the dense surface becomes the
opt-in replay reusing the shipped PgnViewer.

A single game's moment list / eval chart / slideshow are rebuilt from #7's in-memory results (0 new
analyze calls when present, AC-14; #7 re-analyzes the stored PGN on a cold open from 棋誌). The
durable summary is **not** a per-game moment cache.

## ADR Check — New ADR Required (ADR-0014)

| Decision | Coverage |
|----------|----------|
| `memory_summaries` schema, event-key idempotency (`game_id`), guest reconcile, `schema_version` durability | **ADR-0014** (new, 2026-06-18) — Accepted 2026-06-20 |
| #7 → #22 read-only consumption boundary; pure-function selection; 0-analysis contract | **ADR-0014** |
| `/review` becomes 棋憶 dashboard; dense surface = replay reusing PgnViewer | **ADR-0014** (view/route ownership) |
| `useMemoryStore` as its own Pinia store (cross-game window only) | ADR-0005 (per-feature store boundary) |
| memory persistence on `useDataSyncStore`; RLS + offline queue + union reconcile | ADR-0011 (only data-sync/auth touch supabase) |
| Replay reuses PgnViewer + Wood12/Gioco + Move Annotation | ADR-0006 + visual SoT (no new ADR) |

## Governing ADRs

| ADR | Decision Summary | Status | Engine Risk |
|-----|-----------------|--------|-------------|
| ADR-0014: 棋憶 Data Model & Review Consumption Boundary | `memory_summaries` table (`UNIQUE(user_id, game_id)`, `schema_version`, guest reconcile); #7 read-only consumption with 0 new analysis; pure `src/modules/memory/*`; `/review`→dashboard, dense→PgnViewer replay | **Accepted** (2026-06-20) | LOW |
| ADR-0011: Supabase Auth + Data Sync | memory persistence lives on `useDataSyncStore`; RLS `user_id=auth.uid()`; offline queue; union reconcile | Accepted | LOW |
| ADR-0007: Post-Game Review Analysis Loop | #7 owns `analysisResults`/`biggestSwingCursor` (computed once, never moves), persists none across sessions — the read-only source 棋憶 consumes / re-triggers on cold open | Accepted | LOW |
| ADR-0005: Pinia Store Boundaries | `useMemoryStore` is its own store (cross-game window only); no supabase import; selection is pure functions not store state | Accepted | LOW |
| ADR-0006: Move Annotation Rendering | replay arrows/eval reuse Move Annotation Display; neutral semantics, no re-coloring | Accepted | LOW |

> **ADR-0014 Accepted 2026-06-20** — story-011 acceptance + live-migration gate PASSED (migration applied
> via Dashboard SQL Editor; anon REST probe GET 200 `[]` / POST 401 `42501`; mirrors Journal story-007 /
> ADR-0013). All stories unblocked. *(Historical: data + logic stories were implemented against the Proposed
> ADR in parallel where they needed no live table — pure F1/F2/F4/F5 are testable without the DB; live
> persistence verification was what waited on this gate.)*

## GDD Requirements (AC → Story map)

| AC | Scope | TR-ID |
|----|-------|-------|
| (table, data-sync load/append, store window, guest reconcile, schema_version) | data layer | TR-memory-001 |
| AC-2/2b/2c/2d, AC-3, AC-4, AC-5, AC-6, AC-14 | key-moment selection F1 (pure) + 0-analysis | TR-memory-002 |
| AC-13 | derivation: E_white F2 + stage F5 (pure) | TR-memory-003 |
| AC-12, AC-12b | cross-game Neve line F4 (no weak-stage) | TR-memory-004 |
| AC-11b | zero-AI templates F3 + register/banned-token lint | TR-memory-005 |
| EC-5/12/13/14, AC-17, Rule 1 | UX/a11y spec (fix #5) — **sequenced before dashboard/slideshow** | TR-memory-006 |
| AC-1, AC-3, EC-1, EC-3 | 棋憶 dashboard view + zero-state | TR-memory-007 |
| AC-9, AC-10, EC-2, EC-15 | moment slideshow + animation | TR-memory-008 |
| AC-8, AC-16 | move-by-move replay (PgnViewer reuse) | TR-memory-009 |
| AC-15 | 棋誌 coupling + (gameId, ply) deep-link | TR-memory-010 |
| (live migration + ADR acceptance) | release gate | TR-memory-011 |

## Stories

| # | Story | Type | Status | ADR | Depends on |
|---|-------|------|--------|-----|-----------|
| 001 | Memory data layer (table + data-sync + store + guest reconcile) | Integration | Ready (live verify ← 011) | ADR-0014, 0011, 0005 | — |
| 002 | Key-moment selection F1 (pure, 0 analysis) | Logic | Ready | ADR-0014, 0007 | — |
| 003 | Derivation: E_white F2 + stage F5 (pure) | Logic | Ready | ADR-0014, 0007, 0003 | — |
| 004 | Cross-game Neve line F4 (no weak-stage) | Logic | Ready | ADR-0014, 0005 | 001, 002, 003 |
| 005 | Zero-AI templates F3 + persona/banned-token lint | Logic | Ready | ADR-0014 | 002, 004 |
| 006 | UX/a11y spec (fix #5) — **precedes 007/008** | UI (spec) | Ready | ADR-0014 | — |
| 007 | 棋憶 dashboard view + zero-state | UI | Ready (recordGame ← 011) | ADR-0014, 0007, 0006 | 002, 003, 004, 005, 006, 001 |
| 008 | Moment slideshow + animation | Visual/Feel | Ready | ADR-0014, 0006 | 002, 005, 006, 007 |
| 009 | Move-by-move replay (PgnViewer reuse) | UI | Ready | ADR-0014, 0006 | 003, 007 |
| 010 | 棋誌 coupling + (gameId, ply) deep-link | Integration | Ready (live verify ← 011) | ADR-0014, 0013, 0011 | 007, 009, 001 |
| 011 | ADR-0014 Accepted + live migration gate | Config/Process | Ready | ADR-0014 | 001 |

> **Recommended start**: 002 → 003 (pure, zero-dep, instant red→green) → 005 → 004 → 001 → 006 → 007 → 008/009 → 010 → 011.
> Pure-logic stories (002–005) run against the Proposed ADR; persistence/integration verification (001/010) and the dashboard `recordGame` write wait on story-011 (ADR-0014 Accepted). story-006 (UX spec) must be `/ux-review` APPROVED before 007/008.

## Definition of Done

This epic is complete when:

- `supabase/migrations/20260827000000_create_memory_summaries.sql` applied to live DB; anon REST probe
  verifies table + RLS (200 `[]` / 401 `42501`); `supabase/README.md` lists `memory_summaries` (8 tables).
- ADR-0014 status flipped to **Accepted**.
- `src/stores/memory.ts` + `useDataSyncStore` memory methods implemented with unit tests; guest→login
  reconcile integration test (union by `game_id`, no dup, no loss).
- F1 selection / F2 + F5 derivation / F4 cross-game line / F3 templates unit-tested per GDD ACs
  (test-frozen constants, not live tuning defaults — GDD AC preamble).
- AC-14 verified: opening 棋憶 with `analysisResults` present issues **0** `reviewEngine.analyze` calls.
- 棋憶 dashboard + slideshow + replay shipped; `/review` lands on the dashboard; replay mounts the
  shipped PgnViewer (Wood12/Gioco, BASE_URL assets — no lichess dark board leak).
- UX/a11y spec (fix #5) authored and conformed: two doors, color-blind channel, reduced-motion
  full-comparison, keyboard parity, ≥44px targets, back-nav per entry point.
- Exactly one journal entry per game; a journal entry deep-link opens this game's 棋憶 at the right ply.
- vue-tsc 0, vitest green; Eason on-device pass (iPhone Safari); manual evidence for animation/visual ACs.

## Enables (Downstream)

- **棋誌 page accumulation header** (future, separate task) — reads the running totals 棋憶's per-game
  `MemoryGameSummary` rows feed; the header itself is not in this epic.
- **v2 free-form explanation** (deferred to last) — replace F3 templates with Claude API / BYOK.
- **Future concepts** (fork/pin/skewer…) — additive to `classify()` (#20) → richer tactical moments,
  no schema change (`conceptCounts` is an open `Record<concept, number>`).

## Next Step

Stories created. Implement in the recommended order — start `/story-readiness production/epics/memory/story-002-selection-f1.md` → `/dev-story` (pure F1, zero-dep). Run `/story-readiness` before each story; `/code-review` + `/story-done` after.
