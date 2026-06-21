<!-- STATUS -->
Epic: 差異化重構
Feature: Phase 2 — 概念側門廢除 + 概念深化頁（concept deepening）
Task: **概念深化頁施工完成（尚未 commit，全在 working tree）**。設計拍板（Eason 2026-06-21：先設計再整包、全 8 概念）→ spec＝`design/quick-specs/concept-deepening-page.md`（supersede `concept-tab-tactic-entry.md`；learning-loop GDD §3.5 已加重構註記）。**做了什麼**：①抽出共享渲染器 `src/components/lesson/LessonPlayer.vue`（棋盤幾何+步進+教練氣泡+收尾引擎），`LessonView` 與新 `ConceptDeepenView` 都變薄殼包它（收尾卡/動作列用 slot）→ `fromConcept` 分支整個消失。②新資料 `src/data/concept-deepening/index.ts`＝8 概念各 3 漸進局面+回望（複用 `LessonStep`，clean-room，**全 chess.js 驗證**：FEN 合法/白方走/expectedMove 合法/mate 概念 `isCheckmate()` 真）。③新 route `/learn/concept/:conceptId`（fullBleed）。④`concept-progress` store 加 `deepenedConcepts`+`markDeepened`+雲同步；`data-sync` 加 `concept_deepened` 讀寫；App.vue 接 reconcileOnLogin。⑤概念地圖卡片改點→深化頁（`深入 ›`/`重溫 ›` 文字態，保留 已學/已練 兩點，已學改只讀 `isCompleted`）。⑥**side-door 全拆**：`?from=concept`、`fromConcept`、`sideLearned`/`markSideLearned`/`isLearned`、data-sync `loadSideLearned`/`upsertSideLearned`（`lesson_side_learned` 表保留不刪、僅停用）。**驗證**：`npm run build` 綠、vue-tsc 0、**vitest 815 passed/81 files**（新增 concept-deepening 10 + concept-progress deepened 4；改寫 concept-map/lesson-progress/data-sync 測試；route-table、gambit-compliance 含新檔全綠）、**chromium e2e 17/17**（webkit 本機跑不起來＝環境問題，連 toolchain canary 都掛，與本次無關）。**視覺驗證 PASSED**（dev+chromium 截圖：概念地圖＝深入 affordance+兩點+無未達成；fork 深化 step1＝Wood12 木盤無 lichess 漏、token 全解析無黑、Neve 氣泡+步數）。**多 agent 對抗審查 PASSED**（6 agents：抓出並修 2 處棋理不成立——fork 深化被 `Qe8` 反殺、defense 深化被 `Kxd8` 吃城堡，已改 Ne7+ 叉王城堡／Rd8+ 底線將軍並 chess.js 重驗無反駁；另修 discovered 雙將措辭、superseded banner、App.vue routeKey 補 concept-deepen）。**`concept_deepened` migration 已套 live + RLS gate PASSED 2026-06-21**（Eason 手動套；anon REST probe GET 200 `[]`／POST 401 `42501`，比照 011/ADR-0014）。**剩 push（commit message 待 Eason 確認）+ iPhone 實機手感**。**棋憶 #22 已上線**（`a3caa1d`+`af168dd`+`9b36999`）。**驗證**：app typecheck 0、`npm run build` 綠、`vitest run` **804 passed/80 files**、路由 e2e（spa-deep-link/journal）chromium 8/8。**011 gate PASSED 2026-06-20**：Eason 手動套 migration、anon REST probe GET 200 `[]`／POST 401 `42501` → **ADR-0014 Accepted**、README(8 表)/EPIC/index 已更新、evidence `memory-migration-gate.md` 記錄。**OQ-R1 Accepted（Eason 2026-06-20）**：敗局 anchor 中性「轉折點」◆＋金 accent 條、不戴星。**視覺驗證 PASSED 2026-06-20**（dev server + Playwright seed 一盤含 turning-point+plain 重點時刻的完局，截 dashboard/replay/slideshow 三畫面：DOM 序對、Neve 深青卡、走勢圖、◆ 金邊、**Replay Wood12 木盤無 lichess 深盤漏**、slideshow 比較欄+中性 Neve）。**抓到並修兩個單元測試漏掉的 bug**：①**設計 token 不解析**——SVG/inline 用 `var(--danger)`/`var(--surface-card)` 等原始名，但 app 是 Tailwind v4 `--color-*` → 全 fallback 黑；已把 4 元件（EvalShapeChart/ReplayEvalChart/MomentList/MomentCard）改 `--color-*`（`--accent-text`→`--color-gold-dark`）。②**回顧態把失誤講成讚美**——turning-point（anchor 收斂成 kind='bright'）跑了 bright 模板「你穩住了…拿回主導權」；已在 MemorySlideshow 用 `templateKind` 讓 turning-point 改用中性 plain 模板。修後 typecheck 0、vitest 804 綠。（驗證用的 dev seam 已還原、截圖已清。）**架構決定**：`/review` 維持單一 route → 新 `MemoryView.vue`（owns 單一 usePostGameReview ⇒ analysis 跑一次/AC-14；內部 mode='dashboard|slideshow|replay' + History API 淺堆疊，瀏覽器返回 pop 到 dashboard/GDD Rule 2；provide `MEMORY_CONTEXT` 給三子視圖）。舊 `ReviewView.vue` 已刪→`MemoryReplay.vue`（009）；signpost 測試已遷 `memory-replay-signpost.test.ts`。**新檔**：`src/views/MemoryView.vue` + `src/components/memory/{memory-context.ts,MemoryDashboard,NeveCard,EvalShapeChart,MomentList,EmptyMemory,MemoryReplay,ReplayEvalChart,MemorySlideshow,MomentCard,DotBand}.vue` + `src/modules/memory/{describe,choreography}.ts` + config（零態文案/動畫 timing）+ 測試（describe/choreography/moment-card/eval-charts/replay-signpost/deeplink）+ evidence docs（slideshow/replay/migration-gate）。journal GDD 已加棋憶回指（Rule 23）。**剩餘**：①**只剩 iPhone 實機手感**（畫面長相已代驗）——008 動畫節奏（OQ-2 650/380/700/520ms）、觸控左右滑換時刻、減少動態下跳結局態的手感（evidence docs 已列 checklist）。②**010 `?gameId` 載任意局 + 棋誌 entry tap→棋憶**＝待 #21 per-game ② pen（Phase 2）出現 caller 再接（YAGNI；`?ply` target 已就緒）。③注意 **Gambit-noir 平行 worktree** 共用同 origin，migration timestamp 已避（memory 828 vs noir 827）。
<!-- /STATUS -->

