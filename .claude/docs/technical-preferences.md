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
  - PWA（Add to Home Screen／離線）**已實作（2026-07-10，ADR-0016）**：`vite-plugin-pwa`、
    `registerType: 'autoUpdate'`（**勿改成 prompt**，否則 service worker 把舊版鎖死、部署更新卡住），
    precache＝app shell；stockfish／fonts 刻意排除 precache、走 runtime CacheFirst；Supabase 永不快取。
    **測試剛部署的版本若看到舊畫面＝裝置快取**，用無痕分頁、或設定→Safari→進階→網站資料刪該站即可
    （autoUpdate 會在下次載入自癒）。bash 跑帶 base 的 build 要 `MSYS_NO_PATHCONV=1`（MSYS 會把
    `/gambit/` 靜默改寫成 Windows 絕對路徑、壞掉 manifest base）。
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
  或只跑相關 spec（例：改了 router → `npx playwright test spa-deep-link visual-regression`）。
- **npm 11（Node 26 內建）`allow-scripts` 警告非錯誤**：npm 11 預設攔截依賴的 postinstall
  script，`npm install` 會跳 `npm warn allow-scripts stockfish / vue-demi …`。本專案**無害、不用 approve**：
  Stockfish WASM 已 committed 在 `public/stockfish/`（非靠 postinstall 產生）、vue-demi 自偵 Vue 3。
  CI 在 Node 26 全綠已證實。看到此警告不要以為壞了。
- **vitest 全檔掛掉但「no tests / import 0ms」＝`node_modules/.vite` 快取問題，不是 code 壞**：特徵組合＝
  9x/9x files failed、Tests no tests、import 0ms、`Cannot read properties of undefined (reading 'config')`、
  pgn-viewer 報 `Cannot find module …dist/config`（dep optimizer 沒作用時原生 ESM 解析不了無副檔名 import）。
  兩種毒法：① 與其他 vite 程序（dev server、playwright webServer、緊接的前一次 vitest）並行搶快取——
  **單獨重跑一次即綠**（2026-07-03 兩度誤警）；② 快取檔本體損毀——**重跑不會好、帶不帶 `--maxWorkers` 都紅**
  （2026-07-13 公司電腦 5 連紅實證），修法＝把 `node_modules/.vite` 搬走讓 vite 重建
  （`mv node_modules/.vite node_modules/.vite-poisoned-<date>`，用 mv 不用 rm 以避開刪除保險絲），一次即綠。
  看到特徵先重跑一次分流①②，別追假根因。
  **push 假紅已根治（2026-07-14，家用機 hook 已上補丁）**：真相＝易碎的 `deps/` bundle 是 dev server／
  Playwright webServer 寫進**共用主快取**的，vitest 讀到被寫壞的它就 91 檔全紅——vitest 是受害者。
  根治兩件套：① `vitest.config.ts` 的 `cacheDir` 接 `VITEST_CACHE_DIR` 環境變數（已入 repo）；
  ② `~/.claude/hooks/shell-gate.js` 的 `runVitestGate` 以 `node_modules/.vite-prepush` 隔離快取跑
  ＋首跑紅自動搬走 hook 快取全新重跑一次（自癒保險絲）。實測：連續 push 綠、毒化隔離快取仍綠
  （該快取只含 vitest results.json，不含易碎 deps 工件）。
  **公司機注意**：hook 是 per-machine 檔案，公司機的 shell-gate.js 尚未上此補丁——同步前照舊流程
  （push 前先 `npx vitest run` 直跑確認綠、毒了先 mv 主快取），或照本段描述對該機 hook 套同款補丁。
  手動直跑撞毒（特徵同上）仍照 mv 主快取處方，與 hook 無關。
  另註：prepush hook 是 **PreToolUse**——在整條 shell 指令執行之前先跑，任何「修好再 push」的動作
  都不能與 `git push` 寫在同一條指令裡。
