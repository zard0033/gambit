# Game Concept v2 — Chess Training Companion

*修訂日期：2026-06-04　·　Status: Confirmed & Shipped（視覺方向已全站套用，見 design/gambit-design-system/）*

> 本文是 `game-concept.md`（v1）的**調性／視覺識別／遊戲化**修訂。v1 是 2026-05-27 臨時起意寫的，產品骨架紮實，但「平靜極簡 lichess 工具」的美學北極星與 Eason 真正想要的方向不符。v2 **只改 tone / 視覺 / 遊戲化 / 敘事**；v1 的營運細節（MVP、loop、風險、技術、雙向連結 hook）仍然有效。

---

## 與 v1 的關係

### ✅ 保留（v1 仍然成立，不重複，指回 v1）
- **獨特 hook**：雙向知識連結（lesson ⇄ 你自己的對局）。仍是核心差異化。
- **Pillar 1 累積感**、**Pillar 2 學用相連**。
- **受眾**：成人棋藝初學者（25–50），想要「能感覺到的系統性進步」。
- **棋盤標註的 Nippon 角色色**（bestMove 青磁 / playedMove 利休鼠 / alternateLine 淺蔥 / threat 紅鬱金 / keySquare 山吹金 / eval 胡粉·桑染）——這套**只管「對局/分析當下」的標註層**，由 ADR-0006 + control-manifest 鎖定，**繼續沿用**。它「角色中性、不評判」的精神依然正確（不羞辱玩家的每一手）。
- **MVP 範圍、Core Loop、風險、技術考量** → 見 v1。

### 🔄 改寫（本文重點）
1. **定調**：從「平靜極簡 lichess 工具」→「**精緻、有溫度、像踏進一個棋之國度的學習遊戲**」。
2. **Pillar 3**：「無壓力」拆成「**低壓力 ＋ 高動力**」——保留無計時/無排行/無社交/無連續天數，但**主動加入正向動力**（等級、闖關地圖、徽章、輕劇情）。
3. **新增 Pillar 4 畢業導向**。
4. **視覺識別**整段重寫（深青瓷＋山吹金＋玻璃質感；參考 Epic Seven／鳴潮／Chants of Sennaar）。
5. **新增輕敘事層**（導師＋棋之國度）。
6. **校準棋盤現實**：實際 build 是 **wood12 木盤 ＋ Gioco Wood 棋子**（非 v1 寫的 cburnett＋Nippon 平色格）；v2 以「真實木盤」為準。

---

## Elevator Pitch（v2）

> 一個**有溫度、像在闖一個「棋之國度」**的單機棋藝道場。你在這裡跟 AI 對弈、透過賽後分析把每一手連回學過的課，**真正把棋學起來**——然後**畢業出去**，到 chess.com／lichess 跟真人對局。它不做真人對戰；它讓你「準備好出去」這件事變得高效又令人期待。

---

## Core Fantasy（保留並加溫）

**「我正在穩定變強，而且我看得到——而且我**期待**打開它。」**

v1 的「看著一棵樹長大」仍成立；v2 補上**情感層**：打開 App 不是開一個冷工具，而是**回到一個你在裡面成長的世界**。

---

## 定位光譜

**遊戲感 6–8（偏遊戲、但成熟不童趣）**。

| 參照 | 取 | 捨 |
| --- | --- | --- |
| **chess.com**（Learn/Puzzle 頁面） | 精緻、有質感的學習/謎題介面、活潑的回饋感 | **童趣的 icon**、**偏亮的綠**、廣告/社交壓力 |
| **lichess** | 乾淨、專注 | **太工具、沒有溫度** |
| **Kenney RPG kit**（曾誤用） | — | 厚重卡通、像素感、童趣 |

---

## Game Pillars（v2）

### Pillar 1 — Accumulation Over Sessions（保留）
每局都留下痕跡：等級、技能分、歷史。永遠不會「從頭來過」。**不含連續天數 streak**（避免「怕斷掉」的壓力）。

