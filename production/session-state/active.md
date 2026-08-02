<!-- STATUS -->
Epic: 定位 v2 刪除期
Feature: 照死刑名單砍 src ~3,100 行、tests ~1,400 行、文件 ~37,000 行
Task: ✅ 零風險四項已完成（238 檔刪除、25,566 行）。**下一步＝判斷場搬遷（前置）**，
它會動路由與 mount 時序 → 走 dev-flow ＋ 補跑 E2E。順序見下方，不可調換。
⚠️ 動 engine 解析層時注意：`handshake.ts` 寫死 `MultiPV 1` 且與 review 分析路徑共用，勿污染分析。
<!-- /STATUS -->

> **交接快照**：只留現況＋待辦＋未固化決策；施工細節在 git，歷史輪次全文在
> `archive-2026-07.md`。**收尾覆寫本檔，紅線 ≤150 行**（超線 hook 會叫）。
> **定位 SoT ＝ `production/positioning-v2-2026-08-02.md`**——提任何功能/重構/UI 前**先讀**。
> （舊 `gambit-differentiation-vision.md` 的問題定義已作廢，只剩氣質面有效；D10 會刪掉它三節。）

## 🔪 定位 v2 已拍板，進入刪除期（2026-08-02）

一句話：**Gambit 把你剛下完的那盤棋，變成明天的題目——而且不告訴你裡面有沒有東西。**
其餘（課程／題庫／回放／賽後分析／開局資料）lichess 都免費且更好；那條唯一抄不走的路**已經跑得起來**
（`modules/learning-loop/recognition-runtime.ts`），缺口是只涵蓋 fork/mate 2/8 概念、只在課後觸發、
且 runtime 那條沒有誘餌（`recognition-runtime.ts:24` 每盤 `kind:'real'`，答案恆為「有」）。

**問題陳述**：斷層＝**認知遷移**（學到的調用不出來），不是情緒問題。「新手覺得自己笨」是症狀。
目標使用者第一位＝Eason 本人；定位第一段兩個目標都寫（A 學棋／B 有一個值得做的工程專案）。
第一筆資料：失敗類型比例 **5:2:3**（沒看到／算不出／評估偏），全在 rung 1，量級足以定方向。
商業模式與「對標 Calm、怎麼贏 chess.com」整組作廢。

### 施工順序（依賴決定，不可調換）

1. ~~**零風險四項**~~ ✅ **2026-08-02 完成**：`use-game-export.ts`＋`tier-delivery.test.ts`
   （`assembler.ts` 保留——`data-sync.ts:59` 靠它寫雲端 PGN）／variants 輪替機制拔除、
   已深化概念不再給行動召喚（`variants[0]` 直取，資料結構未攤平＝v2 明令不動 `index.ts`）／
   `production/{epics,qa,sprints,gate-checks}`＋49 個 design HTML 共 236 檔（`session-state/` 已排除；
   `session-log.md` 是 gitignored 無 git 保護，**搬到 scratchpad 未刪**）／vision 三節切除 239→152 行。
   合計 238 檔、25,566 行。vitest 944 綠、typecheck 0 error。
2. **判斷場搬出 `/learn/concept/:conceptId` 給自己的路由**（前置，先做）。不先搬，砍 D2/D4 會讓主路徑
   完全不可達——它唯一入口是 `MemoryDashboard.vue:41` 掛的 `RecognitionSignpost.vue:36`。
   拆頁時注意 `lessonUnaided` 串著 epiphany 判定（`settle.ts:91-95`），D1 未先執行會靜默漏發。
3. **D1 棋誌整組**（保留 `lib/persona-lint.ts`，`modules/memory/persona-lint.ts:9` 在用）。
   **須早於任何 game-history 動作**（`stores/journal.ts:6`）。
4. **D2 試煉關卡外殼**（保留 `src/data/puzzles/` 30 題）。注意只有 26 題能直接餵 `RecognitionBoard`——
   4 題 mate-in-2 無法用 `types/recognition.ts:25-28` 的單一 `expectedMove` 表達。
5. **D4 棋憶敘事外殼**（**保留 `MemoryDashboard.vue`**＝主路徑的門，另保留 describe/selection/
   summary/missed-mate/post-game-review）。`pgn-viewer` 與 `@lichess-org/pgn-viewer` 同批退役。
6. **D3 難度五檔→一檔**（保留 `fallible-pick.ts`）。
7. **D5 開局知識卡＋opening-id＋`chess-openings` 依賴**。
8. **D6 ProfileView 整頁**——主題切換（`:198-209`，`uiStore.setTheme` 唯一 UI）與 `reset-history-dialog`
   （`:78` 唯一掛載點）**先搬進 header 齒輪**再刪。

### 🔴 三個必須記住的陷阱（審查實測，別重新發現）

1. **題目供給率 ∝ 對手有多弱**：判斷場題目全來自 `selectMissedMates`（要求唯一解 mate-in-1），
   而 rung 1 有 60% 機率刻意送一手虧 100–300cp。關掉 fallible 訊號才乾淨、但主路徑會餓死；不關則練成
   「認出引擎故意送的子」。這是 D3 挑窗口值時的真正決策點（v2 的 P3，隨 D3 一起量）。
