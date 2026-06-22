<!-- STATUS -->
Epic: 差異化重構
Feature: 概念深化頁 A 類 UX 重設計（Phase 2 收尾；棋憶 #22 全線已 ship）
Task: **概念深化頁 A 類「Neve 收手」首磚施工完成（未 commit）**。多 agent brainstorm + council 拍板＝深化頁從「換皮課程」改成「Neve 一段一段放手的辨識訓練」。首磚＝撤鷹架（3 關：她指→她問→沉默）+ Neve 收手文案 + A1 間距 + A3 收尾彈窗（精髓 essence + 全程未求助時第一人稱認可）+ 全站拿掉逐字打字機。細節見下方「概念深化頁」段。
<!-- /STATUS -->

> **交接快照**：只留現況 + 待辦 + 未固化的 in-flight 決策。長期鐵則/技術參考在 CLAUDE.md 體系（見「接手必讀」），不複述；**已完成施工細節在 git**。
> **差異化北極星 = `production/gambit-differentiation-vision.md`**——提任何功能/重構/UI 前**先讀**。

---

## 接手必讀（鐵則不在這個檔）

長期規則與技術參考都在 **CLAUDE.md 與它 `@`-include 的 docs**，每次 session 自動載入：

- **CLAUDE.md**：技術棧、CI Node 26 鎖、push guardrail、部署 base path、E2E 盲區、棋理護欄、內容授權、視覺設計 SoT（全 app 棋盤＝Wood12+Gioco）、教練人格 Neve、西洋棋用語。
- **`.claude/docs/technical-preferences.md`**：測試規範（@spike、Node26 vitest shim、chessground 合成事件測不到）、Board/chessground 幾何·易位·標註踩坑、Deferred Cleanups。
- **`.claude/docs/coding-standards.md`**：commit 格式、截圖自清。
- 設計 SoT＝`design/gambit-design-system/`；GDD＝`design/gdd/`；Supabase migration＝`supabase/README.md`。
- **Supabase MCP**：stdio、user scope、**read-only**、`--project-ref=vfnzekqtvxhewifnmtnz`、token 走 `$env:SUPABASE_ACCESS_TOKEN`；需重開 Claude Code 才 Connected。可查表除錯、不能跑 migration。
- **Gambit-noir 平行 worktree** 共用同 origin：加 Supabase migration 時注意 timestamp 別撞（前例 memory 828 / noir 827）。

---

## 北極星 + 重構路線圖

> 一句話：解新手**情緒問題**、對標 Calm 非 chess.com、Neve 安靜陪伴、課程長在你自己棋上 + 棋誌、核心零 AI、氛圍 vs juice。完整見 vision 文件。

**三階（鐵律：一次蓋一塊磚，每塊能單獨上線、單獨證明靈魂）：**

- **Phase 1 — 棋誌**（心臟）：✅ 已上線。
- **Phase 2 — 課程長在你自己的棋上（①＝棋憶 #22）**：✅ 棋憶全線 ship（logic+persistence+UI 006–011 + 三入口統一 + 賽後 UX bug 批）。🚧 剩**概念深化頁 A 類 UX 重設計**（in flight，見待辦）。
- **Phase 3 — 沉浸感 + 旅程 IA**：等心臟+引擎好了再包。
- **商業模式**（訂閱/付費深度/BYOK）＝最後。

**關鍵架構事實**（細節在 ADR/git）：**ADR-0013**（journal）＋ **ADR-0014**（memory `memory_summaries`）皆 Accepted、migration 已套 live + RLS PASS；Supabase 現 **8 張 live 表**。

---

## 現況（產品已全線可用）

- **核心動線**：對局 → 賽後檢討（棋憶）→ 課程 / 試煉，Google OAuth + 跨裝置同步。
- **測試**：vue-tsc 0、vitest 綠（總數以實跑為準，勿照抄）。
- **已完成里程碑**（細節在 git）：試煉道場 #19、學習迴圈 #20、課程四階 21 課、UI Redesign Phase 0–4、Google OAuth、訪客 local-first+續玩、棋誌 Phase 1、棋憶 #22 全 Done。

