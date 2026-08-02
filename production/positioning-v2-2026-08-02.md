# Gambit 定位 v2（2026-08-02）

> 取代 `gambit-positioning-draft.md`(v1) 與 `production/gambit-differentiation-vision.md` 的問題定義。v1 的三個核心主張已被實測與 repo 事實推翻：①「階段 1 察覺完全沒有」是事實錯誤；②第 1 步訊號（MultiPV ≥150cp）實測在開局中局觸發率 0；③「三層結構」只判死 0.65% 的 src。

---

## 一句話

**Gambit 把你剛下完的那盤棋，變成明天的題目——而且不告訴你裡面有沒有東西。**

其餘一切（課程、題庫、回放、賽後分析、開局資料）lichess 都做得更多、更好、免費。這句話是這個 repo 唯一抄不走的東西，而它已經跑得起來（`src/modules/learning-loop/recognition-runtime.ts`）。

---

## 問題陳述

斷層＝**認知遷移**：學到的知識在實戰中調用不出來。「新手覺得自己笨」是症狀不是根因。四階段模型（察覺／候選／計算／評估）**保留為假設、不當前提**——它抄自成人棋手自述，沒有在 Eason 身上量過。v1 問題表有一格是事實錯誤，改寫如下：

| 階段 | repo 現況（實測） |
| --- | --- |
| 1 察覺 | **已有 v1**：`data/concept-deepening/recognition.ts:16` 判斷場（6 盤含 2 誘餌、不預告有沒有答案）＋ `recognition-runtime.ts` 從玩家自己漏掉的將殺生成。缺口＝只涵蓋 fork／mate 2/8 概念、只在課後觸發、**runtime 那條沒有誘餌**（:24 每盤 `kind:'real'`，答案恆為「有」） |
| 2 候選 | 題庫 30 題（自 2026-06-23 未動） |
| 3 計算 | 全站零覆蓋 |
| 4 評估 | 21 課、8 個概念深化 |

所以這是**觸發點與覆蓋率問題（成本數百行）**，不是「要蓋一個新核心功能」（成本數千行）。差一個數量級。

### 已有的第一筆資料（2026-08-02 Eason 口述，本檔寫成後補入）

Eason 已下過數盤並回報失敗類型比例 **5:2:3**（完全沒看到／看到但算不出來／看到但覺得別手更好），
**全部在 rung 1**。三件事必須同時記住，否則這個數字會被用錯：

1. **分母不是 P1 要的那個。** 5:2:3 的分母是「棋憶指出我漏掉的那些手」，不是「所有存在機會的局面」。
   所以它算不出察覺**命中率**——它算的是**失敗類型的組成**。P1 仍未被回答，五盤紙筆實驗照跑。
2. **它仍然有結論**：在失敗裡察覺佔最大宗（約一半），且評估（3）比初學者的典型分佈高，值得單獨追。
3. **rung 1 讓這筆資料的題目來源本身是人造的。** `difficulty-tuning.ts:83` 六成機率刻意送一手虧
   100–300cp。所以那 5 成「沒看到」，相當比例是沒看到**引擎故意送到面前**的東西——比真實對局更明顯的
   目標。方向是**高估**察覺能力，故 5 成是下限。但同一件事也意味著：那個技能對真人不轉移（見 P3 的兩難）。
4. 「我覺得」是印象不是逐手記錄，量級可信、參數不可信。**足以決定方向，不足以決定門檻值。**

---

## 這個 app 存在的理由

兩個並列目標，衝突時明講選哪個：

- **(A) 把西洋棋學起來**。以此為目標函數，這 68 天是負報酬——同樣時數投在 lichess 做題與實戰，棋力增幅幾乎確定更高；內容量差萬倍（21 課 vs 整個 practice 區、30 題 vs 數十萬題）。這一項不需要寫任何 code。
- **(B) 有一個值得做的工程專案**。這是實際行為揭露的目標函數（0 個真人使用者、117k 行寫入）。它完全正當，但**必須寫出來**——否則它每次都偽裝成「這對學棋有用」來取得論證，v1 的「棋憶是主路徑」就是一例。

(A) 底下唯一站得住的功能只有一件：**用你自己的局面出題，且不預告裡面有沒有東西**。lichess 的訓練全是事後的（分析）或預先宣告有答案的（puzzle）；這件事它不做，不是做不到，是對它的百萬用戶不划算。其餘一切都是複製品。

