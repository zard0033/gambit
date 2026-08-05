<!-- STATUS -->
Epic: 定位 v2 刪除期
Feature: 照死刑名單砍 src ~3,100 行、tests ~1,400 行、文件 ~37,000 行
Task: ✅ 零風險四項＋✅ 判斷場搬遷＋✅ 像素回歸閘＋✅ **D1 棋誌**＋✅ **D2 試煉外殼**。
**下一步＝D4 棋憶敘事外殼**，再依序 D3 → D5 → D6。
⚠️ 動 engine 解析層時注意：`handshake.ts` 寫死 `MultiPV 1` 且與 review 分析路徑共用，勿污染分析。
<!-- /STATUS -->

> **交接快照**：只留現況＋待辦＋未固化決策；施工細節在 git，歷史輪次全文在
> `archive-2026-07.md`。**收尾覆寫本檔，紅線 ≤150 行**（超線 hook 會叫）。
> **定位 SoT ＝ `production/positioning-v2-2026-08-02.md`**——提任何功能/重構/UI 前**先讀**。
> （舊 `gambit-differentiation-vision.md` 的問題定義、競品框架、商業模式三節**已於 2026-08-02 切除**，
> 只剩氣質面有效：Neve 人格、平靜不遊戲化、安靜文學式、沉浸感、平台路徑、「課程長在你自己的棋上」。）

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

1. ~~**零風險四項**~~ ✅ **2026-08-02**：238 檔、25,566 行（`production/{epics,qa,sprints,gate-checks}`
   ＋49 個 design HTML ＋ variants 輪替 ＋ vision 三節）。🔙 其中 **D7 已於 2026-08-05 撤銷**——
   `use-game-export.ts`＋`tier-delivery.test.ts` 復活，匯出接上 UI 後是保留項目。
2. ~~**判斷場搬出獨立路由**~~ ✅ **2026-08-03**：`/learn/concept/:conceptId/judge` →
   `RecognitionFieldView.vue`；`unaided` 改用 query 跨路由傳遞，收尾卡抽成 `DeepeningWrapUp.vue`。
   **未完全解鎖 R2 的 catalog 刪除**——`deepening.essence` 仍依賴 `data/concept-deepening/index.ts`。
   `RecognitionSignpost.vue` 刻意不改（它推教學相位，改了會跳過課程）。
3. ~~**D1 棋誌整組**~~ ✅ **2026-08-05 完成**（見下方「已施工」）。
4. ~~**D2 試煉關卡外殼**~~ ✅ **2026-08-05 完成**（見下方「已施工」）。
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
3. **`data-sync.ts` 不是雲端層，是唯一的持久化層**：guest 佇列與 memory 的讀寫都是純 localStorage，
   `game-history`／`memory` 全靠它。砍它＝失去本機儲存，不是失去跨裝置。要動必須先拆成
   local-store ＋ cloud-adapter 兩層（v2 的 R1）。（行號原本寫死在這裡，D1/D2 刪過就不準了，故移除。）

## 已施工（已 commit、工作區乾淨；**本機領先 origin 4 個 commit，尚未 push**）