- **Node 26 vitest localStorage shim（`tests/setup-node26-compat.ts`，vitest.config 已 `setupFiles` 指向）**：
  Node 26 把 `localStorage` 加進原生 globals（實驗性 Web Storage），但無 `--localstorage-file` 時它是
  getter-only 的 undefined，happy-dom 用 plain assignment 覆寫在 strict mode 會靜默失敗 → 全測試
  `localStorage=undefined` 而紅。shim 在 happy-dom init 後**條件式**（`if typeof localStorage === 'undefined'`）
  補裝可用的 InMemoryStorage（key 為 own enumerable，使 `Object.keys` 正常）。對 Node 22 是 no-op
  （happy-dom 已正常注入 → shim 跳過），公司電腦 22 pull 後測試照綠、不需動作（建議仍升 26 對齊 CI）。
- **chessground 互動本機可驅動（更新 2026-06-25，修正舊「合成事件測不到」結論）**：先前以為 Playwright 完全
  推不動 chessground，其實只對 **drag / 高階 `dragAndDrop`/dispatch** 成立。**tap-to-move（點起點格→點目標格）
  用真實座標滑鼠點擊可驅動**——chessground 監聽 board 上的 pointer 事件、由座標判格，不吃 element-targeted click（格子
  非可定址 DOM）。做法：抓 `cg-board` 的 `getBoundingClientRect()`，格邊長＝`width/8`，**白方視角**格中心
  `x = left+(file+0.5)·sq`、`y = top+(8−rank+0.5)·sq`（file a=0…h=7、rank 1–8；黑方視角 file/rank 對調），
  再用 Playwright `page.mouse.click(x,y)` 點起點、點目標即走子（MCP：`browser_run_code_unsafe` 內呼 `page.mouse.click`）。
  guest 登入即可進深化／試煉；棋憶 slideshow 仍需先有完整分析局才到得了。**已用此法本機驗過牽制深化三關
  unaided→epiphany 鏈 + board-fit 渲染**。→ B5 試煉互動、epiphany 等先前「待 iPhone 複看」項目，本機 Playwright
  即可截圖驗（純 drag 行為仍需實機）。
- **node 直驅 Stockfish 驗任意 FEN（無需 dev server，比 @spike 輕）**：要快速驗一個 FEN 的最佳手／唯一解
  （新增戰術局面、抓假將殺/假贏）時，不必開 dev server 或跑 Playwright uniqueness-spike。node 直接
  `require('stockfish')`（factory）→ `factory('lite-single')` **回 Promise**，`.then(engine => …)`。命令走
  `engine.sendCommand('position fen <FEN>')` + `engine.sendCommand('go depth 16')`（或 `go movetime 5000`）
  （stockfish@18.0.8 起是 `sendCommand`，**沒有** `postMessage`——舊筆記寫 postMessage 是 18.0.7 殘留，
  2026-07-03 實測修正）。**UCI 輸出設 `engine.listener = (line) => …` 接**（不設 listener 才 fallback 到
  console.log），抓 `bestmove …` 與 `info … multipv N … score cp X … pv <移動序列>`。唯一解＝
  `setoption name MultiPV value 2` 後比 PV1／PV2 的 score gap。
  **mate 題更強的唯一解驗法＝chess.js 窮舉**：列全部合法走法逐一 `isCheckmate()`，「恰好一個」是決定性證明，
  比引擎 PV 更硬。**改教學盤除了驗 FEN 字面重複，還要掃「終局殺型」跨資料集重複**（lessons/puzzles/deepening
  的 K+Q vs K 全列出比對角落與殺著——2026-07-03 換深化 mate 盤第一輪就因只查 FEN、漏掉 rules.ts 用同殺型
  教過兩次而被對抗審查退回）。**script 寫進 scratchpad、用絕對路徑 `require('<repo>/node_modules/stockfish')`**
  （require 從 script 所在目錄解析，scratchpad 無 node_modules）。已實證真A `8/7p/2r3k1/pp6/7P/5N2/P5P1/4K3 w`
  → `bestmove f3e5`。閘門級唯一解仍以 `concept-deepening-uniqueness-spike`（@spike）為準，此法是設計階段的快速自驗。
