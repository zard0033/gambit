> 本檔為 2026-07-30 快照手術前的完整歸檔（678 行版 active.md 原文照存）。
> 手術原因：快照膨脹成流水帳（status-protocol 失效模式）；施工細節本來就在 git，
> 本檔只作歷史查閱用，**不再更新**。現況一律看 active.md。

<!-- STATUS -->
Epic: 差異化重構
Feature: 對局難度階梯重製（引擎弱化 + 難度選單）
Task: 2026-07-29 **難度階梯已施工完成、待實玩驗收**——根因＝對手從未被調弱
（`play-engine` 只送 Skill Level，depth 無上限、`movetime 3000`，資源遠超 lichess level 8；
**舊的「難度 0」不是最低難度**）。已落地：五檔階梯（抄 lichess 1/2/3/4/6）＋選單重製
（變體四＝橫向軌道＋節點下掛標籤＋明朝大字重述，包進 `DarkPanel`）。vue-tsc 0 error、
全量 vitest 93 檔 925 綠、cream／noir 雙主題 390px 截圖驗過。
**剩兩件**：① ui-design-flow ➍➎ 獨立評審未跑（需派 agent，本 session 受限未派）
② **AC-5＝Eason 實玩檔一「初學」要贏得了**——這條是整件事的目的，只有他能判。
<!-- /STATUS -->

> **交接快照**：只留現況 + 待辦 + 未固化的 in-flight 決策。長期鐵則/技術參考在 CLAUDE.md 體系（見「接手必讀」），不複述；**已完成施工細節在 git**。
> **差異化北極星 = `production/gambit-differentiation-vision.md`**——提任何功能/重構/UI 前**先讀**。

---

## 2026-07-29 對局難度階梯重製（進行中）

### 三件事的優先序（Eason 2026-07-29 拍板）

1. **對手強度修正** ← 現在做。修完才有可信的對照組
2. **課程→對局的 gap 重新評估**——等 1 完成後 Eason 重玩一輪再判斷。若 gap 仍在，候選解＝
   優勢局面下完／殘局實戰／開局十步（都是既有系統的延伸，非重做課程）
3. **UI／UX design flow 全站化**——排最後。**不逐頁跑五階段**，先全站 audit 分流，
   只對真有問題的頁跑完整流程，其餘標「下次要改時再跑」

> 順序理由：1 沒修之前，「學完課程仍贏不了」這個實驗的對照組是壞的，不能拿來推論課程系統
> 方向錯誤。3 排最後是因為 2 可能改動資訊架構，現在跑等於幫要重做的頁做設計。

### 已驗證事實（node 直驅 Stockfish 實測，非推論）

- **現況＝對手從未被調弱**：`play-engine.ts` 只送 `setoption name Skill Level`，接著
  `go movetime 3000`——無 depth 上限、無 `UCI_LimitStrength`。搜尋資源遠超 lichess 最高的
  level 8（depth 12 / 400ms）。**現在的「難度 0」不是最低難度。**
- **lichess 對照**：level 1 = skill 3 / depth 1 / 50ms；level 8 = skill 20 / depth 12 / 400ms。
  三件套一起調，**depth 才是主角**。（註：現行 lichess 用 Fairy-Stockfish 的負值 skill，
  標準 SF18 範圍 0–20 無負值，我們用不了）
- **depth 1 仍不會吊子**：quiescence search 會把吃子序列算完。depth 1 vs depth 6 一局打完
  子力 0:0，輸在被將殺，開局仍下得像樣（`Nf3 d5 d3 Nc6 g3 f6 c4`）。
- **要犯錯必須注入隨機手**：depth 1 + **20% 隨機**＝對 depth 6 淨輸 9 子（后冒進、王亂走、
  中局失子，但開局仍體面）；**35%** ＝淨輸 20 子、連續送大子——那是 chess.com 低階 bot 的
  反面教材，玩家贏了會知道對方在亂下，**給不了成就感**。20% 是目前的甜蜜點。
- **頂部擠在一起**：depth 6 vs depth 10 六局有五局在 80 手內分不出勝負；depth 10 vs 全力
  也只決勝 4/6。對初學者訓練 app 而言「很強」與「更強」是同一格。
- **中間有斷崖**：depth 1+8%隨機 vs depth 6 ＝ 6:0 全數將死。這段空白正是使用者要待數月的區間。

### 旋鈕有效性實測（三輪，每輪都推翻前一輪的假設——照順序讀）

- **隨機比例不是有效的分級旋鈕**：25% vs 12% 隨機打成 4:4（50%），玩家不可能感覺到差異。
  隨機的作用是「讓對手會犯錯」，**不是分級**——所以它該是低檔共用的固定值（暫定 15%），
  不是每檔給不同比例。真正的大跳是「有隨機 vs 無隨機」。
- **多變數混淆是實驗設計錯誤**：第二輪每檔同時改 depth／skill／movetime／random 四個變數，
  測出的差異無法歸因，還測出「檔三輸給檔二」的反序。**分級參數一次只驗一個變數。**
- **🚩 勝率作為度量不可靠——四輪數據全部作廢，不要拿去定參數**：每對只有 5–6 局決勝，
  一局值 20 個百分點，隨機開局＋隨機手注入的變異直接淹沒訊號。決定性證據＝**同一組對比
  兩輪結果相反**：`d2 vs d1` 第三輪 83%、第四輪 20%（反序）；`d6 vs d4` 第三輪 100%、
  第四輪 50%。加大樣本是「同做法換參數」，不解決根因。**改用平均 centipawn loss**
  （每局約 50 個樣本點 vs 1 個，變異小一到兩個數量級，且直接對應「這個對手下得多爛」）——
  script＝scratchpad `cploss-ladder.js`，判官用 depth 12、cpLoss 上限 1000 避免單一崩盤淹沒平均。
