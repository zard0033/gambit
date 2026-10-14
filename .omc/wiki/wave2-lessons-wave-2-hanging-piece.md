---
title: "wave2-lessons 已施工蒸餾：棋憶 wave 2、hanging-piece 判定接線、走法白話文"
tags: ["棋憶", "KeyMomentsCard", "describe.ts", "classify.ts", "蒸餾"]
created: 2026-10-14T06:22:24.250Z
updated: 2026-10-14T06:22:24.250Z
sources: []
links: ["wave2-decisions.md"]
category: debugging
confidence: medium
schemaVersion: 1
---

# wave2-lessons 已施工蒸餾：棋憶 wave 2、hanging-piece 判定接線、走法白話文

各項完成狀態查 git log；這裡只留「換個任務還會用到」的部分。

## CONTEXT.md 專案詞彙表（2026-08-09，試行中）
15 個詞，`@`-include 進 `CLAUDE.md` 常駐。**只有詞義不放規則**（抄規則＝第二份 SoT，會漂）。**判準＝下個 session 是否真省掉解釋術語的成本**，沒省到就砍。檔尾「待確認」四題待 Eason 回。

## 賽後關鍵步清單（`c558b6e`／`3293d96`，wave 1 已改成 carousel）
兩個坑仍成立——① 判準用「玩家走的 === bestMove」，**不可**用 Moment 的 `kind`（`displayKind` 把 anchor 壓成 `'bright'`，反推會把最大失誤講成好棋）；② `chess-board.vue` 初始 lastMove 在 `onBoardCreated` 補套，別退回純 watch。

## liveness 重生孤兒化 `play()` promise（`02f712d` 已修）
worker 重生那次的結果被丟棄，原本被 await 的 promise 永不 settle → `PlayView` 永久卡 `AI_THINKING`。**蒸餾**：測試裡的 `.catch(() => {})` 是警訊。

## `plans/`（`0582e4e`／`22181c8`，評估 shadcn/improve plugin 的副產物；002 已判 false positive 撤回）
**蒸餾**：稽核引用 `file:line` 全對 ≠ 結論對；擋下錯誤結論的是 plan 的 STOP 條件，不是它的 vet 階段。

## 棋憶 wave 2（2026-09-05，`2ba583b` 已 push）
深青互動格併進 carousel 最前面（pending 的 missed mate 一格一題，棋盤可動、零標記、就地走）、`RecognitionSignpost` 與 `?source=recognition` 整條路徑刪除、三顆鈕的中間那顆做循環步進（review deep，runId `wf_eded828f-0e1`）。**還會咬人的五件事**：
① `KeyMomentsCard` 是**單一 ChessBoard 換 `:fen`**，不是多盤 translateX carousel——`RecognitionBoard` 那套 360ms `reapplyFen` + `dispatchEvent(resize)` 的 stale-bounds 修法不適用，別看到「carousel」就抄。
② 深青格的來源要 **setup 同步取的快照**（`pendingFor('mate')`）：放 `onMounted` 首次 render 會空一輪；跟著 store 走則會在玩家走對的當下（`markConsumed`）從腳下消失。
③ 步進歸零的 watch **只能掛 `index`**，且切回已通關的格子要還原成「走完那一手」的畫面。掛 `isSolved` 或無條件歸零，棋子都會彈回走子前，而對話框寫著「就是這一手」。**同症狀兩條觸發路徑，各留一條測試。**
④ `:last-move` 要真的綁值（通關＝標出那一手，其餘 null）。原本傳 `null` 毫無 runtime 效果（`onBoardCreated` 只處理 truthy、watch 非 immediate），測試把它當保證＝假驗證。
⑤ 標題不寫「這盤」（見 [[wave2-decisions-wave-2-v2]]）。
**蒸餾**：刪一支元件要順手 grep 全 repo 的 SoT（這次 `persona-neve.md`／`positioning-v2`／`quick-specs/signpost-material-expansion.md` 三份同時漂掉，只想到改 CONTEXT.md）。

## hanging-piece 判定接線＋走法白話文（2026-09-05）
`classify.ts` 的 `hungUndefendedMaterial` 一直算出「哪顆子、在哪一格」再丟成 boolean，抽出 `hungMaterialDetail` 回 detail、boolean 版變成 `!== null`（`classify` 行為零變化）。`moment-display` 用同一組輸入（同一手＋同一個對手回應）重算，所以不必動 `Moment` 型別／`selection.ts`／`MemoryView.vue`。`describeMove` 從 `.get(from)` 改 `.move()`，一次拿到 captured／promotion／castle／en-passant。**四件事**：
① **`movePhrase` 是走法片語的唯一出處**（`describe.ts`）。`KeyMomentsCard` 原本自己硬編 `把{piece}移到 {to}`，於是卡片說「把后移到 f7」、Neve 那句說「用后吃掉 f7 的兵」。要顯示走法就呼叫它。
② **`.move()` 只收小寫升變後綴**：`a7a8Q` 會被當非法手丟掉整格（既有測試立刻轉紅）。`isLegalUci` 早就有 `normalizeUci`，只有 `describeMove` 漏了。片語內也不准有逗號——它會被塞進「與其X，不如先Y。」中間。
③ **「留在」在玩家自己把子送過去時是說反的**：`hungSquare === played.to` 就是這一手放上去的，說「留在」等於把主動送子講成疏忽。改成「你${played}，那裡沒人守著。不如先${best}。」這是最常見的送子形狀，不是邊角。
④ **吃過路兵的被吃子不在落點上**，照一般吃子模板會指到一個空格；`enPassant` 旗標讓片語不報格號。
**驗證**：vitest 870 綠、`vue-tsc` 0、375/1280 實跑 `/review`（1.e4 e5 2.Nf3 Nc6 3.Nxe5?? Nxe5 →「你用騎士吃掉 e5 的兵，那裡沒人守著。不如先把主教移到 b5。」標題「騎士沒人守著」）。
**蒸餾**：判定給不出來時標題與內文必須**一起**退回籠統版，只修一邊會標題點名、內文不提。
**review（deep，runId `wf_004dd5a2-dd4`）抓到而自驗漏掉的**：⑤「那裡沒人守著」的指涉物是 played 片語裡的格號，而吃過路兵的片語**刻意不報格號**——兩個各自正確的決定疊起來成了「你用兵吃過路兵，那裡沒人守著」，「那裡」指不到東西。`hungMaterialDetail` 擋的是**對手回應**是 e.p.，不是玩家這一手是，所以走得到（verifier 用 `4k1n1/6p1/8/4Pp2/8/8/8/4K3 w - f6 0 1` 實測）。已修＋留測試。
**蒸餾**：兩個各自正確的局部決定會疊出一個沒人做過的錯誤決定，這種缺陷單看任一邊的 diff 都看不出來。

來源：`production/session-state/active.md`（2026-10-14 搬入）。