---

## 產品的形狀

```
下棋（單一難度窗口） → /review 兩趟分析 → 抓漏殺 → 判斷場（自己的局面＋誘餌） → 回到下棋
```

分層只有兩層，每項二選一：**在這條迴圈上（留）／不在（刪）**。要例外必須同時給出**一個日期和一個具名用途**——`.claude/docs/technical-preferences.md` 的「Deferred Cleanups」四項全部沒有日期，那份清單就是「素材層」的前身，已經演示過結局：無限期腐爛。v1 的素材層與支援層定義相同（都是「不投資但保留」），真名叫「我不想現在決定」，本版廢除。

**前置搬遷（順序不可顛倒）**：判斷場目前住在 `/learn/concept/:conceptId` 第三相位，唯一 UI 入口是 `MemoryDashboard.vue:41` 掛的 `RecognitionSignpost.vue:36`。**先給它自己的路由與入口，才能執行下面任何一刀**——順序顛倒的話，被稱為主路徑的東西中途完全不可達。

---

## 死刑名單

（v1 刪除層＝約 130 行 src ＝ 0.65%。以下合計 src 約 3,100 行、tests 約 1,400 行、文件約 37,000 行。）

**D1. 棋誌（journal）整組——大功能** ｜ `src/modules/journal/`(361)、`src/stores/journal.ts`(110)、`src/data/journal-templates/`(231、4 筆×6 變體)、`src/views/JournalView.vue`(168)、`src/components/journal/`(299)、`src/config/journal-config.ts`(19)、`tests/unit/journal/`(473)。**保留 `src/lib/persona-lint.ts`(35)**（`modules/memory/persona-lint.ts:9` 在用）。
→ 為什麼：`settle.ts:78-103` 四個閘門**沒有一個讀盤面**（有沒有寫過／課上完沒／深化求助沒／連敗計數）。三支決定性筆上限 13（onset 1＋arrival 4＋epiphany 8）；`solace` 是唯一無 dedup 的（:97-100 只有冷卻），所以長期還在寫的那支筆是「連敗三盤通知」。與斷層零交集。
→ 斷：`/journal` 路由與 tab、`HomeView.vue:216-220,234-240`、`ConceptDeepenView.vue:84`、`use-game-lifecycle.ts:155`、`App.vue:10,22,89`；12 個測試檔 79 個 it。→ **1–2 天**。須排在任何 game-history 動作之前（`stores/journal.ts:6`）。

**D2. 試煉（dungeon）關卡外殼——大功能** ｜ `DungeonMapView.vue`(285)、`DungeonPuzzleView.vue`(377)、`stores/dungeon-progress.ts`(158)、`src/modules/dungeon/`(106)、`config/dungeon-tuning.ts`(13)、`migrations/20260823000000_create_dungeon_progress.sql`、`dungeon-progress-store.test.ts`(129)。**保留 `src/data/puzzles/`(499、30 題)**。
→ 為什麼：為了送 30 個 FEN 蓋了地圖＋掛鎖＋進度＋雲端表。素材需要的是一個陣列和一顆「下一題」。
→ 斷：`/dungeon` 兩條路由、底部 tab 一格、`HomeView.vue:213`、`App.vue:7,19,86,101`、`ConceptMapView.vue:19`。注意 30 題只有 26 題能直接餵進 `RecognitionBoard`：`types/puzzle.ts:16-20` 是交替多手序列，4 題 mate-in-2 無法用 `types/recognition.ts:25-28` 的單一 `expectedMove` 無損表達。→ **1 天**。

**D3. 難度階梯五檔 → 一檔——大功能** ｜ `src/config/difficulty-tuning.ts` 的 `DIFFICULTY_LADDER` 與 `rungForSkillLevel`(154 行檔)、`src/components/play-setup-modal.vue`(221)。**保留 `modules/chess-engine/fallible-pick.ts`(65)**。
→ 為什麼：五個 rung 的 `depth`/`movetime` 全同（8/1000），`skillLevel` 檔內 :29-32 自承「只是為了寫進 `game_sessions.ai_difficulty`」，真旋鈕只剩 `probability` 與 cp 帶。一個使用者、一個窄實力帶，另外四檔永遠不會被走。
→ 斷：`PlayView.vue:15,83,187`、開局前難度 modal、`difficulty-tuning.test.ts` 21 個 it 大部分、`play-engine-uci.test.ts:310`、`game-history-mappers.test.ts:109-112`。→ **半天～1 天**。但這一檔的窗口值直接決定主路徑的題目供給（見 P3）。

