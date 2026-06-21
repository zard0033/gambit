> ⚠️ **SUPERSEDED 2026-06-21 by `quick-specs/concept-deepening-page.md`** — 本文描述的 `?from=concept` 側門（`sideLearned`/`markSideLearned`/`from=concept` 進入豁免、已學＝completed ∪ sideLearned 聯集）**已整套拆除**，改為概念深化頁（`/learn/concept/:conceptId` + `concept_deepened`）。下方 §3/§6/§7/§8 的施工指示已失效，**請勿照做**。保留本檔僅作設計史紀錄。

# 概念頁改版 — 在熟悉度地圖上加「按戰術切入學習」（加法版）

> **性質**：功能增補（additive，**不是**重新定義）。在 GDD §3.5 既有的熟悉度地圖上，新增 tap-to-learn 入口。**不改寫 §2 Player Fantasy**（保留「平靜的反映面」定位）。
> **狀態**：Design-review（full）已跑 → 原「砍掉重練」版判 MAJOR REVISION，收斂為本加法版。實作後仍建議補跑 `/design-review` 確認 §3.5 一致。詳見文末 §審查紀錄。

---

## 1. 為什麼

Eason 的目標：**非初學者想直接找到並跳進某個戰術去學**，不必從第一章線性爬。

原提案（把整頁改成純戰術索引）經 design-review 判 **MAJOR REVISION**，三個致命問題：(1) 偷改了已核准、二輪審過的 §2 Player Fantasy——地圖被鎖定為「平靜的反映面」，答「你熟了哪些」非待辦清單；(2) 刪掉「已練」這個取代 XP/連勝的成就訊號；(3) 側門工程踩了 GDD §3.2 D1 已**否決**的「改寫共享進度集合＋改鎖判斷」雷。

**本版改採加法**：保留地圖靈魂，只增加 tap-to-learn。約 20% 工作量拿 80% 價值，不傷 pillar。

## 2. 設計（加法）

### 2.1 保留（不動 §2 靈魂）

- 地圖仍是「你熟了哪些」的平靜反映面。
- **保留 已學 ＋ 已練 兩個熟悉度訊號**（已練是取代 XP 的成就感，**不刪**）。
- **保留「之後會遇到」安靜區**：未開始的概念維持視覺低調，**不變成一格格打勾的待辦網格、不顯示「未達成」**。

### 2.2 增加：tap-to-learn

- 每個概念卡可點 → **側門**進入該戰術的教學課（`teaches[0]`），就算線性還沒解鎖也能進。
- 未學的概念卡也可點（去學），但**視覺維持安靜**——tap 提示低調（如小小「去學 ›」），不喧賓奪主、不變清單。
- **這頁不放「去試煉」**（一戰術對多謎題，無單一正確關卡；練習交給上完課的 Bridge-1 ＋ 謎題模式）。
- 修掉原本雙圓點「看起來像兩個待辦」的混亂：已學/已練改用一個清楚可讀的狀態呈現（確切視覺於施工時截圖定，須保留兩訊號的資訊量）。

### 2.3 雙向連結（Learning Loop 三橋）維持不動

本次移除的「去試煉」是**概念頁自己的那顆 CTA**（`ConceptMapView.vue` 的 `practise()`），**不是**三道橋。三橋活在課程／謎題／賽後檢討頁內，全部保留：

| 橋 | 方向 | 位置 |
| --- | --- | --- |
| Bridge 1 | 課程 → 試煉 | `LessonView.vue:437` `lesson-practice-cta`「想趁熱練幾題」 |
| Bridge 2 | 試煉 → 課程 | `DungeonPuzzleView.vue:233` `concept-review-link`「複習這個概念」 |
| Bridge 3 | 對局 → 課程／試煉 | `ReviewView.vue:429`「複習這個概念」＋ signpost |

側門讓雙向迴圈**更完整**：概念頁 →（側門）學戰術 → 上完課 **Bridge 1** 接去練 → **Bridge 2** 帶回課。

## 3. 側門機制 — 沿用 D1「獨立 signal、不污染線性進度」

GDD §3.2 D1 對謎題側門的定案：練習解題只寫獨立 `practiced` 訊號，**不寫**共享 `solved` 集合、**不改**解鎖判斷。課程側門照**同一 pattern**（重點：是照 D1 精神，**不是**改鎖判斷——原版踩的就是這個雷）：

1. **進入豁免（新標記）**：概念卡導向 `/learn/:lessonId?from=concept`。`LessonView` 進入守衛改為 `isUnlocked(lesson) || route.query.from === 'concept'`。
   **`?from=concept` 是新的第三種標記**（現有謎題側門用 `?from=lesson`，兩者不同、勿混用；這不是「照抄」謎題，是新路徑）。
2. **完成寫獨立訊號，不寫線性集合**：經 `from=concept` 側門完成課程時，寫入新的 `sideLearned`（概念側門已學）訊號，**不呼叫 `lessonProgress.markComplete`**、**不改 `isUnlocked`**。
3. **熟悉度由聯集決定**：`learned(concept)` = 該概念的教學課在 `completed` **或** `sideLearned` 任一完成 → 點亮地圖「已學」。`isUnlocked` **只讀**線性 `completed`（**完全不動**）。

**為何這樣一次全解**：

- 不改鎖判斷 → 消除 systems「行為相同」自相矛盾與測試盲區（原 B1/B2）。
- 不寫共享集合 → 線性課程列表不會出現「✓完成緊鄰 🔒 鎖住」的矛盾（原 R1 消失）。
- 與 D1 同一 pattern → 全 repo 一致，不再有兩套相反的 side-door 做法（原 R3 消失）。

