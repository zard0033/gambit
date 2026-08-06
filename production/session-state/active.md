<!-- STATUS -->
Epic: 定位 v2 刪除期 — **主線收工**（D1–D9 全部執行或撤銷）＋ **noir 深色主題整組下架**（2026-08-06）
Feature: 無進行中 feature；下一步看「未決/待辦」
Task: health-check Q9（訪客登入/history/reset 缺口）已修復，工作區有 3 檔改動尚未 commit/push
⚠️ 動 engine 解析層時注意：`handshake.ts` 寫死 `MultiPV 1` 且與 review 分析路徑共用，勿污染分析。
<!-- /STATUS -->

> **交接快照**：只留現況＋待辦＋未固化決策；施工細節在 git，D1–D6 各條目全文在
> `archive-2026-07.md` 與 git log（`git log --oneline` 查對應 commit）。**收尾覆寫本檔，紅線 ≤150 行**。
> **定位 SoT ＝ `production/positioning-v2-2026-08-02.md`**——提任何功能/重構/UI 前**先讀**。

## 🔪 定位 v2 刪除期——主線已收工（2026-08-02 拍板，2026-08-06 執行完畢）

一句話：**Gambit 把你剛下完的那盤棋，變成明天的題目——而且不告訴你裡面有沒有東西。**
斷層＝**認知遷移**（學到的調用不出來），不是情緒問題。目標使用者第一位＝Eason 本人。

D1（棋誌）／D2（試煉外殼）／D4（棋憶敘事外殼）／D5（開局知識卡，縮小範圍）／D6（ProfileView）
皆已執行；D3（難度五檔）核實後判定原判死理由誤讀實作，Eason 拍板撤銷保留。全文見
`positioning-v2-2026-08-02.md` 的判決表與 git log（`d1..d6ad416` 區間）。

### 🔴 三個必須記住的陷阱（審查實測，別重新發現）

1. **題目供給率 ∝ 對手有多弱**：判斷場題目全來自 `selectMissedMates`（要求唯一解 mate-in-1），
   而 rung 1 有 60% 機率刻意送一手虧 100–300cp。
2. **MultiPV gap ≥150cp 當「有沒有東西」的訊號是壞的**：實測觸發率 7/10/30/15%，恆答「沒有」
   準確率 70–93%。正解＝chess.js 窮舉前瞻判定（`missed-mate.ts:44-58` 已有一半）。
3. **`data-sync.ts` 不是雲端層，是唯一的持久化層**：guest 佇列與 memory 的讀寫都是純 localStorage。
   要動必須先拆成 local-store ＋ cloud-adapter 兩層（v2 的 R1）。

## 已施工（push 狀態查 `git log origin/main..HEAD`；本輪 3 檔尚未 commit，見上方 STATUS）

- ✅ **health-check Q9 修復：訪客齒輪選單**（2026-08-06）：D6 把重置對局記錄／對局紀錄搬進
  `settings-menu.vue` 後訪客完全看不到入口（`app-nav.vue` 舊邏輯只在登入時掛 SettingsMenu，
  訪客只給一個「登入」連結）。底層 `resetHistory()`→`deleteGameHistory()` 本來就是
  guest-safe（`!userId` 時只清 localStorage、直接 return true），純粹缺 UI 入口。
  修法：SettingsMenu 一律掛載，登出鈕加 `v-if="authStore.userId"` 蓋掉；`app-nav.vue` 訪客
  同時保留「登入」CTA 與齒輪並排（不互斥）。補 2 條 guest-mode 測試，vitest 786→788 綠、
  typecheck 0、桌機/手機截圖驗過(截圖已清)。

- ✅ **noir（玄夜）深色主題整組下架**（2026-08-06，Eason 拍板只留 cream+jade）：
  A/B demo 出過兩版提亮修法都不滿意，直接砍掉整套雙主題系統，不修了。刪 `src/lib/theme.ts`
  （resolveTheme/applyTheme/persistTheme/systemTheme/pickNewer 全部）；`ui-store.ts` 移除
  `theme`/`setTheme`/`reconcileOnLogin`；`App.vue` 移除對應 watcher 呼叫；`data-sync.ts` 移除
  `loadThemePreference`/`upsertThemePreference`；`main.ts` 移除啟動時 `applyTheme(resolveTheme())`；
  `settings-menu.vue` 齒輪選單外觀切換段整段拿掉（現只剩對局紀錄／重置對局記錄／登出三項）；
  `main.css` 移除 16 個 `[data-theme='noir']` 規則區塊、`colors_and_type.css` 移除 noir 設計說明
  ＋token 區（193-314 行）；`CLAUDE.md` Pre-Push Checklist 的雙主題截圖要求改單一 cream。
  **Supabase 不動 schema**：`user_preferences` 表（唯一欄位是 theme）保留但不再讀寫，比照
  D1/D2 的 `dungeon_progress`/`journal_entries` 先例變孤兒表，不 drop、不改 CHECK constraint。
  刪 `tests/unit/lib/theme.test.ts`；`ui-store.test.ts`/`settings-menu.test.ts` 移除主題相關測試。
  vitest 784 綠、typecheck 0、e2e 78 過/24 skip（像素回歸 CI 本就 skip）/0 fail、截圖驗證
  cream/mobile+desktop 皆正確、無黑色 fallback。
  **蒸餾**：A/B demo 拿去問使用者前，先用瀏覽器 computed style 或獨立元素截圖驗證注入的樣式
  真的有視覺差異（第一版提亮量太小、螢幕截圖裡幾乎看不出來，白白讓 Eason 看了一輪沒用的比較）。

