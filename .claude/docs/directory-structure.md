# Directory Structure

```text
/
├── CLAUDE.md                    # Master configuration
├── .claude/                     # Agent definitions, skills, hooks, rules, docs
├── src/                         # Vue 3 app source (Composition API + TS)
│   ├── assets/                  # CSS (Tailwind v4 @theme tokens), fonts, static art
│   ├── components/              # Vue components (chess board, lesson, journal, ui/…)
│   ├── composables/             # use-* composables (board input/keyboard/fit, reduced-motion)
│   ├── config/                  # Tuning constants (dungeon, journal, sync, learning-loop…)
│   ├── data/                    # Static content (lessons, puzzles, concepts, journal-templates)
│   ├── lib/                     # Cross-feature infra only: supabase client, utils, persona-lint core (ADR-0015)
│   ├── modules/                 # Domain modules (journal, memory, game-export, learning-loop, opening-id…)
│   ├── router/                  # Vue Router routes + guards
│   ├── stores/                  # Pinia stores
│   ├── types/                   # Shared TS types
│   ├── utils/                   # Pure helper functions
│   ├── views/                   # Route-level page components
│   └── workers/                 # Web Workers (stockfish-worker)
├── public/                      # Static assets served as-is (fonts, board/piece art, Stockfish WASM)
├── design/                      # Design documents
│   ├── gambit-design-system/    # Visual design system SoT (colors, type, persona-neve.md)
│   ├── gdd/                     # Game design documents (per-system specs)
│   ├── quick-specs/             # Lightweight feature specs
│   ├── ux/                      # UX / accessibility requirements
│   ├── registry/                # Entity/consistency registry
│   └── demos/                   # Standalone HTML design demos
├── docs/                        # Technical documentation
│   ├── architecture/            # ADRs (adr-0001…), control-manifest, tr-registry
│   ├── examples/                # Reference snippets
│   └── registry/                # Cross-doc registries
├── tests/                       # Test suites
│   ├── unit/                    # Vitest unit tests
│   ├── e2e/                     # Playwright E2E specs (incl. @spike-tagged heavy specs)
│   ├── integration/             # Integration tests
│   └── smoke/                   # Smoke/toolchain checks
├── supabase/                    # Supabase migrations + README (schema SoT)
├── scripts/                     # One-off / build scripts
└── production/                  # Production management
    ├── session-state/           # active.md — handoff snapshot (TRACKED in git on purpose)
    ├── session-logs/            # Session audit trail (gitignored)
    ├── epics/                   # Epic + story files
    ├── sprints/                 # Sprint plans
    ├── qa/                      # QA plans, bugs, evidence
    ├── gate-checks/             # Phase-gate verdicts
    └── retrospectives/          # Retro notes
```

> **active.md is intentionally version-controlled** (not gitignored as the upstream template
> assumes). This is a solo, multi-machine setup (home + work computer); committing the handoff
> snapshot lets `git pull` carry "where we are / what's next" across machines. It is still a
> *whiteboard* — durable rules/guardrails live in CLAUDE.md and its `@`-included docs, never here.
