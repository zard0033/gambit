<!-- STATUS -->
Epic: 棋憶（/review）改造——統一 Neve 對話框 + 深青互動格就地走
Feature: 設計已全數拍板（2026-08-08，見下方「本輪設計決定」）
Task: wave 1（對話框 + 白話文說明格 + 頁面 header）**已完成並 push**；wave 2（深青
  互動格就地走 + 路標下架）未開始
⚠️ 動 engine 解析層時注意：`handshake.ts` 寫死 `MultiPV 1` 且與 review 分析路徑共用，勿污染分析。
⚠️ `/review` 要改 fullBleed＝動路由 meta → push 前必補跑 `npm run test:e2e`（E2E 盲區護欄）。
<!-- /STATUS -->

> **交接快照**：只留現況＋待辦＋未固化決策；施工細節在 git，D1–D6 全文在 `archive-2026-07.md` 與 git log。
> **收尾覆寫本檔，紅線 ≤150 行**。**定位 SoT ＝ `production/positioning-v2-2026-08-02.md`**——提任何功能/重構/UI 前**先讀**。

## 🎨 本輪設計決定（2026-08-08 拍板，樣張逐版比對後定案）

樣張檔 `public/_demo-key-moments.html` 是**拋棄式**的，開工後刪掉，不要 commit。

1. **形態＝統一 Neve 對話框 carousel**：棋盤在上、對話框在下、一次一手、左右切換。取代原本的「共用棋盤＋
   五列清單」。清單那五列的高度就是這次省下來的。
2. **顏色規則（新增進設計系統，管的不只這頁）**：**Neve 說的話統一用對話框；淺卡＝她在說明，
   深青＝她要你做一件事，而且就在這一格做**。深青格才有行動出口，段點條上是金色點。
3. **判斷場路標整張下架**，內容改由對話框的**第一格**承載。理由：它跟關鍵步清單都在講「你漏掉的東西」，
   兩張深青卡同屏會互相稀釋；併進 carousel 後跨局的 pending 仍有家（永遠排最前面）。
4. **深青格＝就地走，不跳頁**（原本點 CTA 會導去 `/learn/concept/mate?source=recognition`，
   且中間夾一整段深化課才到判斷場）。棋盤可動、**盤面全乾淨零標記**（預先標＝幫他縮小範圍），
   走出那一手就通關；走不出來點次要的「看答案」。`/learn/concept/:id/judge` 那頁**保留**——
   概念地圖進去的公版題還走它。
5. **能做互動格的只有唯一解局面**（目前＝`selectMissedMates` 驗過的 mate-in-1）。其餘的手沒有唯一答案，
   做成互動會判錯玩家走對的手（v2 陷阱 #2）。要擴大＝先做 v2 的 P2（mate → material 前瞻判定）。
6. **說明格內容**：白話文取代 SAN（全站僅此處用 SAN 列表）、並排「你走了 / 更好的是」、一句 Neve 理由，
   棋盤同時標兩手（你走的＝次要色，更好的＝金）。
7. **切換鈕 `‹ ↻ ›` 三顆一組收在頭像列**，重播坐中間。底部留給行動出口。原本掛棋盤右下角的重播圓鈕
   會壓在棋子上，取消。
8. **swing 數字（`−2.1`）拿掉**：對初學者是沒解釋的數字。
9. **頁面 header**：`/review` 改 **fullBleed**，自畫一列 `← 棋憶`（返回與頁名合體）＋ 右上「⧉ 棋譜」。
   代價＝底部 tab 一起消失，已接受（這頁是看完就走，不是常駐據點）。
   **header 要吃 `env(safe-area-inset-top)`**——standalone 沒有瀏覽器 chrome 擋動態島。
10. **返回落點用來源判斷，不用 `history.back()`**：有 `?gameId=` → 回 `/history`（從對局紀錄來），
    無 → 回 `/`（下完棋自動導來）。**iOS standalone PWA 的 `history.back()` 在空堆疊時是靜默 no-op**
    （不報錯、不觸發事件、畫面不動），冷啟動落在深層頁就失靈。
11. **「複製這盤棋」→「⧉ 棋譜」移進 header 右上**：原本緊貼對話框下方，看起來像在複製當下這一手。