**兩面鏡子（與 GDD §1 一致）**：概念地圖反映「你遇過哪些戰術」；線性 課程 track 反映「你一步步的進度」。側門學了 牽制 → 地圖「已學」亮，但線性列表仍顯示未走到該課——這與謎題「練習解開但關卡仍未解」**完全對稱**，是刻意的雙鏡設計，不是 bug。

## 4. 側門返回與定向（修 ux 回程斷裂）

`LessonView` 的返回鍵、完成後返回、守衛 fallback 目前都寫死 `router.push('/learn')`（線性目錄），會把側門使用者丟回線性清單。修正：

- 經 `from=concept` 進入時，**返回鍵與完成後返回 → 導回 `/learn/concepts`**（非 `/learn`）；返回鍵 `aria-label` 由「返回課程清單」改為「返回概念」。
- `?from=concept` 需在課程內導覽中保留／傳遞。
- **提前學的輕聲提示**：`from=concept` 進入時，課程頂部顯示一句平靜中立的註記（如「你提前學了這個戰術」），不評判、不施壓。

## 5. Calm-rule 合規（不變）

無 streak/timer/leaderboard/XP/分數；無「未達成」；無「X/8」框架。西洋棋用語城堡/騎士/主教。已學/已練徽章須以**文字或 icon** 表達（**非僅靠顏色**）；CJK 文字不用 italic。

## 6. 實作計畫（分階段，各自可獨立 ship）

1. **進度訊號**：新增 `sideLearned`（lesson-progress store 內或小型 store）。side-door 完成寫此，**不寫 `completed`**。**`isUnlocked` 不動。**
2. `src/modules/learning-loop/mastery.ts`：`learned(c)` 讀 `completed ∪ sideLearned`。
3. `src/views/LessonView.vue`：`from=concept` 進入豁免；完成時依 `from` 寫 `sideLearned` 或正常 `markComplete`；返回／`aria-label`／提前學註記依 §4。
4. `src/views/ConceptMapView.vue`：保留 已學/已練 ＋ 安靜 dormant 區；每張卡可點 → `/learn/:lessonId?from=concept`；清掉雙圓點混亂、加低調 tap 提示；沿用先前已套用的 tab icon／標頭／白話 blurb。

## 7. Acceptance Criteria（新增）

**自動（blocking）：**

1. **側門不污染線性進度**：經 `from=concept` 完成一課後，`lessonProgress.completed` 不變、`isUnlocked` 對每一課不變、`nextLesson` 不變；該概念 `learned()` 變 `true`。*(store/unit)*
2. **`?from=concept` 進入豁免**：鎖住的課帶 `?from=concept` mount `LessonView` 會 render（不 redirect）；不帶該參數則 redirect 回 `/learn`。*(component)*
3. **側門返回定向**：`from=concept` 時返回鍵與完成返回導向 `/learn/concepts`，`aria-label` 為「返回概念」。*(component)*
4. **Bridge-1 路徑無關**：經 `from=concept` 完成、且該概念有謎題 → `lesson-practice-cta` 出現，與線性完成一致。*(component)*
5. **概念卡狀態**：已學概念顯示單一「已學」徽章（文字/icon，非僅顏色）；未學概念**無「未達成」**且**仍可點**進該課；已練呈現保留。*(component)*
6. **Calm/Gambit 合規**：`gambit-compliance.test` 對重建後的 view 仍全綠（無 未達成/streak/emoji/象棋用語）。*(grep)*
7. **觸控目標 ≥44px**：每張可點概念卡 `boundingBox()` ≥ 44×44。*(Playwright)*

**手動（advisory）：**

8. **視覺走查**：概念頁讀起來仍是平靜的「我熟了哪些」反映面（非待辦清單）；側門進遠處課程 → 完成 → 不點亮後面的線性課；返回落在概念頁；CJK 徽章不 italic。

## 8. 測試衝擊

- `tests/unit/views/concept-map-view.test.ts`：**整檔重寫**。刪除斷言舊設計的測試（lit/dormant 分區、`concept-practise-cta`、雙 state-dot 那套）；**保留 load-bearing 不變式**：無「未達成」、lesson-only 概念不顯示練習入口。新增：未學概念卡仍可點。
- `tests/unit/learning-loop/gambit-compliance.test.ts`：**不動、保留**（重建後仍須通過——它是重寫的迴歸網）。
- `tests/unit/stores/lesson-progress-store.test.ts`：新增 §7-AC1 的「側門不污染」測試。**`isUnlocked` 不動，現有測試應全綠。**
- `tests/unit/learning-loop/mastery.test.ts`：`learned()` 新增 `sideLearned` 聯集分支測試；`practiced()` 保留。
- 44px（AC-11a）覆蓋由移除的「去試煉」鈕**移到新的可點卡**。

## 審查紀錄

- **2026-06-09 design-review（full）**：specialists = systems-designer、game-designer、ux-designer、qa-lead、creative-director。
  原「砍掉重練成純戰術索引」版判 **MAJOR REVISION**——偷改 §2 Player Fantasy、刪「已練」、側門踩 D1 已否決的共享集合雷、側門無返回路徑。
  收斂為本「**加法版 ＋ D1 獨立 signal**」：保留地圖靈魂（已學/已練/安靜 dormant 區），只增 tap-to-learn；側門用獨立 `sideLearned` 訊號、不動 `isUnlocked`；修返回定向；補 §7 AC 與 §8 測試。
