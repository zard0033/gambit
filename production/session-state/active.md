<!-- STATUS -->
Epic: 定位 v2 刪除期主線已收工；本輪接**賽後檢討的可見性**（moments 有算沒顯示），已收尾
Feature: 賽後關鍵步清單（棋憶頁）— 已 push；AC-7／棋盤朝向兩項疑慮已實測排除，非 bug
Task: 關鍵步清單「比對＋理由」spec 已核可（見待辦，第一波待實作，尚未動工）；判斷訓練最小版
  dev-flow 釐清階段拍板中途暫停（Q1/Q1b/Q2 已拍板，Q3 起待續）
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

## 已施工（push 狀態查 `git log origin/main..HEAD`）

- ✅ **賽後關鍵步清單**（2026-08-06 push `c558b6e`；2026-08-07 補黑方回歸測試 `3293d96`）：
  新增 `modules/memory/moment-display.ts` ＋ `components/memory/KeyMomentsCard.vue`，掛進
  `MemoryDashboard` 的 isComplete 分支。vitest 801 綠、typecheck 0、E2E 0 fail、截圖驗過。
  precommit-review deep `wf_73687f35-343` 零 confirmed 真缺陷。
  **兩個別再踩的點**：① 判準用「玩家走的 === bestMove」，**不可**用 Moment 的 `kind`——
  `displayKind` 把 anchor 和 bright 都壓成 `'bright'`，拿 kind 反推會把最大失誤誤認成好棋。
  ② `chess-board.vue` 初始 lastMove 已改在 `onBoardCreated` 補套（watch 沒 `immediate` 且註冊時
  boardApi 不存在）——別退回純 watch。
  遺留疑慮 AC-7 與棋盤朝向已於 2026-08-07 實機走查排除（僅 1 盤黑棋樣本，非系統性）。
  **蒸餾**：① 單元測試綠不等於畫面對——凡「初始狀態就該生效」的 imperative 設定，都要懷疑它
  有沒有搭上 watch。② 帶著「可能是既有 bug」的疑慮進下一輪前，先花 10 分鐘實機重現一次。

- ✅ **health-check Q9 修復：訪客齒輪選單**（2026-08-06）：D6 把重置對局記錄／對局紀錄搬進
  `settings-menu.vue` 後訪客完全看不到入口（`app-nav.vue` 舊邏輯只在登入時掛 SettingsMenu，
  訪客只給一個「登入」連結）。底層 `resetHistory()`→`deleteGameHistory()` 本來就是
  guest-safe（`!userId` 時只清 localStorage、直接 return true），純粹缺 UI 入口。
  修法：SettingsMenu 一律掛載，登出鈕加 `v-if="authStore.userId"` 蓋掉；`app-nav.vue` 訪客
  同時保留「登入」CTA 與齒輪並排（不互斥）。補 2 條 guest-mode 測試，vitest 786→788 綠、
  typecheck 0、桌機/手機截圖驗過(截圖已清)。

- ✅ **noir 深色主題整組下架**（2026-08-06，只留 cream+jade）：刪 `src/lib/theme.ts` 全套 +
  相關 store/main.ts/settings-menu 讀寫點；`user_preferences` 表孤兒化不 drop。細節查 git log。
  **蒸餾**：A/B demo 給使用者看前，先用截圖/computed style 驗證注入樣式真的有視覺差異。

- ✅ **D6 ProfileView 整頁下架**（2026-08-06）：搬 `authStore.signOut()`／`/history` 連結進新建
  `settings-menu.vue`（reka-ui Popover），砍 `ProfileView.vue`／`/profile` 路由。
  **蒸餾**：砍整頁前重新掃一次「這頁裡還有什麼是全站唯一入口」，SoT 清單可能不完整。

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

- 🆕 **關鍵步清單「比對＋理由」——spec 已核可（2026-08-07），待實作**：`KeyMomentsCard` 目前
  每項只顯示一手（SAN 記號），Eason 要並排比對「原本走法 vs 建議走法」＋一句理由。
  **關鍵發現：不是從零蓋，是復原**——D4（2026-08）刪棋憶敘事外殼時連坐砍掉的
  `modules/memory/templates.ts`(`renderMoment()`，zero-AI 純模板，吃 `Moment.kind`/`concept`
  產生 Neve 語氣理由句) 與 `choreography.ts`(`momentEndState()`，兩手同時箭頭+highlight 定格)，
  在 git 歷史裡（`e2cb898~1`）完好，相容性已核對：`Moment`/`MEMORY_BRIGHT_GATE`/
  `annotation-types.ts` 三者皆未變動，可原封復原接線；`describe.ts`(白話文轉換) 甚至沒被刪、
  現在還活著沒人用。動畫用的 4 個 `ANIM_*` 時間常數當時被砍，要補回 `memory-config.ts`。
  **第一波 spec(已核可)**：復原 `templates.ts`(只留 `renderMoment`/`MoveDesc`/`MomentText`，
  `renderNeveLine` 是死掉的 F4 不復原) + `describe.ts` 接線；`moment-display.ts` 擴充成兩手都算
  白話文(取代 SAN，全站僅此一處使用 SAN 列表)；`KeyMomentsCard.vue` 顯示並排+理由句，棋盤用
  `momentEndState()` 靜態雙標(不做動畫，動畫留第二波，因手感需真機驗證);`own` 案例也顯示理由
  (renderMoment 對 bright/plain 都有話講，非新增範圍)；材料類理由先用籠統版(不含「哪顆子」，
  舊碼本身也沒做完這塊，獨立記債不卡這波)。走 ui-design-flow 出樣張確認白話文取代 SAN。
