<!-- STATUS -->
Epic: 差異化重構
Feature: Phase 2 收尾（全專案體檢已 ship）
Task: 7edc660 全面體檢+拍板批已 push；CI 紅燈修復（onset 新行為 E2E 斷言）本 commit。下一步＝Supabase 兩 migration 手動 apply + iPhone 複驗。
<!-- /STATUS -->

> **交接快照**：只留現況 + 待辦 + 未固化的 in-flight 決策。長期鐵則/技術參考在 CLAUDE.md 體系（見「接手必讀」），不複述；**已完成施工細節在 git**。
> **差異化北極星 = `production/gambit-differentiation-vision.md`**——提任何功能/重構/UI 前**先讀**。

---

## 現況（產品全線可用；2026-07-04）

- **核心動線**：對局 → 賽後檢討（棋憶）→ 課程 / 試煉 / 深化（判斷場），Google OAuth + 跨裝置同步，guest local-first。
- **測試**：vitest 868 綠、vue-tsc 0、axe a11y 綠、E2E CI 等效全綠（總數以實跑為準，勿照抄）。
- **7edc660（2026-07-03 全面體檢，94 檔）已 push**：12 維度審查 41 findings 修復（棋誌 settle 接線、離線佇列
  completedAt 淘汰、賽後引擎 lowerbound/spawn、首屏 -207KB、a11y/設計系統批、文件對齊 ×7）＋七項拍板
  （chess-board 拆分 606→474+5 composables、journal 搬家 modules/+ADR-0015、data-sync 解耦 syncVersion、
  axe E2E 真實化、Actions pin SHA、RLS WITH CHECK + DROP 兩表 migration）＋ Neve 頭像接入、判斷場 stale
  bounds、/play 直連彈回、深化 mate 換盤 h1 角、死常數清理+CLASSIFIER_SIGNALS 接線。細節＝git log + ADR-0015。
- **行為變更注意**：Home mount / 對局終局現在會跑 `journal.evaluate()`——**全新玩家首次進站即有 onset 開場
  條目**（首頁 peek 顯示 1 筆是設計行為，對應 E2E 斷言已改）。
- **已完成里程碑**（細節在 git）：試煉道場 #19、學習迴圈 #20、課程四階 21 課、UI Redesign Phase 0–4、
  Google OAuth、訪客 local-first+續玩、棋誌 Phase 1、棋憶 #22 全 Done、判斷場 MINIMAL、深化四磚。

---

## 待辦

### ① 立即（Eason 手動）

- **Supabase 兩個 migration 未套 live**（Dashboard SQL editor 依檔名順序跑）：
  1. `20260830041917_add_explicit_rls_with_check.sql`——9 表 RLS 補顯式 WITH CHECK（無資料風險）。
  2. `20260830053142_drop_unused_tables.sql`——**DROP `skill_scores` + `lesson_side_learned`，會永久刪除
     該兩表既有資料**（程式碼零引用、Eason 2026-07-03 拍板清；跑之前最後確認一次不留）。

### ② iPhone 實機複驗（累積三批，deploy 後用無痕分頁）

- **7-03 批**：Neve 頭像三處觀感（課程/判斷場 24px、棋憶 28px）；判斷場第 3 盤裸點擊＋真手指滑動；深化
  mate 新盤（h1 角 Qg2#）手感；redesign 三項＝#6 keySquare 高亮環+脈動、#9 概念地圖三階 coin、#11 課程
  氣泡 font-lesson。
- **6-29 批**：#2 誘餌盤互動、#10 棋盤跑版（含試煉）、#7 d4 軟引導、演示節奏、**epiphany 鉤子實際觸發＋
  棋誌顯示**、深化 A3 彈窗。
- **更早**：棋憶賽後 UX 批（`e11d3c6`：失誤動畫節奏、重開同盤 cache 命中）；B5 試煉互動（log 累積、答錯
  滑回、揭曉箭頭）；逐手 PgnViewer「棋盤外藍框 + 座標小偏」（本機渲染不到、待實機指認）。

### ③ 待 Eason 拍板（未動工）

- **重置對局記錄**（原 iPhone 反饋 item 4）：實為跨 store 破壞性刪除（Supabase + localStorage + journal/
  memory 衍生資料）。待 scope：只清 list？連 concept-progress/journal 重置？guest-only vs 含雲端？
- **走勢圖「重點步」list 無用**（2(e)）：建議改「點圖轉折→跳該手」或拿掉。
- **賽後 loading 結合 Neve「思考中」對話框**（2(a)）：小工程。
- **「控制中心」tile 標題截斷**（pre-existing）：縮短 label／允許兩行／深入改純 icon，三選一。

### ④ 深化頁後續磚

- **階段二＝接棋憶 signpost（北極星歸宿）**：RecognitionGate 換觸發源（真實對局偵測到錯過的概念機會）。
  受 classifier 只可靠偵測 mate+material 限制（8 概念覆蓋 2）；訊號清單已接線成真開關
  （`CLASSIFIER_SIGNALS`），擴 fork/pin 屬 Phase C+（pv 不可靠是已知難題）。開放問題：誘餌造題工時、
  unaided/epiphany 門檻鬆緊。
- **擴池 or HOLD**：依實機手感決定其他概念要不要加 variant／判斷場；懷疑論者長期提醒＝真正歸宿在
  signpost，養肥後再評估深化頁獨立存在的必要。
