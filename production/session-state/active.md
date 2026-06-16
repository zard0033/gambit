<!-- STATUS -->
Epic: 差異化重構
Feature: Phase 2 — 課程長在你自己的棋上（賽後檢討）
Task: **Phase 1 棋誌 epic 全部上線**（CI 綠、部署站 200）。賽後檢討棋盤已從 FEN 字串換成真棋盤（PgnViewer）＋全 app 棋盤統一 Wood12+Gioco——**已 push（commit `e99d706`）**。**下一步＝Phase 2「重點回播」redesign，design-first：先做可點 demo → 拍板 → GDD → stories → 實作**（提案＋待定決策見下方待辦）。
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
- **Phase 2 — 課程長在你自己的棋上（①）**：最大護城河。賽後檢討棋盤＝入口（**真棋盤已做**），下一步＝「重點回播」redesign（見待辦）。
- **Phase 3 — 沉浸感 ＋ 旅程 IA**：等心臟＋引擎好了再包。
- **商業模式**（訂閱／付費深度／BYOK）＝最後，有體驗＋用戶再說。

**Phase 1 收尾事實（細節在 git / journal.md，這裡只留接手要點）：**

- **ADR-0013**（journal 資料模型，**Accepted**）：`journal_entries` 表、事件級冪等 `UNIQUE(user_id, source_ref_id)`、惰性 settle（不需 app-close）、session 僅用於 cooldown/carryover。migration 已套 live DB ＋ RLS PASS。
- **7 stories** 在 `production/epics/journal/`；v1 範圍＝onset/arrival/solace（cap=3，`SESSION_ENTRY_CAP=3`），①②③⑥ 全 Phase 2。
- **Supabase MCP**：stdio 版（`claude mcp add supabase`，user scope、**read-only**、`--project-ref=vfnzekqtvxhewifnmtnz`，token 走 `$env:SUPABASE_ACCESS_TOKEN`）；**需重開 Claude Code 才 Connected**。read-only＝可查表除錯、不能跑 migration。

---

## 現況（產品已全線可用）

- **核心動線**：對局 → 賽後檢討 → 課程 / 試煉，Google OAuth + 跨裝置同步。
- **測試**：vue-tsc 0、vitest **730 passed**。Supabase 6 張表到位，**無待套 migration**。
- **已完成里程碑**（細節在 git）：試煉道場 #19、學習迴圈 #20、課程四階 21 課、UI Redesign Phase 0–4、Google OAuth 遷移、訪客 local-first + 續玩、棋誌 Phase 1、賽後檢討真棋盤 + 全站棋盤主題統一。

---

## 🚧 待辦 / 開放項

### Phase 2（深化方向）

- 🆕 **賽後檢討「重點回播」redesign**（Eason 構想＝Phase 2 ① 的 UX）：不逐手翻，只 **highlight 3-5 個關鍵時刻**（重用既有 cpLoss/最大轉折/`classify()`＝篩選+呈現非新邏輯，且只看關鍵手＝更平靜、對上「寧少勿濫」）。每時刻顯示**戰術名 + 你的步 vs 最佳步差異**，Neve **模板 per mistake-concept** 解釋（零 AI）；v2＝任意局面自由解釋（AI/BYOK，最後）。**咬合**：每個被點出的時刻＝一筆棋誌（②/③），review＝②蘇格拉底教學。⚠️ 大改 `ReviewView` 互動模型，依鐵則先 `/design-review`→拍板→才施工。
  - **可重用料（現成在 `ReviewView.vue` / `modules/learning-loop`）**：`computeCpLoss`、`biggestSwingCursor`、`classify()`（已產 concept）、`mistakeSignposts`、`selectMistakeSignposts`。棋盤＝剛上線的 `PgnViewer`。
  - **本 session 已提案、待 Eason 拍板的決策**：① 時刻怎麼選（推薦：玩家手依 deep cpLoss 排序、取有 concept 或大 swing 的前 3-5；是否也放 1 個「漂亮的一手」②未定）② 逐手瀏覽（推薦保留為次要 toggle，不丟現有 nav）③ Neve 講解＝每 mistake-concept 一個模板「我看到你想…，這裡…更好，因為…」④ eval bar / 棋譜列在重點回播模式收掉（平靜），逐手模式才出現 ⑤ 棋誌咬合先做 UI、寫入留一張 story。
  - **下一步（接手就做）**：刻一個**可點 HTML demo**（真實一盤的關鍵時刻 + Neve 模板文案）給 Eason 看版面/節奏 → 拍板 → 寫進 `design/gdd/post-game-review.md`（或新 GDD）→ `/design-review` → 切 stories → 實作。
- **概念側門廢除 + 概念深化頁**：廢除「概念→課程側門」（`ConceptMapView` 戰術卡 `?from=concept` alias 到課程），概念改成「單一戰術主題的深化＝課程加深版」（自有 `steps`、共享 LessonView 渲染器吃不同資料）。**整包做**（只拆側門會留破洞）。牽連 `LessonView` `fromConcept` 分支、`lesson-progress` `markSideLearned`、`concept-progress` store、`data-sync` `lesson_side_learned`、概念地圖雙色點。**保留**賽後檢討 signpost（`ReviewView` `?from=lesson`→試煉）。**已做**：移除課程完成卡練習邀請 CTA。

### 待 Eason iPhone 實機複看（皆已修/已 push）

- PWA 冷啟動登入閃爍、header logo 光學對齊、首頁招呼語 Neve 化、過場效能。2026-06-14 實機過一輪大致 PASS。
- **B5 試煉互動**（log 累積對錯、inline 達成、答錯滑回、換步不 remount、揭曉箭頭走子後消失）：chessground 合成事件難在 Playwright 自動觸發，需實機點一輪確認（背景見 technical-preferences）。

### 未來獨立任務

- **對局頁「專注模式」自動收 navbar**：用**狀態驅動**（對局中收底部 nav、結束/底緣上滑叫回），非捲動驅動。注意平靜鐵則 + iOS 底緣手勢衝突。
- **Phase C+/D**：捉雙/牽制賽後偵測（需精準度實測）；Claude API 動態講解＝開放式對話/BYOK（最後）。
- **文件**：`epics/index.md` 試煉/學習迴圈狀態待補（純文件）。
- **PgnViewer 棋譜列面板**深色 chrome 可選染 cream（獨立小任務，非棋盤/棋子，回放/複盤共用）。
