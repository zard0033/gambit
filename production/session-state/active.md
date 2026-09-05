<!-- STATUS -->
Epic: 棋憶（/review）改造——統一 Neve 對話框 + 深青互動格就地走
Feature: wave 1／wave 2 皆已實作完畢
Task: wave 2（深青互動格就地走 + 路標下架 + 步進鈕）**已完成，待 review→push**
⚠️ 動 engine 解析層時注意：`handshake.ts` 寫死 `MultiPV 1` 且與 review 分析路徑共用，勿污染分析。
<!-- /STATUS -->

> **交接快照**：只留現況＋待辦＋未固化決策；施工細節在 git，D1–D6 全文在 `archive-2026-07.md` 與 git log。
> **收尾覆寫本檔，紅線 ≤150 行**。**定位 SoT ＝ `production/positioning-v2-2026-08-02.md`**——提任何功能/重構/UI 前**先讀**。

## precommit-review 留下的技術債（deep `wf_9edc6475-d91`，29 條 confirmed，4 條 major 已修）

已修：觸控目標 36→44px、`router.push` 改 `replace`（返回會讓 history 無限增長）、
標題與內文兩套 kind 推導會互相矛盾（收成 `describe.ts::momentTone` 單一來源，新增 `best-anyway`
語氣——玩家走了最佳手時不套失誤模板）、金色內文改回墨色（`text-gold-dark` 是 large-copy-only）、
好棋定格兩支箭頭同色（對手回應改灰）。**未修，按優先序**：

- **白話文吃掉吃子／升變／入堡資訊**：「把后移到 f7」實際是「吃掉 f7 的兵」。`describeMove` 只講
  piece + to。這是最影響理解的一條，接 hanging-piece 判定時一起做。
- **`geomTick` + ResizeObserver 那套幾何接線已經第三次複製貼上**（PracticePuzzleView／
  LessonPlayer／KeyMomentsCard）。第三次是抽 composable 的門檻，下次動到就抽。
- **`lintNeve` 仍無產品呼叫端**：只有測試在跑（本輪已把 F3 模板與短名的每個分支接進測試層）。
  元件內硬編的文案（「你走了」「更好的是」）不在覆蓋內。
- **Tier-3 匯出 fallback 面板** `fixed top-24` 是魔術數字、不吃 safe-area、無焦點管理。
- **`isComplete` 在 `MemoryView` 與 `MemoryDashboard` 各算一份**，該經 MemoryContext 共用。
- **返回落點只認兩個入口**（有無 `?gameId`），將來多一個入口會靜默走錯。
- **元件測試裡 `ChessBoard` mock 不 expose `boardRef`/`squareToRect`**，所以 `MoveAnnotationDisplay`
  在單元測試中永不渲染——標註那條路目前只有純模組測試守著。

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
- ✅ **棋憶 wave 2（2026-09-05，待 push）**：深青互動格併進 carousel 最前面（pending 的 missed mate
  一格一題，棋盤可動、零標記、就地走）、`RecognitionSignpost` 與 `?source=recognition` 整條路徑刪除、
  三顆鈕的中間那顆做循環步進。**四個實作事實**：
  ① `KeyMomentsCard` 是**單一 ChessBoard 換 `:fen`**，不是多盤 translateX carousel，所以
     `RecognitionBoard` 那套 360ms `reapplyFen` + `dispatchEvent(resize)` 的 stale-bounds 修法
     **不適用也不需要**——別看到「carousel」就把它抄過來。
  ② 深青格的來源快照在 **setup 同步取**（`pendingFor('mate')`），不可放 `onMounted`：mount 後才填
     會讓首次 render 空掉一輪（單元測試同步斷言全紅）。而它必須是快照不是 reactive 讀取——
     通關會 `markConsumed`，跟著 store 走的話格子在玩家走對的當下從腳下消失。
  ③ 通關後 `step` 設 1（走完那一手的畫面），且步進歸零的 watch **只能掛 `index`**。掛上 `isSolved`
     會在通關的下一個 flush 把 step 覆寫回 0，棋子當場彈回走子前，讀起來像「你走錯了」。
  ④ 通關時機的截圖要等 ~800ms：chessground 的移動動畫還在跑，拍到的是起始幀（棋子還在原位、
     但 check ring 已經套上），會誤判成 FEN 沒更新。
  **驗證**：vitest 843 綠、`vue-tsc` 0 error、E2E 78 綠、mobile/desktop 截圖、tap-to-move 座標點擊
  實走 e1e8 通關、白方 pending ＋ 黑方本局的朝向翻轉實機驗過（切格翻轉、標註幾何跟上、高亮不殘留）。
  **review（deep，runId `wf_eded828f-0e1`）抓到而自驗漏掉的**：
  ⑤ 通關後切走再切回，`watch(index)` 無條件把 step 歸零 → 盤面退回走子前，而對話框寫著「就是這一手」，
     且通關後盤已鎖住，玩家無法自己重走。**與 ③ 是同一個症狀的第二條觸發路徑**——修好一條不代表另一條
     也好了，這種「同症狀多路徑」要各留一條測試。
  ⑥ `:last-move="null"` 原本毫無 runtime 效果（`onBoardCreated` 只處理 truthy、watch 非 immediate），
     測試卻把它當保證鎖住＝假驗證。真正的問題是玩家自己走出正解後 chessground 留下的原生高亮，
     `setPosition` 不清它，會跟著切到下一格；改成真的綁值（通關＝標出那一手，其餘 null）才同時解掉。
  ⑦ 三份 SoT 同時漂掉（`persona-neve.md` 深青「現例」、`positioning-v2` 的現在式現況宣稱、
     `quick-specs/signpost-material-expansion.md` 整份施工點）。**刪一支元件要順手 grep 全 repo 的 SoT**，
     這次只想到改 CONTEXT.md。

## 待辦（本輪之外）

- 🔜 **判斷訓練最小版——dev-flow 釐清階段拍板中途暫停**：走子前**強制**答「有／沒有」、不給回饋、
  局後一次列對照表（約 150 行，chess.js 窮舉不開引擎）。**已拍板**——Q1 不可取代好處成立、
  Q1b v1 只用自己對局出題、Q2 這是主線。**待續（Q3 起）**：現在做值不值得（Jobs 視角）、Q12 驗收條件、
  Q10 難度/fallible 衝突、範圍（mate-only vs 強制贏子）、跟既有判斷場的關係。
  **前置閘門已解除（P1，2026-08-13 跑完）**：五盤紙筆實驗，rung 5（關 fallible，
  排除「認出引擎故意送的子」的混淆），命中率約 1–2/5，遠低於 70% 門檻——v2 主軸
  （斷層卡在察覺階段）不被推翻，成立。Q3 起的釐清可以繼續。
- **「是哪顆子沒人守」的判定（hanging-piece）**：`renderMoment` 的 material 分支需要 `hungPiece`/
  `hungSquare` 才講得出「你的**后**留在 **f7**，沒人守著」。這段判定沒人寫過，模板一直是 fallback。
  2026-08-08 拍板：**沒有這兩個值就整句不講**（只留「與其…不如先…」），不吐沒資訊的空話。
  同一個缺口也讓 `momentShortName` 對送后只能說「漏掉一個子」。接上判定後兩處都會自動變好。
  排在 P2（mate → material）那一批一起做。
- **missed-mate 從 mate 擴到 material**（v2 的 P2，也是上面第 5 點擴大互動格的前置）：若既有對局跑
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