- 🔎 **push 前 deep review 收斂（runId `wf_358bd846-92d`，22 條 confirmed）**：修了 12 條。
  真 bug 只有一條——**多手題吃過提示仍顯示「完成」**：D2 刪掉 per-puzzle 的 sticky `hintUsed`
  改讀 `hintStage`，但後者在 `correct-advance` 每手歸零，第一手求助、第二手自解就誤報。單手題碰不到，
  所以 850 綠證明不了它。已還原 sticky flag。
  **舊試煉進度加了一次性遷移**（`pgr:dungeon:progress.solved` → `practiceSolved`，先 persist 才刪來源鍵，
  ＋3 條測試）——不遷移的話概念地圖的「已練」金幣會無聲退回未練。**但雲端 `dungeon_progress` 不遷移**
  （讀它的 data-sync 函式已隨 D2 移除，加回來不划算）：只在別台裝置解過的題不會回來，且**已練從
  cloud-synced 降級成 device-local**——這是 D2 的已知取捨，不是 bug。
  另修：練習頁返回改回上一頁（入口是棋憶，硬丟 `/learn` 會把人踢出脈絡）、nav indicator 寬度改由
  `NAV_ITEMS.length` 算（本輪已手改兩次）、systems-index 等 6 份 GDD 的 journal/DungeonScreen 死連結、
  learning-loop 兩支模組註解、signpost 測試的 route stub。
  **駁回 1 條**：reviewer 說 `--color-surface-dungeon` 已死——`PracticePuzzleView.vue:183` 還在用。
  **不修 4 條**：`/journal`、`/dungeon` 不加 redirect（已刪功能不留路由，NotFoundView 已優雅處理）；
  `surface-dungeon` token 不改名（cascade 到 light/noir 兩塊＋view，純語彙）；HomeView 零單元測試
  （e2e 結構不變量已涵蓋掛載與 JS 例外）；`chess:journal:*` 本機鍵不清（與保留雲端表同一立場）。

- ✅ **D2 試煉外殼下架，練習模式留下**（2026-08-05）：**名單原本要連 `DungeonPuzzleView` 一起刪，
  Eason 拍板只砍外殼**——那個 view 同時是棋憶回放「練這個概念」路標的唯一出口，落在保留軸上。
  刪：`DungeonMapView`(285)、`stores/dungeon-progress`(158)、`data-sync` 的 dungeon 兩支、`/dungeon`
  路由、底部 tab 的試煉格（indicator `w-1/3`→`w-1/2`）、首頁**整個總覽區**（砍完只剩一張學習進度卡，
  而 hero 卡已經有同一條 0/21 進度）、地圖的死 CSS 與 8 個孤兒 token（map-tile-*／map-trail／
  surface-dungeon-2／棋誌遺留的 texture-paper-grain）。
  改名：`modules/dungeon`→`modules/practice`、`useDungeonPuzzle`→`usePuzzle`、`dungeon-tuning`→
  `practice-tuning`、`DungeonPuzzleView`→`PracticePuzzleView`、路由 `/dungeon/:id`→`/practice/:id`。
  **`App.vue` 的 `routeKey` 也要跟著改**（它比對 route name `'puzzle'`，漏改就換題不重繪）。
  順修三處說謊文案：練習頁標題還寫「第 N 關」（地圖沒了，編號不指向任何東西）→ 改用題目標題；
  重置對話框說「不動棋誌與試煉進度」（兩者都已不存在）；棋憶路標按鈕「去試煉」→「練這個概念」。
  `ConceptMapView` 的**已練**來源從 `dungeonSolved ∪ practiceSolved` 收斂成只剩 practiceSolved。
  GDD 標「部分 superseded」並在標頭列出哪些死哪些活（解題本體仍有效）；`dungeon_progress` 表與
  migration 同 D1 處置＝保留未 drop。vitest 850 綠、typecheck 0、e2e 86 綠。

- ✅ **D1 棋誌整組下架**（2026-08-05）：42 檔、約 3,100 行。名單外自行裁定的三件——
  ① **`data-sync.ts` 的 journal 持久化層一併拔除**（`journalRowToEntry`／`journalEntryToRow`／
  `loadJournalEntries`／`appendJournalEntry`／`readLocalJournalEntries`／`flushJournalQueue`
  ＋兩個 localStorage key 常數），棋誌一死它就是純死碼；這不違反 R1，R1 擋的是砍 data-sync 本身。
  ② **Supabase `journal_entries` 表與 migration 保留未 drop**，資料還在。
  ③ **GDD／quick-spec／review-log 刪、ADR-0013 標 Superseded**；另刪 technical-preferences 的
  「新增棋誌筆種 pen 的標準路徑」整節——留著等於叫未來的 session 去接一個不存在的管線。
  **`concept-progress.deepenedUnaided` 刻意留著**（`ConceptDeepenView`／`RecognitionFieldView`
  仍在寫）：唯一消費端是死掉的 epiphany 筆，但它落在認知遷移軸上，是**目前唯一「無求助通關」的
  持久訊號**。現在是孤兒欄位，別當死碼誤刪。
  vitest 867 綠（原 964 減掉刪除的 97 個 it）、typecheck 0、e2e 92 綠。
