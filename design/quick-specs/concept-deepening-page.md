# 概念深化頁 — 廢側門、概念地圖通向「更深一層」

> **性質**：方向重構（vision-blessed）。**Supersedes `concept-tab-tactic-entry.md`**（側門加法版）——側門整套拆除，概念地圖改為通向各戰術的「深化頁」。
> **北極星依據**：`production/gambit-differentiation-vision.md` §2 決策 2（課程體驗重設計 ③ 教你怎麼想 + ④ 慢課），Open Questions 已列「概念深化頁」。
> **狀態**：設計拍板（Eason 2026-06-21，先設計再整包做 + 全 8 概念）。實作後補跑 `/design-review` 確認與 learning-loop §3.5 一致。

---

## 1. 為什麼

側門（`?from=concept` 跳進入門課）解的是「非初學者想直接學某戰術」，但它與新北極星（2026-06-16）的「課程長在你自己棋上 / 慢課 / 教你怎麼想」軸不對齊：側門只是**提前看同一堂入門課**，沒有「更深」。新方向把概念地圖從「入門課的捷徑」升級成「**每個你遇過的戰術 → 走更深一層**」的門。

入門課（線性 track）回答「這是什麼圖案」；深化頁回答「**在更亂的盤面自動看出它**」——服務 ③（怎麼想，不是背步）+ ④（慢，一個局面坐久）。

## 2. 設計

### 2.1 核心轉變
- 概念地圖不再側門跳進入門課。**入門課留在線性課程 track 原位不動。**
- 點概念卡 → 新路由 `/learn/concept/:conceptId`（深化頁）。
- 整套 side-door 機制拆除（見 §6）。

### 2.2 深化頁內容（教學法）
- **每概念 3 個漸進局面**：乾淨示範 → 接近實戰的雜訊盤。每個是 Socratic 互動步（提問 → 提示給目標不給步 → 走對給可遷移原則），中間夾敘述步。≈ 3–5 步/概念。
- **收尾不發勳章**（證書感是入門課專屬，避免重複）。改 Neve 一句平靜回望：「你開始用眼睛看棋，不是背招。」
- Neve 語氣（回顧/教學態見 `persona-neve.md`）、**clean-room 自寫**、**每個 FEN/走法 chess.js 實證**（受內容授權 + 棋理兩護欄）。
- **v1 範圍 = 全 8 概念**：material / fork / pin / mate / skewer / discovered / defense / center。每張卡都通向真實深化頁，地圖行為一致。

### 2.3 概念地圖狀態（守「不要第三顆待辦點」教訓）
- **維持 已學 / 已練 兩顆點不變**（已學＝入門課線性完成；已練＝解題達標）。side-door 拆除後，已學**只讀線性 `completed`**（不再聯集 `sideLearned`）。
- 深化完成**不加第三顆彩點**——改卡片低調文字：未深化「深入 ›」、已深化「重溫 ›」。平靜、非計分、非待辦。
- 深化頁**不上鎖**（Calm 無鎖鐵則），不要求先完成入門課。已學/已練/已深化三者彼此獨立的安靜狀態。
- 守 §2 Player Fantasy：地圖仍是「你熟了哪些」的平靜反映面，只是每格現在能往深走，不是待辦清單。

## 3. 架構（共享渲染器）

- 從 `LessonView` **抽出 `<LessonPlayer>`**：棋盤幾何 + 步進互動（提示/揭曉/重試/上下步）+ 教練氣泡打字機 + finished 轉場引擎。Props：`steps / playerColor / title / backTo / backLabel`；emit `complete`；slots：`#completion-card`（收尾卡內容）、`#completion-actions`（收尾頁腳動作列）。
- `LessonView` 與新 `ConceptDeepenView` 都變薄殼包 `<LessonPlayer>`：各自帶自己的 guard / 進度寫入 / 返回 / 收尾卡 + 動作列。**`fromConcept` 條件分支整個消失**（每 caller 自帶設定）。
- 資料：`src/data/concept-deepening/` 匯出 `Record<ChessConcept, ConceptDeepening>`，`ConceptDeepening = { conceptId; title; intro: string; steps: LessonStep[] }`。**複用 `LessonStep`**，不另造型別。
- 進度：`concept-progress` store（已管 `practiceSolved`）加 `deepenedConcepts: Set<ChessConcept>` + `markDeepened` + 雲端同步，**取代** `sideLearned`。

## 4. 路由與返回

- 新 `{ path: '/learn/concept/:conceptId', name: 'concept-deepen', component: ConceptDeepenView, meta: { fullBleed: true } }`。
- 深化頁返回鍵 / 收尾返回 → `/learn/concepts`，`aria-label`「返回概念」。
- 未知 conceptId → `router.replace('/learn/concepts')`。