- **長命 vite dev server 會讓 E2E 噴假的 `SyntaxError: Importing binding name 'X' is not found`**
  （2026-08-05 D2 實踩）：`playwright.config.ts` 是 `reuseExistingServer: !CI`，所以本機那台 dev server
  會橫跨一整個 session 的所有編輯。改動夠多之後它的模組圖會失準，E2E 出現「某個明明存在且有匯出的
  binding 找不到」——**typecheck 0、vitest 全綠、chromium 也全綠，只有一兩條 webkit 掛**，看起來像
  瀏覽器差異，其實是伺服器陳舊。分流：先殺掉 5173 讓 Playwright 重開一台，再跑一次；好了就是這個。
  `Get-NetTCPConnection -LocalPort 5173 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }`
- **Playwright 背景分頁的 `setTimeout` 會被瀏覽器 throttle**（2026-07-29 難度輪實踩）：多分頁時
  非前景頁的計時器被降頻，量出 3019ms 的假停頓差點誤導調參。量任何跟 `setTimeout` 有關的節奏前，
  先 `bringToFront()` 並關掉其他分頁。
- **有 scale 進場動畫的 modal，等動畫結束才量 `getBoundingClientRect()`**（2026-07-29 verifier 實踩）：
  難度 dialog 0.95→1 進場，開啟後 300–900ms 內量到全體 ×0.95 的假數字（44px 讀成 41.8px），
  觸控目標會誤報不達標。寫回歸腳本先 wait 動畫收斂再量。
- **字階 16px 下限只綁 body，agent 報「<16px 違反鐵則」可直接駁回**（2026-07-29 兩路評審同時誤判）：
  設計系統原文＝`body 16 (min)·body-sm 14·label 13·caption 12`，且 iOS auto-zoom 只作用於
  focusable input。label/caption 用 13/12 是合法字階，不是缺陷。

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
- **annotation 高亮/箭頭 vs 格子偏移（已修，2026-06-22）**：位置幾何在源頭 `chess-board.vue::squareToRect`
  已改用**真實 cg-board `getBoundingClientRect()` 尺寸 ＋ 相對 cg-wrap 原點**（`br.left-wr.left, br.top-wr.top`），
  三個消費端（對局/課程、賽後檢討、回放）共用此修正過的 `squareToRect`，端點/高亮本就對齊格子。
  `move-annotation-display.vue` 的 `squarePx`（只用於箭頭桿粗、不影響位置）也已從 cg-wrap/8 對齊到真實格子尺寸
  `squareToRect('a1').width` 並補 resize 反應。若日後又見偏移，root cause 在 `chess-board.vue::squareToRect` 或消費端傳錯 `squareToRect`，不在 overlay 元件。
- **viewOnly 建立的盤永遠不能互動（已修，2026-06-29）**：chessground `bindBoard` 在 **建立時** `if(viewOnly) return`
  跳過綁 `mousedown`/`touchstart` listener，且之後 `setConfig({viewOnly:false})` **不會重綁**（vendor 一次性綁定）。
  carousel 等「非初始 active 盤」若 created viewOnly 就永遠拖不動子（dests/state 再對也沒用，因為沒 listener）。
  解＝`chess-board.vue` 一律以 `viewOnly:false` 建立（讓 listener 綁上），`onBoardCreated` 後才 `setConfig` 套真實
  viewOnly。**新增任何「初始 disabled 後才啟用」的盤都吃這個 fix，別退回 `viewOnly: props.disabled` 當初始 config。**
  另：carousel 盤切 active 後還要 `reapplyFen()`（setPosition 重整 selectable），且須等 slide transition 結束再做
  （見 `RecognitionBoard.vue` 的 360ms watch）。
  **第二層（已修，2026-07-03）——stale bounds**：chessground 建立時 memo 棋盤 bounds；在 translateX 偏移處建立的
  carousel 盤切 active 後 memo 不失效（ResizeObserver 只看尺寸、位移不觸發），點擊座標→格子換算全錯、整盤點不動。
  解＝同一個 360ms watch 內 `reapplyFen()` 後補 `window.dispatchEvent(new Event('resize'))`——這是 chessground 自己
  的 `bounds.clear()` 監聽路徑（vendor 支援、不碰 private `board.redrawAll`）。新增任何「建立時不在最終位置」的盤
  （carousel／隱藏 tab）都吃這兩層修法。