**D4. 棋憶的敘事外殼——大功能** ｜ `MemorySlideshow.vue`(206)、`MemoryReplay.vue`(249)、`EvalShapeChart.vue`(204)、`ReplayEvalChart.vue`(77)、`MomentCard.vue`(66)、`MomentSlideshowDoor.vue`(44)、`NeveCard.vue`(29)、`DotBand.vue`(20)、`modules/memory/{choreography(121),cross-game(110),templates(75)}.ts`。**保留 `MemoryDashboard.vue`(80)**——三個視角要砍它是錯的，它是 `RecognitionSignpost` 的唯一掛載點，砍掉＝主路徑沒有門；另保留 `describe/selection/summary/missed-mate/post-game-review/`。
→ 為什麼：把答案演成一場秀＝回放，lichess 免費做。真正在斷層上的只有 missed-mate → 判斷場那條線。
→ 斷：`stores/memory.ts:5` 的 `pickNeveLine` 要改（cross-game 是它唯一資料源）、`MemoryView.vue:31-33,235-237` 要重寫、`memory_summaries` 表失去讀者、`components/pgn-viewer.vue` 與 `@lichess-org/pgn-viewer` 同批退役（附帶：`board-theme.css` 的 `.main-wrap .cg-wrap` 汙染 reset 可一起退役）。→ **1–2 天**。

**D5. 開局知識卡 ＋ opening-id** ｜ `src/data/opening-knowledge-cards.ts`(215)、`opening-knowledge-card.vue`(82)、`tests/unit/opening-knowledge-cards/`(165)；`src/modules/opening-id/`(63)＋`tests/unit/opening-id/`(108)＋`chess-openings` 依賴＋兩份 GDD(180+358)。
→ 為什麼：卡片全站**零呼叫點**（只有它自己 import 自己）。開局知識與察覺零關係，接線只是多一個要維護的分頁。→ 斷：僅 `MemoryView.vue:23,204` 的開局名一行；`modules/memory/stage.ts:35` 的 `bookExitPly` 傳 null 走 EC-8。→ **1 小時**。

**D6. ProfileView 整頁**(219) ｜ **先搬再刪**：`:198-209` 主題切換是 `uiStore.setTheme` 的唯一 UI、`:78` 是 `reset-history-dialog.vue` 的唯一掛載點，兩者搬進 header 齒輪。
→ 為什麼：四格統計全是字面 `'—'`(:36-39，其中一格 label 是「連勝」，違反 no-streak 鐵則)、三列 `locked:'即將推出'`(:62,63,69)。留半頁比留整頁更糟，它會繼續佔一條路由和一格 tab。（附帶：`gambit-compliance.test.ts:29` 已把「連勝」列為禁詞，但 :10-19 的掃描清單不含 ProfileView.vue——機械執行漏掉唯一違規的檔。）
→ 斷：`/profile`、底部一格、`tests/e2e/visual-regression.spec.ts:19` baseline 重拍。→ **半天**。

**D7. `src/modules/game-export/use-game-export.ts`(103) ＋ `tests/.../tier-delivery.test.ts`(264)** ｜ 零呼叫點。**範圍已修正**：三個視角都主張砍整個目錄，那是錯的——`assembler.ts`(182) 的 `buildPgn` 活著（`data-sync.ts:59` 動態 import 寫雲端 PGN、`MemoryView.vue:28`），砍它會落進 :61 catch → PGN 靜默降級成原始 UCI 字串，不紅不炸。→ 斷：無。→ **10 分鐘**。

**D8. concept-deepening 的 `variants` 輪替機制** ｜ `ConceptDeepenView.vue:49-53` 的 `count % variants.length`（8 個 concept 的 `variants.length` 全部＝1，取模恆 0）＋ `ConceptMapView.vue:166` 的「重溫」文案 ＋ `concept-deepening.test.ts:54-55` 把 1 釘死的兩條斷言。**不准砍 `data/concept-deepening/index.ts` 整檔**（見 R2）。→ 斷：無。→ **1 小時**。