> **交接快照**：只留現況 + 待辦 + 還沒固化的 in-flight 決策。**長期鐵則/技術參考一律在 CLAUDE.md 體系**（見下方「接手必讀」），這裡不複述；已完成施工細節在 git。
> **差異化北極星 = `production/gambit-differentiation-vision.md`**——提任何功能/重構/UI 前**先讀**。

---

## 接手必讀（鐵則不在這個檔）

長期規則與技術參考都在 **CLAUDE.md 與它 `@`-include 的 docs**，每次 session 自動載入 context：

- **CLAUDE.md**：技術棧、CI Node 26 鎖、push guardrail、部署 base path、E2E 盲區、棋理護欄、內容授權、視覺設計 SoT（含全 app 棋盤主題＝Wood12+Gioco）、教練人格 Neve、西洋棋用語。
- **`.claude/docs/technical-preferences.md`**：測試規範（@spike、npm11、Node26 vitest shim、chessground 合成事件測不到）、**Board/chessground 幾何·易位·標註踩坑**、**Deferred Cleanups**（升變 fallback / `recommended()`）。
- **`.claude/docs/coding-standards.md`**：commit 格式、截圖自清。
- 設計 SoT＝`design/gambit-design-system/`；棋誌設計＝`design/gdd/...` + journal review-log；Supabase migration＝`supabase/README.md`。

---

## 北極星 + 重構路線圖

> 完整版見 vision 文件。一句話：解新手**情緒問題**、對標 Calm 非 chess.com、Neve 安靜陪伴、
> **課程長在你自己棋上 ＋ 棋誌**、核心零 AI、氛圍 vs juice。

**三階（鐵律：一次蓋一塊磚，每塊能單獨上線、單獨證明靈魂）：**

- **Phase 1 — 棋誌**（心臟）：✅ **已完成上線**（001~007 ＋ 004 全覽UI ＋ 005 peek/未讀）。
- **Phase 2 — 課程長在你自己的棋上（①＝棋憶 #22）**：最大護城河。賽後檢討棋盤＝入口（真棋盤已做）。**logic+persistence 已上線（a3caa1d），剩 UI 006–011（見 STATUS / 待辦）。**
- **Phase 3 — 沉浸感 ＋ 旅程 IA**：等心臟＋引擎好了再包。
- **商業模式**（訂閱／付費深度／BYOK）＝最後，有體驗＋用戶再說。

**Phase 1 收尾事實（細節在 git / journal.md，這裡只留接手要點）：**