### Pillar 2 — Knowledge Connects to Play（保留）
課程與對局雙向連結（見 v1 hook）。

### Pillar 3 — Low-Pressure, High-Motivation（**改寫自舊「No Pressure」**）
這是道場不是競技場：**無計時、無排行、無真人社交、無連續天數**。但「無壓力」**不等於**「無動力、冷淡」——v2 主動用**正向動力**讓人想回來：等級、闖關地圖、徽章、輕劇情。
- *設計測試*：會製造**時間/社交/連續性焦慮**的 → 砍（違反低壓力）。能給**成就感/期待感/探索欲**且不施壓的 → 留。

### Pillar 4 — Graduation-Oriented（**新增**）
成功的定義 = **你準備好出去跟真人下棋了**。進度敘事走「**邁向真正的對局**」這種嚮往式語氣（不走「電爆對手」的攻擊性語氣）。畢業＝去 chess.com／lichess，正是差異化（我們不做真人對戰）。

### Anti-Pillars（更新）
- **不是**真人對戰平台。
- **不是** chess.com 複製品（chess.com 是畢業後的目的地）。
- **不是**童趣手遊——遊戲化是**成熟**的（份量、氛圍、克制），不是糖果色彈跳吉祥物。
- 謎題/闖關**是訓練**包上遊戲外衣，**訓練的實質仍嚴肅**（針對弱點，非隨機娛樂）。

---

## Engagement & Gamification（明確去留）

| 機制 | 去留 | 備註 |
| --- | --- | --- |
| 等級 Level | ✅ | 解鎖更強 AI／新課程軌 |
| 闖關地圖 Quest map | ✅ | 由下而上、章節＝棋之國度的「地點」 |
| 徽章 Badges | ✅ | 達成里程碑 |
| 輕劇情（導師＋世界） | ✅ | 見下節 |
| 連續天數 Streak | ❌ | 製造「怕斷掉」壓力，違反 Pillar 3 |
| 計時/排行/社交比較 | ❌ | 違反 Pillar 3 |

---

## 輕敘事層（新增 · 輕量起步、預留長大）

**採輕量 (a)：一位導師 ＋「棋之國度」的旅程框架包住章節。**

- **導師**：成熟、內斂的「棋道引路人」，氛圍式簡短旁白——**不是話癆吉祥物**。persona 沿用既有命名 **貝絲·哈蒙（Beth Harmon）**（《后翼棄兵》，成熟有型，比舊圖更貼 v2 調性）。**現有卡通 `coach.png` 立繪棄用**（風格不合）；導師**視覺形象延後到 art-bible 用成熟插畫風重做**，v0 先以文字 persona＋字母頭像呈現、不 gate。（IP 註：日後若沿用 Beth Harmon 形象，商用前需留意授權。）
- **世界**：章節＝國度裡的**地點/領域**（不是冷冰冰的關卡編號），用畫面與氛圍敘事。
- **份量參考**：Chants of Sennaar 那種**近乎無字的優雅**＋ Epic Seven 那種**畫面的份量感**。
- **避坑**：輕劇情最怕變薄、變吉祥物喊話 → 一不小心就掉進「童趣」。守則＝成熟、克制、用氛圍不用碎念。
- **未來性**：章節/任務結構設計成**模組化**，之後想加主線弧＋支線（升級成中量敘事）不必重做。
- **MVP 立場**：劇情是**外衣**，不擋學習節奏、不 gate 內容；v0 可先用導師＋世界框架的最小形式。

---

## Visual Identity v2（**取代 v1 的「Visual Identity Anchor」§**）

> v1 的「lichess-clean ＋ board-as-protagonist ＋ calm-default ＋ everything recedes」**作廢**。保留的只有「**對局標註層的角色中性 Nippon 色**」（見下「保留」）。

### 一句話視覺規則
**「精緻、有溫度、像踏進一個棋之國度——premium、有氛圍、有遊戲感但成熟不童趣。」**

