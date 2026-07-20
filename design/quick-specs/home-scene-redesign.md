# 首頁「星夜旅程」重打 — Quick Spec

design-flow：⓪A 勝出（2026-07-20 三方盲測）➊ v4.3 樣張核可（同日）➋ 本檔（2026-07-20 二次定案，
本輪覆蓋掉工作樹「亮綠+適應性深色文字」的否決版）➌ 施工（本檔對應改動）➍ 待另派審查 ➎ 隨 ➍ 併派

## 方向一句話

首頁不再是「hero 橫幅＋SaaS 卡片牆」，而是「星夜天色場景＋一條蜿蜒小徑，三顆光點＝三件今天可以做的事」。
場景本身即內容容器，不是裝飾條。

## 樣張（SoT）

`concept-round/home-a-v4.html` + 核可截圖 `home-a-v42-390.png` / `home-a-v42-640.png`（2026-07-20，
Eason 核可 v4.3：拿掉金色 radial 光暈與中段光暈平台後的定稿）。天空技術做法另補
`warm-sweep.html`（2026-07-20，暖光 4 變體比稿）——核可變體 2「熾白核心」。

## 2026-07-20 二次定案：否決「亮綠天空 + 適應性深色文字」

上一版把 morning/afternoon 天空整組拉亮成鮮綠色調、靠 `--scene-ink`/`--scene-ink-dim` 隨 bucket
切換深/淺色文字去湊 WCAG——Eason 否決：「風格直接跑掉了」。星夜美學的前提是**四時段都是暗空**，
願景寫的「晨光/暮色」指的是低光時刻的光質變化，不是把天空調亮成白天。本輪定案：

1. **四時段天空全部維持深空**，不做亮度階梯。
2. **文字色固定**，統一回 `--color-ink-on-deep` / `--color-ink-on-deep-dim`，不隨 bucket 變動、
   不再有「亮時段深色文字」這條分支。
3. 時段之間的可辨性改由**光的事件**（見下表）與星塵密度負責，不靠背景亮度。

## Tokens（`src/assets/main.css`，additive，`--scene-*`）

`--scene-sky-1..6`＝6-stop 垂直漸層，**四個 bucket 現在共用同一組深 jade 停駐色**
（`#030907 → #071712 → #0b241d → #103029 → #16392f → #1c4237`，錨 `#103029` 不變）。這是
WCAG 對比實算逼出的結果——曾嘗試單獨把 afternoon 天空拉淺表達「最清透」，但底部停駐色一亮，
`ink-dim` 對比就跌到 3.87:1（見下方對比實算節）；「清透」改由星量最低（0.08）＋天頂光暈事件
表達，天空本身不變亮。`--scene-star-opacity` 控制星塵密度（容器 opacity，非逐星計算）。

| Bucket | star-opacity | 光的事件（--scene-core-*） |
| --- | --- | --- |
| night | 1.0 | 無（`--scene-core-opacity:0`）——最深、星最多，是基準 |
| morning | 0.35 | 冷白熾核心，低窄帶（top 58% / height 22%），alpha 峰值 0.06 |
| afternoon | 0.08 | 天頂極淡高空白晝光，大尺度（top -10% / height 46%），alpha 峰值 0.10 |
| evening | 0.6 | 暖白熾核心，低窄帶（top 58% / height 22%），alpha 峰值 0.06 |

`--scene-nav-join`（`#183e35`）維持不變，仍是場景頂緣與 AppNav 底色的無縫接點。

## 光的事件（`--scene-core-*`）——時段辨識不靠亮度，靠光質

四時段的可辨性來自「有沒有光帶、光帶是什麼色相、光帶在哪」，不是整體調亮/調暗：

- **night**：無光帶。天空維持最深、星塵最密（opacity 1.0）——四時段的基準畫面。
- **morning**：冷白熾核心，低窄帶貼近路徑下段（藍調時刻）。色相取近白帶青藍
  `rgba(235,245,255,·)`，星量中等偏少（0.35）。