---

## 🚧 待辦 / 開放項

### 🚧 概念深化頁 A 類「Neve 收手」重設計

**設計拍板（Eason 2026-06-22，經多 agent brainstorm + council）**：深化 ≠ 更難的三題，而是 **Neve 一段一段放手**——課程＝先講後做、深化＝先認後證。一個概念兩段（「她教你看 → 換你自己看」，避免「初階/進階/Lv」這種打卡心智）。spec＝`design/quick-specs/concept-deepening-page.md`（待補增訂）。

**首磚（施工完成、未 commit）**：① **撤鷹架** 3 關漸層——step0 她指給你看、step1 她只問你一句、step2 沉默「我不說了」（highlights 清空；hint/arrows 仍是 opt-in 逃生梯）② Neve 收手文案（8 概念全重寫，fen/expectedMove/arrows/hint 逐字未動，過 2 輪對抗式棋理審查）③ **A1** 木盤↔氣泡間距拉開 ④ **A3** 收尾改原頁彈窗（精髓 `essence` + 全程未求助才出第一人稱認可）⑤ **全站拿掉逐字打字機**。共用渲染器 `LessonPlayer` 加 `completionMode='overlay'`＋`complete(unaided)`；資料移除第 4 個 recap step（剩 3 互動）+ 加 `essence` 欄。vitest 805、典型畫面已截圖驗（A1/打字機/1-3 步/沉默關）。

**剩（後續磚，非首磚範圍）**：① 棋誌鉤子（沉默關無輔助解出→寫一筆「你自己看出來的」）② 雜訊盤面 + 變體池 + 隔時間交錯遞回（內容量大、需 Stockfish 驗唯一解）③ iPhone 實機點深化頁手感（含 A3 彈窗、合成事件本機測不到）④ 懷疑論者長期提醒：內化真正歸宿在棋憶 signpost，等 signpost 養肥再回頭問深化頁是否該獨立存在。

### 待 Eason iPhone 實機複看

- **棋憶賽後 UX 批（`e11d3c6`）**：失誤動畫節奏、loading 觀感、重開同盤是否真瞬間（cache 命中）。
- **B5 試煉互動**：log 累積對錯、inline 達成、答錯滑回、換步不 remount、揭曉箭頭走子後消失（chessground 合成事件 Playwright 測不到，需實機，背景見 technical-preferences）。

### 未來獨立任務

- **Phase C+/D**：捉雙/牽制賽後偵測（需精準度實測）；Claude API 動態講解/BYOK（最後）。
- **epics/index Summary/Story Count 兩張彙總表過時**（沒納入 journal/memory/dungeon/learning-loop），獨立重算、刻意未動。
- **🎨 第二主題（noir / "Dusk"）** ⏸ 低優先、未施工。設計定案、spec 已固化進 SoT（`colors_and_type.css` 的 `[data-theme="noir"]` 區塊 + 兩條護欄：金只給 reward/eval/focus、沉浸區靠 elevation/glass 分層）；demo＝`design/demos/{theme-tokens-mockup,ink-noir-explore}.html`。production 0 實作。**刻意延後**（不在 Phase 2 關鍵路徑、無需求方、上線即雙主題維護稅）。屆時排序：① `[data-theme="noir"]` token 層（`src/assets/main.css` @theme + shadcn HSL 雙寫、~70% 重用 on-deep）② toggle（ProfileView + localStorage/Supabase 同步、尊重 `prefers-color-scheme`）③ 深區 ~30 處寫死漸層 hex 隨頁面逐步 tokenize（別全域 sweep）④ CI WCAG 對比 gate。觸發＝Phase 2 告一段落/有需求/當賣點。
