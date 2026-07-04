# ADR-0015: `src/lib/` vs `src/modules/` Boundary and Persona-Lint Consolidation

## Status

Accepted

## Date

2026-07-03

## Last Verified

2026-07-03

## Decision Makers

Eason (product owner, approved the direction); Claude (implementing).

## Summary

`src/lib/` and `src/modules/<feature>/` had no written rule distinguishing them. In practice, 8 of 9
feature modules (`chess-engine`, `dungeon`, `game-export`, `game-lifecycle`, `learning-loop`,
`move-annotation`, `opening-id`, `post-game-review`, `memory`) already held their pure domain logic
under `src/modules/`, but 棋誌 (journal)'s equivalent logic (`settle`, `session`, `order`, `totals`,
`unread`, `stages`, `render`, `persona-lint`) sat under `src/lib/journal/` — structurally identical to
`src/modules/memory/`, filed in the wrong place with no rule to catch it. Compounding this,
`src/lib/journal/persona-lint.ts` and `src/lib/memory/persona-lint.ts` were two **divergent**
implementations of the same house rule (emoji + xiangqi-piece-term lint), with memory's copy importing
directly from journal's `src/lib/journal/persona-lint.ts` — one feature reaching into another feature's
"lib" path, which is itself a symptom of `lib/` not meaning "cross-feature infrastructure."

This ADR fixes both:

1. **The boundary rule**: `src/lib/` holds only genuinely cross-feature infrastructure (currently
   `supabase.ts`, `utils.ts`, `persona-lint.ts`); all pure feature-domain logic lives in
   `src/modules/<feature>/`. Journal's domain logic moves from `src/lib/journal/` to
   `src/modules/journal/`, matching the other 9 modules.
2. **Persona-lint has one shared core**: the common word lists (`PIECE_TERMS`, `XIANGQI_TERMS`,
   `SOLACE_FORBIDDEN`) and the generic checker (`lintBody`) move to `src/lib/persona-lint.ts` — genuine
   cross-feature infrastructure per the new rule, since both journal and memory need it. Each feature
   keeps only its own thin, pen-/domain-aware wrapper: `src/modules/journal/persona-lint.ts`
   (`lintEntryBody`) and `src/modules/memory/persona-lint.ts` (`lintNeve` + `MEMORY_BANNED_TOKENS`).

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | TypeScript Web App (Vue 3 + Pinia 3) — pure code-organization change, no new runtime dependency |
| **Domain** | Cross-cutting / Codebase Architecture |
| **Knowledge Risk** | LOW — file moves and import-path updates only; no behavior change |
| **References Consulted** | `src/modules/memory/*` (the existing correct-shape precedent); `src/lib/journal/*` and `src/lib/memory/persona-lint.ts` (the two files being consolidated); ADR-0013 (journal data model); ADR-0014 (memory data model, §2 already documents `src/modules/memory/` as "PURE functions... NO store, NO supabase") |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | `npx vitest run` over the affected suites (journal, memory, journal-templates, views) must remain green with zero test-semantics changes — see Validation Criteria |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0013 (Accepted — establishes the journal domain this ADR relocates); ADR-0014 (Accepted — §2 already states the `src/modules/<feature>/` = pure-functions convention this ADR generalizes into a written rule) |
| **Enables** | Any future feature module has a written rule for where its pure logic lives, instead of guessing from precedent |
| **Blocks** | Nothing — this is a non-breaking internal reorganization |
| **Ordering Note** | None — can land independently of any feature work |

## Context

### Problem Statement

`src/lib/` accumulated two shapes of content over time: genuine cross-feature infrastructure
(`supabase.ts` — the sole Supabase client, `utils.ts` — generic helpers) and an entire feature's domain
logic (`src/lib/journal/`, 8 files: settle engine, session tracking, timeline ordering, totals,
unread-tracking, stage derivation, template rendering, persona lint). Meanwhile `src/modules/` already
held 9 other features' pure domain logic, including `src/modules/memory/` — structurally the closest
sibling to journal (both are Neve-voiced, both read persisted state and render text, both have a
persona-lint file). Nothing in `CLAUDE.md` or `technical-preferences.md` stated which directory new
pure domain logic belongs in, so the split was purely historical accident (journal shipped first, before
the `modules/` convention was established by later features) with no rule to correct it once the
inconsistency existed.