- **⚠️ 奇數 depth 疑似不可用（奇偶效應）**：勝率輪測到 `d3 vs d2 = 0%`（depth 2 完勝 0:5），
  是所有勝率數據裡最極端的一筆，且有獨立文獻佐證——成因＝alpha-beta 最小博弈樹拓撲 ＋
  奇數層的額外先手使評估偏樂觀（[Chessprogramming: Odd-Even Effect](https://www.chessprogramming.org/Odd-Even_Effect)；
  歷史程式 L'Excentrique／Bebe 即以「兩層遞增」規避）。**暫定階梯只用偶數 depth，
  待 cpLoss 複驗確認**（文獻＋極端值兩項佐證，但度量本身已知有缺陷，不可當定論）。

### 架構落點（已確認，進 spec）

- **隨機手注入不放 `play-engine`**：它不 import chess.js，是純 UCI 通道；`PlayResult` 型別上有
  「only objective chess data」的邊界註記，ADR-0002 亦規定 postMessage-only IPC。要在那裡挑
  隨機手就得算合法手＝讓引擎模組開始懂棋規，破壞既有分層。
- **切法**：`play-engine.play()` 只加一個 optional `depth`（`go movetime T` → `go depth D movetime T`），
  改動極小；難度查表與「這手要不要走隨機」的決策放 `use-game-lifecycle`——它已 import chess.js
  且已在管 `aiSkillLevel`。

### 🔑「弱」不是一維的——本輪最重要的發現

cpLoss 量測（judge depth 12，對手固定 depth 4，每檔約 56 手）：

| 檔（測試用） | mean cpLoss | median | 崩盤 ≥300cp |
| ---- | ---- | ---- | ---- |
| d1 + 15% 隨機 | 90 | 22 | **5**/56 |
| d2 + 15% 隨機 | 145 | 23 | **6**/53 |
| d2 無隨機 | 89 | 29 | 3/55 |
| d4 無隨機 | 59 | **56** | **0**/56 |
| d6 無隨機 | 38 | 18 | 1/56 |
| 全力（參考點） | 3 | 0 | 0/56 |

mean 與 median 給出**矛盾的排序**，原因不是雜訊：

- **隨機手注入 ＝ 崩盤型的弱**（median 低、崩盤多）：大部分手下得不錯，偶爾整盤送掉。
  玩家贏了會知道是對方送的——**這正是 chess.com 低階 bot 的反面教材，給不了成就感**。
- **depth 限制 ＝ 持續小虧型的弱**（median 高、崩盤零）：每手小虧一點、從不崩。
  玩家靠慢慢累積優勢贏——**這才是要的那種弱**。

> **結論：隨機手注入整個放棄。** 先前「20% 是甜蜜點」的判斷是看子力差得出的，
> 那個判準看不出崩盤型與持續型的差別。另註：此輪 foil 固定用 d4，故 d4 那列是自己對自己，
> 局面性質不同、median 偏高有此偏差成分。

### 方向（已定案）——抄 lichess，不自己發明

**五輪自製測量的產出不是參數表**，是「理解為什麼 lichess 那樣設計」。lichess 的 skill+depth+movetime
三件套經幾百萬局真實對局調校，樣本量差我五個數量級，我測不出更好的。**直接抄它的 1/2/3/4/6 檔**：

| 檔 | Skill | Depth | Movetime |
| ---- | ---- | ---- | ---- |
| 一 | 3 | 1 | 50ms |
| 二 | 6 | 2 | 100ms |
| 三 | 9 | 3 | 150ms |
| 四 | 11 | 4 | 200ms |
| 五 | 17 | 8 | 300ms |

這順帶解掉奇偶效應的顧慮——lichess 用 depth 3 多年無事，因為 Skill Level 的候選擾動蓋過該效應；
我的測量會放大它，是因為把 skill 固定在 0。**上線後靠 Eason 實玩微調，不再自製測量。**

### 待辦（依序）

1. ~~定出參數表~~ ✅ 收案（抄 lichess）。自製測量到此為止，不再開新輪
2. ~~寫 spec~~ ✅ `design/quick-specs/difficulty-ladder-remake.md`（★ Eason 已核可）
3. **⚠️ 規模從「大」降回「中」——不需要 migration**：`ai_difficulty` 的 CHECK 是
   `BETWEEN 0 AND 20`，五檔各對應一個 skill level（3/6/9/11/17），**續存那個 skill level 即可**，
   不改欄位語意。`highestBeatenLevel`／`resume.level`／`data-sync`／`game-export` 全部照舊能用。
   先前判「大」是假設要改欄位語意，那假設不必要。
4. ~~實作~~ ✅ 五檔階梯 + 選單重製全數落地（改動清單見下）
5. ~~ui-design-flow ➍➎ 三路評審~~ ✅ 跑完（hallmark／impeccable／web-design-guidelines），
   findings 已合併修完十條（見下「評審修復」）
6. ~~fresh-context 複驗~~ ✅ 跑完：**18 條 17 pass / 1 fail**，唯一 fail 是字階（見下），已修並複量
7. **🔴 AC-5 FAIL（2026-07-29 Eason 實玩）**——**下最低階「初學」仍然輸**。
   底部到頭了：depth 不能低於 1、movetime 也壓不動。**下一步＝MultiPV 挑次好手**
   （從候選前幾名裡挑差的，錯得像人；不是本輪已否決的「隨機送子」）。要動 engine 解析層，
   且 `handshake.ts` 目前寫死 `MultiPV 1`、與 review 分析路徑共用，改時勿污染分析。

### 2026-07-29 續：出手節奏 ＋ 刻度改分段條

**出手節奏（已修）**——Eason 回報「下得好快，很像快棋」。根因：我把「引擎搜尋時間」和
「對手表現出來的思考時間」當成同一件事。實測**引擎本身只花 21ms 就回手**（停頓歸零時量的）。
修法＝`difficulty-tuning.ts` 加 `MIN_THINK_MS=900` / `THINK_JITTER_MS=600` ＋ 純函數
`remainingThinkDelayMs(elapsed, roll)`（roll 可注入故可測），`PlayView.requestAiMove` 在引擎回手後
補足到該下限才落子，並在等待後重驗 `phase` 以丟棄過期的手。實測體感：落子動畫 820ms ＋ 引擎 21ms
＋ 停頓 900–1500ms ≈ **1.7–2.3 秒**。

> ⚠️ **量測陷阱（我踩過，會誤導調參）**：Playwright 開多分頁時，非前景頁的 `setTimeout` 會被瀏覽器
> throttle。我第一次量到 3019ms 差點照著把停頓調小——實際是分頁在背景。量任何跟 `setTimeout`
> 有關的節奏前，先 `bringToFront()` 並關掉其他分頁。

> 可省未省：引擎現在是**等玩家落子動畫跑完才開始算**（`PlayView` 的 `await payload.animationDoneAt`），
> 那 820ms 是乾等。改成動畫與思考並行可省下來；目前總節奏尚可，刻意不動。

**刻度改分段條（Eason 選 A）**——原「圓點＋連線」被嫌醜。樣張見
`design/demos/difficulty-track-restyle.html`（四案：現況／分段條／棋子刻度／純文字底線）。
**棋子刻度（兵→騎士→城堡→后→王，子力嚴格遞增）Eason 因擴充性顧慮否決**，雖然實際上
六階上限碰不到（往上加階無意義，實測 d6 vs d10 分不出勝負）。採 A：五格連成一條、面積取代線條。
降權改用**底色深淺**（`bg-surface-deep/70` vs `/40`）而非文字顏色——降文字會壓低對比，降底色反而提高。
radiogroup／roving tabindex／方向鍵／aria-live 全部沿用，換形式後複驗仍通過（觸控 60×52）。

> 隨形式改變而消失的修復：先前為「第一次獲勝軌道不亮」寫的 `litRailWidth` 半步偏移已刪除。
> 分段條天然沒有這個問題——贏第一階就有一整格變綠。

### 複驗（verifier，fresh context）結論與後續處置

- **唯一 fail＝字階**：`text-[11px]`（label）與 `text-[26px]`（選中階名）不在設計系統字階
  （44/32/28/22/18/16/14/13/12）上。verifier 按字面判 fail 並拒絕自行改判準，只列減輕情境交裁決——
  **這是對的做法**（驗收條件是我寫得不精確，不是它過嚴）。已修：11→12（caption）、26→28（h1）。
- **排除一個 medium 疑點**：verifier 質疑 blurb 仍用 `ink-on-deep-dim`、對比疑慮應同樣成立。
  實測面板內垂直位置：label 13% / 階名 45% / 大字 69% / **blurb 87%**。漸層 160deg 近似由上而下，
  87% 處插值約 `#1b453a`，`#9bbdb1` 對它 **5.26:1**，過 AA。**dim 色只在漸層亮端失分**，
  blurb 在暗端，層級可保留、不需提亮。
- **⚠️ 量測時序陷阱（verifier 發現，未來寫回歸腳本必讀）**：這個 dialog 有 0.95→1 的 scale 進場動畫，
  開啟後 300–900ms 內量 `getBoundingClientRect()` 會拿到全體 ×0.95 的假數字
  （它第一次量到 41.8px/20.9px，等動畫結束才是 44px/22px）。**量這個 modal 一定要等動畫結束**，
  否則觸控目標會誤報不達 44px。

### 🚩 待辦：執子方也改 radiogroup（Eason 2026-07-29 決議「列待辦」）


`play-setup-modal.vue` 的執黑／隨機／執白仍是 `button + aria-pressed`，三選一語意上同樣該是
`radiogroup` + `radio` + roving tabindex + 方向鍵——與難度階梯本輪剛改好的做法一致。
**同一個 modal 內目前兩套語意並存**。非本次改動範圍故複驗未判 fail，但既然難度那組已示範過
完整寫法，照抄即可，成本很低。順手做的話可一併統一「已選中」的視覺語言
（現為綠框 vs 金環兩套，見下方「評審提出但本輪不做」）。

### 🚩 待辦：noir 深色模式的 DarkPanel 明度（Eason 2026-07-29 決議「之後再做」）

**問題不是色相，是明度差。** Eason 回報「jade 配暗色就是不搭尬，調過很多輪都沒用」——
hallmark 實測給出診斷：noir 下 modal 底是 `rgb(39,35,32)` 暖黑棕，`DarkPanel` 是 jade 漸層
`#1f5f4b → #0e3a2c`，**兩者亮度接近，面板「跳出來」的錨定效果比 cream 弱很多**。
調色相調不動，是因為調錯維度了。

**修法（hallmark 給的兩條，未擇一）**：① noir 下面板漸層再提亮一階；② 給 DialogContent
挑一個更明確偏中性／非綠的深色，重新拉開兩者對比。

**範圍警告**：`DarkPanel` 是全站共用元件（首頁／對局／深化都用），改它的 noir 配色＝一次動到
所有深色區塊。**動手前先做 A/B demo 讓 Eason 挑**，不要直接改進去。

> 本輪已修的是**文字對比**（階名／label 提亮、徽章加深色 pill 底），那與本項無關、已完成。
> 「直接砍掉暗色模式」仍是 Eason 提過的選項；砍要連 Supabase `user_preferences` 的
> theme CHECK constraint 一起處理（不可逆），所以先試最便宜的修法。

### 評審修復（2026-07-29，三路 findings 合併一輪修）

- **radiogroup 語意（critical）**——五選一原用 `button + aria-pressed`（獨立開關語意），
  螢幕閱讀器聽不到「第 N 項共 5 項」。改 `role="radiogroup"` + `role="radio"` + `aria-checked`
  ＋ roving tabindex ＋ 方向鍵／Home／End。**焦點落點問題隨之自動解決**（非選中階 `tabindex=-1`，
  Tab 直接到選中那階），未另寫 autofocus。
- **`aria-live="polite"`**——選中換階時名稱與描述整段更新，沒有它螢幕閱讀器讀不到變化。
- **第一次獲勝的軌道（我的公式錯）**——原 `litRailWidth` 在 `beatenRung <= 1` 回 `0px`，
  使「第一次獲勝」成為唯一「節點有勾、軌道全暗」的狀態，恰好是最該被慶祝的那次。
  改成亮到已通過那階**再往前半步**；半步也讓五階全通時剛好滿格。
- **「你上次贏過 X」語意錯位（我的邏輯錯）**——原綁全域 `beatenRung` 放在描述段，打穿後點回初學
  會同時讀到「初學：常常看不到你的威脅」＋「你上次贏過大師」。改成右上角常駐徽章「最高 · X」。
- **輕度降權**——超過建議階的節點 22px→18px。**刻意用尺寸不用顏色**，降顏色會壓低對比。
- **對比**——面板頂端是漸層最亮處（160deg 由上而下），小字疊在那裡掉出 AA
  （`ink-on-deep-dim` 僅 3.30:1）。階名與 label 改全亮 `ink-on-deep`（選中與否改由字重承擔）；
  成就徽章自帶 `bg-surface-deep/70` pill 底，才留得住 success 綠又不失對比。
- **reduced-motion**——補 `motion-reduce:transition-none`，對齊專案既有 Button 寫法。
- **字階**——13.5/12.5px 不在官方字階上，對齊成 13/12。
  ⚠️ 兩路 agent 都報「文字低於 16px 違反鐵則」是**誤判**：設計系統原文是
  `body 16 (min) · body-sm 14 · label 13 · caption 12`，16px 下限只綁 body，
  且 iOS auto-zoom 只作用於 focusable input。日後再收到同樣 finding 可直接駁回。
- **「精通」文案**——原「很少失誤，要靠佈局才有機會」轉去評論玩家勝算，與其餘四句「描述對手」
  的語氣不一致且隱含壓力。改為「很少失誤，開局也算得清楚。」

### 評審提出但本輪不做（記著，別重新發現一次）

- **連續卡關時介面毫無差異化陪伴**——`beatenRung` 只前進不記錄失敗，輸 8 次和第一次挑戰畫面
  完全一樣。UX agent 判斷：新設計有了清楚的「你應該贏這階」敘事之後，卡關反而更醒目。
  需要新的持久狀態，超出本輪範圍。
- **五階打穿後沒有收尾肯定**——只是多幾個綠勾，是唯一讓它讀回「像進度條」的地方。
- **執子方與難度用兩套「已選中」視覺語言**（綠框 vs 金環）——同畫面兩種慣例。
  金色限 focus/reward 是設計系統鐵則，故未動。

### 已落地的改動（2026-07-29）

- **新增 `src/config/difficulty-tuning.ts`**——五檔表（rung／name／blurb／skillLevel／depth／
  movetimeMs）＋ `rungAt()` ＋ `rungForSkillLevel()`（把前朝任意 0–20 值映射到最近的檔，
  舊續玩存檔才不會壞）。文案誠實原則：第五檔是 depth 8 **不是全力**，blurb 不得宣稱全力。
- **`play-engine.ts`**——`PlayInput` 加 optional `depth`，`go` 指令抽成 `goCommand()`。
  **`_checkpoint` 一併帶 depth**：漏了的話 iOS 背景切回觸發 worker 重生會靜默退回無 depth 的舊行為。
- **`PlayView.vue`**——呼叫引擎前 `rungForSkillLevel(chosenLevel)` 查表。`chosenLevel` 仍存 raw
  Skill Level，所以下游全鏈路不動。
- **`play-setup-modal.vue`**——21 格數字 → 五階橫向軌道（變體四）。包進既有 `DarkPanel`；
  gold 只給當前節點的 ring，已通過用 `success-on-deep`；`legend` 改 sr-only、節點 44px 觸控目標。
  順手修掉一句過期文案：「無限思考時間」已不成立（每檔都有 movetime 上限）。
- **`game-history-mappers.ts` ＋ GDD game-history Formula 2**——區間重切成五檔各佔一段
  （`0-4/5-7/8-10/11-14/15-20`）。Eason 授權改上游文件。順帶修掉既有的文件／實作不一致
  （GDD 寫 `4–7 Easy`、程式碼寫 `[4,6]`，`7` 兩邊對不上）。
- **測試**——新增 `tests/unit/config/difficulty-tuning.test.ts`（表不變式＋legacy 值映射）；
  `play-engine-uci.test.ts` 加三條（go 帶 depth／不帶 depth 的回溯相容／五檔各驗參數）；
  `game-history-mappers.test.ts` 加一條守住「五檔各得一個標籤」。

### UI 決策紀錄（ui-design-flow ⓪➊）

- **⓪**：三方向樣張 `design/demos/difficulty-selector-concepts.html`（棋力階段／對手身份／序數）。
  Eason 選「甲乙合併」＋要求橫向解捲動。**⓪ 的三個樣張全 cream、無 deep-jade 錨——那是它們扁的原因**，
  ➊ 才補上 `DarkPanel`。
- **➊**：四變體樣張 `design/demos/difficulty-selector-final.html`，Eason 選**變體四**
  （節點下掛標籤看全貌 ＋ 明朝大字重述選中檔）。變體一二被否的真原因：**只顯示選中那一檔的名字**，
  玩家得一個個點才知道有哪五個對手。
- **命名語彙（選單與歷史紀錄共用）**：初學／進階／熟練／精通／大師。
- **不顯示 Skill Level 數值**（Eason 拍板）：引擎內部參數對初學者無意義，等於把 21 格數字選單的病
  帶回來一半。要查對照直接看 `difficulty-tuning.ts`。設定頁**沒有**開發者區塊（唯一的 dev 工具是
  `PlayView` 的 Ctrl+Shift+F FEN 注入）；為此新建一個不划算。

### 相關發現

- `game-history-mappers.ts` 的 `DIFFICULTY_RANGES` 早就把 0–20 收成五個標籤
  （Beginner/Easy/Intermediate/Hard/Master）——**產品早已認定五級是對的**，只是這判斷只用在
  歷史紀錄顯示，選單那端仍把底層 21 檔整個攤給玩家
- **Maia**（人類化 NN 引擎，1100–1900，用真人棋譜訓練、犯人類會犯的錯；lc0 有 WASM 版、
  權重約 1.2MB）＝日後做「陪練角色」時的答案，**現在不做**：要引入第二套引擎 runtime，
  且最低 1100 對真初學者仍偏強
- **design flow 現況盤點**：2026-07-20 之後的 UI 工作有跑且留了申報行
  （`home-scene-redesign` / `journal-book-redesign` / `navigation-vertical-world`）；之前的
  沒跑（＝app 絕大部分）。根目錄 DESIGN.md 是**刻意不建**，由 `design/gambit-design-system/`
  擔任該角色（見 quick-spec 檔內註記）。**未結欠帳＝玄夜換血輪次的 ➍➎**——hallmark audit
  與 web-design-guidelines 兩路從未跑過，那批已經 push 上線（見下方 07-22 節「未跑」段）

> 測量 script 在 scratchpad（非 repo）：`level-gap-probe.js`（對局棋譜＋子力差）、
> `rung-spacing.js`（相鄰檔勝率）。要重跑得先重建——scratchpad 是 session-specific。

---

## 2026-07-27 Supabase 專案被暫停（已 restore）＋ keep-alive workflow

**事故**：Supabase free tier 專案（`vfnzekqtvxhewifnmtnz`）因 7 天無資料庫活動被暫停，
線上站登入／雲端同步全掛。**暫停的專案連 DNS 都會被撤掉**——症狀是 `curl` / `nslookup` 回
`Could not resolve host` / NXDOMAIN（本機與 8.8.8.8 皆然），不是回一句 "project is paused"。
以後看到 supabase.co 網域解析不到，第一個猜測是被暫停，不是被刪。Eason 於後台 Restore 後即恢復。

**restore 後 schema 完整**（anon REST probe 逐表確認）：7 張 live 表全 200；
`skill_scores` / `lesson_side_learned` 回 404（＝已 drop，與 `supabase/README.md` 記載一致）。資料無損。

**防復發**：`.github/workflows/supabase-keep-alive.yml`——至多每 3 天 `curl`
`/rest/v1/journal_entries?select=id&limit=1`（實表查詢才會真的打 DB；`/auth/v1/health` 與
`/rest/v1/` 根目錄都不保證）。沿用既有 secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，
無新增設定。非 2xx/4xx 一律讓 job 紅（專案再被停就看得到，不會靜默綠）。
**注意 GitHub 政策：repo 連續 60 天無 commit 會自動停用 scheduled workflow**。

---

## 2026-07-22 玄夜換血輪次（noir 色板換血 + 首頁墨韻融合落地）

**結論**：noir 顯示名「暖墨」正名「玄夜」（內部值 `'noir'` 不動，Supabase check constraint 不動）；
色板從舊「深墨綠」全面換成「玄黑紙 × 漆玉」（J3），全站映射鐵則＝cream 紙→玄黑系、cream 玉→漆玉
系、金不動。首頁（HomeView/NeveSceneHeader）依已核可決策樣張 `design/demos/home-ink-fusion-final.html`
落地墨韻融合：cream＝墨氣柔化，noir（玄夜）＝材質分層。

**改動檔案**：
- `src/assets/main.css`——noir `:root` token block 整段重調（surface/line/ink 系列）；11 個
  theme-aware class（`.app-header-bg`／`.app-bottomnav-bg`／`.dark-focus-panel`／
  `--scene-nav-join`/-sky-a/-b／`.game-over-panel`／`.dungeon-zone-bg`／`.dungeon-action-bar`／
  `.signin-bg`／`.puzzle-result-panel`）改用漆玉（J3）家族；`.dungeon-node-face-done`／
  `.dungeon-node-check-done`／`.lesson-progress-fill` 已是玉系維持不變。新增
  `.gambit-surface-card`（cream 墨氣柔化／noir 材質分層共用 class）、`.lesson-tag-ink`（印框
  tag）、`.journal-ink-dot`（行首墨點）、`.ink-seep`（頭部墨氣下滲）四個首頁融合共用件。
- `design/gambit-design-system/colors_and_type.css`——SoT noir 段同步（值＋映射鐵則＋「玄夜」
  命名＋墨韻母題段補 cream/noir 差異化表現說明＋保留清單）。
- `src/components/ui/card/card.vue`、`src/components/ui/gambit/stat-card.vue`——改用
  `.gambit-surface-card`（原 cream 白邊暖棕陰影不變，noir 新增材質分層）。
- `src/views/HomeView.vue`——眉標「NEW GAME」→墨記「今日」＋短筆畫；課程卡 tier 標籤加印框
  tag；棋誌 peek 行首圓點→不規則墨滴（未讀另疊亮綠角標）；棋誌卡改 `.gambit-surface-card`。
- `src/components/home/NeveSceneHeader.vue`——`.scene` `overflow: hidden`→`visible`（放行
  `.ink-seep` 下滲）；`<section>` 內補 `.ink-seep` div。
- `src/views/ProfileView.vue`——外觀 toggle 標籤「暖墨」→「玄夜」。
- `production/session-state/active.md`——STATUS 更新 + 07-21 節「暖墨」殘留改為已正名記錄。

**驗證**：
- `npx vue-tsc --noEmit` 0 error。
- `npx vite build` 成功（間接證實 CSS/Vue 語法正確；供 vitest 全紅時的獨立佐證）。
- `npx vitest run` **本輪未取得綠燈**——92 檔全數在 import/collect 階段即失敗（`Cannot read
  properties of undefined (reading 'config')`／`Vitest failed to find the runner`），已排除本輪
  診斷：全新未用過的 `VITEST_CACHE_DIR`、`node_modules/.vite` 搬移重建、`--pool=forks`、
  `--maxWorkers=1` 四種手法逐一試過仍同錯，且 `vite build` 成功排除語法錯誤——研判為**環境資源
  競爭**（`netstat` 確認另有 dev server 佔用 5173、scratchpad 下發現非本 session 的另一 Claude
  session 正在同一 repo 操作，`tasklist` 當時有 40+ node.exe），非本輪 diff 造成。**下一段對話
  push 前務必補跑乾淨環境下的 `npx vitest run` 確認全綠**，不可用本輪的 build-only 佐證頂替。
- WCAG 實算（玄夜，全部 ≥4.5:1）：faint/card 4.58:1（precommit review 抓到原 #857C70 只 3.8:1，
  已提亮為 #948A7D；faint 真文字限 base/card 面、raised 面只准裝飾——已註記於 main.css 與 SoT）、
  ink/base 15.20:1、ink/card 12.81:1、muted/card 6.05:1、
  primary(連結)/base 5.95:1、danger/base 5.97:1、金字(#FFC94D)/深玉(#123A2C) 8.23:1、
  暖白/漆玉(#1F5F4B，hero 最亮點) 6.10:1。card/base 相對亮度比 1.19:1（樣張門檻，準確值
  ≈1.1866，四捨五入達標）。
- 截圖（scratchpad，dev-server 實測，guest 登入）：home cream/玄夜 × mobile/desktop 四張＋
  玄夜 `/learn`、`/dungeon` mobile 各一張——六張皆無黑色 token fallback，深區可辨為漆玉、卡片
  可辨材質分層。
- **未跑**：`playwright test visual-regression`（e2e，同上資源競爭風險，留給下一輪在確認
  dev server 淨空後跑，含 home 快照 `--update-snapshots`）；hallmark audit／
  precommit-review／web-design-guidelines 三路並行評審（➍➎，按 ui-design-flow 排在下一步）。

**保留清單（未採用、未丟棄）**：inkskin「以墨為玉」概念（`design/demos/home-ink-fusion-inkskin.html`）
——日後若要進一步收斂玉區用量可回頭參考。

## 2026-07-22 佈局 from-scratch 專案收案 + 首頁回退

**結論**：佈局 from-scratch 方向（星夜旅程小徑、墨色垂直世界及其後續替代構圖，合計十案）全數敗於
2026-07-14 前的舊卡片佈局（深青招呼頭部＋「開始新對局」hero 卡＋繼續學習卡＋總覽三磚）。Eason 逐輪
比較後拍板：**首頁退回舊卡片佈局，方向廢止**。敗因診斷：十案共通問題是缺乏**色塊錨定**與**卡片實體
感**——星夜的蜿蜒小徑、垂直世界的分層 diorama、墨紙條目式、及甲乙丙/丁戊己等變體，都把資訊攤成
連續性的場景/軸線敘事，失去舊版「一眼可分辨的色塊區域」與「卡片=可點擊實體」的直覺。

**已回退（外科手術，非整檔 checkout）**：
- `src/views/HomeView.vue`、`src/components/home/NeveSceneHeader.vue`——還原至 `241e4ea`（D3 招呼框
  版本，佈局 from-scratch 之前的最後穩定態）。星夜版新增的 `CtaStation`/`PathStation` 型別、蜿蜒小徑
  版面、`ctaStation`/`lessonStation`/`trialStation` computed 已隨整檔還原一併移除（無孤兒引用）。
- `src/assets/main.css`——只反做 `27a26cb`／`63e67db` 對「ATMOSPHERIC HOME SCENE」token 段的 hunk
  （四時段 `--scene-sky-1..6`／`--scene-star-opacity`／`--scene-core-*`／`--texture-sky-grain` 全數
  移除，還原為 `--scene-sky-a`/`-b`/`--scene-glow` 舊版三 token）。**noir 主題 token 區與「墨韻 (INK
  GARNISH)」段完全未動**（grep 確認完好）。
- **noir 下的舊招呼框補一組深色適配**（比照 `.app-header-bg` 手法）：舊版 `--scene-sky-a`/`-b`/
  `--scene-nav-join` 是 cream 定案時的深 jade 值，未曾被 noir 主題看過——在 noir 下比周邊底色淺、讀
  成一塊突兀亮框。已在 main.css 加 `:root[data-theme='noir'] [data-scene='X']` 覆寫（四時段個別加深，
  比例對齊 noir `.app-header-bg` 的加深幅度 ≈×0.52）＋ `:root[data-theme='noir']` 的 `--scene-nav-join`
  直接對齊 noir `.app-header-bg` 底部停駐色，維持「與 AppNav 無縫銜接」的原始設計意圖。截圖已目視
  確認 noir 下不再突兀。

**墨韻融合（鋪量克制，只加三處）**：
1. 招呼語墨筆——`NeveSceneHeader.vue` 的 h1「棋盤未曾離開，你來了。」下方掛 `InkBrush` 底線；深青
   表面兩主題皆用暖白墨（scoped 覆寫 `--color-ink-brush: rgba(236,230,218,.72)`，不動全域 token——
   墨色跟著表面走、不跟主題走）。
2. 段落標籤乾筆——`HomeView.vue` 三個 `SectionLabel`（繼續學習/總覽/棋誌）旁配寬扁乾筆（`InkBrush
   width=200 height=8 thickness=0.18`），統一處理、各自不同 seed 避免視覺重複；cream/noir 走全域
   `--color-ink-brush` 預設值（未覆寫，深棕墨／暖白墨隨主題切換）。
3. 未加飛濺（`InkSplatter`）——首頁是日常場景，金墨飛濺仍限 reward/特殊時刻。

**驗證**：vitest 911/911、vue-tsc 0、E2E `visual-regression` home 結構不變量與像素回歸（chromium+webkit）
綠、home 基準圖已 `--update-snapshots` 重生並目視確認（cream/noir × mobile/desktop 四張 dev-server 截圖
另存 scratchpad）。`mobile-play` 像素回歸有一個既有偏差（14176px/0.05，與本次改動無關——PlayView 未觸碰、
快照自 `241e4ea` 起未變、也不依賴工作樹裡其他人未 commit 的 history 相關改動），本輪範圍外不處理。

**文件收案（同批）**：`design/gambit-design-system/navigation-vertical-world.md`（墨色垂直世界方向）與
`design/quick-specs/home-scene-redesign.md`（星夜 spec）皆加墓碑（OBSOLETE，本文件僅留歷史記錄）；
`colors_and_type.css` 墨韻母題段更新「cream 日常可入」定案；下方「佈局 from scratch project」節加墓碑
註記，「首頁光（backlog）」節（星夜專屬、已無標的）移除。

## 2026-07-22 墨韻母題改嫁落地（cream / deep-jade 兩主題）

> 另一對話將以此為地基，把墨韻做成全站共通視覺語言逐屏擴散。

- **落了什麼（共用件，一處定義、非 inline）**：`InkBrush`（墨筆底線＋乾筆分隔，同元件靠 width/height
  切換）＋ `InkSplatter`（金墨飛濺）＝ `src/components/ui/gambit/`，已在 `index.ts` 註冊；production CSS
  在 `src/assets/main.css`「墨韻 (INK GARNISH)」段（檔末）。接手對話直接複用元件＋class，不必重刻。
- **兩主題行為**（SoT 已同步：`design/gambit-design-system/colors_and_type.css` 墨韻母題段）：
  - 墨色 token `--color-ink-brush`：cream 深棕墨 `rgba(61,34,16,.68)`、deep-jade 暖白墨 `rgba(236,230,218,.72)`。
  - 金墨飛濺兩主題品牌金；`--fleck-scale` cream=1.6（亮底加大粒子補存在感）、deep-jade=1。
  - **cream 極克制**：只在 reward／章節扉頁／Neve 特殊時刻掛，不進日常 UI；**deep-jade 暖白墨可進日常**。
- **首個掛載＝課程完成卡**（`LessonView.vue` `#completion-card`）：課程名下墨筆底線 ＋ 勳章區金墨飛濺，
  兩主題 reward 時刻。掛載點穩定（不受首頁 from-scratch 重做影響）。
- **筆觸資產**：演算法（buildPath / flecks）在元件內；決策樣張 demo＝`design/demos/ink-garnish-mockup.html`。
- **待擴散（給接手對話）**：乾筆分隔（InkBrush 寬扁）primitive 已備、未掛任何畫面；deep-jade 日常標題
  底線可鋪開；首頁招呼語墨筆待 from-scratch 新 IA 定案後接（星夜元件將拆，故此輪未掛首頁）。

## 2026-07-21 第二主題「深墨綠」完成 ＋ 佈局 from-scratch project 啟動

### 第二主題（深色模式）＝深墨綠，已完成＋已 push（`feat/theme-deep-jade` 內容已併入 main 並推送到 origin）

- **方向探索歷程（教訓：憑空認可挑不出、看實物才準）**：原 noir branch 的 ink-noir（暖黑墨底＋暖白紙、去 jade）
  一路被推翻——Eason 把 cream/noir 擺一起看，覺得 ink-noir「tone 不對、像兩個 app」。診斷＝去 jade 斷了品牌血緣，
  但飽和 jade 貼中性暗底又螢光。探索「鏡像對偶」（noir 配另一靈魂色 X：朱砂／黛紫／黛藍）後，Eason 最後選
  **深墨綠沉浸**：底本身是接近黑的深墨綠 `#0e1411`、jade 是同色系亮階（不螢光）、金唯一高光＝cream（暖亮＋jade）
  的明暗鏡像、同青瓷家族。黑度取「偏黑」版（非較綠版）。
- **落地**：`main.css` `:root[data-theme='noir']` token block（深墨綠色板）＋11 個深區 theme-aware class 的 noir
  漸層值；`colors_and_type.css` noir 段（SoT）同步；toggle 系統（`lib/theme.ts`＋`ui-store`＋`data-sync` 跨裝置
  同步＋ProfileView「外觀」toggle＋`main.ts` 開機套用＋`App.vue` 登入 reconcile）；`theme.test.ts` 6 測試。
  WCAG 五項實算全過（ink 15.66:1、primary 連結 5.93:1、danger 5.95:1…）。vitest 913 綠、vue-tsc 0、cream byte 不變。
- **Supabase migration 已套用 live**（2026-07-22 用 anon key 對 PostgREST 驗證，非文件宣稱）：
  `20260830053143_create_user_preferences.sql`（一人一列 RLS、theme check）。驗法＝`user_preferences` 查詢回
  `[]`（表存在、RLS 正常擋 anon），對照已 drop 表回 `PGRST205`（真不存在）區分兩種情況。跨裝置同步應已生效；
  migration 檔內「NOT applied」warning comment 已過期，已一併移除。
- **兩個小尾巴**：① toggle 中文標籤原為「暖墨」（ink-noir 遺留）——**已正名「玄夜」（2026-07-22 玄夜換血輪次）**。
  ② 深區 class 接在**當前佈局**上——佈局 from scratch 後會隨頁面重做而演變，但 token／toggle／migration 是留用資產。
- **實機截圖未完成**（Playwright 分頁反覆被關），但落地值＝Eason 看過選定的 runtime demo（偏黑深墨綠）＋WCAG＋
  build 綠，信度足；Eason 可 `localhost:5173`→我的→外觀→玄夜 自驗（深墨綠色板已於 2026-07-22 玄夜換血輪次退役）。

### 佈局 from scratch project：⓪➊ 拍板完成（同日延續，另一對話開工）

> **【墓碑，2026-07-22】方向已廢止**：Eason 裁決首頁維持舊卡片佈局＋墨韻融合，本方向不再施工。
> 詳見上方「2026-07-22 佈局 from-scratch 專案收案 + 首頁回退」節。以下保留原文當歷史記錄。

- **方向**：Eason 提出「首頁可垂直滑動、滑到底變場景轉換進試煉」的構想，具體化為**墨色垂直世界**
  ——可垂直滑動的沉浸首頁樞紐，取代底部 tab 為主的 SaaS 卡片牆。空間語意固定：上＝沉澱回望
  （棋誌）、中＝當下（對局／首頁落點）、下＝深處挑戰（試煉）。範圍只換首頁樞紐＋跨場景轉場，
  功能頁本身維持正常頁面不整頁沉浸化。逃生艙（不迷路的保底導覽）選融入式常駐導覽，非點開才現的羅盤。
- **技術驗證**：Eason 擔心純 CSS 效果有限——demo 證實不需要 WebGL，Canvas 星塵＋CSS 3D＋
  scroll-driven 動效即可做出空間感與慣性視差。
- **迭代歷程（教訓：加法不等於加分）**：拋棄式 demo（`design/demos/layout-vertical-world.html`）
  兩輪大改＋一輪否決——① 右側導覽從圓點升級成「棋座標軸」（數字 rank）與「深度計」（連續指針）
  兩個新方向，Eason 實測後判「都很醜，比原本圓點更差」；② 改成重用每層本來就有的 glyph（書／
  學士帽／棋盤格／時鐘／拱門）縮小當導覽 icon、維持簡約，Eason 拍板「先這樣吧」。滑動吸附
  跨兩層的手感問題桌機測不出結論（滑鼠/觸控板跟 iPhone 觸控物理不同），留待 ➌ 真機驗證。
- **DESIGN.md 落地**：決策寫入 `design/gambit-design-system/navigation-vertical-world.md`（不建
  獨立 root DESIGN.md，避免與既有 SoT 分裂）；README.md 導覽段補註記「Phase 3 B redesign in
  progress」，現行 bottom-tab 描述仍屬實未改。
- **➌ 真開發未開始**：待 IA 全盤點（五層是否為導覽全集）＋ 補 44px 觸控命中區 ＋ focus-visible
  ring，細節見 DESIGN.md「已知待驗證」節。
- **不變約束**：iPhone 單手可用、觸控 ≥44px、a11y、深墨綠+cream 雙主題、Gambit 視覺 SoT（Wood12 盤、
  Neve 人格、西洋棋用語）。深墨綠色票＝資產。

---

## 2026-07-20 iPhone 複驗回合（三真 bug 修復＋待回報項清空）

Eason 用 iPhone 走完 4 批複驗清單逐項回報，逐一分流：多數 OK；三項是真 bug，已修＋驗證；兩項澄清為
設計本來如此（清單描述過期，非退步）；一項 backlog。**已 push**（`a804adc`，2026-07-22 核對 origin/main 確認）。

- **PgnViewer（棋憶回放）座標終於對齊木框**（待實機指認項終於複現，真 bug）：根因＝
  `@lichess-org/pgn-viewer` 用 snabbdom `patch()` 掛載，會把傳進去的 DOM 節點整個**替換**成它自己蓋的新節點
  （remove+insert，不是就地寫入）——Vue 的 `ref` 綁的是原本那個被丟棄的節點，座標讀取一直讀到孤兒節點、
  回傳空陣列。修法＝`pgn-viewer.vue` 改用 `frameRef`（外層永不被替換的 wrapper）取代 `containerRef` 做
  幾何量測與 `:deep()` CSS 錨點；關閉原生 chessground 座標（`coordinates:false`）、自繪 rank/file 標籤到
  木框上，跟試煉/課程/對局統一（不再是 lichess 風格印在格內角）；`.lpv__board` 補 12px padding 讓標籤有地方
  站；`board-theme.css` 移除變成死碼的原生座標樣式區塊。黑方/白方 orientation 皆已 Playwright 實測正確翻轉。
- **課程「控制中心」d4/e4 內容矛盾**：第一個互動步的 `text`／`hint` 都寫「e4/d4 這類中心格」暗示兩者等價，
  但 `expectedMove` 只認 e4（d4 只觸發 softReject 溫和帶回，不算過關），跟 `objectives` 早就寫的
  「練習用 e4」矛盾。改法＝`text`／`hint` 收斂成明確指向 e4，不再暗示 d4 同樣算完成。
- **概念地圖「未學」coin 改虛線描邊**：原本刻意做成幾乎看不見的淡環（安靜預設），但 Eason 反饋認不出第三階；
  出 3 個方案 demo 拍板選虛線描邊（A），語意直接、跟另兩階同量級但不搶色。
- **釐清非 bug（清單描述過期，不是退步）**：試煉「沒有 LOG」——現在是刻意只顯示最近一次結果、不累積
  （避免清單把底部 CTA 推到手機網址列下面），清單項目寫的是改版前的舊行為。
- **backlog（Eason 拍板先不動）**：epiphany 棋誌文案「太 AI 太假」——六個模板都用同一種「我沒做 X，你卻/仍 Y」
  否定式排比骨架，加上「這不容易」「是你掙來的」偏評價語，違反 Neve「不輕易讚美」人格規則；之後再處理
  （見待辦④）。
- 驗證足跡：vitest 907/907（含一次疑似快取假紅、單獨重跑即綠，同 technical-preferences 已知模式）、
  vue-tsc 0、PgnViewer 座標＋coin 樣態均 Playwright 實截圖確認（桌機/手機雙寬）。

## 2026-07-14（家用機）收線紀錄

- **D3 招呼框銜接修復**（`241e4ea`）：iPhone 反饋「漸層切割感明顯」＝banding；三方向 demo 盲選拍板 D3
  ＝色溫過渡壓縮前 40%、其餘 sky-b 實色、底部硬切＋1px inset 細影，結構上無長漸層段。基準圖重生
  home×2＋play×2/concepts（stale 修正）。
- **開局面板閃現修復**（`1f8ac2d`）：Eason 反饋開新對局「棋盤先出、下面 block 晚出且閃現」。根因＝
  PlayView onMounted 先 await engine.init()（Stockfish 握手）才撥 phase 離開 SETUP，面板 v-if 綁 phase
  被卡 ~183ms 後無過渡蹦出。修法＝開局邏輯移到握手前（面板與棋盤同幀），握手完輪 AI 才補 requestAiMove()
  （既有 no-op guard，不動狀態機）。插樁實測 gap 183ms→0ms。
- **以上皆已 push**（`8c3b41a`＋教訓文件 `4823805`）；push 途中三連撞 vitest 假紅，根因＝prepush hook 是
  PreToolUse（指令執行前先跑），「mv 快取+push 同一條指令」無效——處方已補進 technical-preferences。
- **⚠️ material 撞題事故與裁決**：家用機 07-12 晚依當日三題拍板（offense／平行欄位／規則層審查）把
  material **完整實作**（6 條件 selector＋37 樣本抽查 0 誤收＋逼和排除——與 spec 條件 9 獨立收斂），
  但未 push；公司機 07-13 不知情之下重跑設計、產出更嚴的 11 條件 Accepted spec（D1–D6 拍板）。
  **07-14 Eason 裁決：spec 為準；v0 實作停車到 branch `material-v1-parked`**（含測試/抽樣工具/樣本集，
  正式版照 spec 施工時拆件用、上線後刪分支）。**教訓：跨機開工前先 `git fetch` 看對方 session 的
  active.md；未 push 的施工要在 active.md 標記「in-flight」。**
- 附帶：判斷場完成留白/slideshow 門等第二批已於 07-12 上線（`bed83ae`），公司機 07-13 的 907 綠已含之。

## 2026-07-13（公司電腦）本日產出（已 push，`4de2633`…`42a4791`）

- **signpost material 概念擴充設計案 → Accepted**（`6509da5` 產出、`6d44489` 拍板）＝
  `design/quick-specs/signpost-material-expansion.md`。18-agent workflow（5 盤點→4 提案→8 對抗審查→綜合）。
  路線＝「無守衛之子」chess.js 可證明子集 v1（零引擎呼叫、零 schema 侵入；MultiPV 補算＝v2 條件路徑）。
  D1–D6 全數照推薦（D2 推翻率門檻 5%、D4 召回 <1 次/5 局）。
- **文件現實對帳 backfill**（`a83d4e7`，68 檔 105 筆）：全 repo epic/story/ADR/GDD/spec 狀態宣稱對齊上線現實，
  全部低報回填、零高報；69-agent 審計＋逐筆核證＋fresh-context 驗收 PASS；4 筆 ambiguous 同日裁決施行。
- **epics/index 彙總表重算**（`4de2633`）：18 epics／87 stories／113 TR-IDs／16 ADRs，補漏列 5 epic＋主表 4 格誤植。
- **vitest 假紅根治**：`.vite` dep-optimizer 快取損毀型假紅（91 檔全掛、重跑不會好）＝搬走快取重建即綠；
  處方入 technical-preferences、`maxWorkers: 4` 入 vitest.config（治另一種 timeout 間歇紅）。
- **precommit-review deep 過**（1 major 修＋2 minor 入 backlog）；環境順修＝`precommit-review.js` CRLF→LF、
  executor role 加「禁止再委派」鐵則。

## 現況（產品全線可用；2026-07-10）

- **核心動線**：對局 → 賽後檢討（棋憶）→ 課程 / 試煉 / 深化（判斷場），Google OAuth + 跨裝置同步，guest local-first。
- **測試**：vitest 907 綠（2026-07-13 實跑）、vue-tsc 0、axe a11y 綠、E2E CI 等效全綠（總數以實跑為準，勿照抄）。
  **視覺回歸守門**（`tests/e2e/visual-regression.spec.ts`）：每路由結構不變量（橫向溢出／var() 色票變純黑／
  非方棋盤／JS 例外）＝CI 硬閘、決定性；像素回歸 `toHaveScreenshot`＝本機 push 前跑（基準圖 chromium-win32、
  依平台而異故 CI skip）。改 UI 後基準圖需 `--update-snapshots` 重生並目視確認。
- **7edc660（2026-07-03 全面體檢，94 檔）已 push**：12 維度審查 41 findings 修復（棋誌 settle 接線、離線佇列
  completedAt 淘汰、賽後引擎 lowerbound/spawn、首屏 -207KB、a11y/設計系統批、文件對齊 ×7）＋七項拍板
  （chess-board 拆分 606→474+5 composables、journal 搬家 modules/+ADR-0015、data-sync 解耦 syncVersion、
  axe E2E 真實化、Actions pin SHA、RLS WITH CHECK + DROP 兩表 migration）＋ Neve 頭像接入、判斷場 stale
  bounds、/play 直連彈回、深化 mate 換盤 h1 角、死常數清理+CLASSIFIER_SIGNALS 接線。細節＝git log + ADR-0015。
- **Supabase 兩 migration 已套 live（2026-07-10，Eason 於 Dashboard SQL editor 手動跑）**：RLS 顯式
  WITH CHECK＋DROP `skill_scores`/`lesson_side_learned`。PostgREST 已驗：兩表回 PGRST205（確實消失）、
  餘 7 表 RLS 正常擋 anon。WITH CHECK 行為中立、僅間接驗證；要鐵證在 SQL editor 查
  `pg_policies` 的 `with_check is not null`（7 行全 true 即過）。
- **2026-07-10 四磚（已 push 上線 `a80fc9e`）**：
  ① **氛圍首頁 IA-A**：`NeveSceneHeader` 四時段天色（night/morning/afternoon/evening，`timeBucketForHour` 純函式）
  ＋緩亮 620ms（唯一允許超過 300ms 的氛圍例外）＋全站 `journey` 路由轉場（App.vue Transition out-in 200ms）；
  h1 focus 因 out-in 時序改掛 `@after-enter`（router afterEach 保留管首次載入）。
  ② **PWA**：`vite-plugin-pwa` autoUpdate＋**ADR-0016**（precache app shell 73 項/2.6MB；stockfish/fonts 排除
  precache 走 runtime CacheFirst；Supabase 永不快取）。bash 跑帶 base 的 build 要 `MSYS_NO_PATHCONV=1`
  （MSYS 會把 `/gambit/` 改寫成 Windows 路徑、silent 壞 base）。
  ③ **mate 深化磚**：沉默關文案去洩題；判斷場 3 盤（悶殺 Nf7#／雙城堡樓梯 Rb8#／底線假殺 decoy Rd8+→Rxd8），
  全過 chess.js 窮舉唯一性＋3-lens 對抗棋理審查＋uniqueness spike 3/3；Qg3 逼和特判（`trapFeedback` 資料驅動，
  LessonStep 新選配欄位）。
  ④ **棋憶 signpost→判斷場接真實對局 v1**（mate-only）：review COMPLETE 時 `selectMissedMates` 擷取
  （**關鍵語意：classifier 的 mate 訊號＝「放任被將死」，missed-mate＝新偵測器，勿混用**）→
  `recognition-source` store（localStorage、冪等、consumed FIFO 300、只留最近 3 局）→ 棋憶 signpost 卡 →
  `/learn/concept/mate?source=recognition` 動態組全 real 判斷場。**擷取硬閘（precommit-review critical 修復）：
  只收 `evalMate===1` 且 chess.js 窮舉「恰好一個殺著、且＝引擎手」的局面**——否則「一步將死?」的 prompt 會對
  二步殺說謊、多殺著局面會把玩家的真殺著誤判 missed。v1 守衛：white-only（黑方翻盤+tap 座標未驗）、跳過升變
  殺著；升級路徑=黑方 orientation、material 概念、跨裝置同步走 journal/data-sync。
  ⑤ **Neve 頭像**：共用 `NeveAvatar`（ui/gambit/）24→32、28→36px，深底 ring+提亮，單次進場動效；
  persona-neve.md 已補頭像視覺規範。
  驗證足跡：vitest 898/898、vue-tsc 0、E2E CI 等效 96 綠、視覺結構不變量全綠、7 項中央驗證 findings＋
  precommit-review deep 11 confirmed（1C/2M/8m）修 10——1 項不修（HomeView 淡入未抽 composable＝美化債）。
  已知 flaky：全量 vitest 在重負載（VSCode 重建索引）下 auth-guard timeout 與 opening-lookup 20ms 效能斷言
  會間歇紅，隔離單跑全綠；`--maxWorkers=4` 降競爭即 898 全綠。
- **視覺回歸 spec 已固定時鐘 15:00**（首頁天色隨時段變，不固定像素基準不決定性）；4 張基準圖重生已目視
  （desktop/mobile-home、mobile-lesson、mobile-concept-deepen）。已知 pre-existing advisory：/play 像素
  間歇 0.47 漂移＝board-fit settle race，非本輪造成。
- **行為變更注意**：Home mount / 對局終局現在會跑 `journal.evaluate()`——**全新玩家首次進站即有 onset 開場
  條目**（首頁 peek 顯示 1 筆是設計行為，對應 E2E 斷言已改）。
- **已完成里程碑**（細節在 git）：試煉道場 #19、學習迴圈 #20、課程四階 21 課、UI Redesign Phase 0–4、
  Google OAuth、訪客 local-first+續玩、棋誌 Phase 1、棋憶 #22 全 Done、判斷場 MINIMAL、深化四磚。

---

## 待辦

### ① iPhone 實機複驗（累積四批，deploy 後用無痕分頁）

- **7-10 批（四磚）複驗進度**：✅ 頭像；✅ mate 判斷場（「完成彈窗太快」已修＝留白 1.4s）；✅ signpost
  全流程；⏳ **氛圍首頁 D3 版已上線可測**（V3 漸層被反饋 banding 後重做為 D3 純深底，2026-07-14 已 push）；
  ✅ PWA 加到主畫面＋離線＋autoUpdate 更新（2026-07-22 複驗 OK）；✅ 順驗：開新對局棋盤與下方面板同幀出現
  （2026-07-22 複驗 OK）。
- **7-03 批**：✅ Neve 頭像三處觀感（課程/判斷場 24px、棋憶 28px，2026-07-22 複驗 OK）；✅ 判斷場第 3 盤裸點擊＋
  真手指滑動（2026-07-20 複驗 OK）；⏳ 深化 mate 新盤（h1 角 Qg2#）手感；redesign 三項＝✅ #6 keySquare 高亮環+
  脈動、✅ #9 概念地圖三階 coin（2026-07-20 認不出第三階→改虛線描邊已修，見上方 07-20 節）、✅ #11 課程氣泡
  font-lesson（皆 2026-07-20 複驗 OK）。
- ✅ **6-29 批全數結案（2026-07-20 複驗）**：#2 誘餌盤互動 OK；#10 棋盤跑版（含試煉）OK；#7 d4 軟引導——
  清單描述有誤（功能只在課程「控制中心」，不在開新對局），順帶抓到內容矛盾已修（見上方 07-20 節）；
  演示節奏 OK；epiphany 鉤子實際觸發＋棋誌顯示 OK（文案語氣另立 backlog，見待辦④）；深化 A3 彈窗 OK。
- ✅ **更早批全數結案（2026-07-20 複驗）**：棋憶賽後 UX 批（`e11d3c6`：失誤動畫節奏 OK、重開同盤 cache
  命中 OK）；B5 試煉互動（log 累積——清單描述過期，現在刻意單筆不累積，非 bug；答錯滑回 OK；揭曉箭頭 OK）；
  逐手 PgnViewer「棋盤外藍框 + 座標小偏」——實機終於複現，是真 bug，根因與修法見上方 07-20 節。

### ② 待 Eason 拍板

- ✅ **signpost material 設計案 D1–D6**（2026-07-13 拍板＝全數照推薦，含 D2 推翻率 5%、D4 召回門檻
  <1 次/5 局）：定案記錄在 `design/quick-specs/signpost-material-expansion.md` §0/§5。施工前置＝D6 離線量測。
- ✅ **docs 對帳 4 筆 ambiguous**（2026-07-13 拍板＝照建議施行）：① visual-identity EPIC → Complete＋
  被 Wood12+Gioco 承接註記 ② ADR-0012 → Accepted（觸發條件早已跨過，回填理由在檔內）③ ADR-0007
  排程措辭更新（真機量測 outstanding as of 2026-07-13）④ vision「已規劃」→「已上線的概念深化頁（判斷場）」。
- ✅ **失誤 slideshow 入口**（2026-07-11 拍板＝單一安靜入口）：新 `MomentSlideshowDoor`（cream 底
  Neve 卡，走勢圖下方、有重點步才現身）→ openMoment(0) 進 slideshow。與點圖跳手互補
  （工具 vs Neve 陪看），不恢復整排 list。
- ✅ 已施工（2026-07-11 第二批，細節在 git）：重置對局記錄（拍板 scope＝只清對局列表；ProfileView
  「資料」區＋二次確認 dialog，登入清 Supabase game_sessions＋本機、訪客清本機；棋誌/棋憶/進度不動）、
  走勢圖點圖跳手（EvalShapeChart plyAtClientX，MomentList 已刪）、控制中心 tile line-clamp-2
  （真身在 ConceptMapView）、賽後 Neve loading（查明既有實作，免改）、判斷場完成彈窗留白
  （RECOGNITION_COMPLETE_LINGER_MS=1400，iPhone 複驗反饋）、招呼框 V3 接天空
  （結構性 full-bleed：HomeView root 拆兩層，nav-join #183e35 三段漸層淡出到 cream，vignette 移除）。

### ③ 深化頁後續磚

- ✅ **階段二 signpost v1 已施工**（2026-07-10，見現況四磚④）：mate-only、localStorage、無 decoy。
  ✅ **黑方擷取已解鎖**（2026-07-11）：Playwright 實測黑方翻盤＋tap 座標端到端可用（playerColor 一路傳到
  chessground orientation）、evalMate＝side-to-move 慣例（ADR-0007）黑方不需反號 → 移除 MemoryView
  white-only 守衛。後續磚：material 概念擴充、動態 decoy 造題（工時未估）、unaided/epiphany 門檻鬆緊
  （沿用既有，未調）。
- ✅ **mate 沉默關三項已施工**（2026-07-10，見現況四磚③）：去洩題文案／判斷場（比照 fork）／Qg3 逼和特判。
- **擴池＝HOLD（2026-07-11 Eason 拍板）**：不再手工造罐頭 variant；深化題真正歸宿=signpost
  （mate 已通、黑方已解鎖）。material 擴充**設計案已 Accepted（2026-07-13，D1–D6 照推薦）**；
  施工前置＝D6 離線量測（推翻率 ≤5% 才開旗），之後 selector→store 泛化→signpost 接線（估 3–4 sessions）。
  **量測腳本已就緒但樣本歸零**（scratchpad `measure-missed-material.mjs`，fixtures 8/8＋engine smoke 過；
  anon key＋session 驗證 auth 正常，但 `game_sessions` 0 筆——「重置對局」實機驗收把雲端清空了）。
  **續點（Eason 2026-07-13 拍板＝選路 1）**：登入態自然累積新對局（≥10 局）、實際玩過給 feedback 後
  重跑腳本出命中率／推翻率；session token 在 scratchpad `sb-session.json`（過期就請 Eason 重貼）。

### ④ 未來獨立任務

- ✅ **Neve 頭像 presence**（2026-07-10 已施工，見現況四磚⑤）：實機辨識度（尤其深青底）待 7-10 批複驗；
  頭像素材位置與 ffmpeg 重產指令已記入 `design/gambit-design-system/persona-neve.md` 頭像規範節。
- **Phase C+/D**：捉雙/牽制賽後偵測（需精準度實測）；Claude API 動態講解/BYOK（最後）。
- ✅ **PWA 已實作**（2026-07-10，autoUpdate＋ADR-0016，見現況四磚②）：首次 deploy 後所有訪客開始吃 SW；
  之後每次 deploy 由 autoUpdate 自癒，「舊畫面＝裝置快取」的排查註記仍適用於未升級的舊訪客一次。
- ✅ **死碼清理 + 效能斷言修正**（2026-07-22 施工＋commit `5156f73`，隨首頁回退批一同過
  deep review；GDD `game-history.md` Rule 8/AC-12/AC-12b 已同步標 REMOVED 墓碑）：game-history
  `expandedRowId`/`setExpandedRow`/展開面板已被
  row-tap-to-navigate 取代，一併清 store（`game-history.ts`）、元件（`history-row.vue` 展開面板＋prop）、
  消費端（`HistoryView.vue`）、孤立測試（store 4 個 + view AC-12 1 個）；`opening-lookup` wall-clock 斷言
  （違反 coding-standards「no time-dependent assertions」）改成正確性斷言（不再測 ms，效能改註解說明已手動
  Chrome DevTools 驗證）；`auth-guard` timeout 查過＝非硬編時間斷言、是重負載下 vitest 逾時保護，非違規，
  無需修（`--maxWorkers=4` 仍是既有緩解）。清理後 working tree 實測 vitest 911/911、vue-tsc 0
  （911 為清理後數字；origin/main 的 tree 仍是清理前狀態）。
- ✅ **第二主題（深墨綠）已完成並 push**（見上方 07-21 節）：舊待辦記的方向是「noir/Dusk」暖黑探索，
  最終拍板落地的是深墨綠，這條過期待辦移除。
- **epiphany 棋誌文案語氣待收斂**（2026-07-20 iPhone 複驗反饋「太 AI 太假」，Eason 拍板先放 backlog）：
  六個模板（`src/data/journal-templates/epiphany.ts`）同一種「我沒做 X，你卻/仍 Y」否定式排比骨架，
  加上「這不容易」「是你掙來的」偏評價語，違反 Neve「不輕易讚美」人格規則（見
  `design/gambit-design-system/persona-neve.md`）。處理時走文案語氣護欄的 3-lens 對抗式審查
  （見 CLAUDE.md「文案語氣護欄」）。

---

## 接手必讀（鐵則不在這個檔）

長期規則與技術參考都在 **CLAUDE.md 與它 `@`-include 的 docs**，每次 session 自動載入：

- **CLAUDE.md**：技術棧、CI Node 26 鎖、push guardrail、部署 base path、E2E 盲區、棋理護欄、內容授權、
  視覺設計 SoT（全 app 棋盤＝Wood12+Gioco）、教練人格 Neve、西洋棋用語。
- **`.claude/docs/technical-preferences.md`**：測試規範（@spike、Node26 shim、vitest 快取衝突假紅、
  chessground 合成事件測不到、node 直驅 Stockfish 驗盤法）、Board/chessground gotchas（viewOnly 兩層修法、
  stale bounds、PgnViewer CSS 汙染）、Deferred Cleanups（含 game-export、開局知識卡＝待接 UI 勿刪）。
- **`.claude/docs/coding-standards.md`**：commit 格式、截圖自清。
- 設計 SoT＝`design/gambit-design-system/`；GDD＝`design/gdd/`；Supabase migration＝`supabase/README.md`；
  lib/ vs modules/ 判準＝**ADR-0015**。
- **Supabase MCP**：stdio、user scope、**read-only**、`--project-ref=vfnzekqtvxhewifnmtnz`、token 走
  `$env:SUPABASE_ACCESS_TOKEN`；需重開 Claude Code 才 Connected。可查表除錯、不能跑 migration。
- **Gambit-noir 平行 worktree** 共用同 origin：加 Supabase migration 時注意編號接續 repo 現有最大值
  （目前已到 202608305xxxxx，非真日期；撞號前例見 memory）。

---

## 北極星 + 重構路線圖

> 一句話：解新手**情緒問題**、對標 Calm 非 chess.com、Neve 安靜陪伴、課程長在你自己棋上 + 棋誌、核心零 AI、氛圍 vs juice。完整見 vision 文件。

**三階（鐵律：一次蓋一塊磚，每塊能單獨上線、單獨證明靈魂）：**

- **Phase 1 — 棋誌**（心臟）：✅ 已上線（settle 管線 2026-07-03 起全面接線：onset/arrival/solace/epiphany 都活了）。
- **Phase 2 — 課程長在你自己的棋上**：✅ 棋憶全線 ship；✅ 深化頁重設計（判斷場 MINIMAL + 四磚）ship；
  ✅ 階段二 signpost v1 施工完（判斷場接真實對局，mate-only）。🚧 剩 iPhone 複驗定案（見待辦 ①③）。
- **Phase 3 — 沉浸感 + 旅程 IA**：🚧 A 路線（氛圍首頁＋全站轉場）已施工待複驗；B 路線（tab→路/地圖
  IA 重構）未動、待 A 驗證後評估。
- **商業模式**（訂閱/付費深度/BYOK）＝最後。

**關鍵架構事實**（細節在 ADR/git）：ADR-0013（journal）+ ADR-0014（memory）+ ADR-0015（lib/modules 判準）
皆 Accepted；Supabase 現 7 張 live 表（2026-07-10 起，兩張 unused 已 drop）。