**D9. 流程文件** ｜ `production/{epics(109 檔 10,649),qa(64 檔 7,621),sprints(940),gate-checks(300)}`、`session-logs/session-log.md`(7,055 行單檔)、`design/` 下 49 個 HTML 預覽頁(9,585)。**顯式排除 `production/session-state/`**（跨機 handoff，hook 會讀）；保留 `design/gambit-design-system/{README.md,colors_and_type.css,persona-neve.md}`。
→ 為什麼：非出貨文字對 src 至少 3.3:1（production 28,536 ＋ design 20,945 ＋ docs 13,610 vs src 19,079）。CLAUDE.md 自己寫 director-gates 與四支 skill「2026-07 全月觸發次數是 0」。成本不是磁碟，是判斷「這個 repo 有多大」時的自我感知失真。→ 斷：無。→ **30 分鐘**。

**D10. 文件本身** ｜ 刪 `gambit-differentiation-vision.md` 的「核心洞察：戰場換軸」(:65-78)、「§5 商業模式」(:152-174)、末行 Constraint「對標是 Calm」(:230)——**直接刪節，不再疊第三層修訂註記**，搬到 `session-state/archive-2026-07.md`；修 `active.md:136-137` 那句與同檔 :17-26 直接互斥的「解新手情緒問題、對標 Calm」。→ **30 分鐘**。

---

## 緩刑名單（技術上砍不掉；不接受「已拍板／刻意保留」）

- **R1. `src/stores/data-sync.ts`(807) ＋ auth 那層**：它**不是雲端層**。`:286-300` guest 讀本機佇列、`:513/:537/:635` 是純 localStorage 讀寫，而 `game-history.ts:34/58/83`、`journal.ts:25-26`、`memory.ts:31-32,39,51` 以它為**唯一持久化來源**。砍掉不是失去跨裝置，是失去本機儲存；「換成 20 行 JSON 匯出」取代的是備份，不是 append/read/dedup/queue。另有 15 個測試檔 `vi.mock('@/lib/supabase')`，模組不存在時 `vi.mock` 直接拋錯。**解鎖條件**：先拆成 local-store ＋ cloud-adapter 兩層。在那之前只有 `SignInView.vue`(71) 與 landing gate（`router/index.ts:36,47-49`）可動。
- **R2. `src/data/concept-deepening/index.ts`(352)**：`ConceptDeepenView.vue` 是 `RecognitionGate` 的唯一掛載點，而 :38 `if (!deepening) router.replace('/learn/concepts')`、:29-31 的 `?source=recognition` 被 `deepening &&` 短路。砍它＝判斷場永遠到不了。**解鎖條件**＝判斷場先搬到自己的路由。
- **R3. `src/components/lesson/LessonPlayer.vue`(500)**：`ConceptDeepenView.vue:4` 消費，判斷場的前兩相位跑在它裡面（:41 註解「LessonPlayer (step0/1) → RecognitionGate」）。同 R2 解鎖條件。
- **R4. `src/stores/game-history.ts`(113)＋`types/game-history`＋`config/history-config.ts`(2 行)**：`MemoryView.vue:14`、`data-sync.ts:7-8`、`reset-history-dialog.vue:11` 在用。`HistoryView.vue`(181)＋`history-row.vue`(76) 那一頁可砍，**store 不行**。
- **R5. `modules/game-export/assembler.ts`(182)＋`types.ts`＋353 行測試**：見 D7。
- **R6. `src/lib/persona-lint.ts`(35)**：`modules/memory/persona-lint.ts:9` 在用。
- **R7. 底部 tab 三格 → 兩格**：技術可行，但 IA 決策 Eason 2026-07-29 排最後（`active.md:45-51`）。這是**順序衝突不是技術阻礙**，見待拍板第 4 題。

---

## 核心新功能：判斷訓練（最小版）

v1 的四步問答**整節作廢**。三個理由：

1. **訊號不成立（實測）**：`gap-baserate.js` 四 seed，MultiPV 最佳 vs 次佳 ≥150cp 的觸發率 7%／10%／30%／15%；seed 222 開局＋中局 17 個玩家回合觸發 **0** 次，8 次觸發有 7 次連號落在已有強制殺的殘局。恆答「沒有」的準確率 70–93%。根因是分析性的：這個 gap 量的是**最佳手唯不唯一**，不是有沒有戰術——兩手都能贏一隻子時 gap≈0，訊號正好在戰術最豐富處關掉自己。（repo 對它的正當用途是謎題唯一解閘門，見 technical-preferences。）
2. **四步是成本論證推出來的**：v1 :77「四步吃同一次 MultiPV 搜尋——工程量接近一步」，而四步表最右欄標題就叫「訊號來源」。從零件倒推的指紋。
3. **主動按鍵會被目標使用者跳過**：「停一下」要求在對局中公開承認卡住。