- 🔴 **像素回歸容差原本鬆到會放行改版**（2026-08-05，已修）：`maxDiffPixelRatio` 原為 0.02，
  量到首頁少一整張 StatCard ＋一整列 peek 只有 **0.0213**——僅超標 6%，實際判過。根因是本站
  **奶油卡疊奶油底**，YIQ 色差小到多數變動像素不被計入，閘本身是好的（假基線驗過會紅）。
  收緊成 **0.005** 後另有 5 張一起轉紅＝0.02 一直藏著的既有漂移（diff 是卡片位移，非散點），全數重生。
  同輪另清掉 `/play` 兩張（基線停在舊的 Skill Level 0–20 UI，非 chromium 漂移）。
  **`/review` 不在路由表裡**——匯出卡無視覺守門。**收緊後仍抓不到純文字改動**，
  改到文案要自己 `--update-snapshots=all` 對一次。
- ✅ **匯出這盤棋接上 UI**（2026-08-05，D7 撤銷）：新 `GameExportCard.vue` 掛在 `MemoryDashboard`
  的 COMPLETE 分支末尾——選這裡是因為 `/review?gameId=` 同時服務「剛下完」與「對局紀錄點進來的
  過去某局」。復活 `use-game-export.ts`＋`tier-delivery.test.ts`；`MemoryContext` 加 `opening`。
  **桌機刻意繞過 Web Share**（`pointer: coarse` 分流）：ADR-0010 排它 Tier 1 只在 iPhone 對，桌機
  Chrome/Edge 也實作了它，按鈕寫「複製」卻跳出 Windows 分享面板。順修兩個既有 bug：句點疊字、
  `historyEntryToCompletedGame` 硬編 `endReason: 'resignation'` 害每局歷史都自稱投降。
- 🔴 **賽後檢討看不見「該殺沒殺」**（2026-08-05 用真實對局量出來，未修）：重點步用 cpLoss 選，
  而 **cpLoss 對將殺完全不敏感**（mate − mate = 0）。Eason 8/4 那盤，引擎第 21 手就看到 8 手內
  強制殺，他第 43 手才完成、11 手偏離最短路徑——**現有檢討完全看不到，只會說「你走得很穩」**。
  這是繼 P2（missed-mate 擴到 material）之後的**第三種訊號**：現有 `selectMissedMates` 管的是
  「放任被將死」，這裡要的是「該殺沒殺／殺得慢」，量的是 mate distance 不是 cp。
- ✅ **完局屏改版**（`PlayView.vue`）：Neve 頭像＋署名＋講評，主按鈕「我陪你看看剛剛那一步」→ `/review`。
- ✅ **vision 開頭加「2026-08-02 修訂」節**（D10 會把它連同三節一起收斂進 v2）。
- 📄 `production/health-check-2026-08-02.md`（體檢，15 條指控推翻 5 條——**推翻那節要讀**）；
  `production/positioning-v2-2026-08-02.md`（定位 SoT，含死刑／緩刑名單與 5 條可證偽預測）。

## 未決 / 待辦

- **像素回歸的 CI 盲區**：`toHaveScreenshot` 在 CI 是 skip 的（基線依平台而異），CI 只跑結構不變量。
  **動到任何 UI 後本機要自己跑** `npx playwright test visual-regression`。
- **`HomeView.vue` 續玩卡的 `Lv.{{ resumeInfo.level }}`** 印 raw Skill Level，違反「不顯示 Skill
  Level 數值」。D3 砍成一檔後這行連同難度選單一起消失，**不必單獨修**。（不寫行號——它會漂。）
- **missed-mate 從 mate 擴到 material**（v2 的 P2）：若對既有對局跑 `selectMissedMates` 產出 ≥1 題的
  比例 <30%，主路徑必須先擴到 material 才成立。這是題目供給的第二個旋鈕。
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
