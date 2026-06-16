<!-- STATUS -->
Epic: 差異化重構
Feature: Phase 1 — 棋誌（Neve 記憶的可見載體）
Task: design-review✅→ADR-0013 Accepted✅→7 stories✅→migration live✅。001~007 全實作。**004 全覽UI✅＋005 peek+未讀✅完成**（005：HomeView 棋誌 StatCard 解鎖＋peek 列表 HOMEPAGE_PEEK_COUNT=3＋淡玉未讀點，MCP 瀏覽器驗 6 項 AC 全過）。**Phase 1 棋誌 epic 全部完成**。⚠️ 整包 journal 001~007＋Node 26 升級**尚未 commit/push**，待 Eason 確認 scope。注意：006 動 App.vue userId watch，push 前跑完整 E2E（CI 含 Stockfish spec）
<!-- /STATUS -->

> **交接快照**：只留現況 + 待辦 + 鐵則。已完成施工的細節在 git 提交，不在此複述。
> **差異化北極星 = `production/gambit-differentiation-vision.md`**——提任何功能/重構/UI 前**先讀**。

---

## 北極星 + 重構路線圖（2026-06-16 定）

> 完整版見 vision 文件。一句話：解新手**情緒問題**（非技術問題）、**對標 Calm 非 chess.com**、
> Neve 安靜陪伴旅程、**課程長在你自己棋上 ＋ 棋誌**、免費關係付費買深度、核心**零 AI**、
> **氛圍 vs juice**（擋 juice 但擁抱 atmosphere，別再做成平淡）。

**三階順序（鐵律：一次只蓋一塊磚，每塊能單獨上線、單獨證明靈魂）：**

- **Phase 1 — 棋誌**（先蓋心臟）：Neve 記憶的可見載體。最獨立、最低風險，靠**現有事件**
  （完成課/階、你上一盤的最佳手）即可 v1。建立記憶資料模型 ＋ Neve 文學語氣，後面 ①②④ 全插進來用。
  **＋ 小快贏**：開場＝抵達一個有光的場景（只動一頁、純視覺，讓沉浸感先活過來）。
  做氛圍/特效前先讀 `production/tooling-inspira-ui.md`（採用 Inspira UI＝只偷氛圍元件、剝 juice、對齊鐵則，不裝整庫）。
  **棋誌視覺方向＝ demo C「深色沉浸」**（Eason 2026-06-16 拍板：deep-jade 世界＋一盞燈的光；光之後用 Inspira UI aurora 真做）。
  UI 元件/框架總表見 `production/tooling-ui-frameworks.md`。demo 暫存 `d:\tmp\gambit-journal-demo.html`。
- **Phase 2 — 課程長在你自己的棋上（①）**：最大護城河、最多新邏輯（Stockfish 跨局追弱點 ＋ 配對微課）。
  天然餵棋誌、建在賽後檢討上。下方「賽後檢討打磨」＝此階入口。
- **Phase 3 — 沉浸感 ＋ 旅程 IA**：tab → 一條路，最顯眼但牽動每頁，等心臟＋引擎好了再包。
- **商業模式**（訂閱／付費深度／BYOK 開放式對話）＝更後面，有體驗＋用戶再說。