- **ADR-0013**（journal 資料模型，**Accepted**）：`journal_entries` 表、事件級冪等 `UNIQUE(user_id, source_ref_id)`、惰性 settle（不需 app-close）、session 僅用於 cooldown/carryover。migration 已套 live DB ＋ RLS PASS。
- **7 stories** 在 `production/epics/journal/`；v1 範圍＝onset/arrival/solace（cap=3，`SESSION_ENTRY_CAP=3`），①②③⑥ 全 Phase 2。
- **Supabase MCP**：stdio 版（`claude mcp add supabase`，user scope、**read-only**、`--project-ref=vfnzekqtvxhewifnmtnz`，token 走 `$env:SUPABASE_ACCESS_TOKEN`）；**需重開 Claude Code 才 Connected**。read-only＝可查表除錯、不能跑 migration。

---

## 現況（產品已全線可用）

- **核心動線**：對局 → 賽後檢討 → 課程 / 試煉，Google OAuth + 跨裝置同步。
- **測試**：vue-tsc 0、vitest 綠（棋憶 +55；全套總數以實跑為準，勿照抄舊數字）。Supabase **live 7 張表**；**`memory_summaries`（第 8 張）migration 待套**（story-011 上 live + flip ADR-0014）。
- **已完成里程碑**（細節在 git）：試煉道場 #19、學習迴圈 #20、課程四階 21 課、UI Redesign Phase 0–4、Google OAuth 遷移、訪客 local-first + 續玩、棋誌 Phase 1、賽後檢討真棋盤 + 全站棋盤主題統一、**棋憶 #22 logic+persistence（UI 待做）**。

---

## 🚧 待辦 / 開放項

### Phase 2（深化方向）

- **棋憶（#22）— logic+persistence 已上線（`a3caa1d`），剩 UI 006–011。** 完整細節在 STATUS 區塊 + `production/epics/memory/`（EPIC + story-001…011）+ GDD `design/gdd/memory.md` + ADR-0014。設計 SoT＝approved demo `design/demos/highlight-replay-demo.html`（v9，七輪定版，dashboard 順序：Neve 深青卡 → 整局走勢圖(→逐手覆盤) → 重點時刻清單）；Neve 回顧態語氣＋視覺嗓音＋白話走法已固化在 `persona-neve.md`；重點時刻生成邏輯/階段判定/跨局質化觀察＝全寫進 GDD Formulas 且已實作。**全站累積數字（Neve 記得 N 盤／棋誌 N 則／同行 N 天）的家＝棋誌頁 `JournalView`，非棋憶 dashboard**——未來獨立增強（GDD Downstream 已記），不在本次範圍。
- **概念側門廢除 + 概念深化頁 — ✅ 施工完成（見 STATUS，working tree 未 commit）**。spec＝`quick-specs/concept-deepening-page.md`。**保留**賽後檢討 signpost（`?from=lesson`）、Bridge 1/2/3。**待**：①`concept_deepened` migration 手動套+gate；②iPhone 實機點深化頁手感 + 確認完成卡（見下節）。

### 待 Eason iPhone 實機複看（皆已修/已 push）

- PWA 冷啟動登入閃爍、header logo 光學對齊、首頁招呼語 Neve 化、過場效能。2026-06-14 實機過一輪大致 PASS。
- **概念深化頁手感**（chromium 截圖已代驗畫面/木盤/token）：點概念卡→深化頁、走 3 局面手感、收尾「平靜回望」完成卡（合成事件本機測不到，同 B5 盲區）。
- **B5 試煉互動**（log 累積對錯、inline 達成、答錯滑回、換步不 remount、揭曉箭頭走子後消失）：chessground 合成事件難在 Playwright 自動觸發，需實機點一輪確認（背景見 technical-preferences）。

### 未來獨立任務

- **對局頁「專注模式」自動收 navbar**：用**狀態驅動**（對局中收底部 nav、結束/底緣上滑叫回），非捲動驅動。注意平靜鐵則 + iOS 底緣手勢衝突。
- **Phase C+/D**：捉雙/牽制賽後偵測（需精準度實測）；Claude API 動態講解＝開放式對話/BYOK（最後）。
- **文件**：`epics/index.md` 試煉/學習迴圈狀態待補（純文件）。
- **PgnViewer 棋譜列面板**深色 chrome 可選染 cream（獨立小任務，非棋盤/棋子，回放/複盤共用）。
- **🎨 第二主題（noir）+ 主題切換器（≈ dark mode）** ⏸ 低優先、未施工。
  - **目前進度**：設計定案、**spec 已固化**進 SoT（`design/gambit-design-system/colors_and_type.css` 的 `[data-theme="noir"]` 區塊 + 兩條護欄 + 文件註解）；對照 demo＝`design/demos/theme-tokens-mockup.html`（token 表 + 6 頁面切換）。**production 0 實作。**
  - **待辦（屆時照序）**：① production token 層——`src/assets/main.css` 的 `@theme` + shadcn HSL `:root` **雙寫** noir override（~70% 重用既有 on-deep 詞彙）。② **主題切換 UI**——ProfileView 設定加 toggle（奶油 jade / 暖 noir），存 **localStorage + Supabase 跨裝置同步**，套 `data-theme` 到 `<html>`；尊重 `prefers-color-scheme` 當預設。③ 深區頁面 ~30 個寫死漸層 hex 在 component 內（木盤/地城幣/英雄卡）翻不到 token，**隨頁面上線逐步 tokenize**，別先做全域 sweep。④ 建議補 **CI WCAG 對比 gate**（兩 token 集都驗），防雙主題漂移。
  - **觸發條件**：北極星 Phase 2（棋憶）告一段落、或有實際使用者需求/當上線賣點時再排。設計已釘死、零風險，可隨時乾淨接續。詳見下方『🎨 第二主題探索』段。