2. **MultiPV gap ≥150cp 當「有沒有東西」的訊號是壞的**：實測觸發率 7/10/30/15%，開局中局可為 0，
   恆答「沒有」準確率 70–93%。它量的是最佳手唯不唯一——兩手都能贏子時 gap≈0，正好在戰術最豐富處
   關掉自己。正解＝chess.js 窮舉（`missed-mate.ts:44-58` 已有一半，另一半「有沒有強制贏子」要新寫
   前瞻判定，**不能**沿用 `classify.ts:57-92`，那支是事後判定）。
3. **`data-sync.ts` 不是雲端層，是唯一的持久化層**：`:286-300`／`:513`／`:537`／`:635` 是純
   localStorage 讀寫，`game-history`／`journal`／`memory` 全靠它。砍它＝失去本機儲存，不是失去跨裝置。
   要動必須先拆成 local-store ＋ cloud-adapter 兩層（v2 的 R1）。

## 已施工（本輪，未 commit）

- ✅ **完局屏改版**（`PlayView.vue`）：Neve 頭像＋署名＋font-lesson 講評；主按鈕改
  「我陪你看看剛剛那一步」→ `/review`，再來一局降次要、返回首頁降文字連結。文案改兩句。
  verifier 11/11 PASS（雙尺寸截圖、按鈕 44px、`/review` 實載入）；vitest 957 綠、typecheck 0 error。
- ✅ **vision 開頭加「2026-08-02 修訂」節**（D10 會把它連同三節一起收斂進 v2）。
- 📄 `production/health-check-2026-08-02.md`（體檢，15 條指控推翻 5 條——**推翻那節要讀**）；
  `production/positioning-v2-2026-08-02.md`（定位 SoT，含死刑／緩刑名單與 5 條可證偽預測）。

## 未決 / 待辦

- **`HomeView.vue:109`** 的 `Lv.{{ resumeInfo.level }}` 印 raw Skill Level，違反「不顯示 Skill Level
  數值」。D3 砍成一檔後這行連同難度選單一起消失，**不必單獨修**。
- **missed-mate 從 mate 擴到 material**（v2 的 P2）：若對既有對局跑 `selectMissedMates` 產出 ≥1 題的
  比例 <30%，主路徑必須先擴到 material 才成立。這是題目供給的第二個旋鈕。
- **底部 tab 三格→兩格**：技術可行，D2/D6 砍完會空出兩格，屆時一起處理。
- v2 末尾另有 8 題待答（棋力現況、下棋 vs 寫 app 時數比、四週對照實驗、自用產品的驗收條件等）。

## 護欄備忘

- **Stockfish 無旋鈕可製造初學者級失誤**（2026-08-01 實測定案）：skill 0／`go nodes 1`／
  `UCI_Elo 1320`／depth 限制四維度全部照吃白送的子。**要它犯錯只能在引擎外面做**（拿到 bestmove
  後換手＝`fallible-pick.ts`）。**抄 lichess 的 `Skill Level -9/-5/-1` 是死路**——引擎宣告
  `spin min 0 max 20`，越界整段拒收、實際停在滿血 20。讓子（material odds）已否決，勿再提案。
- Supabase keep-alive workflow 每 3 天打實表查詢（免費層 7 天無活動即暫停；暫停的專案連 DNS
  都消失——NXDOMAIN ≠ 被刪）。**GitHub 政策：repo 60 天無 commit 自動停用 scheduled workflow**。
- Maia（人類化 NN 引擎）＝日後「陪練角色」的答案，現在不做（要第二套 runtime、最低 1100 仍偏強）。

## 接手必讀（鐵則不在這個檔）

長期規則與技術參考都在 **CLAUDE.md 與它 `@`-include 的 docs**，每次 session 自動載入：

- **CLAUDE.md**：技術棧、CI Node 26 鎖、push guardrail、部署 base path、E2E 盲區、棋理護欄、
  視覺設計 SoT（全 app 棋盤＝Wood12+Gioco）、教練人格 Neve、西洋棋用語、Pre-Push Checklist。
- **`.claude/docs/technical-preferences.md`**：測試規範（@spike、Node26 shim、vitest 快取假紅、
  chessground tap-to-move 可驅動、node 直驅 Stockfish 驗盤法、三條量測陷阱）、
  Board/chessground gotchas（viewOnly 兩層修法、stale bounds、PgnViewer CSS 汙染）、Deferred Cleanups。
- 設計 SoT＝`design/gambit-design-system/`；Supabase migration＝`supabase/README.md`；
  lib/ vs modules/ 判準＝**ADR-0015**。
- **Supabase MCP**：stdio、user scope、**read-only**、`--project-ref=vfnzekqtvxhewifnmtnz`、
  token 走 `$env:SUPABASE_ACCESS_TOKEN`；需重開 Claude Code 才 Connected。
- **Gambit-noir 平行 worktree** 共用同 origin：加 Supabase migration 時編號接續現有最大值
  （已到 202608305xxxxx，非真日期）。