**下一個動作（2026-06-16 更新）**：design-review→ADR→stories 全數完成。
- **design-review**：MAJOR REVISION NEEDED → 同 session 修正。**v1 範圍砍成 onset/arrival/solace**（皆可從持久狀態推導，繞開上游 #18/#7 缺口與 iOS app-close 不可靠）；①②③⑥ 全 Phase 2。新增 onset 啟程筆解 cold-start。**R4 改 `SESSION_ENTRY_CAP=3`**（Eason 拍板，原一筆放寬為三＝抵達與陪伴並存）。review-log: `design/gdd/reviews/journal-review-log.md`。
- **ADR-0013**（`docs/architecture/adr-0013-journal-data-model-and-session-boundary.md`，**Accepted 2026-06-16**）：`journal_entries` 表、事件級冪等 `UNIQUE(user_id, source_ref_id)`（非 row-UUID）、惰性 settle（不需 app-close）、session 僅用於 cooldown/carryover。migration `supabase/migrations/20260826000000_create_journal_entries.sql` **已套上 live DB ＋ RLS 驗證 PASS**。
- **7 stories**：`production/epics/journal/`（story-001 資料層 / 002 結算引擎 / 003 模板+lint / 004 全覽UI / 005 peek+未讀 / 006 訪客合併 / 007 ADR-Accepted+migration）。TR-journal-001~007 已入 registry。
- **story-007 已完成（2026-06-16）**：`journal_entries` 已套上 live DB（Dashboard SQL Editor）、anon REST 驗證 PASS（GET 200 `[]` / unauth POST 401 `42501`）、**ADR-0013 轉 Accepted**。smoke 證據 `production/qa/smoke-journal-migration-2026-06-16.md`。story-001~006 全 Ready。
- **Supabase MCP**：已裝 stdio 版（`claude mcp add supabase`，user scope、read-only、`--project-ref=vfnzekqtvxhewifnmtnz`），token 走 `$env:SUPABASE_ACCESS_TOKEN`（已加進 PowerShell profile）。**需重開 Claude Code 才會 Connected**＋工具載入。read-only＝可查表/除錯，不能跑 migration（未來要寫再拿掉 `--read-only`）。壞掉的是 plugin OAuth 版（`plugin:supabase:supabase`，unrecognized client_id），改用此 stdio 版。
- **已實作（2026-06-16，全套 730 tests 綠 / vue-tsc 0）**：007（migration+ADR Accepted）、003（模板+lint）、001（資料層）、002（結算引擎）、006（訪客合併）。**剩 004 全覽UI、005 peek+未讀**（皆 UI，與 Eason 一起做）。
  - 程式：`src/stores/journal.ts`（`useJournalStore`：`load`/`evaluate(now?)`/`recent(n)`/`byVolume`/`reconcileOnLogin`；entries 已倒序、onset 置底）、`src/lib/journal/{render,persona-lint,order,settle,stages,session}.ts`、`src/data/journal-templates/*`、`src/config/journal-config.ts`、`src/types/journal.ts`。data-sync 已加 journal 方法、App.vue 已串 reconcileOnLogin。

### ✅ story-004 全覽 UI — 已完成（2026-06-16，與 Eason 迭代定稿）
- **產出**：`src/views/JournalView.vue`＋`src/components/journal/{JournalEntryCard,JournalLamp}.vue`，route 登記 `src/router/index.ts`（`/journal`，`fullBleed`），E2E `tests/e2e/journal-view.spec.ts`（6 案）＋ route-table 測試補 `/journal`。
- **定稿決策（Eason 拍板，已偏離原 demo C/發想）**：
  - **組織主軸＝時間軸**（非分卷桶）：依時間倒序、**月份分段**，近期展開／舊月**收合**成「N 篇」可點細條（收合條疊起＝累積視覺，根治「越長越亂」）。**卷退成里程碑**，只在抵達筆當「卷X · 名」章節小標（solace/onset 不歸卷）。
  - **日期＝安靜小標**（font-num faint），Neve 內文當主角（曾試首字下沉/大日期，皆被否）。
  - **燈光＝Inspira `beam` 光錐**（其餘 aurora/spotlight/lamp 已移除）；**燈心＝暖象牙燭光 `#FFE9C0`，非品牌金**（避免佔用 reward 金）；純 CSS 一次性綻放、reduced-motion 靜態。
  - cream 紙頁卡（紙紋＋暖陰影）＋逐張一次性漸顯。
  - 文件已同步：`journal.md` R7/UI 改時間軸、story-004 AC、navigation-and-routing route 表。
- **驗證**：vue-tsc 0／vitest 730 綠／`journal-view`+`spa-deep-link` E2E 16 綠（chromium+webkit）。完整含 Stockfish 的 E2E 太慢沒本機跑，**CI 會跑**（config retries:2）。
- **⚠️ 尚未 commit/push**：整個 journal Phase 1 epic（含 001~007 資料層）都還在 working tree，待 Eason 確認 commit scope 後 `git push origin main`。
- **🔜 下一個＝story-005**（首頁 peek＋未讀）：HomeView「總覽」區的 `即將推出`（Library icon）locked 卡＝預留棋誌格；露最近 `HOMEPAGE_PEEK_COUNT=3` 筆＋未讀 watermark（`chess:journal:lastSeenAt`，二元/非金/僅棋誌內）；點入 `/journal`。**這是棋誌在 app 內的入口**（004 完成後 /journal 仍只能打 URL）。
- **⚠️ push 前注意**：006 動了 `src/App.vue` userId watch（登入時序）——本機已跑 spa-deep-link（landing gate/auth 路徑）綠；完整 E2E 靠 CI。
- ⚠️ **以下舊筆記已被 2026-06-16 design-review 取代，僅留作脈絡**（現況以上方為準）：原本規劃「事件當下捕捉、≤1 筆、v1=①②④」——design-review 發現 ①② 上游欄位不存在＋iOS 無可靠 app-close，故 **v1 改為 onset/arrival/solace（全可從持久狀態推導）、cap=3**，①②③⑥ 全 Phase 2。
- 已更新：systems-index #21、journal review-log、tr-registry（TR-journal-001~007）、epics/index、supabase/README。