- ✅ **D6 ProfileView 整頁下架**（2026-08-06）：核實 SoT 原案時發現漏搬兩項真功能——
  `authStore.signOut()` 和 `/history` 連結都只有 ProfileView 一個入口。新建 `settings-menu.vue`
  （reka-ui Popover）取代 header 帳號圖示；`src/components/ui/popover/`（reka-ui 家族，跟既有
  dialog 同源）。砍 `ProfileView.vue`、`/profile` 路由、對應測試與 baseline 截圖。
  **蒸餾**：SoT 寫「先搬 X、Y 再刪」時，這份清單本身可能不完整——砍一整頁前要自己重新掃一次
  「這頁裡還有什麼函式呼叫／連結是全站唯一入口」。

- 🔎 **push 前 precommit-review（deep，runId `wf_9ab87010-2ba`）**：3 條 confirmed 全修（觸控目標、
  零測試覆蓋補測試、`parse-inline-markdown.ts` 孤兒回報後 Eason 裁決一起刪）。
- ✅ **D5 開局知識卡刪除（縮小範圍）**：opening-id／chess-openings 保留（D7 復活後
  `GameExportCard.vue` 靠它產生 PGN Opening/ECO header），只刪真死碼四項。
  **蒸餾**：跨 D 項的判死決策會互相連動，改任一項前查一下同名單有沒有更晚拍板的關聯項目。
- 🚫 **D3 難度五檔→一檔，撤銷**：原判死理由誤讀實作（`fallible` 犯錯參數本來就五檔不同，
  不是啞彈），選單保留、程式碼零改動。
- ✅ **D1 棋誌＋D2 試煉外殼下架**（2026-08-05）：42 檔約 3,100 行；練習模式（30 題）留下。
- ✅ **D4 棋憶敘事外殼下架**：`MemoryGameSummary` 只寫不讀，登記進 technical-preferences.md
  Deferred Cleanups（複查期限 2026-11-06）。
- 🔴 **像素回歸容差**已收緊到 0.005；本機需自己補跑 `npx playwright test visual-regression`。
- ✅ **匯出這盤棋接上 UI**（D7 撤銷復活）：`GameExportCard.vue` 掛在 `MemoryDashboard`。
- 🔴 **賽後檢討看不見「該殺沒殺」**：cpLoss 對將殺不敏感，第三種訊號候選（mate distance，非 cp）。

## 未決 / 待辦

- **像素回歸的 CI 盲區**：`toHaveScreenshot` 在 CI 是 skip 的，動 UI 後本機要自己跑。
- **missed-mate 從 mate 擴到 material**（v2 的 P2）：若既有對局跑 `selectMissedMates` 產出
  ≥1 題比例 <30%，主路徑必須先擴到 material 才成立。**2026-08-06 查過 Eason 現有對局數＝
  個位數**，樣本太小量出來的比例不可信，暫緩建離線量測腳本；等對局數自然累積後再跑。
- v2 末尾另有 8 題待答（棋力現況、下棋 vs 寫 app 時數比、四週對照實驗、自用產品的驗收條件等）。

## 護欄備忘

- **Stockfish 無旋鈕可製造初學者級失誤**：要它犯錯只能在引擎外面做（`fallible-pick.ts`）。
  讓子（material odds）已否決，勿再提案。
- Supabase keep-alive workflow 每 3 天打實表查詢；**GitHub 政策 repo 60 天無 commit 自動停用**。
- Maia（人類化 NN 引擎）＝日後「陪練角色」的答案，現在不做。

## 接手必讀（鐵則不在這個檔）

長期規則與技術參考都在 **CLAUDE.md 與它 `@`-include 的 docs**，每次 session 自動載入：

- **CLAUDE.md**：技術棧、CI Node 26 鎖、push guardrail、部署 base path、E2E 盲區、棋理護欄、
  視覺設計 SoT（全 app 棋盤＝Wood12+Gioco；主題僅 cream+jade，noir 已下架）、教練人格 Neve、
  西洋棋用語、Pre-Push Checklist。
- **`.claude/docs/technical-preferences.md`**：測試規範、Board/chessground gotchas、Deferred Cleanups。
- 設計 SoT＝`design/gambit-design-system/`；Supabase migration＝`supabase/README.md`；
  lib/ vs modules/ 判準＝**ADR-0015**。
- **Supabase MCP**：stdio、user scope、**read-only**、`--project-ref=vfnzekqtvxhewifnmtnz`、
  token 走 `$env:SUPABASE_ACCESS_TOKEN`；需重開 Claude Code 才 Connected。
- ~~Gambit-noir 平行 worktree~~：2026-08-06 查證，這台機器上 `git worktree list` 只有主工作樹，
  無此 worktree 也無對應分支——筆記過時或指的是另一台機器，不要再假設它存在。
