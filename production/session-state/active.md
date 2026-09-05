<!-- STATUS -->
Epic: 棋憶（/review）文案準確度——hanging-piece 判定接線 ＋ 走法白話文補上吃子／升變／易位
Feature: 已實作完畢，待 review→push
Task: 下一步＝判斷訓練釐清 Q3 起（P2 仍卡在對局數個位數，樣本不足）
⚠️ 動 engine 解析層時注意：`handshake.ts` 寫死 `MultiPV 1` 且與 review 分析路徑共用，勿污染分析。
<!-- /STATUS -->

> **交接快照**：只留現況＋待辦＋未固化決策；施工細節在 git，D1–D6 全文在 `archive-2026-07.md` 與 git log。
> **收尾覆寫本檔，紅線 ≤150 行**。**定位 SoT ＝ `production/positioning-v2-2026-08-02.md`**——提任何功能/重構/UI 前**先讀**。

## precommit-review 留下的技術債（deep `wf_9edc6475-d91`，29 條 confirmed，4 條 major 已修）

已修：觸控目標 36→44px、`router.push` 改 `replace`（返回會讓 history 無限增長）、
標題與內文兩套 kind 推導會互相矛盾（收成 `describe.ts::momentTone` 單一來源，新增 `best-anyway`
語氣——玩家走了最佳手時不套失誤模板）、金色內文改回墨色（`text-gold-dark` 是 large-copy-only）、
好棋定格兩支箭頭同色（對手回應改灰）。**未修，按優先序**：

- ✅ **白話文吃掉吃子／升變／入堡資訊**（2026-09-05 已修，見下方「已施工」）。
- **`geomTick` + ResizeObserver 那套幾何接線已經第三次複製貼上**（PracticePuzzleView／
  LessonPlayer／KeyMomentsCard）。第三次是抽 composable 的門檻，下次動到就抽。
- **`lintNeve` 仍無產品呼叫端**：只有測試在跑（F3 模板與短名的每個分支、吃子／升變／易位片語都在
  測試層過 lint）。元件內硬編的文案（「你走了」「更好的是」）不在覆蓋內。
- **Tier-3 匯出 fallback 面板** `fixed top-24` 是魔術數字、不吃 safe-area、無焦點管理。
- **`isComplete` 在 `MemoryView` 與 `MemoryDashboard` 各算一份**，該經 MemoryContext 共用。
- **返回落點只認兩個入口**（有無 `?gameId`），將來多一個入口會靜默走錯。
- **元件測試裡 `ChessBoard` mock 不 expose `boardRef`/`squareToRect`**，所以 `MoveAnnotationDisplay`
  在單元測試中永不渲染——標註那條路只有純模組測試守著。**`key-moments-card.test.ts` 已修**
  （mock 給真 element ＋ 斷言前 `flushPromises` 等 `onMounted` 的 geomTick），其餘元件測試檔照舊。
  修之前那裡的「零標記」斷言是恆真的，改的時候記得配一條「有標註」的對照組，否則驗不到東西。

## 未決 → 已於 wave 2 拍板（2026-09-05）

- **深青格走錯了**：棋子靜默滑回（`resetPosition()`），不計次、無懲罰 UI。沿用判斷場既有作法。
  查證修正：`missedHint` 不在 `RecognitionBoard` 而在 `RecognitionGate`，且只用於「答『這裡沒有』
  但其實有」的情境，就地走沒有那個動作，所以本來就轉不過來。
- **`markDeepened`**：深青格通關**只做 `markConsumed`，不標已深化**。走一手將殺 ≠ 走完深化課，
  標了概念地圖會說謊。
- **中間那顆鈕**：不做自動重播，改成**循環步進**（原局面 → 你走了 → 更好的是 → 繞回）。
  圖示用 `▸` 不用 `↻`（↻ 讀起來是重播）。深青格通關前 disabled——步進正解等於直接給答案。

## 🔪 定位 v2 刪除期（2026-08-02 拍板，2026-08-06 執行完畢）