- **afternoon**：天頂一抹極淡高空白晝光——大尺度（46% 高度）、頂緣起始向下暈開、三段停駐皆無
  硬邊，讀不出浮空邊界；星幾乎不見（0.08），是四格中最安靜的一格。
- **evening**：暖白熾核心，低窄帶，色相同 morning 幾何、換暖色 `rgba(255,250,240,·)`；星回來
  （0.6）。

### 「熾白核心」避開橄欖濁色的色彩原理

深 jade 天空（綠相）疊暖色時，若走 `amber + screen` 的傳統做法（如 `rgba(255,190,80,·)`
中段疊綠底），中間調的黃橙會與底色的綠相加成**橄欖濁色**——三輪迭代（v4.1 平台、v4.2 hero-glow）
都栽在這裡。`warm-sweep.html` 比稿驗證的解法：把核心色相直接推到**近白熱**（`rgba(255,250,240,·)`
／冷色版 `rgba(235,245,255,·)`），跳過會生成橄欖的黃橙中間調——screen blend 疊近白色在任何底色上
都趨向提亮而不换色相，橄欖沒有中間調可生。

### alpha 大幅下調——AC（對比）優先於樣張數值

`warm-sweep.html` 核可的 alpha 是 0.55/0.88（給獨立 hero 視覺用），直接套進本頁會把節點文字位置的
對比壓到 1.1–3.3:1（WCAG 對比實算逼出的發現，見下節）。本輪把 morning/evening 核心的 alpha
降到 0.03–0.06（用二分搜尋對全部 6 段天空停駐色求出的安全上限），afternoon 天頂光暈維持
0.04–0.10（其位置本身落在天空最暗的頂部區，天生有餘裕）。光的事件因此比樣張更含蓄，這是
「規格與可測 AC 衝突時 AC 優先」的取捨——可視性讓位給可讀性。

## 顆粒層（`--texture-sky-grain`）

靜態 SVG `feTurbulence` data-URI，`baseFrequency:0.75`、`numOctaves:2`、200px tile；消費端
（`NeveSceneHeader.vue` `.grain`）套 `opacity:.14; mix-blend-mode:overlay`，**限定在 `.scene`
容器內**（非整頁 fixed，行動效能考量）。0.14 是比稿三檔（`grain-sweep.png`：0.05／0.14／0.20）裡
唯一「有感但不髒」的值——0.05 幾乎等於沒開、0.20 偏髒。尺度與棋誌紙頁紋理
（`--texture-paper-grain`，0.9／2／120px）分開調，天空要更細更疏的粒子感，兩者互不影響。

## 漸層插值：oklab 雙宣告

`.scene` 的天空背景寫兩行 `background`：第一行標準 sRGB linear-gradient 當 fallback，第二行
`linear-gradient(180deg in oklab, …)` 覆蓋。理由：sRGB 空間插值深色 stop 之間常見濁灰/濁綠假象
（尤其深綠→深綠的多段漸層，中段容易讀出一層灰霧），oklab 插值感知均勻、不產生這種假象。
不需要 `@supports`——CSS 對整條聲明的未知語法本就是宣告層級忽略，Safari 16.0/16.1（不支援
`in oklab`）會讓第二行整條被忽略、停留在第一行的 sRGB 結果；Safari 16.2+／Chromium／Firefox
近期版支援，套用第二行。

## 鐵則：禁止深青上疊金色 radial 光暈 / 懸空色塊

三輪迭代（v4.1 平台、v4.2 hero-glow、v4.3 移除）皆證實：任何金色 `radial-gradient` 疊在 jade 漸層上，
無論釘在中段或底部，都會被讀成一塊獨立浮空色塊（`scratchpad/isolate-*.png` 隔離測試留證）。
**場景背景一律只用線性漸層 stop 本身表達暖度，或用 top/bottom-anchored 全寬線性 `screen` 光帶**
（本輪「光的事件」用的手法：全寬、貼邊、無左右羽化邊界，讀成大氣光而非懸空物件），**不得使用
`radial-gradient` 或任何有明確中心點／邊界的色塊**。金色僅保留於：CTA 按鈕、光點（node dot）
本體、與 1px 細光帶（`.streak`，非 radial、非 wash，不受此鐵則約束）。

