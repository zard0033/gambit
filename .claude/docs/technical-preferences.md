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
- **npm 11（Node 26 內建）`allow-scripts` 警告非錯誤**：npm 11 預設攔截依賴的 postinstall
  script，`npm install` 會跳 `npm warn allow-scripts stockfish / vue-demi …`。本專案**無害、不用 approve**：
  Stockfish WASM 已 committed 在 `public/stockfish/`（非靠 postinstall 產生）、vue-demi 自偵 Vue 3。
  CI 在 Node 26 全綠已證實。看到此警告不要以為壞了。
- **Node 26 vitest localStorage shim（`tests/setup-node26-compat.ts`，vitest.config 已 `setupFiles` 指向）**：
  Node 26 把 `localStorage` 加進原生 globals（實驗性 Web Storage），但無 `--localstorage-file` 時它是
  getter-only 的 undefined，happy-dom 用 plain assignment 覆寫在 strict mode 會靜默失敗 → 全測試
  `localStorage=undefined` 而紅。shim 在 happy-dom init 後**條件式**（`if typeof localStorage === 'undefined'`）
  補裝可用的 InMemoryStorage（key 為 own enumerable，使 `Object.keys` 正常）。對 Node 22 是 no-op
  （happy-dom 已正常注入 → shim 跳過），公司電腦 22 pull 後測試照綠、不需動作（建議仍升 26 對齊 CI）。
- **chessground 合成事件測不到**：B5 試煉互動（log 累積、inline 達成、答錯滑回、換步不 remount、
  揭曉箭頭走子後消失）等靠 chessground 合成事件的行為，Playwright 難自動觸發 → 靠 vue-tsc 0 ＋ unit
  ＋邏輯正確性保證，需部署後實機點一輪確認。

## Board / chessground gotchas（vue3-chessboard，動棋盤幾何/易位/標註前先讀）

- **容器寬對齊 8 倍數**：否則 chessground 把 cg-board floor 成 8n 偏移。用 `useBoardFit`
  ResizeObserver 解、套 `.board-fit`。
- **overlay 定位**（標註/箭頭/check ring/座標）用**真實 cg-board 尺寸 ＋ 相對 cg-wrap 原點**，非 cg-wrap 寬。
- **易位**：chess.js 只收 `e1→g1/c1`，城堡格手勢要 remap 成 king 兩格目標；`events.select(key)` 偵測選子觸發城堡提示。
- **座標自繪**在木框（chessground `coordinates:false`）。
- **不可用 `max-w` 依高度硬縮棋盤**（高度被內部 pin、會壓成非正方）；要省空間改縮周邊（合併列、棋譜上限）。
  Tailwind arbitrary calc 內 `-` 兩側要底線：`calc(100dvh_-_Nrem)`。
- **桌機棋盤過大 root cause**：vue3-chessboard `.main-wrap` 被釘 `width:700px`。解＝board wrapper 加 `board-fit`
  ＋ scoped `.board-fit :deep(.main-wrap){width:100%!important;max-width:100%!important;height:auto!important}`。
  PlayView/Review/Replay 遇過大套同一 fix。
- **annotation 高亮/箭頭 vs 格子 2–4px 偏移**（polish 後續）：MoveAnnotationDisplay 用 cg-wrap（536px）算格子，
  但實際 cg-board 531.2px、左偏 ~5px → 改用 `elements.board` 尺寸＋原點。牽涉全站箭頭/標註，需獨立驗證。

## Deferred Cleanups（刻意保留、勿移除）

- **自訂升變 fallback**：`components/promotion-dialog.vue` ＋ `chess-board.vue` 的 `pendingPromotion`/
  `handlePromotionSelect`/`handlePromotionCancel`/`isPromotionMove` 分支。「死」靠 vue3-chessboard runtime
  而非結構保證，又接在核心 `onMove`，移除＝拔 fallback。升變無法只靠 vue-tsc/vitest 驗（要瀏覽器真走一步
  升變），故待能實機測升變再移除。
- **`recommend.ts` 的 `recommended()`**：有測試/文件、與 candidates/practiceTarget 成套的保留 API，刻意不刪。

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
