<!-- STATUS -->
Epic: 定位 v2 刪除期
Feature: 照死刑名單砍 src ~3,100 行、tests ~1,400 行、文件 ~37,000 行
Task: ✅ 零風險四項＋✅ 判斷場搬遷＋✅ 像素回歸閘＋✅ D1 棋誌＋✅ D2 試煉外殼＋✅ **D4 棋憶敘事外殼**。
**下一步＝D3 難度五檔→一檔**，再依序 D5 → D6。
⚠️ 動 engine 解析層時注意：`handshake.ts` 寫死 `MultiPV 1` 且與 review 分析路徑共用，勿污染分析。
<!-- /STATUS -->

> **交接快照**：只留現況＋待辦＋未固化決策；施工細節在 git，歷史輪次全文在
> `archive-2026-07.md`。**收尾覆寫本檔，紅線 ≤150 行**（超線 hook 會叫）。
> **定位 SoT ＝ `production/positioning-v2-2026-08-02.md`**——提任何功能/重構/UI 前**先讀**。

## 🔪 定位 v2 已拍板，進入刪除期（2026-08-02）

一句話：**Gambit 把你剛下完的那盤棋，變成明天的題目——而且不告訴你裡面有沒有東西。**
斷層＝**認知遷移**（學到的調用不出來），不是情緒問題。目標使用者第一位＝Eason 本人。
第一筆資料：失敗類型比例 **5:2:3**（沒看到／算不出／評估偏），全在 rung 1。

### 施工順序（依賴決定，不可調換）——1-4 已完成，見下方「已施工」

5. **D3 難度五檔→一檔**（保留 `fallible-pick.ts`）——下一步。
6. **D5 開局知識卡＋opening-id＋`chess-openings` 依賴**。
7. **D6 ProfileView 整頁**——主題切換與 `reset-history-dialog` 先搬進 header 齒輪再刪。

### 🔴 三個必須記住的陷阱（審查實測，別重新發現）

1. **題目供給率 ∝ 對手有多弱**：判斷場題目全來自 `selectMissedMates`（要求唯一解 mate-in-1），
   而 rung 1 有 60% 機率刻意送一手虧 100–300cp。這是 D3 挑窗口值時的真正決策點（v2 的 P3）。
2. **MultiPV gap ≥150cp 當「有沒有東西」的訊號是壞的**：實測觸發率 7/10/30/15%，恆答「沒有」
   準確率 70–93%。正解＝chess.js 窮舉前瞻判定（`missed-mate.ts:44-58` 已有一半）。
3. **`data-sync.ts` 不是雲端層，是唯一的持久化層**：guest 佇列與 memory 的讀寫都是純 localStorage。
   要動必須先拆成 local-store ＋ cloud-adapter 兩層（v2 的 R1）。

## 已施工（已 commit、工作區乾淨；push 狀態查 `git log origin/main..HEAD`）

- ✅ **D4 棋憶敘事外殼下架**（2026-08-06）：刪 8 個表演層元件（Slideshow/Replay/EvalShapeChart/
  ReplayEvalChart/MomentCard/MomentSlideshowDoor/NeveCard/DotBand）＋`pgn-viewer.vue`＋
  `@lichess-org/pgn-viewer` 依賴＋`choreography/cross-game/templates/derive.ts`；`MemoryDashboard`
  重寫成只剩 判斷場路標／零狀態／匯出卡；`MemoryView` 砍掉 slideshow⇄replay 淺堆疊與 `?ply=` 深連結。
  **兩輪 precommit-review 抓到的真問題，已修**：① 砍 `MemoryReplay.vue` 時漏看它裡面唯一通往
  `/practice/:puzzleId` 的「練這個概念」連結，害 D2 保留 `PracticePuzzleView` 的唯一理由斷了——
  修法＝把連結移到判斷場收尾卡（`RecognitionFieldView` → `DeepeningWrapUp` 新增 `practiceHref`
  prop，只在 `?source=recognition` 路徑出現，接 `candidates('mate', puzzles)`，補了兩條 route-handoff
  測試）。② `MemoryGameSummary`（stageCounts/conceptCounts）沒了 `pickNeveLine` 這個唯一讀者後變
  真·只寫不讀——已依專案慣例登記進 `technical-preferences.md` 的 Deferred Cleanups（複查期限
  2026-11-06，具名候選消費端＝「該殺沒殺」第三種訊號或 P2 material 擴展）；寫入路徑（`recordGame`/
  `recordSummary`）刻意保留不刪，避免砍過的資料出現斷層。連帶清掉 `classify.ts` 的
  `selectMistakeSignposts`/`ClassifiedMistake`、`MISTAKE_CONCEPT_MAX_LINKS`、`memory-config.ts` 的
  F2/F4/動畫旋鈕（全部零呼叫點的孤兒）。vitest 811 綠、typecheck 0、e2e chromium 全綠（webkit 有
  browserContext 啟動逾時的環境級 flake，與本次改動無關）。**`describe.ts` 仍是刻意保留的孤兒**
  （SoT 明列保留，唯一消費端隨 D4 一起刪，但屬於「可能被未來訊號重用的純函式」，非死碼）。

