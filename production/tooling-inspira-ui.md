# 工具評估：Inspira UI（給重構期的 AI 用）

> 寫於 2026-06-16。給「差異化重構」期任何要動 UI／沉浸感的 AI 看。
> **這不是「裝一個 UI 庫」的提案，是「需要氛圍元件時，去哪偷、怎麼改」的清單。**
> 上游決策＝願景 §6「擋 juice，擁抱氛圍」。動手前先讀 `design/gambit-design-system/`。

---

## 一句話結論

**不裝整庫。** Inspira UI 是 copy-paste 模式（同 shadcn 思路），只在需要「氛圍」時，
把**單一元件的原始碼**搬進來、**剝掉 juice、改成 Gambit 配色與動效鐵則**，當靈感與起點用。
90% 的元件（炫動畫類）跟 Gambit 的平靜魂直接對沖，**不要用**。

## 它是什麼

Vue 3 動畫元件庫，React 圈 Aceternity UI / Magic UI 的 Vue 版。技術棧 Vue 3 + Tailwind +
`motion-v`（Motion for Vue）。**copy-paste**：用 CLI 把元件原始碼複製進專案，完全擁有可改，不鎖版本。

## 相容性注意（接進 Gambit 前先確認）

- **要多裝 `motion-v`**：Inspira UI 動畫依賴它。Gambit Phase 1 lib 清單沒有，且 CLAUDE.md 有
  guardrail「Phase 1 MVP 沒 ship 前不加新 lib」。→ **能用純 CSS transition 做到的氛圍（緩亮、漸顯）
  優先用 CSS，不為了一個效果引入整個動畫 runtime。** 真要 `motion-v` 再單獨評估、走加 lib 流程。
- **Tailwind 版本**：Gambit 現已在 **Tailwind 4**（CSS-first + `@theme`，`08ab9e4` 已完成 codemod）。
  複製 Inspira UI 新版（v4）元件可直接沿用其 utility / `@theme` 寫法，不需再翻譯回 v3。
- **部署 base path**：氛圍元件常含背景圖／`mask-image`／inline `url()`——依 repo 鐵則
  **JS/inline-style 資產路徑必加 `import.meta.env.BASE_URL`**，否則部署到 `/gambit/` 子路徑 404。

## 白名單（剝掉 juice 後可能符合「氛圍」）

對應願景 §6「進 app＝抵達一個有光的場景」「晨光／暮色／四季」「轉場＝穿過空間」：

| 元件方向 | 用途 | 改造重點 |
| --- | --- | --- |
| Aurora / 漸層光暈背景 | 開場「有光的場景」、時間/季節氛圍 | 改 deep-jade 系；極慢或靜態，**禁脈動循環**；金色只當 focus/reward 不當背景 |
| 文字漸顯（text fade-in / blur-in） | Neve 招呼語登場 | **一次性**，非循環；150–300ms 或更慢的單次 ease；尊重 `prefers-reduced-motion` |
| 柔光 / 景深 vignette | 場景包裹感 | 純 CSS 漸層 + opacity，別用 box-shadow 動畫（鐵則禁） |
| 頁面/路由轉場（穿過空間感） | 旅程感轉場 | 只動 transform / opacity；慢、優美；禁位移彈跳 juice |

## 黑名單（與平靜魂對沖，不要用）

3D 翻卡 / tilt、霓虹發光邊框（box-shadow 動畫，鐵則明禁）、Marquee 跑馬燈、粒子/流星/煙火、
彈跳數字 / counter、任何無限循環脈動、任何帶「刺激 / 多巴胺爆點」氣味的效果。
→ 這些就是願景 §6 要繼續禁的「賭場式 juice」。

> **例外 — reward／棋憶等「特規時刻」**：成就、獎勵、棋憶高光這類**刻意設計的時刻**不在上述反-juice
> 範圍內，可用**無限循環的氛圍動態**（例：螢火蟲微光、緩慢光點），用以標記「這一刻值得停留」。
> 仍守住的底線：只動 `transform`/`opacity` 或 canvas（**box-shadow 動畫仍禁**）、**尊重
> `prefers-reduced-motion`**（關掉動畫仍可讀）、金只給 reward、強度克制不刺眼。日常介面（清單、卡片、
> 導覽）一律回歸平靜，特規僅限這些被明確標記的時刻。

## 改造鐵則（複製任何元件後，逐條對齊才算數）

1. **配色**：每屏 deep-jade `#103029` 錨；金 `#F8B500` 只 focus/reward，**絕不當背景或內文**；暖 cream 內容、暖棕陰影非純黑。
2. **動效**：150–300ms（氛圍可更慢但要單次），只動 `transform` / `opacity`，**box-shadow 動畫禁止**，**無限循環脈動禁止**。
3. **`prefers-reduced-motion`**：一律加 fallback，關掉動畫仍可用。
4. **觸控 ≥ 44×44px**、無 hover-only（iPhone 無 hover）。
5. **棋盤 / 棋子 / 標註 / eval 神聖不可碰**：氛圍只能在周圍，不重新上色棋盤。
6. **無 emoji 當功能 icon**（用 Lucide）。

## 使用流程（守 repo 既有鐵則）

需要氛圍元件時：**先 `/redesign` 對真實畫面出 H/M/L 報告 → Eason 拍板 → 才施工**
（CLAUDE.md「redesign 先報告後施工」，即使計畫已寫好也不可直接動手）。Inspira UI 只當
「施工時的程式碼起點與靈感」，**不得覆蓋 Gambit 配色／字型／金色規則**。

官網：inspira-ui.com（元件預覽與安裝）。