- **lichess PgnViewer CSS 全域汙染 vue3-chessboard（已修，2026-06-29）**：`lichess-pgn-viewer.css` 有全域
  `.cg-wrap{box-sizing:content-box;height:0;padding-bottom:100%}`（它自己的 aspect trick）。一進**棋憶/複盤**載入此
  stylesheet 後，該規則也套到 vue3-chessboard 的 `.cg-wrap`（它已 absolute 填滿自己 `.main-board` 的 aspect 框）
  → 疊加第二層 100% padding → **棋盤高度雙倍、往下溢出**。症狀＝「進過棋憶後全站 vue3-chessboard 盤跟著壞」（失誤
  slideshow／試煉／深化），因 lichess CSS 全域且常駐。解＝`board-theme.css` 加 `.main-wrap .cg-wrap` reset
  （`height:100%;padding-bottom:0;box-sizing:border-box`）；scope `.main-wrap` 只命中 vue3-chessboard，PgnViewer 的在
  `.lpv` 下不受影響。**勿移除此 reset**，否則複發。

## Deferred Cleanups（刻意保留、勿移除）

- **`concept-progress.deepenedUnaided`（登記日 2026-08-05，複查期限 2026-11-05）**：唯一消費端
  （epiphany 棋誌筆）已隨 D1 刪除，現在是**只寫不讀**的持久欄位，兩個深化 view 仍在寫。
  **具名用途**：它是全 app 唯一的「無求助通關」持久訊號，落在 v2 保留的認知遷移軸上，
  預定給「該殺沒殺／判斷場題目供給」那批新訊號當輸入（v2 的 P2／P3）。
  到期仍無讀取端就刪掉欄位＋兩個寫入點＋`ProgressShape` 對應鍵。**別當死碼順手清掉。**
- **自訂升變 fallback**：`components/promotion-dialog.vue` ＋ `chess-board.vue` 的 `pendingPromotion`/
  `handlePromotionSelect`/`handlePromotionCancel`/`isPromotionMove` 分支。「死」靠 vue3-chessboard runtime
  而非結構保證，又接在核心 `onMove`，移除＝拔 fallback。升變無法只靠 vue-tsc/vitest 驗（要瀏覽器真走一步
  升變），故待能實機測升變再移除。
- **`recommend.ts` 的 `recommended()`**：有測試/文件、與 candidates/practiceTarget 成套的保留 API，刻意不刪。
- **`src/modules/game-export/use-game-export.ts`（已接 UI，勿刪）**：2026-08-02 曾依 positioning-v2 D7
  當死碼刪除（當時零呼叫點），**2026-08-05 撤銷並復活**——匯出接上棋憶儀表板的「複製這盤棋」
  （`components/memory/GameExportCard.vue`），Eason 拍板它屬於產品而非開發工具。`tier-delivery.test.ts`
  一併復活。**`assembler.ts` 亦不可刪**——`buildPgn` 另有兩個活消費端（`stores/data-sync.ts:59` 寫雲端
  PGN、`views/MemoryView.vue:28`），砍它會靜默降級成原始 UCI 字串。
