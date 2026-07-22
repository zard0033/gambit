# Claude Code Game Studios -- Game Studio Agent Architecture

Indie game development managed through 49 coordinated Claude Code subagents.
Each agent owns a specific domain, enforcing separation of concerns and quality.

## Project Overview

**Chess Training Companion** — A single-player chess training web app for beginners.
Built as a Web App (not a traditional game engine project) because the target
platforms are Windows browser + iPhone Safari, and the product is a training tool
rather than a game requiring physics or 3D rendering.

See `~/interviews/chess-training-companion-brief.md` for the full concept brief.

## Technology Stack

- **Platform**: Web App (TypeScript + Browser APIs)
- **Frontend Framework**: Vue 3 + Vue Router + Pinia
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Build System**: Vite + `vite-plugin-pwa`（PWA 已實作，**autoUpdate 鐵則**；快取策略＝ADR-0016，細節見 technical-preferences）
- **Chess Board**: vue3-chessboard (wraps lichess chessground for Vue)
- **Chess Engine**: Stockfish 18 Lite (single-threaded WASM, NNUE embedded) — `stockfish@18.0.7` (nmrugg/stockfish.js); files in `public/stockfish/stockfish-18-lite-single.{js,wasm}`
- **Chess Rules**: chess.js (bundled with vue3-chessboard)
- **Opening Database**: chess-openings (lichess open source)
- **PGN Viewer**: @lichess-org/pgn-viewer (lichess open source) — game replay UI
- **Cloud Backend**: Supabase (PostgreSQL + Auth with Google OAuth)
- **Deployment**: GitHub Pages
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Version Control**: Git with trunk-based development
- **Node Runtime**: 26+ (CI 與本機開發必須一致)

> **Note**: This project does NOT use a traditional game engine (Godot/Unity/Unreal).
> Engine-specialist agents are not applicable. Use web/TypeScript-focused review.

> **CI Node 版本鎖 26，勿降回 20**：`src/lib/supabase.ts` 在 import 時即
> `createClient()`，Supabase RealtimeClient 需要 WebSocket。Node < 22 無原生
> WebSocket，會在測試載入階段（import supabase 的 suite）直接拋錯使 CI 失敗。
> 降版本前先改成裝 `ws` 並注入 transport。

> **部署 base path 護欄**：站台部署在 GitHub Pages 子路徑 `/gambit/`
> （CI 以 `VITE_BASE_URL` 注入）。**寫在 JS / inline-style 的資產路徑**——
> `:style` 的 `url(...)`、`<img :src>`、`mask-image`、`background-image`——
> **必須前綴 `import.meta.env.BASE_URL`**，否則部署站 404。只有 `.css` 檔裡的
> `url()` 會被 Vite 自動補 base；JS 字串不會。本機 dev（base=`/`）看不出來，
> 只在部署站爆。曾誤判成「iOS Safari 渲染 bug」繞兩輪——先 curl 部署 URL 再下結論。

> **E2E 盲區護欄**：`npm run test:unit`（vitest）全綠 ≠ 安全。改到啟動／路由／auth／
> mount 時序（`main.ts`、`router/index.ts`、`App.vue`、`stores/auth.ts`）後，push 前
> 一定本機補跑 `npm run test:e2e`——這類時序問題只有 Playwright 抓得到，CI 會跑 E2E，
> 本機只跑 vitest 會漏。2026-06-14 PWA 閃爍修復就是只信 vitest 665 綠、漏跑 E2E 而紅 CI。

> **棋理內容護欄**：要新增／修改 `data/lessons/*`、`data/puzzles/*`、`data/concept-deepening/*`
> 局面，或潤飾 `persona-neve.md` 文案前，先讀 `.claude/docs/chess-content-guardrails.md`
> （chess.js 驗證、對抗式棋理審查、Stockfish 唯一解閘門、文案人格審查、內容授權）。

### Phase 2 Reserved (not yet integrated)

- **AI Explanation**: Claude API (Anthropic) — natural language move explanations
- **Backend Functions**: Supabase Edge Functions — protect Claude API key

## Project Structure

@.claude/docs/directory-structure.md

## Technical Preferences

@.claude/docs/technical-preferences.md

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction

> **Push guardrail**: this repo is a fork of the `Claude-Code-Game-Studios` template.
> `origin` = `zard0033/gambit` (your fork); `upstream` = the template.
> Always push explicitly with `git push origin main` — never bare `git push` — so a
> branch that tracks `upstream` can never push your work to the template repo.

> **active.md 同步守則**：push 前先更新 `production/session-state/active.md`（完成項標 ✅、更新下一步），
> 一起 stage 進同一個 commit，不必單獨推。不寫 commit hash（查 `git log` 即可，hash 在 active.md 裡是冗餘）。

See `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` for full protocol and examples.

> **First session?** If the project has no engine configured and no game concept,
> run `/start` to begin the guided onboarding flow.

## Visual Design System (Gambit)

**全站視覺 SoT = `design/gambit-design-system/`**。
實作任何 UI 前先讀其 `README.md` + `colors_and_type.css`。以下為非協商鐵則：

> **教練人格 SoT = `design/gambit-design-system/persona-neve.md`**（Neve，原創角色）。
> 寫任何課程／試煉／概念文案前先讀：課程＝Neve 第一人稱對你說、試煉 brief＝第三人稱觀察指對手弱點、概念＝中性。

- **色彩**：每屏都要 deep-jade 錨 `#103029`；品牌金 `#F8B500` 只用於 focus / reward 的
  fill / indicator，**絕不當內文**（內文金用 `#8F6200` 且限大字）；內容區 warm cream；陰影暖棕非純黑。