- 🔜 **判斷訓練最小版——dev-flow 釐清階段拍板中途暫停**（先前只活在
  `positioning-v2-2026-08-02.md`「核心新功能」段，2026-08-07 走 `grilling` 開始拍板）：
  **已拍板**——Q1 不可取代好處成立（訓練長在自己的棋上，lichess 做不到）；Q1b v1 只用自己
  對局出題，公版題庫（練敏銳度/判斷力，Eason 認為市面無此類產品）記為獨立未來擴充、不進 v1；
  Q2 這是主線，且是目前唯一還沒蓋出來的主線。**待續（從 Q3 開始）**：現在不做去做別的事會
  不會更值得（Jobs 視角）、Q12 驗收條件、Q10 難度/fallible 衝突、範圍(mate-only vs
  強制贏子)、互動確認(純聲明不指認)、跟既有判斷場的關係、對照表 UI 位置。
  規格草稿與成本估算(~150 行、chess.js 窮舉不開引擎)見 positioning-v2 原段。
- **像素回歸的 CI 盲區**：`toHaveScreenshot` 在 CI 是 skip 的，動 UI 後本機要自己跑。
- **missed-mate 從 mate 擴到 material**（v2 的 P2）：若既有對局跑 `selectMissedMates` 產出
  ≥1 題比例 <30%，主路徑必須先擴到 material 才成立。**2026-08-06 查過 Eason 現有對局數＝
  個位數**，樣本太小量出來的比例不可信，暫緩建離線量測腳本；等對局數自然累積後再跑。
- v2 末尾另有 8 題待答（棋力現況、下棋 vs 寫 app 時數比、四週對照實驗、自用產品的驗收條件等）。

## 護欄備忘

- **Stockfish 無旋鈕可製造初學者級失誤**：要它犯錯只能在引擎外面做（`fallible-pick.ts`）。
  讓子（material odds）已否決，勿再提案。
- Supabase keep-alive workflow 每 3 天打實表查詢；**GitHub 政策 repo 60 天無 commit 自動停用**。
- **Maia（人類化 NN 引擎）＝日後「陪練角色」；2026-08-07 查證，「要後端所以不做」的前提已翻案**：
  **只有 Maia-1 可行**——官方 ONNX ~3.3MB／級距（9 檔 Elo 1100–1900），官方前端
  `csslab/maia-platform-frontend` 已用 `onnxruntime-web` 純 client-side 跑它並與 WASM Stockfish 並存，
  無後端、無 SharedArrayBuffer。權重 GPL-3.0（本 repo public+MIT，摩擦小）。
  **Maia-2／3 不走**：無官方 ONNX，要自己 `torch.onnx.export`＋驗數值＋量化；Maia-3 是 AGPL，
  體積 5M 版 20.97MB／23M 版 91.8MB（float32），23M 直接超出 150MB 預算。又：Maia-2 的「單一模型
  涵蓋全棋力」對 web 是**退步**——一次只下一檔，Maia-1 的分檔小模型才能只載要的那個。
  **綠燈後第一驗證項**：查官方前端怎麼從 policy head 取手。**若是 argmax，實際棋力會高於標稱 Elo、
  失誤遠少於真人**（單一失誤本身低機率），要 temperature sampling 才有真實失誤率——
  此項未驗證前不可假設「Maia-1100 會像真的 1100 一樣送子」。
  次要未知：Maia-1 最弱 1100，現行 rung 1 實際 Elo 也沒量過，誰強誰弱不知道
  （可能形狀＝混合：rung 1 留 fallible-pick、2–5 走 Maia）。
  **假說（未量測，不可當換引擎的理由）**：`fallible-pick` 刻意避開送子（`maxLossCp` 300 上限、
  過濾器排除我方被將死），**結構性地不會走進 mate-in-1**，真人 1100 會 → Maia 或許能改變判斷場的
  題目供給特性（見陷阱 #1）。但供給率至今沒量過，且 P2 是同一問題成本低得多的既定解法。
  **決策歸屬**：不開獨立線，折進暫停中的判斷訓練 grilling（Q3、Q10 本來就以此為輸入）；
  規格不該跟 fallible-pick 行為硬耦合。

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