- 🪦 **`opening-knowledge-card.vue` + `opening-knowledge-cards.ts`（v2 D5 判死，尚未執行）**：
  20 張卡全站零呼叫點，開局知識與「察覺」無關。接線＝替與斷層無關的東西發居留證。

> **這份清單的教訓**：上面兩條原本寫「待接 UI，勿刪」，但沒有日期也沒有具名用途——結果是無限期腐爛。
> 新增 Deferred Cleanup 必須同時給**一個日期**和**一個具名用途**，否則直接刪。

## 手寫 `var()` 顏色 token（SVG / inline-style 前先讀）

- **手寫 SVG `fill`/`stroke` 或 inline `:style` 的顏色，用 `var(--color-*)`**（Tailwind v4 `@theme`，定義在
  `src/assets/main.css`）——**不是** design system `colors_and_type.css` 的原始名（`--danger`、
  `--surface-card`、`--ink-muted`、`--accent`、`--accent-text`…）。那些原始 token **沒載進 runtime**，
  `var(--danger)` 解析失敗會 **fallback 成黑**（圖表線、label 底板、icon、accent 全黑）。
- 對照：`--danger`→`--color-danger`、`--surface-card`→`--color-surface-card`、`--ink-muted`→`--color-ink-muted`、
  `--accent`→`--color-accent`、**金字 `--accent-text`(#8F6200)→`--color-gold-dark`**。
- Tailwind class（`text-danger`、`bg-surface-card`、`border-line`…）正常解析，**只有手寫 `var()` 會踩**。
- **單元測試驗不到**：`expect(style).toContain('var(--danger)')` 只驗屬性「含」字串、不驗「解析」——
  2026-06-20 棋憶圖表/卡片 4 個元件全黑就是這個，靠 dev-server 截圖才抓到。手寫 token 後**截圖驗一次**。

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
| `vite-plugin-pwa` ^1.x | PWA (SW + manifest, autoUpdate; ADR-0016) | Community |
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

ADRs live in `docs/architecture/adr-NNNN-*.md`. Existing (adr-0001–adr-0016):

1. **ADR-0001** — Stockfish Build Source, Version, and HCE/NNUE Split
2. **ADR-0002** — Web Worker Isolation and UCI Communication Protocol
3. **ADR-0003** — chess-openings Dataset Version Pin and EPD Index Build
4. **ADR-0004** — Vue Router History Mode and GitHub Pages SPA Fallback
5. **ADR-0005** — Pinia Store Module Boundaries and CompletedGame Transport
6. **ADR-0006** — Move Annotation Rendering Substrate
7. **ADR-0007** — Post-Game Review Analysis Loop and sessionStorage Schema
8. **ADR-0008** — Content Security Policy Headers and WASM Deployment Configuration
9. **ADR-0009** — Chess Board Substrate, vue3-chessboard Integration, and Custom Roving-Tabindex Keyboard Model
10. **ADR-0010** — Game Export Tier-1/2/3 Delivery and Synchronous User-Gesture Clipboard Contract
11. **ADR-0011** — Supabase Authentication and Data Sync Strategy
12. **ADR-0012** — Bidirectional Lesson-to-Game Linking via a Shared Concept Tag
13. **ADR-0013** — Journal (棋誌) Data Model, Idempotency, and Session Boundary — **Superseded 2026-08-05**（棋誌整組下架＝定位 v2 的 D1；`journal_entries` 表保留未 drop）
14. **ADR-0014** — 棋憶 (Memory) Data Model and Post-Game Review Consumption Boundary
15. **ADR-0015** — lib/ vs modules/ Placement Criteria
16. **ADR-0016** — PWA Caching Strategy (autoUpdate; precache app shell, runtime CacheFirst for stockfish/fonts)

### Required ADRs (not yet written)

1. **Skill scoring formula** — How tactics/opening/endgame scores are computed
2. **Phase 2 backend boundary** — When to introduce Edge Functions for Claude API

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
