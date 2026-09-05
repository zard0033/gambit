# Gambit — 專案語言

這份檔只定義**詞**：這個專案裡一個詞指什麼、不要用哪些同義詞、哪些詞長得像但不是同一件事。

**規則不在這裡**。配色、字型、棋盤主題、人稱規則、測試紀律都在 `CLAUDE.md` 與各自的 SoT 檔；
這份檔最多指過去，不複述。一旦開始抄規則，它就變成第二份 SoT，然後開始漂。

---

## 詞彙

**棋憶**
`/review` 這條路徑與 `MemoryView.vue`：把剛下完的對局變成回顧內容的地方。
_Avoid_: 複盤、賽後檢討、review 頁

**Moment**
一盤棋裡被挑出來講的**單一手**，`src/modules/memory/` 的核心資料單位。
_Avoid_: 關鍵步、亮點、高光

**Neve**
Gambit 的教練角色，全站對玩家說話的聲音。人格 SoT＝`design/gambit-design-system/persona-neve.md`。
⚠️ 與 Eason 全域 Claude 設定裡的 output-style `Neve`（助理人格）**同名不同物**。
在 Gambit 語境「Neve」永遠指教練；要指助理那個要明講「全域 Neve」。

**判斷場 / 判斷訓練**
**同一件事的兩個時機**——兩者練的都是「察覺」（`positioning-v2` 四階段的第 1 階段），
名字像不是巧合，是親戚：

- **判斷場**＝**局後**。既有功能，`/learn/concept/:conceptId/judge`
  （`RecognitionFieldView.vue`），從概念地圖進入，**只出公版題**。你自己漏掉的將殺不走這裡——
  那些由棋憶頁的**深青互動格**就地承接（2026-09 wave 2）。
- **判斷訓練**＝**局中**。待辦功能，走子前強制答「有／沒有」、不給回饋、局後一次列對照表。
  尚未實作，dev-flow 釐清階段暫停中（前置閘門＝五盤紙筆實驗 P1）。

⚠️ 口語不要簡稱「判斷」——簡稱掉的正好是時機，而時機是兩者唯一的差別。
⚠️ 中英文名對不上（既有狀況，非錯誤）：「判斷場」的英文是 `Recognition`
（`src/` 下 8 個 `Recognition*` 檔、路由名 `concept-judge`），而 recognition ＝ 察覺。
讀程式碼時 `Recognition*` 一律指判斷場，不是指待辦的判斷訓練。

**深青**
在 Neve 對話框的語境裡，「深青」講的是**語意不是顏色**：這一格要玩家做一件事，而且就在這一格做
（相對「淺卡＝她在說明」）。顏色本身是 jade。
_Avoid_: 深色卡、jade 卡（會把語意丟掉）

**就地走**
玩家在當前這一格的棋盤上直接走出那一手就通關，**不跳頁**。與舊做法（點 CTA 導去另一頁）相對。

**唯一解局面**
只有一手是對的局面。目前唯一驗過的來源是 `selectMissedMates`（mate-in-1，
`src/modules/learning-loop/missed-mate.ts`）。**能不能做成深青互動格取決於這個**——
非唯一解會判錯玩家走對的手。

**kind / displayKind / momentTone**
三個都在描述 Moment 的分類，語意不同，不可互換：
`kind` 是原始判定；`displayKind` 會把 anchor 與 bright 壓成 `'bright'`；
`momentTone`（`src/modules/memory/describe.ts`）是語氣的單一來源。
_Avoid_: 拿 `kind` 或 `displayKind` 反推「這手是好是壞」——壓過的分類會把最大失誤講成好棋。

**深化 / `markDeepened`**
`src/stores/concept-progress.ts` 的標記，唯一消費端是概念地圖的標籤。
⚠️ **語意未定**：就地走改造後這個標記由誰下、還要不要下，尚未拍板（見 `active.md`「未決」）。

**斷層**
定位 v2 的核心診斷：**認知遷移失敗**——學到的東西在該用的時候調用不出來。產品要打的就是這個。
SoT＝`production/positioning-v2-2026-08-02.md`。
_Avoid_: 落差、gap

**rung**
**對手**強度的階（`src/config/difficulty-tuning.ts`），不是玩家等級。
_Avoid_: 難度、等級、level

**課程 / 練習題 / 概念**
三種內容類型，資料在 `src/data/lessons/`、`src/data/puzzles/`、`src/data/concept-deepening/`。
各自的 Neve 人稱規則在 `CLAUDE.md`，此處不複述。

**SoT**
某個主題的唯一真相檔。目前有四個：定位（`positioning-v2-2026-08-02.md`）、
視覺（`design/gambit-design-system/`）、人格（`persona-neve.md`）、
lib/ vs modules/ 判準（ADR-0015）。
_Avoid_: 規範、標準、參考文件

**token**
`@theme` 定義的 CSS 變數（`var(--color-*)`）。
⚠️ 與 credential 的 token 同名。「session-state 禁貼 token 實際值」那條講的是 credential。
兩者同時出現時說「設計 token」／「憑證」。

**D／P／R／Q 編號**
四套互不相干的編號，講的時候要說是哪一套：

- `D1–D7` — 定位 v2 的**刪除**判決項
- `P1`／`P2` — 定位 v2 的**優先序**（P1 五盤紙筆實驗、P2 mate→material）
- `R1` — 定位 v2 的**重構**項（`src/stores/data-sync.ts` 拆 local-store ＋ cloud-adapter）
- `Q1–Q12` — grilling 的**問題**編號
_Avoid_: 裸講「D3」「P2」而不說是哪一套

---

## 關係

- 一盤**對局**產出多個 **Moment**
- 一個 **Moment** 只有在是**唯一解局面**時才能做成**深青**互動格；否則只能做成說明格
- **概念** → **判斷場**（公版題，從概念地圖進入）
- **棋憶** → **深青互動格**（自己剛下的那盤棋）
- 每個 **SoT** 管一個主題；`CLAUDE.md` 是路由，不是 SoT

---

## 待確認

以下是我從 `CLAUDE.md`／`active.md`／原始碼推出來的，不確定是否為你平常的講法：

- **「棋憶」的邊界**：指整個 `/review` 頁，還是只指那個 carousel？現在寫成整頁。
- **「Moment」要不要中文名**：目前程式碼裡是 `Moment`，口語似乎講「關鍵步」。
  我把「關鍵步」放進 _Avoid_，但如果你口語就是講關鍵步，那該反過來——中文當正名、`Moment` 標成程式碼識別字。
- **「深青」是不是已經穩定成語意詞**：2026-08-08 才拍板，可能還在顏色的用法上。
- **`rung` 有沒有中文說法**：目前直接用英文。