**最小版（唯一版）**：

| 項 | 規格 |
| --- | --- |
| 判定 | **chess.js 窮舉、不開引擎**：`missed-mate.ts:44-58` 的 `isUniqueOneMoveMate` 已寫好一半；另一半（有沒有強制贏子）要新寫前瞻判定——**不能**沿用 `classify.ts:57-92`，那支吃對手實際走出來的手，是事後判定 |
| 互動 | 走子前**強制**答「有／沒有」，**不給任何回饋**，直接繼續下；局後在 `/review` 一次列出對照表 |
| 為什麼強制 | 按鈕式是壞資料——玩家只在「感覺有東西」時按，樣本自選，察覺率必然虛高 |
| 訓練模式 | 進去就知道這盤拿來練、輸贏不算數，且**關掉 `fallible`**（`play-engine.ts:73-80` 的 `fallible?` 本來就可選，不傳即可），否則練成的是「認出引擎剛才故意送的子」 |
| 成本 | 一個 overlay ＋ 一個布林陣列 ＋ 局後一張表，約 150 行；不需要新引擎路徑 |
| 不做 | 第 2 步（盤上點 1–3 手）——與 tap-to-move 共用同一塊表面、意義相反；撤提示的次數遞減——替一個尚未證明有效的機制預付降級路徑 |

**前置閘門**：`active.md:24-26` 那五盤紙筆實驗跑完之前，這 150 行也不寫。

---

## 這個定位讓我們對什麼說不

只留「刪掉之後使用者會少看到什麼」的條目。v1 六條裡四條半是姿態，已刪。

- **對「陪伴的記錄形式」說不**：棋誌整組下架（D1）。這條會痛——它是唯一的情緒資產。但一本第 13 篇之後只剩「連敗通知」的書，比不承諾更傷。
- **對「敘事外殼」說不**：`/review` 從三個子畫面變一頁（D4）。slideshow、跨局統計句、兩張 eval 圖全消失。
- **對「關卡與進度」說不**：試煉地圖、掛鎖、`N/30`、五檔難度選單全消失（D2、D3）。
- **對「陌生使用者」說不**：開局卡、ProfileView、landing gate、三張「即將推出」全消失（D5、D6）。
- **對「先寫文件再說」說不**：五盤實驗跑完前不寫任何 code、不再產第四份問題陳述（現有三份：vision 修訂節、v1、本檔——本檔一生效，前兩份的問題陳述段就刪）。

---

## 會被推翻的預測（可證偽，附日期）

- **P1（2026-08-09）**：五盤紙筆實驗的察覺命中率 **>70%** → 斷層不在察覺，四階段模型與這份 v2 的主軸作廢，重來的方向是「計算」（全站零覆蓋）。不寫一行 code 就能推翻。
  **量測定義寫死（避免與已有的 5:2:3 混淆）**：分母＝**這盤棋裡所有存在機會的局面**（事後由 `selectMissedMates`
  ／強制贏子判定列出），分子＝其中你在走子前就記下「有」的次數。**不是**「我漏掉的手裡有幾成是沒看到的」。
  且必須在**關掉 fallible** 的難度下跑（rung 5，`difficulty-tuning.ts:101` 該檔無 fallible），否則量的是
  「認出引擎故意送的子」的能力。
- **P2（2026-08-09）**：對既有對局歷史批次跑 `selectMissedMates`，**產出 ≥1 題的對局比例 <30%** → 唯一值得推薦的那條路實務上不存在，主路徑必須先從 mate 擴到 material 才成立。跑既有 review 管線即可。
- **P3（隨 D3 一起量）**：關掉 `fallible` 後 missed-mate 產出率下降 **>50%** → 「乾淨訊號」與「有題目」不可兼得，訓練模式不能關 fallible，而 D3 挑的那一檔窗口值就是題目供給的旋鈕。
- **P4（2026-09-02）**：D1–D9 全刪後一個月內**加回 ≥2 項** → 這份 v2 砍過頭；**一項都沒加回** → v1 的 0.65% 刪除層是嚴重誤判，下一輪繼續砍。
- **P5（最小版做完後 10 盤）**：拿掉提示後察覺命中率**低於**有提示時的 80% → 這是外掛不是訓練，整條路砍掉。門檻現在寫死，事後不准改。