一句話：**Gambit 把你剛下完的那盤棋，變成明天的題目——而且不告訴你裡面有沒有東西。**
斷層＝**認知遷移**（學到的調用不出來）。目標使用者第一位＝Eason 本人。
D1（棋誌）／D2（試煉外殼）／D4（棋憶敘事外殼）／D5（開局知識卡）／D6（ProfileView）皆已執行；
D3（難度五檔）原判死理由誤讀實作，撤銷保留。判決表全文見 `positioning-v2-2026-08-02.md`。

### 🔴 三個必須記住的陷阱（審查實測，別重新發現）

1. **題目供給率 ∝ 對手有多弱**：判斷場題目全來自 `selectMissedMates`（要求唯一解 mate-in-1），
   而 rung 1 有 60% 機率刻意送一手虧 100–300cp。
2. **MultiPV gap ≥150cp 當「有沒有東西」的訊號是壞的**：實測觸發率 7/10/30/15%，恆答「沒有」
   準確率 70–93%。正解＝chess.js 窮舉前瞻判定（`missed-mate.ts:44-58` 已有一半）。
3. **`data-sync.ts` 不是雲端層，是唯一的持久化層**：guest 佇列與 memory 的讀寫都是純 localStorage。
   要動必須先拆成 local-store ＋ cloud-adapter 兩層（v2 的 R1）。

## 已施工（push 狀態查 `git log origin/main..HEAD`）

- ✅ **`CONTEXT.md` 專案詞彙表**（2026-08-09，試行中）：15 個詞，`@`-include 進 `CLAUDE.md` 常駐。
  **只有詞義不放規則**（抄規則＝第二份 SoT，會漂）。**判準＝下個 session 是否真省掉解釋術語的成本**，
  沒省到就砍。檔尾「待確認」四題待 Eason 回。
- ✅ **賽後關鍵步清單**（`c558b6e`／`3293d96`，wave 1 已改成 carousel）：兩個坑仍成立——
  ① 判準用「玩家走的 === bestMove」，**不可**用 Moment 的 `kind`（`displayKind` 把 anchor 壓成
  `'bright'`，反推會把最大失誤講成好棋）；② `chess-board.vue` 初始 lastMove 在 `onBoardCreated`
  補套，別退回純 watch。
- ✅ health-check Q9 訪客齒輪選單、noir 深色主題整組下架（只留 cream+jade）、D6 ProfileView 下架、
  D5 開局知識卡（縮小範圍）、D1 棋誌＋D2 試煉外殼下架、D4 棋憶敘事外殼下架、匯出接上 UI（D7 撤銷復活）。
  細節查 git log。**蒸餾**：砍整頁前重掃「這頁裡還有什麼是全站唯一入口」；跨 D 項的判死決策會互相連動。
- 🔴 **像素回歸容差** 0.005；`toHaveScreenshot` 在 CI 是 skip 的，動 UI 後本機自己跑 `npx playwright test visual-regression`。
- 🔴 **賽後檢討看不見「該殺沒殺」**：cpLoss 對將殺不敏感，第三種訊號候選（mate distance，非 cp）。
- ✅ **liveness 重生孤兒化 `play()` promise 已修**（`02f712d`）：worker 重生那次的結果被丟棄，原本被
  await 的 promise 永不 settle → `PlayView` 永久卡 `AI_THINKING`。**蒸餾**：測試裡的 `.catch(() => {})` 是警訊。
- ✅ **`plans/`**（`0582e4e`／`22181c8`，評估 shadcn/improve plugin 的副產物；002 已判 false positive 撤回）。
  **蒸餾**：稽核引用 `file:line` 全對 ≠ 結論對；擋下錯誤結論的是 plan 的 STOP 條件，不是它的 vet 階段。