**PWA 查證結論（2026-08-08，供日後其他頁沿用）**：iOS **12.2 起** standalone PWA 的左緣滑動返回是
原生啟用且 **app 停不掉**；**Android 不保證**有返回鍵（W3C manifest 規格明文）。所以返回鍵仍要自畫——
手勢是隱形的，初學者不會知道。另：**棋盤左緣離螢幕邊僅約 26px，落在 iOS 邊緣返回手勢觸發帶上**，
拖 a 檔棋子可能誤觸；這是既有狀況（對局頁一樣），但深青互動格要玩家在盤上走子，實機須確認一次。

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

## 未決（實作中會撞到，撞到再問）

- **深青格走錯了怎麼辦**：舊 `RecognitionBoard` 有 `missedHint`，但就地走的錯誤回饋尚未定。
- **`markDeepened` 語意**：`RecognitionFieldView:61` 完成判斷場會**無條件**標記「已深化」，唯一消費端是
  概念地圖的標籤。就地走之後這個標記由誰下、還要不要下，未定。
- **切換鈕中間那顆 `↻`**：定案是 `‹ ↻ ›`，但重播是給動畫用的，動畫在 wave 2。wave 1 只放兩顆——
  按了沒事的鈕比不放更糟。動畫落地時補上中間那顆。

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

- ✅ **`CONTEXT.md` 專案詞彙表**（2026-08-09，試行中）：15 個詞，已 `@`-include 進 `CLAUDE.md` 常駐。
  **只有詞義不放規則**（抄規則＝第二份 SoT，會漂）。**判準＝下個 session 是否真省掉解釋術語的成本**，
  沒省到就砍。檔尾「待確認」四題待 Eason 回。

- ✅ **賽後關鍵步清單**（2026-08-06 `c558b6e`；2026-08-07 補黑方回歸測試 `3293d96`）：
  `modules/memory/moment-display.ts` ＋ `components/memory/KeyMomentsCard.vue`，掛在 `MemoryDashboard`。
  **本輪會大改它**（清單→carousel），但兩個坑仍成立：① 判準用「玩家走的 === bestMove」，
  **不可**用 Moment 的 `kind`——`displayKind` 把 anchor 和 bright 都壓成 `'bright'`，拿 kind 反推會把
  最大失誤誤認成好棋（舊 `MemorySlideshow.vue` 的 `templateKind` 已解過這題，復原時照抄）。
  ② `chess-board.vue` 初始 lastMove 在 `onBoardCreated` 補套，別退回純 watch。
- ✅ health-check Q9 訪客齒輪選單、noir 深色主題整組下架（只留 cream+jade）、D6 ProfileView 下架、
  D5 開局知識卡（縮小範圍）、D1 棋誌＋D2 試煉外殼下架、D4 棋憶敘事外殼下架、匯出接上 UI（D7 撤銷復活）。
  細節查 git log。**蒸餾**：砍整頁前重掃「這頁裡還有什麼是全站唯一入口」；跨 D 項的判死決策會互相連動。
- 🔴 **像素回歸容差**已收緊到 0.005；`toHaveScreenshot` 在 CI 是 skip 的，動 UI 後本機要自己跑
  `npx playwright test visual-regression`。
- 🔴 **賽後檢討看不見「該殺沒殺」**：cpLoss 對將殺不敏感，第三種訊號候選（mate distance，非 cp）。

## 待辦（本輪之外）

- 🔜 **判斷訓練最小版——dev-flow 釐清階段拍板中途暫停**：走子前**強制**答「有／沒有」、不給回饋、
  局後一次列對照表（約 150 行，chess.js 窮舉不開引擎）。**已拍板**——Q1 不可取代好處成立、
  Q1b v1 只用自己對局出題、Q2 這是主線。**待續（Q3 起）**：現在做值不值得（Jobs 視角）、Q12 驗收條件、
  Q10 難度/fallible 衝突、範圍（mate-only vs 強制贏子）、跟既有判斷場的關係。
  **前置閘門：五盤紙筆實驗（P1，日期 2026-08-09）跑完前一行都不寫**——若察覺命中率 >70%，
  斷層不在察覺，v2 主軸作廢。
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
