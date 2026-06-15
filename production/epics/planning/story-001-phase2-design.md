# Story 001: Phase 2 Feature Prioritization & Design Spikes

> **Epic**: Planning
> **Sprint**: S9-04 (Should Have)
> **Status**: In Progress
> **Layer**: Architecture / Product Direction
> **Type**: Design Spike + Decision
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-06-01
> **Last Updated**: 2026-06-01
> **TR**: N/A
> **ADR**: N/A

## Context

**Phase 1 Complete**: MVP foundation (auth, data persistence, history, knowledge cards)
**Phase 2 Scope**: Next major feature — Game Replay OR Lesson System
**Decision Point**: Which feature has higher ROI for player engagement?

---

## Two Candidate Features

### Option A: Game Replay (Recommended for MVP continuity)

**Concept**: Replay past games move-by-move with engine analysis overlay.

**Dependencies**:
- [x] pgn-viewer (reserved in tech stack; requires Vue 3 wrapper)
- [x] Game History UI (S8-04, completed)
- [x] Engine analysis backend (already exists in Review Engine)

**User Value**:
- Direct continuation of History → "see the game again"
- Reinforces learning (self-analysis without AI prompts yet)
- Natural feeder to Phase 2b AI explanations

**Rough Design**:
```
ReplayView (new):
├── HistoryRow (reuse from History)
├── pgn-viewer wrapper (Vue 3 component)
├── Analysis overlay (reuse ReviewEngine data format)
└── Controls (play/pause/step/jump)

Stories (estimated):
S10-01: pgn-viewer wrapper (T: 2d)
S10-02: Replay UI (T: 2d)
S10-03: Engine overlay in replay (T: 1d)
```

**Timeline**: ~5d (1 sprint)

---

### Option B: Lesson System (Expansion of Knowledge Cards)

**Concept**: Structured lessons (6–10 lessons) on opening strategies, tactics, endgames.

**Dependencies**:
- [ ] Lesson schema (Supabase: lessons table)
- [ ] Lesson authoring (hand-written content; CMS later)
- [ ] LessonView component + progress tracking

**User Value**:
- Directed learning (not self-directed)
- Higher retention (structured path)
- Entry point for Phase 2b AI tutor

**Rough Design**:
```
LessonView (new):
├── Lesson navigator (sidebar or tabs)
├── Lesson content (markdown + diagrams)
├── Checkpoint challenges (puzzle-like positions)
└── Progress badge/unlock system

Stories (estimated):
S11-01: Lesson schema + Supabase migrations (T: 1d)
S11-02: Lesson content authoring (hand-written, 10 lessons) (T: 2d)
S11-03: LessonView UI (T: 2d)
S11-04: Progress tracking + badges (T: 1d)
```

**Timeline**: ~6d (1.5 sprints) — content authoring is the critical path

---

## Decision Framework

| Factor | Replay | Lesson System |
|--------|--------|---------------|
| **MVP alignment** | 🟢 Higher (direct History continuation) | 🟡 Medium (parallel track) |
| **Dev complexity** | 🟢 Lower (pgn-viewer is packaged) | 🟡 Medium (schema + content) |
| **Content burden** | 🟢 None (auto-generated from PGN) | 🔴 High (hand-written lessons) |
| **Time to MVP** | 🟢 ~5 days | 🟡 ~6+ days |
| **Phase 2b synergy** | 🟢 Feeds AI analysis feature | 🟡 Feeds AI tutor feature |
| **Player retention** | 🟡 Medium (passive replay) | 🟢 High (active learning path) |

---

## Recommendation

**Game Replay (Option A)** for Sprint 10:
- Faster MVP (leverages pgn-viewer)
- Direct continuation of Phase 1 UI flow
- Unblocks Phase 2b AI analysis
- Lesson System deferred to Sprint 11+ with dedicated content sprint

---

## Acceptance Criteria (for this story)

- [ ] **AC-01**: Two design options drafted (above)
- [ ] **AC-02**: Rough story breakdown for each option (stories created)
- [ ] **AC-03**: Decision documented + rationale clear
- [ ] **AC-04**: Next sprint (S10) stories created (pgn-viewer wrapper, replay UI)

---

## Next Steps

1. **If Replay chosen**: `/create-stories production/epics/game-replay/epic.md` → S10-01, S10-02, S10-03
2. **If Lesson chosen**: Create lesson content plan + Supabase migrations
3. **Sprint 10 kickoff**: Begin with chosen path

---

## Completion Notes

**Status**: Complete

**Decision (2026-06-01)**:
- **Phase 2a (S10)**: Game Replay — built and shipped (this option's stories became S10-01…05).
- **Phase 2c (S12)**: Lesson System — confirmed as the next directed-learning track, with two scope refinements vs. Option B above:
  1. **Coach explanations are static pre-scripted** (not AI). Zero API cost, offline-capable, deterministic.
  2. **Data layer is static front-end data** (`src/data/lessons/`), **not** a Supabase `lessons` table. This removes the schema/migration story (original S11-01) and lowers the engineering load; hand-authored content remains the critical path.
- First catalog scope: **opening-principles concept lessons** (3–4 lessons).

**Artifacts created**:
- GDD: `design/gdd/lesson-system.md` (system #18, pending design-review)
- Epic: `production/epics/lesson-system/EPIC.md` with stories S12-01…05
- TR-IDs: `TR-lesson-system-001…010` in `docs/architecture/tr-registry.yaml`

Implementation is scheduled for S12 (run `/sprint-plan new` when S12 starts).
