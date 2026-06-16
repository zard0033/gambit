# 工具評估：Vue UI 元件庫（給開發期的 AI 用）

> 寫於 2026-06-16。來源文章：tailgrids.com/blog/best-vue-component-libraries（11+ Vue 元件庫 2026）。
> 氛圍/動畫元件另見 `production/tooling-inspira-ui.md`。動 UI 前先讀 `design/gambit-design-system/`。

---

## 一句話結論

**不採用清單裡任何「整包元件框架」。** Gambit 已有對的地基＝
`reka-ui`（headless，Radix 的 Vue 版）＋ Tailwind 3 ＋ `class-variance-authority` ＋ `tailwind-merge`
＝ **shadcn-vue 模式**（copy-paste、自己上樣式、不鎖版本）。整包框架會把**自己的設計語言強加上來**，
跟 Gambit 鎖定的配色／字型／金色規則與平靜魂對沖。需要時只「**偷 copy-paste 來源的單一元件 + reskin 成 Gambit**」。

## 為什麼（Gambit 的硬限制）

1. **設計系統已鎖**：`design/gambit-design-system/`（deep-jade、金只 focus/reward、BIZ UDPMincho/LXGW…）。
   採用自帶 look 的框架＝兩套設計系統打架。
2. **Phase 1 guardrail**：MVP ship 前不加新 lib（CLAUDE.md）。
3. **平靜魂**：Material/企業級框架的預設動效與密度跟「成熟、平靜、低壓力」衝突。
4. **已有 headless 基礎**：reka-ui 已涵蓋無障礙 primitives（Dialog/Slider/Tabs…），不需要再疊一層。

## 逐一評（12 個）

| 元件庫 | 類型 | Gambit 判定 |
| --- | --- | --- |
| **Headless UI (Vue)** | 無樣式 + Tailwind, ARIA | ⚠️ **多餘**——reka-ui 已涵蓋且更完整，不重複裝 |
| **Flowbite Vue** | Tailwind, open-source, copy-paste | ✅ 可偷**單一元件**當起點，但要 reskin（會帶 Flowbite 藍味） |
| **TailGrids Vue** | Tailwind blocks/templates（部分付費） | ✅ 僅限**行銷/landing 區塊**靈感（web-design-engineer 領域），非 app 內畫面 |
| **Vuestic** | Vue3 + Tailwind framework | ⚠️ 是整框架、自帶 look；不採整包，最多看單一元件寫法 |
| **Vue Tailwind** | utility-first | ❌ 文章自己說更新不穩、僅小工具用 |
| **PrimeVue** | 自帶 theme、元件多 | ❌ 整套設計語言，覆蓋 Gambit |
| **Vuetify** | Material Design | ❌ 強加 Material，撞平靜魂 |
| **Vue Material** | Material、少維護 | ❌ 過時 + Material |
| **Ant Design Vue** | 企業級 Ant 語言 | ❌ 企業 look，撞品牌 |
| **Naive UI** | Vue3、可主題化但自帶 look | ❌ 不採整包 |
| **Vant** | 行動端 Vue、風格固定 | ❌ 行動框架但 look 固定，Gambit 是訂製 |
| **Chakra UI Vue** | theme-first | ❌ **已 archived，別碰** |

## 標準作法（未來要 UI 時）

1. **元件層**：用現有 reka-ui + 自寫樣式（shadcn-vue 模式）。需要新 primitive 先查 reka-ui 有沒有。
2. **想偷靈感/起點**：Flowbite（元件）、TailGrids（landing 區塊）只當**程式碼起點**，複製後一律 reskin 成 Gambit。
3. **氛圍/動畫**：走 `tooling-inspira-ui.md`（Inspira UI copy-paste + 剝 juice + CSS 優先）。
4. **鐵則**：任何採用前對齊 `design/gambit-design-system/`；redesign 類「先報告後施工」；Phase 1 不加 lib。