- **字型（Tailwind family）**：標題 `font-display`（BIZ UDPMincho 明朝）、內文 `font-sans`（Sarasa）、
  課程內文 `font-lesson`（LXGW WenKai）、數字 / 棋譜 `font-num`（Cubic 11, tabular）、品牌字標
  `font-brand`（Cinzel）。內文最小 16px（避免 iOS auto-zoom）。
- **Icon**：Lucide line icons 單一字族；**絕不用 emoji 當功能 icon**。
- **導覽**：底部 tab 為主導覽；頂部 header 只放品牌 + 設定齒輪。
- **動效**：150–300ms，只動 transform / opacity（box-shadow 動畫禁止）；尊重 `prefers-reduced-motion`。
- **觸控目標 ≥ 44×44px**。
- **棋盤 / 棋子**：全 app 統一 **Wood12 木紋盤 + Gioco Wood 棋子**（`src/assets/board-theme.css`，main.ts 全域載入）。
  此主題**必須套到所有 chessground**——對局／課程／試煉的 vue3-chessboard，以及回放／複盤的 lichess PgnViewer
  （後者自帶 `lichess-pgn-viewer.css`、同強度選擇器會蓋過我們，故 board-theme 選擇器加 `body` 前綴出強度）。
  新增任何用棋盤的頁，確認它吃到此主題（別讓 lichess 預設深色盤漏出來）。
- **標註 / eval 維持上游中性語意，不重新上色**：箭頭／高亮用 chessground 既有 brush，eval 不染品牌金
  （金只給 focus / reward）。
- **繁中語氣**：成熟、平靜、低壓力，稱呼「你」；無 streak / timer / leaderboard。
- **西洋棋用語**：棋子一律用「后 / 城堡 / 騎士 / 主教 / 國王 / 兵」。**這是西洋棋，禁用象棋的「車 / 馬 / 象」**（rook=城堡、knight=騎士、bishop=主教）。課程標題如「城堡與主教」「騎士與后」即為準則。

## 樣式落地優先序（禁裸手刻 CSS）

寫任何 UI 樣式，照此順序停在第一個成立的：

1. `src/components/ui/` 既有元件能用 → 用它，別重造。
2. Tailwind utility class（吃 `@theme` token）能表達 → 用 class，不開 `<style>`。
3. 用到的值 `@theme` 已有 → 一律 `var(--color-*)` / token，**禁手算硬編 hex / px**。
4. 真正一次性、utility 表達不了的複雜視覺（動效／glass／發光／複雜佈局）→ 才允許 scoped `<style>`，且優先走 `production/tooling-inspira-ui.md` / `apple-design` / `emil-design-eng`，並在 `<style>` 上方一行註明「為何 utility 做不到」。

> 禁：在 .vue 新增 scoped `<style>` 重寫 token 已涵蓋的顏色／間距／字型／圓角／陰影。

## UI 質感 Skill 路由（潤飾專用）

當 Eason 提到下列關鍵詞時，主動採用對應 skill。**三條鐵則優先於一切**：

1. **Gambit 是裁判**：任何 UI 潤飾前先讀 `design/gambit-design-system/`。`ui-ux-pro-max` / `web-design-engineer`
   的產出**不得覆蓋** Gambit 的配色 / 字型 / 金色（focus·reward only）規則；它們只供想法，採用前一律對齊 Gambit。
2. **單純小修不觸發重型 skill**：改一個字、調一格間距等，依「最小可行解 / 勿動沒壞的」直接做，不啟動下表。
3. **redesign 先報告後施工**：redesign / 潤飾類任務，**即使 repo 已有 H/M/L 計畫（如 `production/redesign-2026-06.md`），仍須先跑 `/redesign` 對真實畫面出報告 → Eason 拍板 → 才施工**。不可因「計畫已寫好」就直接動手。

| 關鍵詞 | 採用 skill | 行為 |
| --- | --- | --- |
| 潤飾、質感、質感提升、視覺/UI/介面優化、polish | `redesign` | 先**審查既有屏**出 H/M/L 優先清單，等拍板再改；不直接亂動 |
| 實作元件、改畫面、切版、RWD、響應式、a11y、無障礙、前端實作 | `agent-skills:frontend-ui-engineering` | 當**施工紀律**做 production 級實作，逐項 Playwright 驗畫面 |
| 配色、字型、風格、動效曲線、微互動、設計原則、圖表/chart | `ui-ux-pro-max` | **只當顧問**出想法；採用前對齊 Gambit（見鐵則 1） |
| Landing、行銷頁、品牌頁、logo 頁、簡報頁、HTML demo、獨立頁 | `web-design-engineer` | 僅限**全新獨立頁**；不碰 App 內既有畫面 |

> **UI 工具參考（動 UI／選元件前先讀——否則這些檔放在 `production/` 裡 AI 不會自己找到）**：
> 元件框架選/評 → `production/tooling-ui-frameworks.md`（結論：整包框架一律不裝，走現有 reka-ui shadcn 模式）；
> 氛圍／動畫元件 → `production/tooling-inspira-ui.md`（採用 Inspira UI＝copy-paste 單一元件＋剝 juice＋CSS 優先）。
>
> 全面提升流程：`redesign` 找問題 → triage（砍掉違反 Gambit / 沒壞的）→ `frontend-ui-engineering` 施工 →
> 卡關時 `ui-ux-pro-max` 補深度。`web-design-engineer` 留給品牌頁等獨立頁。

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

@.claude/docs/context-management.md
