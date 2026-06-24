<!-- STATUS -->
Epic: 差異化重構
Feature: 概念深化頁 A 類 UX 重設計（Phase 2 收尾；棋憶 #22 全線已 ship）
Task: 第四磚 MINIMAL ✅ 完成。下一步＝iPhone 實機驗 unaided→epiphany + A3 彈窗手感。
<!-- /STATUS -->

> **交接快照**：只留現況 + 待辦 + 未固化的 in-flight 決策。長期鐵則/技術參考在 CLAUDE.md 體系（見「接手必讀」），不複述；**已完成施工細節在 git**。
> **差異化北極星 = `production/gambit-differentiation-vision.md`**——提任何功能/重構/UI 前**先讀**。

---

## 明天接手（2026-06-23 收尾）

**今日完成並 push**：① Stockfish 唯一解閘門 spike + CLAUDE.md 棋理護欄升級（`9efc7f4`）、第四磚 spec 增訂（`1184e00`）。② 閘門首跑審計 shipped 深化內容→抓到 6 處假戰術/瑕疵；其中 **4 個明確 bug 已 clean-room 重做、chess.js + Stockfish 閘門雙驗、commit+push**：
- **fork#2** `2q3k1/8/8/3N4/8/8/P7/4K3` `d5e7`（修原 K+N vs K 假贏；gap 10975cp）
- **pin#2** `3k4/8/8/3n4/2P5/8/8/3RK3` `c4d5`（修原白方反落後；吃絕對被釘的騎士）
- **mate#2** `7k/8/5K2/8/8/8/8/6Q1` `g1g7`（修原 3 個 mate-in-1 非唯一；Qg7# 唯一、Kf6 支援）
- **discovered#1** `q3k3/8/4N3/8/8/8/8/4R1K1` `e6c7`（改騎士雙將避開原「Bxa8 直接吃后」支配；gap 98200cp）

**剩（明天/後續）**：
1. ~~**defense#1/2 + 閘門 weak-rule**~~ ✅ **2026-06-24 完成（待 commit）**：閘門把 `defense` 納入 `center` weak-rule（Kind `'center'`→`'weak'`、`WEAK_RULE` set）；defense#1 改 `3r2k1/8/8/8/3N4/8/8/2BK4`（騎士被釘在王前→「加防守者」前提為真，Be3）、defense#2 改 `1k5b/8/8/4R3/8/8/8/4K3`（城堡真沒人守+底排串擊逃法 Re8+ 贏主教→修舊局「王守城堡假前提＋Rd4 對稱反擊和棋」）。三道 gate 全清、815 綠、五維+ponytail 過。
2. **第四磚原計畫**（雜訊盤面+變體池 MINIMAL，見 spec §10–§14 + 下方第四磚段）：`steps[]`→`variants[][]` 變體池 + `deepenedCount` 持久化 + fork 1 個雜訊盤沉默關 variant（過三道 gate）+ iPhone 實機驗 unaided→epiphany。

**踩過的坑（別重蹈）**：用 workflow 讓 agent **自己設計+自驗棋局失敗**——agent 不擅長自驗、會在 repo 根目錄狂寫 scratch（`.tmp-chess/`、`scratch_*.mjs`）把 vitest 全炸（vite config 解析壞）；已全清、根依賴未損。**改用「主模型自己設計 → chess.js + 真實 Stockfish 閘門驗」**才可靠。待 Eason 同意的全域 memory：spawn subagent/workflow 時須在 prompt 明令「只寫 scratchpad、禁寫 repo root」（它們不繼承 scratchpad 規則）。

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

**首磚（已 commit `30dccf1`）**：① **撤鷹架** 3 關漸層——step0 她指給你看、step1 她只問你一句、step2 沉默「我不說了」（highlights 清空；hint/arrows 仍是 opt-in 逃生梯）② Neve 收手文案（8 概念全重寫，fen/expectedMove/arrows/hint 逐字未動，過 2 輪對抗式棋理審查）③ **A1** 木盤↔氣泡間距拉開 ④ **A3** 收尾改原頁彈窗（精髓 `essence` + 全程未求助才出第一人稱認可）⑤ **全站拿掉逐字打字機**。共用渲染器 `LessonPlayer` 加 `completionMode='overlay'`＋`complete(unaided)`；資料移除第 4 個 recap step（剩 3 互動）+ 加 `essence` 欄。vitest 805、典型畫面已截圖驗（A1/打字機/1-3 步/沉默關）。

**第二磚（已 commit `df5402d`）＝棋誌鉤子**：沉默關**全程零求助**（LessonPlayer `unaided`）解出 → 自動寫一筆新 pen `epiphany`（「你自己看出來的」）到棋誌。走既有 settle 推導架構（非任意 append）：concept-progress 加 `deepenedUnaided` set（localStorage-only，journal entry 才是跨裝置 SoT）→ snapshot `unaidedDeepenings`/`recordedEpiphanyRefIds` → `deriveCandidates` 推 epiphany（PRIORITY 4，onset 與 arrival 之間）→ 6 句 Neve 收手文案模板（過 persona-lint 嚴格規則：無 blame/digit）。volume 由 concept 的 teaches[0] 課程 category 推得（重用 `CATEGORY_VOLUME`）。entry 不可點、自動歸卷。標準路徑已固化進 `.claude/docs/technical-preferences.md`。vitest 815 綠、vue-tsc 0（既有 pgn-viewer/resume-game/vite.config 紅非本次）。**未實機驗**（chessground 合成事件測不到，併入下方 iPhone 複看）。