- 🔎 **push 前 deep review 收斂（D2 那輪，runId `wf_358bd846-92d`，22 條 confirmed）**：修了 12 條，
  真 bug 一條（多手題吃過提示仍誤報完成，已修並補一次性遷移）。細節見 git log。
- ✅ **D1 棋誌＋D2 試煉外殼下架**（2026-08-05）：42 檔約 3,100 行；試煉地圖/進度/難度選單一起砍，
  練習模式（30 題）留下。`journal_entries`/`dungeon_progress` 表保留未 drop。細節見 git log。
- 🔴 **像素回歸容差**已從 0.02 收緊到 0.005（2026-08-05）；本機需自己補跑
  `npx playwright test visual-regression`（CI 對此 skip）。
- ✅ **匯出這盤棋接上 UI**（2026-08-05，D7 撤銷復活）：`GameExportCard.vue` 掛在
  `MemoryDashboard` COMPLETE 分支——這是 D4 唯一保留的「棋帶出去跟 AI 討論」通道。
- 🔴 **賽後檢討看不見「該殺沒殺」**（2026-08-05 用真實對局量出來，未修）：cpLoss 對將殺不敏感，
  是繼 P2 之後的第三種訊號（mate distance，非 cp）——見上方 D4 條目的 Deferred Cleanup 候選用途。

## 未決 / 待辦

- **像素回歸的 CI 盲區**：`toHaveScreenshot` 在 CI 是 skip 的。動到任何 UI 後本機要自己跑
  `npx playwright test visual-regression`。
- **`HomeView.vue` 續玩卡印 raw Skill Level**：D3 砍成一檔後這行連同難度選單一起消失，不必單獨修。
- **missed-mate 從 mate 擴到 material**（v2 的 P2）：若對既有對局跑 `selectMissedMates` 產出 ≥1 題的
  比例 <30%，主路徑必須先擴到 material 才成立。
- v2 末尾另有 8 題待答（棋力現況、下棋 vs 寫 app 時數比、四週對照實驗、自用產品的驗收條件等）。

## 護欄備忘

- **Stockfish 無旋鈕可製造初學者級失誤**（2026-08-01 實測定案）：要它犯錯只能在引擎外面做
  （`fallible-pick.ts`）。抄 lichess 的 `Skill Level -9/-5/-1` 是死路——引擎宣告
  `spin min 0 max 20`，越界整段拒收、實際停在滿血 20。讓子（material odds）已否決，勿再提案。
- Supabase keep-alive workflow 每 3 天打實表查詢（免費層 7 天無活動即暫停）。**GitHub 政策：repo
  60 天無 commit 自動停用 scheduled workflow**。
- Maia（人類化 NN 引擎）＝日後「陪練角色」的答案，現在不做（要第二套 runtime，最低 1100 仍偏強）。

## 接手必讀（鐵則不在這個檔）

長期規則與技術參考都在 **CLAUDE.md 與它 `@`-include 的 docs**，每次 session 自動載入：

- **CLAUDE.md**：技術棧、CI Node 26 鎖、push guardrail、部署 base path、E2E 盲區、棋理護欄、
  視覺設計 SoT（全 app 棋盤＝Wood12+Gioco）、教練人格 Neve、西洋棋用語、Pre-Push Checklist。
- **`.claude/docs/technical-preferences.md`**：測試規範、Board/chessground gotchas、
  **Deferred Cleanups**（含本輪新增的 `MemoryGameSummary` 條目）。
- 設計 SoT＝`design/gambit-design-system/`；Supabase migration＝`supabase/README.md`；
  lib/ vs modules/ 判準＝**ADR-0015**。
- **Supabase MCP**：stdio、user scope、**read-only**、`--project-ref=vfnzekqtvxhewifnmtnz`、
  token 走 `$env:SUPABASE_ACCESS_TOKEN`；需重開 Claude Code 才 Connected。
- **Gambit-noir 平行 worktree** 共用同 origin：加 Supabase migration 時編號接續現有最大值
  （已到 202608305xxxxx，非真日期）。