- **mate 沉默關三個未來項**（2026-07-03 對抗審查附帶）：① 文案「王罩住逃生格—后貼上去」有洩題傾向（舊有）
  ② 長期可比照 fork 升級 Recognition Gate ③ 新盤 Qg3 是緊鄰正解的**逼和陷阱**——fail feedback 特判
  「這是逼和」是好教學點。

### ⑤ 未來獨立任務

- **🎨 Neve 頭像 presence 加大（redesign 待辦，Eason 2026-07-03 提出）**：三處頭像（24–28px）實感偏小、
  想更有存在感。照鐵則走 `/redesign` 對真實畫面出報告 → 拍板 → 施工；候選：加大尺寸／頂列排版重整／
  出場動效。一併考慮：深青底（棋憶）上頭像偏暗、辨識度比 cream 底低——可能要細邊框或提亮。素材：徽章縮圖
  `public/avatars/neve-badge.png`（192px，撐到 64px@3x）；1254px 原圖在 `design/gambit-design-system/avatars/`
  （勿放回 public/——5.3MB 零引用死重量會進每次 deploy），重產：
  `ffmpeg -y -i design/gambit-design-system/avatars/neve-main.png -vf "scale=<N>:<N>:flags=lanczos" public/avatars/neve-badge.png`。
- **Phase C+/D**：捉雙/牽制賽後偵測（需精準度實測）；Claude API 動態講解/BYOK（最後）。
- **PWA / Add-to-Home-Screen ⏸ 未實作**：零 SW、零 manifest、`vite-plugin-pwa` 沒裝。要做時：① 裝套件+
  manifest+圖示（pwa-192 已有）② **必用 `registerType: 'autoUpdate'`**（否則 SW 鎖死舊版）③ 先寫 Required
  ADR 第 6「PWA caching strategy」。觸發＝離線/裝成 App 需求出現。非 Phase 2 關鍵路徑。
- **epics/index 兩張彙總表過時**（沒納入 journal/memory/dungeon/learning-loop），獨立重算、刻意未動。
- **🎨 第二主題（noir / "Dusk"）⏸ 低優先**：設計定案、spec 已固化 SoT（`colors_and_type.css`
  `[data-theme="noir"]` 區塊）；demo＝`design/demos/{theme-tokens-mockup,ink-noir-explore}.html`。production
  0 實作、刻意延後。屆時排序：token 層 → toggle（ProfileView+同步）→ 深區 hex 逐頁 tokenize → CI WCAG gate。

---

## 接手必讀（鐵則不在這個檔）

長期規則與技術參考都在 **CLAUDE.md 與它 `@`-include 的 docs**，每次 session 自動載入：

- **CLAUDE.md**：技術棧、CI Node 26 鎖、push guardrail、部署 base path、E2E 盲區、棋理護欄、內容授權、
  視覺設計 SoT（全 app 棋盤＝Wood12+Gioco）、教練人格 Neve、西洋棋用語。
- **`.claude/docs/technical-preferences.md`**：測試規範（@spike、Node26 shim、vitest 快取衝突假紅、
  chessground 合成事件測不到、node 直驅 Stockfish 驗盤法）、Board/chessground gotchas（viewOnly 兩層修法、
  stale bounds、PgnViewer CSS 汙染）、Deferred Cleanups（含 game-export、開局知識卡＝待接 UI 勿刪）。
- **`.claude/docs/coding-standards.md`**：commit 格式、截圖自清。
- 設計 SoT＝`design/gambit-design-system/`；GDD＝`design/gdd/`；Supabase migration＝`supabase/README.md`；
  lib/ vs modules/ 判準＝**ADR-0015**。
- **Supabase MCP**：stdio、user scope、**read-only**、`--project-ref=vfnzekqtvxhewifnmtnz`、token 走
  `$env:SUPABASE_ACCESS_TOKEN`；需重開 Claude Code 才 Connected。可查表除錯、不能跑 migration。
- **Gambit-noir 平行 worktree** 共用同 origin：加 Supabase migration 時注意編號接續 repo 現有最大值
  （目前已到 202608305xxxxx，非真日期；撞號前例見 memory）。

---

## 北極星 + 重構路線圖

> 一句話：解新手**情緒問題**、對標 Calm 非 chess.com、Neve 安靜陪伴、課程長在你自己棋上 + 棋誌、核心零 AI、氛圍 vs juice。完整見 vision 文件。

**三階（鐵律：一次蓋一塊磚，每塊能單獨上線、單獨證明靈魂）：**

- **Phase 1 — 棋誌**（心臟）：✅ 已上線（settle 管線 2026-07-03 起全面接線：onset/arrival/solace/epiphany 都活了）。
- **Phase 2 — 課程長在你自己的棋上**：✅ 棋憶全線 ship；✅ 深化頁重設計（判斷場 MINIMAL + 四磚）ship。
  🚧 剩 iPhone 複驗定案 + 階段二 signpost 評估（見待辦 ②④）。
- **Phase 3 — 沉浸感 + 旅程 IA**：等心臟+引擎好了再包。
- **商業模式**（訂閱/付費深度/BYOK）＝最後。

**關鍵架構事實**（細節在 ADR/git）：ADR-0013（journal）+ ADR-0014（memory）+ ADR-0015（lib/modules 判準）
皆 Accepted；Supabase 現 9 張 live 表（兩張 pending drop，見待辦 ①）。
