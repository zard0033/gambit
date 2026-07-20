# 棋誌「旅程之書」重打 — 呈現層 restyle

> **性質**：ui-design-flow ➌ 施工落地文件（非 DESIGN.md——沿用專案 quick-spec 慣例，避免與
> `design/gambit-design-system` 雙 SoT）。SoT＝樣張 `journal-c-v2.html`（決策樣張，token 已內嵌註記）。
> **狀態**：➊ 決策樣張核可（Eason 2026-07-20，v2）。純呈現層——不動 journal 資料模型／settle 管線／
> store／文案。append-only、決定性渲染不變。

## 1. 為什麼

棋誌從「通知列表」重打成「旅程之書」：章節完成（arrival）不再只是卡片裡一行小標，而是滿版深青扉頁；
其餘條目從平面卡片升級成有紙紋、雙層影、固定物（蠟印／和紙膠帶）的工藝紙片便箋。核心訴求（Eason）：
「想法不錯，但沒有『哇好用心』的感覺」——樣張 v2 相對 v1 加了紙紋、雙層陰影、固定物分級、收斂微斜角度。

## 2. Pen → 視覺分級映射

| Pen | 視覺分級 | 理由 |
| --- | --- | --- |
| `arrival` | 滿版深青扉頁（無固定物，edge-to-edge，不斜） | 章節抵達＝旅程里程碑，整張卡就是公告 |
| `epiphany` | 蠟印（`.fixture-seal`） | 「自己看出來的」——全程零求助，分量最重 |
| `solace` | 蠟印（`.fixture-seal`） | 「被安慰的」——低潮陪伴，同樣分量重的私密時刻；且是唯一連結對局的筆（沿用既有「回到那盤」） |
| `onset` | 和紙膠帶（`.fixture-washi`） | 每帳號僅一次，起點/日常級 |

**迴紋針級（對局時刻）本版未使用**：目前 4 個 `Pen`（`onset`/`arrival`/`solace`/`epiphany`）全部有歸屬，
不生成沒有對應資料的固定物 CSS（YAGNI）。若未來新增一枝標記「精采對局時刻」的 pen，迴紋針級是保留給它的
下一個插槽——屆時比照 `.fixture-seal`/`.fixture-washi` 的做法加一個 `.fixture-clip` + `journal-card--clip`
tier 分支即可。

## 3. Token 與固定物規則（樣張 v2 註記落地）

- **紙紋**：`--texture-paper-grain`（`src/assets/main.css` 全域 token，feTurbulence `baseFrequency:0.9`，
  `mix-blend-mode:multiply`，`opacity:0.05`——過此值顯髒非做舊，勿調高）。扉頁疊層用 `mix-blend-mode:overlay`
  + `opacity:0.1`（深色底需要更高不透明度才可見）。
- **雙層陰影**（便箋）：`0 1px 2px rgba(61,34,16,.16), 0 10px 22px rgba(8,24,20,.28)`（貼合＋浮在
  deep-jade 頁面上的環境暈影，第二層用 jade 暗色而非樣張的純棕，貼合本站底色）。
- **微斜角度池**：`[-0.6, 0.5, -0.3, 0.7]` deg，依 `index % 4` 輪替（決定性，非隨機——同一組資料每次渲染
  角度一致）。扉頁不斜。
- **固定物色**：蠟印＝`var(--color-gold-dark)` 徽章漸層（浮雕光澤 `radial-gradient` + 內壓痕邊）；和紙膠帶＝
  `var(--color-primary)` / `var(--color-primary-soft)`（本站青色系，非樣張的中性灰綠字面色）。
- **扉頁背景**：`linear-gradient(150deg, var(--color-surface-deep), var(--color-primary-dark))` +
  一抹 `rgba(248,181,0,0.11)` 金色暈光（reward 情境——完成一卷是里程碑，符合「金只用於 focus/reward」鐵則）。
- **扉頁文案**：小標＝`volume.slice(0,2)`（如「卷一」）、大標＝`volume.slice(2)`（如「規則」）、
  正文＝`entry.body`（既有模板渲染出的完整句子，**零文案改動**）。不另建卷別對照表。

## 4. 與樣張的落地差異（取捨）

樣張把單一扉頁固定放在頁首（靜態示範一頁書）。真實資料是 append-only 時間軸，`arrival` 可能出現在任何
月份分組的任何位置——**扉頁改為在時間軸中依實際 `createdAt` 內嵌顯示**（仍 edge-to-edge 滿版），而非抽出
成頁首固定橫幅。這是把靜態概念稿適配到動態、決定性渲染資料的必要調整，不影響視覺語言本身。

## 5. 元件

全部改動集中在 `src/components/journal/JournalEntryCard.vue`（單一元件依 `entry.type` 分支渲染扉頁或
便箋，共用 `.journal-card` 根類別與既有 e2e 選擇器 `.journal-card` / `.journal-body` / `role="button"`，
未動 `JournalView.vue` 的分組／收合／unread 邏輯，未動 `src/stores/journal.ts`、`src/modules/journal/*`、
`src/data/journal-templates/*`）。

## 6. 驗收

- `npx vue-tsc --noEmit`、`npx vitest run` 全綠
- `npx playwright test journal-view --grep-invert @spike` 綠（既有斷言未改）
- 亮/暗模式沿用既有 deep-jade 底（棋誌頁本就固定深色場景，非亮暗雙主題頁）；mobile 390 + 桌機 1280 截圖
- 扉頁文字對比 WCAG AA 實算（見交付回報）