### Tone 種子（已用真實木盤＋三方案預覽選定）
- **主色**：深青瓷 **Jade**（沉穩寶石綠；比 chess.com 亮綠更收、襯托暖木）。
- **Accent**：山吹金 **#F8B500**（= 既有 keySquare 品牌金，全站一個金）。
- **質感 finish**：**現代玻璃質感**為全站基底（毛玻璃＋頂光＋焦點柔金光暈，鳴潮式精緻 UI）；**畫意氛圍**（金箔角飾／粒子／微光掃過，Epic Seven 份量）**只留給特殊時刻**（hero、升級、章節開場）。
- **特效克制**：柔光暈、深度陰影、緩慢金色微光、150–250ms 平滑；**禁止**彩帶噴發、卡通彈跳、霓虹閃爍、畫面震動、滿屏亂動。
- **參考座標**：Epic Seven（畫意/份量）、鳴潮 Wuthering Waves（精緻氛圍）、Chants of Sennaar（極簡優雅、克制色盤）、黑神話悟空（世界觀/史詩氛圍/東方神話——戲劇性留給特殊時刻）。

### 棋盤（校準為真實 build）
- **保留不動**：`wood12.jpg` 暖木盤 ＋ **Gioco Wood** 棋子（CC BY-NC-SA，個人非商用）＋黑子 `--piece-dark-brightness:1.2`。暖木盤是**溫暖的中心主角**，app chrome（青瓷／玻璃／金）是它周圍的「棋之國度」世界。
- *註*：v1 寫的 cburnett ＋ gofun/kuwazome 平色格與實作不符，以此處為準；eval bar「對齊方格色」的描述待 ADR-0007 後續校準。

### 保留：對局標註層的角色中性色（不動）
箭頭／keySquare／eval 的 Nippon 角色色（青磁/利休鼠/淺蔥/紅鬱金/山吹/胡粉/桑染）**繼續沿用**——「對局當下不評判、不羞辱每一手」這個原則即使在有遊戲感的外殼下依然正確。權威：ADR-0006 + control-manifest。

### 權威與優先序（沿用）
**accessibility-requirements.md** 仍 takes precedence（對比、reduced-motion、box-shadow 動畫禁令、forced-colors）。棋盤/標註/eval 子系統由 game-concept（本 §）＋ ADR-0006 ＋ control-manifest 管轄。app chrome 由 `design/gambit-design-system/` 管轄（視覺重構新 SoT；主色 Jade + 玻璃質感已定案）。

---

## Inspiration & References（更新）

| 參考 | 取什麼 |
| --- | --- |
| **Epic Seven** | 畫意、份量、成熟高級的遊戲美術 |
| **鳴潮 Wuthering Waves** | 精緻氛圍、moody、現代玻璃 UI 質感 |
| **Chants of Sennaar** | 極簡優雅、克制色盤、近乎無字的敘事 |
| **黑神話悟空 Black Myth: Wukong** | **世界觀深度、史詩氛圍、東方神話厚度、戲劇性特效**——主要餵養「世界/敘事」與「特殊時刻畫意氛圍」兩個 bucket，**非日常 UI**（守低壓力；2D web 取其神、非全貌） |
| **chess.com（Learn/Puzzle）** | 精緻有質感的學習/謎題介面（但棄其童趣 icon／亮綠） |
| **Duolingo** | 進度/闖關式學習動力（棄其壓力型 streak） |

*（v1 的 lichess/Chesskit 技術與市場參照仍有效，見 v1。）*

---

## 下游影響（待辦，非本文範圍）
- v1 `game-concept.md` 的「Visual Identity Anchor」§ → 以本文取代（已於 v1 頂部加指引）。
- ✅ 視覺系統 → 已由 `design/gambit-design-system/` 取代（Jade 主色 + 玻璃質感定案、5 字型自架）。
- `learn-path.vue` 等實作 → tone 落地（後續 Step 2–4）。
- 既有 GDD 若引用舊「calm/board-recedes」調性，逐份輕校（不急、不連鎖打掉）。

---

## 待 Eason 確認
這版 concept v2 是否到位？哪裡要加/減/改語氣？確認後即作為 art-bible 的根。