**第三磚（已 commit `66025cb`/`df73ebe`）＝Neve 語氣文案潤飾**：去 AI 味（砍破折號自我修辭、三段式排比、空泛隱喻、膚淺感嘆如「你聞到了什麼」）、戒掉反覆借用 Neve「眼睛」招牌意象、收緊。8 檔純文字、零棋理變動。跑 3-lens 對抗式人格審查（register / 自然度 / 懷疑論者）：16/21 改善或等價，3 處退步已回退。2 處 split（arrival.6 拿掉「我不說漂亮」、control-center 拿掉「別急著走」）多數判改善故保留，skeptic 異議＝丟了人格招牌/引導停頓，留待 iPhone 複看時 Eason 定奪。固化「文案語氣護欄」進 CLAUDE.md。

**第四磚＝雜訊盤面+變體池，判決 MINIMAL（Eason 2026-06-23 拍板）**：設計 workflow（7 agent，含「signpost 才是歸宿」反方→主張 HOLD-PIVOT，synthesis 升級為 MINIMAL）。spec 已增訂 `concept-deepening-page.md` §0/§2.2 改寫 + §10–§14（變體池形狀 `steps[]`→`variants[][]`、雜訊盤四鐵則、三道 gate＝chess.js→**Stockfish MultiPV 唯一解**（已建 `9efc7f4`：`tests/e2e/concept-deepening-uniqueness-spike`）→對抗審查、MINIMAL gate + 退場條款）。**為何 MINIMAL 不全做**：① Stockfish 唯一解閘門尚未存在、現有 data test 只驗合法不驗唯一解（6-21 假戰術陷阱，雜訊盤放大 N 倍）② epiphany 鏈未真機驗 ③ 深化頁 vs signpost 歸宿未定（vision §5 還列付費深度）。**MINIMAL 範圍**＝fork 1 個雜訊盤沉默關 + 先建 Stockfish 閘門腳本，驗核心假設；成立→未來擴/併，不成立→停/pivot（只賠 1 概念）。**第三層時間軸遞回明確延後**（歸宿在 signpost，非深化頁獨立 scheduler）。

**第四磚 ✅ 完成**：`steps[]`→`variants[][]` 變體池 + `deepenedCount` localStorage 持久化 + fork 雜訊盤 variant 1（三道 gate 全清）+ ConceptDeepenView `variantIndex` computed。vitest 818 綠、vue-tsc 0 新增錯誤、五維+ponytail review 過。

**剩（後續磚）**：① iPhone 實機點深化頁手感（A3 彈窗、**epiphany 鉤子實際觸發 + 棋誌顯示**）② 根據實機感受決定擴池（其他概念加 variant）或 HOLD ③ 懷疑論者長期提醒：真正歸宿在棋憶 signpost，等 signpost 養肥再評估深化頁獨立存在的必要。

### 待 Eason iPhone 實機複看

- **棋憶賽後 UX 批（`e11d3c6`）**：失誤動畫節奏、loading 觀感、重開同盤是否真瞬間（cache 命中）。
- **B5 試煉互動**：log 累積對錯、inline 達成、答錯滑回、換步不 remount、揭曉箭頭走子後消失（chessground 合成事件 Playwright 測不到，需實機，背景見 technical-preferences）。

### 未來獨立任務

- **Phase C+/D**：捉雙/牽制賽後偵測（需精準度實測）；Claude API 動態講解/BYOK（最後）。
- **epics/index Summary/Story Count 兩張彙總表過時**（沒納入 journal/memory/dungeon/learning-loop），獨立重算、刻意未動。
- **🎨 第二主題（noir / "Dusk"）** ⏸ 低優先、未施工。設計定案、spec 已固化進 SoT（`colors_and_type.css` 的 `[data-theme="noir"]` 區塊 + 兩條護欄：金只給 reward/eval/focus、沉浸區靠 elevation/glass 分層）；demo＝`design/demos/{theme-tokens-mockup,ink-noir-explore}.html`。production 0 實作。**刻意延後**（不在 Phase 2 關鍵路徑、無需求方、上線即雙主題維護稅）。屆時排序：① `[data-theme="noir"]` token 層（`src/assets/main.css` @theme + shadcn HSL 雙寫、~70% 重用 on-deep）② toggle（ProfileView + localStorage/Supabase 同步、尊重 `prefers-color-scheme`）③ 深區 ~30 處寫死漸層 hex 隨頁面逐步 tokenize（別全域 sweep）④ CI WCAG 對比 gate。觸發＝Phase 2 告一段落/有需求/當賣點。