## 5. Calm-rule 合規

無 streak/timer/leaderboard/XP/分數；無「未達成」/「X/8」；西洋棋用語城堡/騎士/主教；狀態以文字+icon 非僅顏色；CJK 不用 italic。深化頁無鎖。

## 6. 拆除清單（side-door 一次清乾淨）

- `ConceptMapView` 的 `?from=concept` tap → 改 `/learn/concept/:id`。
- `LessonView` 的 `fromConcept` 全分支（guard 豁免、提前學註記、`markSideLearned` vs `markComplete`、`backTo`、aria）——隨抽 `<LessonPlayer>` 一併移除。
- `lesson-progress`：`sideLearned` ref / `markSideLearned` / `isLearned` 的 sideLearned 聯集 / `syncFromCloud` + `reconcileOnLogin` 的 sideLearned 分支。`isLearned` 改為 `=== isCompleted`（或 caller 直接讀 `isCompleted`）。
- `data-sync`：`loadSideLearned` / `upsertSideLearned`。
- `learning-loop/mastery.ts`：`learned()` 的 sideLearned 聯集分支 → 只讀 `completed`。
- **保留**：賽後檢討 signpost（`?from=lesson`）、Bridge 1/2/3、已練（concept-progress practiceSolved）。

## 7. Supabase

- 新表 `concept_deepened (user_id uuid, concept_id text, created_at)`，`UNIQUE(user_id, concept_id)` + RLS（owner-only，比照 `lesson_side_learned`）。
- `lesson_side_learned` 表**留著不刪**（避免破壞性 DROP；停用即可，資料無遷移必要——side-door 本就邊緣使用）。
- **migration 由 Eason 手動套 + gate**（比照 011/ADR-0014）。注意 noir worktree 共用 origin，timestamp 錯開。

## 8. Acceptance Criteria

**自動（blocking）：**

1. **8 概念深化資料合法**：每概念 deepening 的每個 FEN 含雙王且 chess.js 可載；每個 `expectedMove` 在該 FEN 為合法走法；宣稱將殺者 `isCheckmate()` 真為 true。*(data test)*
2. **深化完成寫獨立訊號**：完成某概念深化 → `conceptProgress.deepenedConcepts` 含該 id；`lessonProgress.completed` / `isUnlocked` / `nextLesson` **皆不變**。*(store/unit)*
3. **共享渲染器無回歸**：抽出 `<LessonPlayer>` 後，既有 lesson 單元 + e2e（lesson 流程）全綠，行為不變。*(既有測試)*
4. **側門已除**：`?from=concept` 不再有任何 production 引用；`grep` 0 命中（測試除外）；帶 `?from=concept` 進 LessonView 不再有豁免分支。*(grep + component)*
5. **概念卡導向深化**：點任一概念卡 → `/learn/concept/:id`；返回落在 `/learn/concepts`，aria「返回概念」。*(component)*
6. **地圖狀態**：已學讀 `isCompleted`（非聯集）；已深化卡顯示「重溫 ›」、未深化「深入 ›」；無「未達成」、無第三顆彩點。*(component)*
7. **Calm/Gambit 合規**：`gambit-compliance.test` 對概念地圖 + 深化頁全綠（無 未達成/streak/emoji/象棋用語/CJK italic）。*(grep)*
8. **觸控目標 ≥44px**：每張可點概念卡 boundingBox ≥ 44×44。*(Playwright)*

**手動（advisory）：**

9. **視覺走查**：深化頁讀起來比入門課「更深一層」、Neve 語氣平靜；概念地圖仍是反映面非待辦；木盤主題吃到、無 lichess 深盤漏；CJK 不 italic。截 概念地圖 + 一個深化頁完局 二畫面。

## 9. 測試衝擊

- `tests/unit/views/concept-map-view.test.ts`：改 tap 斷言（→ `/learn/concept/:id`）、已學讀 isCompleted、深入/重溫 文字。保留不變式（無未達成）。
- `tests/unit/stores/lesson-progress-store.test.ts`：移除 sideLearned 測試（或改為「無 sideLearned」迴歸）。
- `tests/unit/learning-loop/mastery.test.ts`：`learned()` 移除 sideLearned 聯集分支測試。
- 新 `tests/unit/data/concept-deepening.test.ts`：§8-AC1 chess.js 驗證。
- 新 `tests/unit/stores/concept-progress-store.test.ts`（或擴充）：deepenedConcepts/markDeepened + AC2 不污染。
- `tests/unit/learning-loop/gambit-compliance.test.ts`：納入深化頁 view，保留全綠。