- ✅ **棋憶 wave 2（2026-09-05，`2ba583b` 已 push）**：深青互動格併進 carousel 最前面（pending 的 missed mate
  一格一題，棋盤可動、零標記、就地走）、`RecognitionSignpost` 與 `?source=recognition` 整條路徑刪除、
  三顆鈕的中間那顆做循環步進（review deep，runId `wf_eded828f-0e1`）。**還會咬人的五件事**：
  ① `KeyMomentsCard` 是**單一 ChessBoard 換 `:fen`**，不是多盤 translateX carousel——`RecognitionBoard`
     那套 360ms `reapplyFen` + `dispatchEvent(resize)` 的 stale-bounds 修法不適用，別看到「carousel」就抄。
  ② 深青格的來源要 **setup 同步取的快照**（`pendingFor('mate')`）：放 `onMounted` 首次 render 會空一輪；
     跟著 store 走則會在玩家走對的當下（`markConsumed`）從腳下消失。
  ③ 步進歸零的 watch **只能掛 `index`**，且切回已通關的格子要還原成「走完那一手」的畫面。掛 `isSolved`
     或無條件歸零，棋子都會彈回走子前，而對話框寫著「就是這一手」。**同症狀兩條觸發路徑，各留一條測試。**
  ④ `:last-move` 要真的綁值（通關＝標出那一手，其餘 null）。原本傳 `null` 毫無 runtime 效果
     （`onBoardCreated` 只處理 truthy、watch 非 immediate），測試把它當保證＝假驗證。
  ⑤ 標題不寫「這盤」（Eason 拍板）：`pendingFor` 回**最近一局**，A 局漏題沒解就下 B 局，B 局的棋憶
     第一格會是 A 局的題目。**不改成「只收本局」**——路標已刪，那會讓跨局題目失去唯一入口。
  **蒸餾**：刪一支元件要順手 grep 全 repo 的 SoT（這次 `persona-neve.md`／`positioning-v2`／
  `quick-specs/signpost-material-expansion.md` 三份同時漂掉，只想到改 CONTEXT.md）。

- ✅ **hanging-piece 判定接線 ＋ 走法白話文（2026-09-05，本輪）**：`classify.ts` 的
  `hungUndefendedMaterial` 一直算出「哪顆子、在哪一格」再丟成 boolean，抽出 `hungMaterialDetail`
  回 detail、boolean 版變成 `!== null`（`classify` 行為零變化）。`moment-display` 用同一組輸入
  （同一手＋同一個對手回應）重算，所以不必動 `Moment` 型別／`selection.ts`／`MemoryView.vue`。
  `describeMove` 從 `.get(from)` 改 `.move()`，一次拿到 captured／promotion／castle／en-passant。**四件事**：
  ① **`movePhrase` 是走法片語的唯一出處**（`describe.ts`）。`KeyMomentsCard` 原本自己硬編
     `把{piece}移到 {to}`，於是卡片說「把后移到 f7」、Neve 那句說「用后吃掉 f7 的兵」。要顯示走法就呼叫它。
  ② **`.move()` 只收小寫升變後綴**：`a7a8Q` 會被當非法手丟掉整格（既有測試立刻轉紅）。`isLegalUci`
     早就有 `normalizeUci`，只有 `describeMove` 漏了。片語內也不准有逗號——它會被塞進「與其X，不如先Y。」中間。
  ③ **「留在」在玩家自己把子送過去時是說反的**：`hungSquare === played.to` 就是這一手放上去的，說「留在」
     等於把主動送子講成疏忽。改成「你${played}，那裡沒人守著。不如先${best}。」這是最常見的送子形狀，不是邊角。
  ④ **吃過路兵的被吃子不在落點上**，照一般吃子模板會指到一個空格；`enPassant` 旗標讓片語不報格號。
  **驗證**：vitest 870 綠、`vue-tsc` 0、375/1280 實跑 `/review`（1.e4 e5 2.Nf3 Nc6 3.Nxe5?? Nxe5 →
  「你用騎士吃掉 e5 的兵，那裡沒人守著。不如先把主教移到 b5。」標題「騎士沒人守著」）。
  **蒸餾**：判定給不出來時標題與內文必須**一起**退回籠統版，只修一邊會標題點名、內文不提。
  **review（deep，runId `wf_004dd5a2-dd4`）抓到而自驗漏掉的**：⑤「那裡沒人守著」的指涉物是 played
  片語裡的格號，而吃過路兵的片語**刻意不報格號**——兩個各自正確的決定疊起來成了「你用兵吃過路兵，
  那裡沒人守著」，「那裡」指不到東西。`hungMaterialDetail` 擋的是**對手回應**是 e.p.，不是玩家這一手是，
  所以走得到（verifier 用 `4k1n1/6p1/8/4Pp2/8/8/8/4K3 w - f6 0 1` 實測）。已修＋留測試。
  **蒸餾**：兩個各自正確的局部決定會疊出一個沒人做過的錯誤決定，這種缺陷單看任一邊的 diff 都看不出來。