---

## ✅ Eason 已拍板（2026-08-02，逐項確認）

| 項 | 決定 |
| --- | --- |
| D1 棋誌整組 | **刪** |
| D2 試煉關卡外殼 | **刪外殼、留 30 題** |
| D3 難度五檔 | **砍成一檔**（保留 fallible-pick） |
| D4 棋憶敘事外殼 | **刪表演層**（保留分析／missed-mate／MemoryDashboard） |
| D5 開局知識卡 ＋ opening-id | **刪**（連 chess-openings 依賴退役） |
| D6 ProfileView | **刪整頁**，主題切換與重置對話框先搬進 header 齒輪 |
| D7/D8/D9/D10（零風險四項） | **直接做**，不另外確認 |
| 判斷場搬出 `/learn/concept/*` | **搬，而且先做**——它是 D2/D4 的前置 |
| 定位第一段的目標 | **兩個都寫**（A 學棋／B 有一個值得做的工程專案） |
| P1 五盤紙筆實驗 | **降級，不再當施工閘門**——Eason 已提供第一筆資料（5:2:3），量級足以定方向 |

**施工順序（依賴決定，不可任意調換）**：
零風險四項 → 判斷場搬遷（前置）→ D1 棋誌（須早於任何 game-history 動作）→ D2 → D4 → D3 → D5 → D6。

---

## 待 Eason 拍板（★＝最關鍵；上表已答者不再重複）

1. **★ 那五盤跑了沒？哪一天跑？** 推薦：這週跑完再談任何實作。三小時、一張紙，全 repo 投報率最高的動作。
2. **★ 兩個目標（A 學棋／B 工程專案）都寫進定位第一段？** 推薦：要。寫出來之後「這功能對學棋沒幫助但我想寫」變成合法可申報的選項，不必偽造論證。
3. **★ D1–D9 全刪，你三個月內會加回哪幾項？逐項答，不准答「都可能」。** 推薦：我預測一項都不會；唯一例外「跨裝置看到同一份資料」被 R1 擋著——要先拆 data-sync，不是刪它。
4. **底部 tab 三格 → 兩格現在做，還是照 `active.md:45-51` 排最後？** 推薦：現在做。IA 排最後的理由是「2 可能改資訊架構」，而這份 v2 就是那個改動。
5. **判斷場搬出 `/learn/concept/*` 給它自己的路由——這一輪做嗎？** 推薦：做，它是 D2/D4/D8 的前置。注意 `lessonUnaided` 串著 epiphany 判定（`settle.ts:91-95`），拆頁時若 D1 未先執行會靜默漏發。
6. **你現在的實際棋力？下過幾盤完整的棋（app 內＋app 外）？** 推薦：誠實填數字。若總盤數是兩位數，處方是每天兩盤連續四週，不是任何新功能。
7. **過去 68 天，「下棋」時數 vs 「寫 app」時數？** 推薦：若落在 1:30–1:100，這個比值該寫進定位第一段。
8. **棋誌：接 move pen 還是下架？** 推薦：下架（D1）。訊號源確實存在（`describe.ts:44` momentVisualKind ＋ `MEMORY_BRIGHT_GATE=120`），但接上去只是讓一支不讀盤面的筆多一個兄弟。
9. **開局卡：接線還是刪？不接受第三個答案。** 推薦：刪（D5）。健檢說「接了等於白撿 20 個內容單元」是錯的——那是替與斷層無關的東西發居留證。
10. **難度：砍成一檔（D3）／加碼校準 rung 1–2／訓練模式關 fallible——三者互斥，選一個。** 推薦：砍成一檔＋訓練模式關 fallible，但先量 P3。
11. **要不要做四週對照實驗（前兩週只用 lichess、後兩週只用 Gambit，同一組指標）？** 推薦：做，`post-game-review/cploss.ts` 已有量測機械。不做就在定位裡誠實寫「本專案不以學棋成效作為驗收標準」，並接受隨之而來的取捨自由。
12. **自用產品的驗收條件？** 推薦寫死：「連續 14 天每天一盤＋賽後判斷場；第 8 天之後的對局中，至少三次在走子前主動想起判斷場看過的局面。」想不起來＝沒跨過，那時該換設計而不是加功能。