## 光點三階層級（node dot）

沿用樣張定稿尺寸與光暈強度，不再放大——樣張經核可，改尺寸需重新核可：

| 站 | dot 尺寸 | 光暈 | 語意 |
| --- | --- | --- | --- |
| 繼續走（node-cta） | 14px | 22px blur + 6px spread（強） | 進行中，永遠最亮 |
| 學習（node-lesson） | 8px | 10px blur + 3px spread（弱） | 次要 |
| 試煉（node-trial） | 4px | 4px blur（極弱／無） | 背景感 |

## 曲徑幾何

`viewBox="0 0 100 100"` 三段貝茲：`M12,10 C42,18 30,32 44,42 C58,52 12,66 20,80`，
`stroke:var(--color-ink-on-deep)` 低透明、`stroke-dasharray:0.5 5` 虛線感。三站定位（`.node-cta`
`left:6% top:2%`／`.node-lesson`　`left:32% top:39%`／`.node-trial`　`left:8% top:78%`）與樣張一致，
左右交錯（cta 左、lesson 右、trial 左），文字對齊隨光點側邊切換（lesson 靠右對齊）。

## WCAG 對比實算（摘要，全量見 session 附件 `contrast.js` 輸出）

實算涵蓋四時段 × 天空 6 段停駐色 × 光的事件三段核心停駐色（screen blend + alpha 合成），對
`--color-ink-on-deep`（`#e7f1ec`）與 `--color-ink-on-deep-dim`（`#9bbdb1`）分別驗 ≥4.5:1。
四時段共用同一組天空停駐色後，全部樣點通過，最低margin為 evening 光帶末端（合成色
`#23443a`）對 ink-dim 的 5.26:1，其餘皆 ≥6:1、多數 ≥9:1。這也是為何 afternoon 放棄單獨拉淺
天空的直接證據：獨立拉淺版本的天空底部停駐色 `#1f5c40` 對 ink-dim 僅 3.87:1（不合格）。

## 資料接線

- 問候語：既有 `greetingForNow()`（不動）
- 繼續走：`useResumeGameStore().current` 有值 → 「上一盤還沒下完」＋回到棋盤（`continueGame`）＋
  「另開新對局」次要連結；無值 → 「開一盤新的」＋開始對局（`startGame`）
- 學習：`useLessonProgressStore().nextLesson` → 課名＋第 N 課／章節標籤；全完成 → 「你已完成所有課程」
- 試煉：`useDungeonProgressStore().currentOrder` 對應 `puzzles` 找目前題 → 題名＋brief；全解 →
  「你已破解所有試煉」
- 棋誌：`useJournalStore().recent(HOMEPAGE_PEEK_COUNT)`，`data-testid="journal-peek-entry"` /
  `"unread-dot"` 原樣保留（journal-unread.spec.ts 斷言）
- 底部三數字：課程 `completedCount/totalCount`、試煉 `solvedCount/totalCount`、棋誌 `entries.length`

## 動效

進場緩亮 620ms（既有氛圍例外，`.scene` opacity fade）；下方棋誌卡／三數字沿用既有 `.fade-rise`
（280ms，錯開 delay）。`prefers-reduced-motion` 兩者皆直接點亮/顯示，不跑 transition。

## 版本紀錄

- 2026-07-20：首版，隨首頁重打施工同時寫入。
- 2026-07-20（二次定案）：否決「亮綠天空 + 適應性深色文字」版；改為四時段統一深空 + 固定淺色
  文字 + 「光的事件」（核心光帶／天頂光暈）+ 顆粒層 + oklab 漸層插值。刪除舊版 a11y 修訂節
  （壓暗背景湊對比／per-bucket 深色文字），避免與本次定案矛盾記錄並存。