This surfaced concretely as two problems during a codebase review:

1. **Structural asymmetry with no rule to cite.** A reviewer (or a future contributor) has no way to
   answer "does new pure logic go in `lib/` or `modules/`?" other than "look at what journal did" vs.
   "look at what memory did" — and those two answers contradict each other.
2. **Duplicate, diverging persona-lint.** `src/lib/memory/persona-lint.ts` was written to "reuse the
   journal lint" (per its own doc comment) by importing `lintBody` from `src/lib/journal/persona-lint.ts`
   — a memory-feature file depending on a journal-feature file through a path that presented itself as
   shared infrastructure (`lib/`) but was not. The two files had already grown independent responsibilities
   (journal's solace/epiphany-specific `SOLACE_FORBIDDEN` + digit rule vs. memory's `MEMORY_BANNED_TOKENS`)
   glued together by one arbitrary import direction (memory → journal, never the reverse) that had no
   architectural justification — it happened to be journal that shipped `lintBody` first.

### Current State (before this ADR)

```
src/lib/
  journal/            ← 8 files: settle.ts, session.ts, order.ts, totals.ts, unread.ts, stages.ts,
                          render.ts, persona-lint.ts (journal's pure domain logic — wrong location)
  memory/
    persona-lint.ts   ← imports lintBody from '@/lib/journal/persona-lint' (cross-feature reach-through)
  supabase.ts         ← genuine cross-feature infra (sole Supabase client, ADR-0011)
  utils.ts            ← genuine cross-feature infra (generic helpers)

src/modules/
  chess-engine/ dungeon/ game-export/ game-lifecycle/ learning-loop/
  memory/             ← correct precedent: pure functions, no store, no supabase (ADR-0014 §2)
  move-annotation/ opening-id/ post-game-review/
  (no journal/)
```

### Constraints

- **Behavior must not change.** This is a pure reorganization — every function's signature, logic, and
  test-observable behavior stays identical. No test's assertions change, only import paths.
- **No forced abstraction.** The consolidation must not introduce new configurability or options beyond
  what already existed (`lintBody`'s existing `opts.solace` flag is preserved as-is, not re-architected).
- **Existing importers**: `src/stores/journal.ts`, `src/views/HomeView.vue`, `src/views/JournalView.vue`,
  and the `tests/unit/journal/*`, `tests/unit/memory/persona-lint.test.ts`,
  `tests/unit/memory/templates.test.ts`, `tests/unit/data/journal-templates.test.ts` suites all import
  from the old paths and must be updated in the same change.

## Decision

### 1. The boundary rule

> **`src/lib/` = cross-feature infrastructure only** (things ≥2 features need, or that touch a genuinely
> global concern like the Supabase client). **`src/modules/<feature>/` = pure functions for exactly one
> feature's domain logic** — no store, no direct Supabase import (mirrors ADR-0014 §2's convention,
> generalized to all features going forward).

A concrete test when placing a new file: *"If I deleted every other feature, would this file still make
sense standing alone as a general utility?"* — yes → `src/lib/`; no (it's about journal entries, or
memory summaries, or lesson recommendations specifically) → `src/modules/<feature>/`.

After this ADR, `src/lib/` contains exactly three files: `supabase.ts`, `utils.ts`, `persona-lint.ts` —
all three pass the test above (Supabase client is used by `auth.ts`/`data-sync.ts` across features;
`utils.ts` is generic; `persona-lint.ts`'s emoji/xiangqi-term check is a house rule every Neve-voiced
surface needs, not journal- or memory-specific).

### 2. Journal domain logic moves to `src/modules/journal/`