### 棋誌・發想定稿（2026-06-16，給 /design-system 當 brief）
- **是什麼**：Neve 一個人寫的、寫「你」的文學書＝她記憶的可見載體。語氣**硬性對齊 `design/gambit-design-system/persona-neve.md`**（第一人稱對你、平靜、**不反射式讚美**＝用「我看見了什麼」代替「好棒」、西洋棋用語、無 emoji、CJK 不斜體）。
- **六種筆**（全要，⑤⑥是靈魂）：①頓悟（沒用提示就答對）②對局的一筆（冷靜/漂亮的一手，可回放）③弱點克服弧線（從「N 次漏掉」→「今天抓到」）④階段抵達·回望（章末稍長）⑤低潮的陪伴（輸棋溫柔記、**永不批評**）⑥時間的回望（隔月「三個月前的你 vs 現在」）。
- **節奏＝寧少勿濫**：一個 session 最多一筆，只記真的值得的。
- **誰寫**：只有 Neve（v1 使用者不寫）。
- **可回放**：值得記的對局/一手帶可點入口 → 深連 `ReplayView` / 重用 `PgnViewer`。
- **組織＝分卷**：對應旅程章節（卷一規則／卷二戰術／卷三開局／卷四殘局），首頁只露最近幾筆。
- **累積感＝無字視覺**（書架長卷 / C 版深色場景），**不用統計數據**（無勝率/rating/準確率＝撞平靜魂）；最強累積感＝⑥時間回望。
- **視覺方向＝ demo C 深色沉浸**（deep-jade 世界＋一盞燈的光＋cream 卡片讀字；光用 Inspira aurora）。demo: `d:\tmp\gambit-journal-demo.html`。
- **v1 範圍＝①②④(+⑤)**（資料已有：課程沒提示答對、賽後檢討最佳手、完成一階、連敗偵測）；③⑥ 等 Phase 2 引擎/數月累積再接。

---

## 現況（產品已全線可用）

- **核心動線**：對局 → 賽後檢討 → 課程 / 試煉，Google OAuth 登入 + 跨裝置同步。全部已 push。
- **測試**：vue-tsc 0、vitest **665 passed**。Supabase 6 張表全到位，**無待套 migration**。
- **已完成里程碑**（細節在 git 提交）：試煉道場 #19、學習迴圈 #20（A/B/C）、課程四階 21 課、
  UI Redesign Phase 0–4、登入遷移 Google OAuth、訪客模式 local-first + 續玩、全站 code review 修復批、
  棋理內容修復批、課程頁完成流程改版、UI 微調批、Template Compliance、dead-file 稽核、PWA 冷啟動閃爍修復。

---

## 🚧 待辦 / 開放項

### 接 Phase 2（深化方向）
- **概念側門廢除 + 概念深化頁**：廢除「概念→課程側門」（`ConceptMapView` 戰術卡 `?from=concept` alias 到課程），
  概念改成「針對單一戰術主題的深化＝課程加深版」（自有 `steps`，共享 LessonView 渲染器吃不同資料）。
  **整包做**（只拆側門會讓概念卡點下去無歸宿＝破洞）。牽連：`LessonView` 的 `fromConcept` 全分支、
  `lesson-progress` 的 `markSideLearned`、`concept-progress` store、`data-sync` 的 `lesson_side_learned` 雲端同步、
  概念地圖「已學/已練」雙色點資料來源。**保留**賽後檢討 signpost（`ReviewView:433` `?from=lesson` → 試煉，有意義）。
  **已做**：移除課程完成卡的練習邀請 CTA（vue-tsc 0）。
- **⚠️ 賽後檢討「棋盤 UI 從沒做」（2026-06-16 驗證，修正文件誤標）**：`ReviewView.vue` 的分析層
  **完整且有測試**（Stockfish、cpLoss、最佳手、最大轉折、將殺、概念連結＝「QA APPROVED」指這層），
  **但畫面沒有棋盤**——第 324-334 行把局面當 FEN 字串印出（`square-to-rect=()=>null`，連箭頭都定位不了）。
  使用者看到的就是「FEN tool」（Eason 實測屬實）。**修法＝把 FEN 佔位換成 `PgnViewer`**（lichess，已在
  `ReplayView` 用、會渲染真棋盤+最佳手箭頭），**不用從零**。這是 Phase 2「賽後檢討」的真正起點（非「打磨」）。
