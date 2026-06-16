# Technical Preferences

<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Platform**: Web App (TypeScript + Browser APIs)
- **Frontend Framework**: Vue 3 (Composition API) + Vue Router + Pinia
- **Language**: TypeScript
- **Rendering**: HTML + CSS (Tailwind) + SVG/Canvas via chessground
- **Physics**: N/A (no game engine — DOM-based chess board)

## Input & Platform

- **Target Platforms**: PC (Windows browser — Chrome / Edge / Firefox), Mobile (iPhone Safari 16+)
- **Input Methods**: Mouse, Touch
- **Primary Input**: Mouse (PC) / Touch (iPhone)
- **Gamepad Support**: None
- **Touch Support**: Full (chess piece drag + tap-to-select)
- **Platform Notes**:
  - Must work in Safari iOS 16+
  - Touch targets ≥ 44×44px
  - No hover-only interactions (mobile has no hover state)
  - PWA-enabled for iPhone "Add to Home Screen" experience
  - Audio playback requires user gesture on iOS

## Naming Conventions

- **Classes/Interfaces**: PascalCase (e.g., `ChessGame`, `ReviewSession`, `BoardConfig`)
- **Variables/functions**: camelCase (e.g., `moveHistory`, `analyzePosition`)
- **Vue components**: PascalCase in templates, kebab-case in filenames (e.g., `<ChessBoard />` from `chess-board.vue`)
- **Composables**: camelCase with `use` prefix (e.g., `useStockfish`, `useReviewSession`)
- **Pinia stores**: camelCase with `use` prefix + `Store` suffix (e.g., `useUserStore`, `useGameStore`)
- **Files**: kebab-case (e.g., `chess-engine.ts`, `board-view.vue`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_DEPTH`, `DEFAULT_TIME_MS`)
- **Types**: PascalCase (e.g., `ChessMove`, `ReviewResult`)

## Performance Budgets

- **Target Framerate**: 60fps
- **Frame Budget**: 16.6ms
- **Memory Ceiling**: < 150MB total (including stockfish.wasm worker)
- **Initial Load**: < 3s on mobile 4G
- **Stockfish Analysis**: ≤ 5s **per position** (iPhone Safari). A full post-game review analyzes many positions across two passes and is bounded by the review's own time budgets (`REVIEW_TOTAL_TIME_BUDGET_MS` etc.), not this per-position figure — see the Post-Game Review GDD.

## Testing

- **Unit Test Framework**: Vitest
- **E2E Test Framework**: Playwright (lichess also uses this)
- **Minimum Coverage**: Core game logic (engine wrapper, move validation, scoring formulas)
- **Required Tests**:
  - Chess move validation
  - Stockfish interface (UCI message parsing)
  - Review data parsing
  - Skill scoring formulas
  - Supabase data sync
- **本機跑 E2E 不要用無參數的 `npx playwright test`**：完整套件含 `@spike` 重 spec
  （`depth-22-spike` 跑 Stockfish 到 depth 22、`memory-budget-spike` 記憶體壓測），本機會卡好幾分鐘像當機。
  CI 用 `grepInvert @spike`（見 `playwright.config.ts`）排除，所以 CI 不慢。
  **本機驗證改用** `npx playwright test --grep-invert @spike`（＝CI 等效、快），
  或只跑相關 spec（例：改了 router → `npx playwright test journal-view spa-deep-link`）。

## Forbidden Patterns

- [None configured yet — add as architectural decisions are made]

## Allowed Libraries / Addons

### Phase 1 (current)

| Package | Purpose | Source |
|---------|---------|--------|
| `vue` ^3.5.x | Frontend framework | vuejs.org |
| `vue-router` ^5.x | Multi-screen routing | Vue official |
| `pinia` ^3.x | State management | Vue official |
| `typescript` ^6.x | Programming language | Microsoft |
| `vite` ^8.x | Dev server + bundler | Community |
| `vite-plugin-pwa` ^0.x | PWA support for iPhone Home Screen | Community |
| `tailwindcss` ^4.x | Utility-first CSS | Community |
| `vue3-chessboard` ^1.x | Chess board Vue component (wraps chessground) | qwerty084 |
| `chess.js` | Chess rules (bundled with vue3-chessboard) | Community |
| `stockfish@18.0.7` (WASM) | Chess engine — Stockfish 18 Lite single-threaded, NNUE embedded (~7.3MB, no external net, no COOP/COEP); serves play+review+replay | nmrugg/stockfish.js |
| `chess-openings` | Opening name database | lichess |
| `@lichess-org/pgn-viewer` ^2.x | Game replay viewer | lichess |
| `@supabase/supabase-js` ^2.x | Cloud database + Auth client | Supabase |
| `reka-ui` ^2.x | Headless UI primitives (shadcn pattern) | reka-ui.com |
| `lucide-vue-next` ^1.x | Icon library (Lucide line icons) | lucide.dev |
| `class-variance-authority` ^0.x | Variant-based class composition | Community |
| `clsx` ^2.x | Conditional class name utility | Community |
| `tailwind-merge` ^3.x | Tailwind class conflict resolution | Community |
| `tailwindcss-animate` ^1.x | Animation utilities for Tailwind | Community |
| `vitest` ^4.x | Unit test framework | Community |
| `@playwright/test` ^1.x | E2E test framework | Microsoft |

### Phase 2 (planned, not yet added)

| Package | Purpose | Source |
|---------|---------|--------|
| `@anthropic-ai/sdk` | Claude API client (server-side) | Anthropic |

> **Guardrail**: Do NOT add Phase 2 libraries until Phase 1 MVP is shipped and
> validated. Adding them early creates unused code and configuration overhead.

## Architecture Decisions Log

- [No ADRs yet — use `/architecture-decision` to create one]

### Required ADRs (to author before Production phase)

1. **Stockfish integration strategy** — Web Worker vs main thread, UCI message protocol
2. **Supabase schema design** — Tables for games, moves, skill scores, lessons
3. **State management boundaries** — What lives in Pinia vs Vue Router vs Supabase
4. **Bidirectional lesson-to-game linking** — How positions are indexed and matched
5. **Skill scoring formula** — How tactics/opening/endgame scores are computed
6. **PWA caching strategy** — What's cached for offline use, what isn't
7. **Phase 2 backend boundary** — When to introduce Edge Functions for Claude API

## Engine Specialists

> **Note**: This is a Web App project, not a traditional game engine project.
> Traditional engine-specialist agents (godot-specialist, unity-specialist, etc.)
> are not applicable. Code review and architecture work should follow standard
> web/TypeScript practices.

- **Primary**: Use general `/code-review` skill (not engine-specific specialists)
- **Code Review Focus**: TypeScript correctness, Vue 3 Composition API patterns,
  Tailwind class conventions, accessibility (ARIA, keyboard nav, focus management)
- **Performance Review**: Browser performance (paint, layout, JS execution time),
  bundle size, lazy loading boundaries

### File Type Routing

| File Type | Review Focus |
|-----------|-------------|
| `*.vue` (components) | Vue 3 Composition API patterns, props/emits, slot usage |
| `*.ts` (logic, composables, stores) | TypeScript types, pure-function design, testability |
| `*.test.ts` (unit tests) | Test isolation, assertion coverage, edge cases |
| `tests/e2e/*.spec.ts` (Playwright) | User flow coverage, selector robustness |
| `tailwind.config.ts`, `vite.config.ts` | Build correctness, plugin order |
| `supabase/migrations/*.sql` | Schema integrity, RLS policies |
| Architecture / cross-cutting | General `/code-review` skill (no specialist) |