All 8 files move verbatim (function bodies unchanged) from `src/lib/journal/` to `src/modules/journal/`:
`settle.ts`, `session.ts`, `order.ts`, `totals.ts`, `unread.ts`, `stages.ts`, `render.ts`. The 8th file,
`persona-lint.ts`, is handled by Decision §3 below (it doesn't move verbatim — it splits).

### 3. Persona-lint: one shared core, two thin domain wrappers

```
src/lib/persona-lint.ts              ← NEW shared core (cross-feature infra)
  PIECE_TERMS, XIANGQI_TERMS, SOLACE_FORBIDDEN   (word lists both domains need)
  lintBody(text, opts?)                           (generic checker: emoji + xiangqi always;
                                                    opts.solace adds blame-token + digit checks)

src/modules/journal/persona-lint.ts  ← journal-specific (pen-aware)
  lintEntryBody(text, pen)            calls lintBody(text, { solace: pen === 'solace' || pen === 'epiphany' })

src/modules/memory/persona-lint.ts   ← memory-specific (回顧態-aware)
  MEMORY_BANNED_TOKENS, lintNeve(text)  calls lintBody(text) then adds memory's own banned-token check
```

`lintBody`'s existing `opts.solace` shape (including `SOLACE_FORBIDDEN` and the digit rule) moves into
the shared core **as-is**, rather than being re-decomposed into a more "generic" options design. This is
the deliberately minimal-change option: `opts.solace` was already a parameter of the one function both
domains called: journal with `{solace: true}` for its affirming pens, memory never setting it. Moving it
unmodified avoids inventing a new abstraction the task didn't need (see Alternatives §3), and the
solace-specific vocabulary is not itself feature-secret — it's a general "never blame" rule that a third
Neve-voiced surface could reuse identically if one is ever added.

Each domain wrapper is the *only* place that decides **when** to apply the stricter rule (journal: which
pens; memory: its own banned-token list). This is what actually varies per domain, and it is what stays
in each `src/modules/<feature>/persona-lint.ts` — resolving the original coupling (memory no longer
imports from journal; both import from the shared `src/lib/persona-lint.ts`).

### 4. Updated importers

`src/stores/journal.ts`, `src/views/HomeView.vue`, `src/views/JournalView.vue` update their four import
statements from `@/lib/journal/*` to `@/modules/journal/*`. Test suites (`tests/unit/journal/*`,
`tests/unit/memory/persona-lint.test.ts`, `tests/unit/memory/templates.test.ts`,
`tests/unit/data/journal-templates.test.ts`) update imports identically; `tests/unit/journal/persona-lint.test.ts`
splits its single import into two (`lintBody` from `@/lib/persona-lint`, `lintEntryBody` from
`@/modules/journal/persona-lint`), matching the new file split.

### Final Layout

```
src/lib/
  supabase.ts         ← unchanged
  utils.ts            ← unchanged
  persona-lint.ts     ← NEW (shared core)

src/modules/
  journal/            ← NEW: settle.ts, session.ts, order.ts, totals.ts, unread.ts, stages.ts,
                          render.ts, persona-lint.ts (thin pen-aware wrapper)
  memory/
    persona-lint.ts   ← NEW alongside existing choreography/cross-game/derive/describe/history-game/
                          selection/stage/summary/templates.ts
  chess-engine/ dungeon/ game-export/ game-lifecycle/ learning-loop/
  move-annotation/ opening-id/ post-game-review/
```

## Alternatives Considered

### Alternative 1: Leave the asymmetry as-is (status quo)

- **Description**: Do nothing; document the inconsistency and move on.
- **Pros**: Zero migration risk.
- **Cons**: The next feature author still has no rule to follow; the memory→journal cross-feature
  `lib` import remains a standing architectural smell that will be copied by the next "reuse X's lint"
  feature.
- **Rejection reason**: The review that surfaced this was explicitly commissioned to fix it; leaving it
  undocumented guarantees a third divergent copy the next time a Neve-voiced surface ships.

### Alternative 2: Move `modules/memory/` domain logic into `lib/` instead (opposite direction)

- **Description**: Since journal already lived in `lib/`, promote memory (and by extension every other
  `modules/*`) into `lib/` for consistency in the other direction.
- **Pros**: Also achieves symmetry.
- **Cons**: Contradicts the convention already established and load-bearing for 8 other feature modules
  (ADR-0014 §2 explicitly documents `src/modules/memory/` as "PURE functions... NO store, NO supabase" —
  a convention other ADRs and stories already reference); would require touching far more files for a
  worse ontology (`lib/` would become a dumping ground for every feature's logic, defeating its purpose
  as a signal for "cross-feature").
- **Rejection reason**: `modules/` was already the majority convention (9 features) and the more
  correct one — a directory meant to house infrastructure should not also house nine unrelated feature
  domains.

### Alternative 3: Keep two persona-lint files, add a comment pointing each at the other

- **Description**: Leave `src/lib/journal/persona-lint.ts` and `src/lib/memory/persona-lint.ts` as
  separate files, just document "keep these in sync" instead of merging them.
- **Pros**: No import changes needed anywhere.
- **Cons**: "Keep in sync" is not enforced by anything — the two files had *already* diverged (different
  banned-token sets, different solace-only branching) with only a doc-comment as the enforcement
  mechanism, which evidently didn't prevent the drift that led to this review. A single source of truth
  for the shared word lists and generic checker is the only structure that makes duplication impossible
  rather than merely discouraged.
- **Rejection reason**: Comments are not a substitute for a single definition when correctness (the
  house persona rules) is at stake.

### Alternative 4: Re-architect `lintBody`'s options into a fully generic rule-registry

- **Description**: Instead of keeping the `opts.solace` boolean flag, redesign `lintBody` to accept an
  arbitrary list of rule-sets (e.g., `lintBody(text, [emojiRule, xiangqiRule, ...customRules])`) so
  every domain composes its own rule pipeline.
- **Pros**: Maximally "generic" — no domain-specific branching lives in the shared core at all.
- **Cons**: Nothing in this task requires more than two call shapes (journal's solace/epiphany-only
  strict mode; memory's plain mode). A rule-registry is speculative flexibility for a third caller that
  does not exist yet — it would also require rewriting and re-testing `lintBody`'s internals, which is
  explicitly out of scope for a "move, don't change behavior" refactor.
- **Rejection reason**: Violates the project's minimal-viable-solution ladder (CLAUDE.md: "不加未要求的
  abstraction"). The existing `opts.solace` shape already does the job; moving it unmodified is the
  smallest change that removes the duplication.

## Consequences

### Positive

- A written, testable rule now exists for `lib/` vs `modules/` placement — future features cite this ADR
  instead of guessing from precedent.
- `src/lib/` shrinks to exactly the files that are genuinely cross-feature (3 files), making its contents
  self-evidently "infrastructure" at a glance.
- Persona-lint word lists and the generic checker have exactly one definition; the memory→journal
  cross-feature import is eliminated (both now depend only on `src/lib/persona-lint.ts`).
- Journal's module now matches memory's shape 1:1, making the two easiest to review/maintain together
  (both are Neve-voiced text-rendering features with the same architecture).

### Negative

- One-time churn: 4 production importers + 10 test files needed import-path updates. All are mechanical
  (path-only), verified by the full affected-suite test run (Validation Criteria).
- `docs/architecture/architecture.md`'s Module Ownership section and `production/epics/journal/*.md` /
  `production/session-logs/session-log.md` still reference the old `lib/journal/*` paths as historical
  record of what was originally built where — those files are out of this ADR's edit scope (see Related)
  and are not updated by this change; they remain accurate as *historical* records of the stories that
  shipped journal, even though the code has since moved.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| A missed import path breaks the build silently until CI | Low | Medium | Full-repo grep for `lib/journal`/`lib/memory` in `*.ts`/`*.vue` before and after the move; targeted `vitest run` over every affected suite |
| `lintBody`'s solace/digit behavior accidentally changes during the split | Low | Medium — would let a blame word or digit slip into a solace/epiphany entry | Function body copied verbatim into `src/lib/persona-lint.ts`; existing `tests/unit/journal/persona-lint.test.ts` assertions (emoji/xiangqi/solace/digit cases) re-run unmodified against the new location |
| Historical docs (`production/epics/*`, `session-log.md`) now read as stale | Low | Low — they are audit trail, not live specs | Left as-is deliberately (Consequences, Negative); this ADR is the up-to-date reference for current layout |

## Migration Plan

1. Create `src/lib/persona-lint.ts` (shared core: `PIECE_TERMS`, `XIANGQI_TERMS`, `SOLACE_FORBIDDEN`, `lintBody`).
2. Create `src/modules/journal/` with `settle.ts`, `session.ts`, `order.ts`, `totals.ts`, `unread.ts`,
   `stages.ts`, `render.ts` (verbatim copies) and `persona-lint.ts` (new thin `lintEntryBody` wrapper
   importing from `@/lib/persona-lint`).
3. Create `src/modules/memory/persona-lint.ts` (new thin `lintNeve` + `MEMORY_BANNED_TOKENS` wrapper
   importing from `@/lib/persona-lint`).
4. Update the 4 production importers (`src/stores/journal.ts`, `src/views/HomeView.vue`,
   `src/views/JournalView.vue`) and 10 test files to the new import paths.
5. Delete `src/lib/journal/` and `src/lib/memory/` (old locations).
6. Update `.claude/docs/technical-preferences.md`'s pen-authoring section (`lib/journal/settle.ts` →
   `modules/journal/settle.ts`, `lib/journal/persona-lint.ts` → `modules/journal/persona-lint.ts` +
   `lib/persona-lint.ts`, `lib/journal/stages.ts` → `modules/journal/stages.ts`).
7. Verify with `npx vitest run tests/unit/journal tests/unit/memory tests/unit/data/journal-templates.test.ts tests/unit/views`.

**Rollback plan**: `git checkout` the deleted `src/lib/journal/` and `src/lib/memory/` paths and the
import-path edits; no data migration, no schema, no external state — a pure file-tree revert.

## Validation Criteria

- [x] `src/lib/` contains only `supabase.ts`, `utils.ts`, `persona-lint.ts`.
- [x] `src/lib/journal/` and `src/lib/memory/` no longer exist.
- [x] Repo-wide grep for `lib/journal` and `lib/memory` in `*.ts`/`*.vue` returns zero matches.
- [x] `PIECE_TERMS`, `XIANGQI_TERMS`, `SOLACE_FORBIDDEN`, and `lintBody` are defined exactly once
  (`src/lib/persona-lint.ts`).
- [x] `npx vitest run tests/unit/journal tests/unit/memory tests/unit/data/journal-templates.test.ts tests/unit/views`
  passes with the same test count and zero failures as before the move.

## GDD Requirements Addressed

N/A — this is an internal code-organization decision, not a GDD-derived feature. It does not change any
system's observable behavior; it only relocates where journal's pure logic and the persona-lint core are
defined.

## Related

- [ADR-0013](adr-0013-journal-data-model-and-session-boundary.md) — the journal domain model and settle
  engine this ADR relocates (unchanged in behavior, only in file location).
- [ADR-0014](adr-0014-memory-data-model-and-review-consumption-boundary.md) — §2 already established the
  `src/modules/<feature>/` = pure-functions-no-store-no-supabase convention this ADR generalizes into a
  written, repo-wide rule.
- `production/epics/journal/story-002-settle-engine.md`, `story-003-templates-and-lint.md`,
  `story-005-peek-and-unread.md`, `production/epics/memory/story-005-neve-templates-f3.md`,
  `production/session-logs/session-log.md` — historical story/session records that still cite the old
  `src/lib/journal/*` / `src/lib/memory/persona-lint.ts` paths as *where the feature was originally
  built*; intentionally left unedited by this ADR (out of scope — audit trail, not live documentation).