### 🎨 第二主題（noir / "Dusk"）探索 — 設計中、未施工

Eason 想加第二套主題（看到一張暖墨/天使圖，喜歡墨跡 + 暖黑 + 金）。已做兩個 demo（皆在 `design/demos/`，**純探索、未進 production**）：

- **`ink-noir-explore.html`（v21）**：墨跡點綴探索。定案技法——墨筆＝**變寬度純向量筆畫**（高斯峰運筆痕、無鋸齒，飛白只給分隔線）；reward 特規＝乾淨金墨頓點 + 金墨飛濺（抖動網格鋪滿、避字、~10 顆）；Neve 對話框＝**形狀分工**（日常＝實墨乾淨圓角卡、特殊時刻才用有機墨團輪廓）、頭像小霧圈單色墨字（文楷）。**reward 特規不在反-juice 範圍**已補進 `production/tooling-inspira-ui.md` 黑名單例外。
- **`theme-tokens-mockup.html`**：jade↔noir **完整 token 對照表** + 6 代表頁面 mockup（首頁/學習/試煉/課程/棋誌/我的，可切換）。

**noir token 規劃邏輯**：把設計系統既有「deep-jade 暗區配色」（on-deep ink/semantics、glass、nav、dungeon）推到全 app；jade 當品牌家族穿進 nav/學習/coach，**主按鈕 jade 不孤立**；金維持唯一高光。

**已過 /council（5 視角）審議並套入修正**：① base 改**暖暮色 `#141110`** + 暖棕陰影（守「永不純黑」鐵則、讓切換像調暗同房間，非冷中性黑）；② 主按鈕 `#226B55` + 近白字＝**過 WCAG AA ≈6:1**（原 #2A8268 只 4.41:1）；③ ink-faint 提到 `#8A8478` 過 AA。**兩條待寫進 SoT 的護欄**：金仍只給 reward/eval/focus（near-black 上金字對比變好、天然護欄消失）；沉浸區靠 elevation/glass/漸層分層（deep vs base 亮度近似、單靠色相日光下會消失）。

**nav 決議（Eason 拍板）**：cream 維持 deep-jade 錨 `#103029`；**noir nav ＝「抬起」式**——比 base **亮**一階的 jade 條 `#1A2620` + glass 頂光（暗色主題慣例 elevated，非變暗），**選中那格用 primary jade**。原則＝兩主題都 jade，但各自往讀得清方向走（亮底壓暗、暗底抬亮）。金字看底色挑值：奶油底 `#8F6200`、深底 `#F8B500`（深面板 eyebrow 用亮金）。

**狀態：設計定案 + spec 已固化（2026-06-17）。** ✅ noir token + nav A′ + 兩條護欄已正式寫進 **`design/gambit-design-system/colors_and_type.css`**（新增 `[data-theme="noir"]` 區塊 + 文件註解）＝**SoT spec 完成、未進 production**。

**⏸ 實作刻意延後**（技術經理判斷，Eason 同意先回北極星）：noir 不在差異化關鍵路徑（Phase 2 棋憶才是護城河）、無需求方、無 toggle 基建、一上就讓每個新畫面兩主題各驗一次（維護稅）。設計已釘住、零風險，哪天真要 noir（夠多人喊/當上線賣點）再照下方排序乾淨實作。**回去做 Phase 2 棋憶。**

**實作排序（屆時照做）**：先上 `[data-theme="noir"]` token 層（production `src/assets/main.css` @theme + shadcn HSL 雙寫、~70% 重用 on-deep）+ toggle（ProfileView 設定 + localStorage/Supabase 同步）；深區頁面有 ~30 個寫死漸層 hex 在 component 內（木盤/地城幣/英雄卡）翻不到 token，**隨頁面上線再逐步 tokenize**，別先做全域 sweep。建議補一個 CI 對比 gate（兩 token 集都驗 WCAG，防雙主題漂移）。棋盤木質兩主題暫共用（之後做使用者可換棋盤/棋子主題）。