- **對比**：`ReplayView`（從紀錄回放）＝有真棋盤（`PgnViewer`），可用。棋誌「可回放」可深連 ReplayView / 重用 PgnViewer。
- 🆕 **賽後檢討 redesign 方向（Eason 2026-06-16 構想，＝ Phase 2 ① 的具體 UX）＝「重點回播」**：
  不逐手翻，只 **highlight 3-5 個可學的關鍵時刻**（重用既有 cpLoss/最大轉折/`classify()`，是篩選＋呈現非新邏輯；
  且只看關鍵手＝更平靜，對上「寧少勿濫」）。每個時刻顯示**該手的戰術名 + 你的步 vs 最佳步差異**，
  Neve 解釋差異：**v1＝模板 per mistake-concept**（「我知道你想…很自然，但這裡…更好，因為…」零 AI，通用版讀心、夠暖）；
  **v2＝任意局面自由解釋＝AI 開放對話前沿**（訂閱/BYOK，最後）。**咬合**：每個被點出的時刻＝一筆棋誌（②/③），
  Neve 解釋＝把 review 變成 ②蘇格拉底教學。review／①／棋誌／② 是同一件事的不同切面。

### 待 Eason iPhone 實機複看（皆已修/已 push）
- PWA 冷啟動登入閃爍（`main.ts` mount 前 initAuth + `router.isReady().then(mount)`；`App.vue` watch userId immediate）。
- header logo / GAMBIT 字標光學對齊（`translate-y-[1px]`）。
- 首頁招呼語 Neve 化「棋盤未曾離開，你來了。」
- 過場效能（tab 換頁/膠囊動畫）＝推測性修法，待確認是否變順。
- 2026-06-14 實機過一輪大致 PASS（登入/PWA/訪客/續玩/升變/易位/殘留綠格/試煉/換頁皆 OK）。

### 未來獨立任務
- **對局頁「專注模式」自動收 navbar**：用**狀態驅動**（對局進行中收底部 nav、結束或底緣上滑叫回），
  非捲動驅動（一屏不捲會卡死）。屬全站導覽改動，注意平靜鐵則 + iOS 底緣手勢衝突。
- **Phase C+/D**：捉雙/牽制賽後偵測（需精準度實測）；Claude API 動態講解＝願景的開放式對話/BYOK（最後）。
- **文件**：`epics/index.md` 試煉/學習迴圈狀態待補（純文件）。

---

## 🔑 鐵則 / 技術參考

### ⚠️ Node 26 升級（2026-06-16，接手必讀）
- **CI 已升 Node 22→26**（`tests.yml`/`deploy.yml`/CLAUDE.md）。Eason 家裡電腦已升 26；**公司電腦仍 Node 22**。
- **換機器 / git pull 後必做**：`npm install`（package-lock 變了，連 `@tailwindcss/postcss` 等技術棧升級的 lock 一起；不重裝 dev server 起不來）。
- **Node 26 vitest 相容 shim**：`tests/setup-node26-compat.ts`（vitest.config 已 `setupFiles` 指向它）。
  - **為何需要**：Node 26 把 `localStorage` 加進原生 globals（實驗性 Web Storage），但無 `--localstorage-file` 時它是 getter-only 的 undefined，happy-dom 用 plain assignment 覆寫會在 strict mode 靜默失敗 → 全測試 localStorage=undefined 而紅。shim 在 happy-dom init 後補裝可用的 InMemoryStorage（key 為 own enumerable，使 `Object.keys(localStorage)` 正常）。
  - **對 Node 22 安全**：shim 是條件式（`if typeof localStorage === 'undefined'`），Node 22 happy-dom 正常注入 localStorage → shim 跳過 → no-op。故公司電腦 22 pull 後測試照綠，不需特別動作（仍建議升 26 對齊 CI）。
  - ⚠️ shim 在 Node 22 的 no-op 行為尚未實機驗證（開發機是 26）；公司電腦首次 `npm run test:unit` 若異常回報。

- **Push guardrail**：`git push origin main`，**絕不 bare `git push`**（origin=你的 fork、upstream=模板）。
  push 前先列 commit message 等 Eason 確認。
- **部署 base path**：JS/inline-style 的資產路徑（`url()`、`<img src>`、`mask-image`）**必加
  `import.meta.env.BASE_URL`**，否則部署子路徑下 404；只有 `.css` 的 `url()` 會被 Vite 自動補。
