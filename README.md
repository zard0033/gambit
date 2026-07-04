# Chess Training Companion

給成人初學者的**單機西洋棋訓練 Web App**：對 AI 練棋、賽後覆盤學習，最終「畢業」到 chess.com / lichess 與真人對弈。框架為「棋之國度」——平靜、精緻、低壓力的學習旅程（無 streak、無計時、無排行榜）。

- **UI 語言**：繁體中文
- **平台**：PC Chrome / Edge / Firefox + iPhone Safari 16+（mobile-first；PWA 規劃中，尚未安裝 `vite-plugin-pwa`）

## 技術棧

| 層 | 技術 |
|---|---|
| 前端 | Vue 3 (Composition API) + Vue Router + Pinia |
| 語言 / 建置 | TypeScript + Vite（PWA／service worker 規劃中，尚未安裝 `vite-plugin-pwa`） |
| 樣式 | Tailwind CSS + shadcn-vue (reka-ui) |
| 棋盤 | vue3-chessboard（chessground）+ chess.js |
| 引擎 | Stockfish 18 Lite（單執行緒 WASM，NNUE） |
| 後端 | Supabase（PostgreSQL + Magic Link Auth） |
| 測試 | Vitest（單元）+ Playwright（E2E） |
| 部署 | GitHub Pages |

## 開發指令

```bash
npm run dev        # 開發伺服器
npm run build      # 型別檢查 + production build
npm run preview    # 預覽 build 結果
npm run test       # 單元測試（Vitest）
npm run test:e2e   # E2E 測試（Playwright）
npm run typecheck  # 僅型別檢查
```

> Node 26 必須（`src/lib/supabase.ts` 在 import 時即建立 Supabase client，需要原生 WebSocket；CI 硬鎖 Node 26）。

## 目錄

```
src/            前端原始碼（views / components / stores / lib）
design/         設計文件
  gambit-design-system/   視覺設計系統 SoT（色彩 / 字型 / 元件 / 4+ 畫面藍圖）
  gdd/                    遊戲設計文件（各系統規格）
public/         靜態資產（字型 / 棋盤木紋 / 棋子 SVG / Stockfish WASM）
tests/          單元 + E2E 測試
```

## 視覺設計系統

全站視覺依歸為 [`design/gambit-design-system/`](design/gambit-design-system/) —— 色彩、字型、元件與互動規範的單一真相來源。實作 UI 前先讀 `README.md` 與 `colors_and_type.css`。

---

> 本專案開發流程基於 [Claude Code Game Studios](https://github.com/Donchitos/claude-code-game-studios) agent 框架（見 `CLAUDE.md` 與 `.claude/`）。