## 待辦（本輪之外）

- 🔜 **判斷訓練最小版——dev-flow 釐清階段拍板中途暫停**：走子前**強制**答「有／沒有」、不給回饋、
  局後一次列對照表（約 150 行，chess.js 窮舉不開引擎）。**已拍板**——Q1 不可取代好處成立、
  Q1b v1 只用自己對局出題、Q2 這是主線。**待續（Q3 起）**：現在做值不值得（Jobs 視角）、Q12 驗收條件、
  Q10 難度/fallible 衝突、範圍（mate-only vs 強制贏子）、跟既有判斷場的關係。
  **前置閘門已解除（P1，2026-08-13 跑完）**：五盤紙筆實驗，rung 5（關 fallible，
  排除「認出引擎故意送的子」的混淆），命中率約 1–2/5，遠低於 70% 門檻——v2 主軸
  （斷層卡在察覺階段）不被推翻，成立。Q3 起的釐清可以繼續。
- **missed-mate 從 mate 擴到 material**（v2 的 P2，也是擴大深青互動格題目供給的前置）：若既有對局跑
  `selectMissedMates` 產出 ≥1 題比例 <30%，主路徑必須先擴到 material 才成立。2026-08-06 查過 Eason
  現有對局數＝個位數，樣本太小，等累積後再量。
- v2 末尾另有 8 題待答（棋力現況、下棋 vs 寫 app 時數比、四週對照實驗、自用產品的驗收條件等）。

## 護欄備忘

- **Stockfish 無旋鈕可製造初學者級失誤**：要它犯錯只能在引擎外面做（`fallible-pick.ts`）。
  讓子（material odds）已否決，勿再提案。
- Supabase keep-alive workflow 每 3 天打實表查詢；**GitHub 政策 repo 60 天無 commit 自動停用**。
- **Maia（人類化 NN 引擎）＝日後「陪練角色」**：2026-08-07 查證，「要後端所以不做」的前提已翻案——
  **只有 Maia-1 可行**（官方 ONNX ~3.3MB／級距，9 檔 Elo 1100–1900，`onnxruntime-web` 純 client-side，
  權重 GPL-3.0）；**Maia-2／3 不走**（無官方 ONNX、AGPL、23M 版 91.8MB 超出 150MB 預算；且「單一模型
  涵蓋全棋力」對 web 是退步）。**綠燈後第一驗證項**＝查官方前端怎麼從 policy head 取手：**若是 argmax，
  實際棋力會高於標稱 Elo、失誤遠少於真人**，要 temperature sampling 才有真實失誤率。
  **決策歸屬**：不開獨立線，折進暫停中的判斷訓練 grilling。

## 接手必讀（鐵則不在這個檔）

長期規則與技術參考都在 **CLAUDE.md 與它 `@`-include 的 docs**，每次 session 自動載入：

- **CLAUDE.md**：技術棧、CI Node 26 鎖、push guardrail、部署 base path、E2E 盲區、棋理護欄、
  視覺設計 SoT（全 app 棋盤＝Wood12+Gioco；主題僅 cream+jade）、教練人格 Neve、西洋棋用語、Pre-Push Checklist。
- **`.claude/docs/technical-preferences.md`**：測試規範、Board/chessground gotchas、Deferred Cleanups。
- 設計 SoT＝`design/gambit-design-system/`；Supabase migration＝`supabase/README.md`；
  lib/ vs modules/ 判準＝**ADR-0015**。
- **Supabase MCP**：stdio、user scope、**read-only**、`--project-ref=vfnzekqtvxhewifnmtnz`、
  token 走 `$env:SUPABASE_ACCESS_TOKEN`；需重開 Claude Code 才 Connected。