- **設計 SoT**：`design/gambit-design-system/`（deep-jade #103029 錨、品牌金 #F8B500 只 focus/reward、
  暖 cream 內容、BIZ UDPMincho 標題 / Sarasa 內文 / LXGW 課文 / Cubic 數字）。Lucide icon、無 emoji、
  touch ≥44px、平靜語氣、**無 streak/timer/leaderboard**。**氛圍 vs juice**：擋 juice，擁抱 atmosphere（見 vision）。
- **教練人格 SoT**：`design/gambit-design-system/persona-neve.md`。課程＝Neve 第一人稱、試煉 brief＝第三人稱觀察、概念＝中性。
- **西洋棋用語**：后/城堡/騎士/主教/國王/兵；**禁象棋 車/馬/象**。
- **內容授權**：lichess 題庫位置/解法＝CC0 可商用；lila/chessops/Learn 課文＝禁抄（copyleft），教學文一律
  繁中 clean-room 自寫；棋子 Gioco Wood（CC BY-NC-SA，已標）。
- **Supabase migration**：走 Dashboard SQL Editor 手動套（無 CLI link）；見 `supabase/README.md`。
- **解法驗證**：chess.js（`.move()` 非法步 throw；`isCheckmate()`）。改 `data/lessons|puzzles/*` 後內容閘門測試
  **只驗合法/結尾將死、不驗最佳解/子力交換/概念匹配**，必須額外用 chess.js 實證（曾一次審出 10 處「合法但棋理錯」）。
- **截圖/暫存檔**：寫到子目錄、測完自清，不留在專案根目錄。
- **E2E 盲區**：改到 `main.ts`/`router`/`auth`/mount 時序後，push 前本機補跑 `npm run test:e2e`（vitest 綠 ≠ 安全）。

### vue3-chessboard 幾何/易位踩坑（重要護欄）
- ①棋盤容器寬須對齊 8 倍數，否則 chessground 把 cg-board floor 成 8n 偏移（`useBoardFit` ResizeObserver 解，套 `.board-fit`）。
- ②overlay（標註/箭頭/check ring/座標）定位要用**真實 cg-board 尺寸 ＋ 相對 cg-wrap 原點**，非 cg-wrap 寬。
- ③易位 chess.js 只收 `e1→g1/c1`，城堡格手勢要 remap 成 king 兩格目標；④`events.select(key)` 偵測選子觸發城堡提示。
- ⑤座標自繪在木框（chessground `coordinates:false`）。
- ⑥**不可用 `max-w` 依高度硬縮棋盤**（高度被內部 pin，會壓成非正方）；要省空間改縮周邊（合併列、棋譜上限）。
  Tailwind arbitrary calc 內 `-` 兩側要底線：`calc(100dvh_-_Nrem)`。
- **B5 桌機棋盤過大 root cause**：vue3-chessboard `.main-wrap` 被釘 `width:700px`。解＝board wrapper 加 `board-fit`
  ＋ scoped `.board-fit :deep(.main-wrap){width:100%!important;max-width:100%!important;height:auto!important}`。
  其他用棋盤的頁（PlayView/Review/Replay）遇過大套同一 fix。
- **annotation 高亮/箭頭 vs 格子 2-4px 偏移**（polish 後續）：MoveAnnotationDisplay 用 cg-wrap（536px）算格子，
  但實際 cg-board 531.2px、左偏 ~5px → 改用 `elements.board` 尺寸＋原點。牽涉全站箭頭/標註，需獨立驗證。

### 遺留 dead code（deferred，需能實機測升變才動）
- 自訂 `components/promotion-dialog.vue` ＋ `chess-board.vue` 的 `pendingPromotion`/`handlePromotionSelect`/
  `handlePromotionCancel`/`isPromotionMove` 分支。「死」靠 vue3-chessboard runtime 而非結構保證，又接在核心 `onMove`，
  移除＝拔 fallback。升變無法只靠 vue-tsc/vitest 驗（要瀏覽器真走一步升變），故刻意不動，待能實機測升變再移除。
- **未刪刻意留**：`recommend.ts` 的 `recommended()`（有測試/文件、與 candidates/practiceTarget 成套的保留 API）。

### B5 試煉互動需部署實機驗證
- log 框累積對錯、inline 達成（不彈窗）、答錯棋子滑回、課程換步不 remount、揭曉箭頭走子後消失——
  chessground 合成事件難在 Playwright 自動觸發，靠 vue-tsc 0 ＋ test ＋ 邏輯正確性保證，Eason 部署後實機點一輪確認。
