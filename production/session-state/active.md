<!-- STATUS -->
Epic: 待規劃
Feature: 賽後檢討頁打磨（待 Eason 細列）
Task: 實機驗收累積項待確認
<!-- /STATUS -->

> **交接快照**：只留現況 + 待辦 + 鐵則。歷史細節在 git log；詳盡規格在各 GDD / EPIC。
> 全專案總覽 `production/epics/index.md`（較舊，試煉/學習迴圈狀態以本檔為準）。

---

## 現況（產品已全線可用）

- **核心動線**：對局 → 賽後檢討(#7) → 課程(#18) / 試煉(#19)，雲端登入 + 跨裝置同步。
- **試煉道場 (#19)**：完成（30 題、地圖、解題、跨裝置進度，`dungeon_progress` 表已驗）。
- **學習迴圈 (#20)**：Phase A/B/C 完成（概念底層、雙向橋接課程↔試煉、概念地圖 `/learn/concepts`、
  賽後檢討的中立 opt-in 概念標記 v1＝mate + material）。**概念頁已改版＝「熟悉度地圖 + 按戰術切入學習」
  雙職，可側門跳學鎖住的戰術（不污染線性進度）；側門已學雲端同步（`lesson_side_learned` 表已套用）。**
  ⚠️ **2026-06-15 方向重定：「概念→課程側門」決定廢除，概念改做「課程加深版」深化頁（見待辦首條）。下方雙向橋接的橋接 CTA 已部分拆除。**
- **game-replay (#S10)**：QA APPROVED；S10-05 動畫 polish 已 deferred；剩 iPhone 實機。
- **訪客模式 local-first + 續玩對局**：done+push（`170abf0`）。訪客完局讀本地 queue、登入 flush 同步；Resume 每步存 local／離開推雲／登入 last-write-wins。**程式已 push，剩實機驗收（見待辦）**。
- **測試**：vue-tsc 0、vitest **664 passed**。

## UI Redesign（2026-06-09～06-11，已全數 push）

> 主計畫 `production/redesign-2026-06.md`；每 Phase 細節在 git log。

- **Phase 0–4 全 done+push**：共用語言／PlayView（`6e35394`）／HomeView（`ff4a675`）／學習三頁（`727ec56`）／試煉兩頁（DungeonMap 透視 funnel + Puzzle H/M）。
- **Redesign 回饋 A1/B2/B4/C + 試煉地圖 chrome + 學習 IG 分頁**：done+push（2026-06-10）。
- **Bug 2 對局側板一屏優化**：done+push（2026-06-11）。合併密度列（徽章＋身分一行，nowrap，文字精簡「思考中」「Lv.X」防窄面板溢出）+ 棋譜捲動區 `max-h-[9rem]`（桌機 12rem）+ 側板自然高度貼合內容。待 iPhone 實機驗收（AI 思考列、棋譜捲動）。
- **鐵則**：redesign 類先跑 `/redesign` 對真實畫面出 H/M/L → Eason 拍板 → 才施工，**即使已給明確方向也不例外**。

## ✅ 課程系統 = 四階課綱完整（S05 完成）

> 教練人格 Neve + 試煉 brief 已 push（`24c1e3d`）；repo 改名 base path 已 push（`e137bef`）。

- **課綱 21 課、orders 1–21 連續**：規則 8 + 戰術 6 + **開局 4**（控制中心/快速出子/王翼易位/別太早出后）
  + **殘局 3**（后王逼殺/城堡逼殺/兵升變對王）。學習弧線完整：規則→戰術→開局→收官。
- **教練人格 Neve（已 push `24c1e3d`）**：SoT `design/gambit-design-system/persona-neve.md`。課程＝Neve 第一
  人稱對你說、試煉 brief＝你內化後的第三人稱觀察、概念＝中性。寫任何課程/試煉/概念文案前先讀此 SoT。

## ✅ 前批全數落地（2026-06-12～13 push，詳見 git log）

> 之前 active.md 標記的「未 commit」三批現已全部 push。互動步的 chessground 拖放驗收併入下方實機累積項。

- **S05 課程內容**（`02e1133`）：四階課綱 21 課全到位（開局補 3、殘局從零建 3）；既有課反射式讚美 9 處收掉
  （對齊 Neve）。殘局將殺 chess.js 實證（Qd7#/Ra8# checkmate=true、升變合法）。
- **課程/試煉 UI 修正批 + 多項 Bug 修復**（PR #1 `da752e6`）：4 bug（首頁學習進度 RouterLink、LessonView 頭像
  `COACH.name.charAt(0)`、試煉 `lastResult` 單筆覆蓋頂 CTA、走錯滑回清 lastMove 綠格）、17 處慶祝式語氣收冷靜、
  升變課 2-2 重寫 + endgame 連接性修正（chess.js 掃相鄰步）、複習按鈕 → concept hub 金框呼吸脈動。
- **2-3 升變框 redesign + 變身動畫**（`51fd786`，走 Option A CSS reskin 原生 `.promotion-dialog`）：Gambit reskin
  + Gioco Wood 棋子、兵→選定子變身 overlay、升變壓暗 scrim、每顆棋子獨立 tile + focus 金邊（reward only）。

## ✅ 登入遷移 Magic Link → Google OAuth（2026-06-13 push，手機 PR #2/#3）

- **PR #2（`fadac05`）**：auth store 移除 `signIn`/`pendingEmail`、新增 `signInWithGoogle`（`signInWithOAuth`）；
  `SignInView` 改 Google 登入按鈕、移除 email 輸入與待確認 UI；測試同步更新；CLAUDE.md 技術棧改 Google OAuth。
- **PR #3（`954fe86`）**：Google 按鈕改玻璃語言（`bg-white/10` + backdrop-blur + hairline border + 頂光），
  字色 ink-on-deep、hover/press 對齊設計系統。Quick spec `design/quick-specs/google-signin-button-style-tweak-2026-06-13.md`。
- **驗證**：vue-tsc 0、vitest **664 passed**。**Google OAuth 完整登入流程 + PWA 冷啟動待 Eason 實機**（見待辦）。

### 遺留 dead code（仍 deferred，需能實測升變才動）

- 自訂 `components/promotion-dialog.vue` ＋ `chess-board.vue` 的 `pendingPromotion`/`handlePromotionSelect`/
  `handlePromotionCancel`/`isPromotionMove` 分支。「死」是靠 vue3-chessboard runtime（`isPromotionMove` 回
  `move.flags.includes('p') && !move.promotion`，而 lib 在 emit @move 前已設好 move.promotion → 永遠 false），
  **非結構保證**；它又接在核心 `onMove` 流程裡，移除＝拔掉 fallback。**升變無法只靠 vue-tsc/vitest 驗（要瀏覽器
  真走一步升變）**，故 2026-06-14 dead-file 清理時刻意不動，待能實機測升變時再移除並確認原生 reskin 完整接手。

## ✅ Template Compliance Adoption（2026-06-15，已完成）

> 計畫存 `docs/adoption-plan-2026-06-15.md`。

- **BLOCKING 修復**：`design/gdd/systems-index.md` — 15 個 Status 欄清掉括號與 `**bold**`（`Approved (round 2, ...)` → `Approved`），`/gate-check`、`/create-stories`、`/architecture-review` 的 exact-match 恢復正常。
- **HIGH 修復**：`.claude/docs/coordination-rules.md` — Opus 版本號 `claude-opus-4-6` → `claude-opus-4-8`（stale model ID 導致 model-tier skill 指向不存在版本）。
- **MEDIUM 修復（story 全補完）**：71 個 story 全部掃完：
  - TR 欄補齊：有 registry 的系統（chess-board / chess-engine / nav-routing / game-lifecycle / move-annotation / post-game-review / game-export / opening-id / opening-knowledge-cards / visual-identity / lesson-system）依 AC 配對正確 TR-ID；無 registry 的系統（game-history / game-replay / supabase / dungeon-puzzle / learning-loop）寫 `pending /architecture-review`。
  - ADR 欄補齊：21 個缺 ADR 的 story 依 epic 目錄對應正確 ADR。
  - AC 補齊：`technical-debt/story-001-tr-registry-update.md` 補 4 條 `- [ ]` checkbox。
- **結果驗證**：掃完 71 stories — Missing TR: 0、Missing ADR: 0、Missing AC: 0。

## ✅ 全站 code review 修復批（2026-06-14 push）

> workflow（gambit-fullsite-review，11 模組 + adversarial verify）出 53 findings → 修 **H2 + M19 + L16**，
> 其餘 L 列「不擅改」（dead code 尊重暫緩、字級/♚ 全站設計決策、純維護性提醒）。vue-tsc 0、vitest **665**（+1）。

- **H**：PlayView engine 從不 dispose（Worker/listener 洩漏）→ onBeforeUnmount 加 `engine.dispose()`；
  opening-index `identifyOpening` 非法走法無 try/catch 會白屏賽後檢討 → 包 try/catch break。
- **M 對局**：引擎掛掉執黑卡 AI_THINKING 死盤 → requestAiMove 加 phase guard + CRASHED 投降收尾；
  setDevFen 依 FEN 走子方決定 phase；chess-board check live-region 拆 polite/assertive + `將軍`；
  data-sync flush 單筆毀損不中斷整批；export buildPgn 包 try/catch 退 FALLBACK。
- **M UI/a11y**：ReviewView 全失敗不再同時「全程穩定+無法分析」；eval bar height/width 動畫→transform
  + reduced-motion（move-annotation、replay-overlay）；LessonView/LearnPager 加 resize 重算；
  觸控 44px（DungeonPuzzle×5、app-nav 帳號、HomeView 另開新對局、input font-size、slider、checkbox）；
  ReplayView 深連結先載 history 再判 redirect；HistoryView loadMore 改 re-throw（修錯置 banner + dead UI）。
- **L**：auth `??` 死碼、router onError flag 清除、debounceTimer/setTimeout/transitionend listener cleanup、
  typewriter 同字串重播、parse-inline-markdown underscore word-boundary、chess-board findPiece 簡化、✓✗→Lucide。
- **不擅改（列報告，待 Eason 定）**：dead code 刪除（use-chess-board/use-stockfish/cploss/recommend、HistoryRow
  is-expanded）、課文字級 16px（全站決策）、Profile/NotFound ♚→品牌棋子、greeting/perf 邊角、ConceptMap gradient
  進度條 width（改 transform 會破壞漸層）、identifyPosition console.error（需 FEN/EPD 格式判斷）。

## ✅ 棋理內容修復批（2026-06-14 push）

> workflow（gambit-chess-content-review，11 組逐局面 chess.js 實證）驗了 82 個局面，找出 **10 個棋理瑕疵**（H4 M4 L2），全部修正並逐一 chess.js 把關。內容閘門測試（lessons/puzzles/concepts.test）全通過。

- **H 假將殺/錯解**：①`rules.ts` tier1Capstone「一步將死」Qb8+ 其實非將死（白王太遠，Kxb8）→ 改 FEN（白王 c6 撐腰）+ Qb7#；②`rules.ts` 逼和題 Qb8+ 假將殺 → 改 Qc7 當逼和陷阱、Qb7# 當正解（保留逼和教學）；③`endgame.ts` 升變課升完后立刻被吃變和棋（白王 f6 不守 e8）→ 整線改白王 f7 護送、安全升變；④`puzzles/l2-pin-win-queen` 釘后用兵收割根本不成立（后沿線可逃 + 城堡可直接換后）→ 重設計成「釘騎士（有保護）推兵收割」（與 l3 互補）。
- **M**：①`tactics.ts` protection（Eason 發現的校準案例）→ 重設計成主教 d3 被城堡攻、加防守者真正化解（前一版城堡 vs 城堡有 Rxd8+ 免費吃漏洞，已換）；②升變課文案配合改「王守升變格」；③`l2-knight-fork-rook` successText 高估收穫（說白吃城堡，實為騎士換城堡）→ 改正確結算；④`l3-pin-knight-pawn` 推兵 suboptimal（城堡可直接 Rxa5+ 一步吃）→ solution 改單步。
- **L**：protection hint「逃不掉」假前提（已隨重設計修）；`dont-bring-queen-out-early` QUEEN_BACK FEN 的 side-to-move/move number 與敘事不符 → 改 `w … 4 4`。
- **驗證**：vue-tsc 0、vitest **665**。每個改動的 FEN/將殺/子力交換/最佳解都用 chess.js 實證。

## ✅ 課程頁完成流程改版（2026-06-14，已 push）

> 全在 `src/views/LessonView.vue`。vue-tsc 0、vitest 658。**已 push（Eason 拍板直接推）。**

- **完成流程去彈窗**：原「完成課程 CTA → 彈窗 → 三鍵」改成最後一步按「完成課程」→ **就地**在對話框內顯示完成卡
  （✓ 徽章 + 本課重點 + 練習邀請），動作列換成「回課程列表 / 繼續下一課（金）」。概念側門完成顯示「回概念地圖」。
- **完成＝必須明確按鈕觸發**（修 bug）：曾用 `watch(isLastStep && canAdvance)` 自動完成，導致敘述型 5/5 一進就秒跳完成
  （4/5 走對→下一步→瞬間完成）。改回最後一步顯示金色「完成課程」按鈕、`complete()` 才設 finished。
- **完成後隱藏棋盤**：finished 時棋盤已無用 → `v-if="!finished"` 收起，完成卡垂直置中成乾淨「完課頁」，手機一頁不捲。
- **完成卡 redesign**：去掉「卡中卡」（cream 外框＋sage 內框）→ 單一卡、圓角統一去聊天缺角、隱藏 Neve header、徽章放大置中。
- **手機版面**：一般步驟卡片貼齊棋盤下緣（`items-start`）、頭像收進卡片 header（拿掉外掛大頭像）；
  footer 按鈕改 `size="sm"`（原 `px-6` 預設害三鍵溢出卡片）。對話框打字 32→16ms、自動捲、釘頂 header（捲動不消失）。

## ✅ UI 微調批（2026-06-15，已 push `c312a0e`）

> 一連串 redesign 微調，涉 LessonView / HomeView / LearnView / ConceptMapView / DungeonMapView / app-nav。
> 手機 390×844 Playwright 各頁實機看過（純 template/style，未動邏輯）。

- **LessonView 完成卡**：scenario 不再溢出完成卡（`stepIndex===0 && !finished`）；總結改置中純文字（去 callout 框，避免搶戲）；動作鍵上下堆疊→左右並排；active 章節 done 課 badge「完成」→「複習」（去刪除線、`text-ink-muted`）。
- **HomeView**：「開始新對局」卡 ChapterBadge → `Swords` 大浮水印 icon（`text-white/[0.07]`，右下溢出）。
- **LearnView**：移除頂部 0/21 進度 header；章節卡統一樣式＝active/done/locked 同結構皆可展開收合（CSS grid `0fr→1fr` 動畫）；locked 章節可展開預覽（不可進入）；done 課「複習」可點回顧；active header 色 `surface-deep`→`surface-deep-2`（同 nav 太深修正）；章節 `1/8 ›` 計數從 `flex-col` 垂直堆疊→水平並排置中。
- **ConceptMapView redesign**（`/redesign` 報告→Eason 拍板 **A 緊湊橫向卡**）：移除 DarkPanel 錨點卡（避免假可點）+ 整個 header；概念分 3 組（核心目標/戰術技巧/棋局原則）；卡片緊湊橫向化 112px→72px，硬幣徽章留、狀態改右側彩色圓點（已學綠/已練金）+ 頂部圖例、未學卡 `ChevronRight`「去學」指示；8 概念一屏覽完。清掉 orphan `.state` 樣式。
- **DungeonMapView**：移除頂部「髒掉」的 distance haze 漸層；底部錨點計數 `solvedCount`→`currentPuzzle.order`（第一關 1/30，與主標「第 N 關」一致；全完成分支維持 solvedCount=30/30）。
- **app-nav**：底部 pill 加漸層底 `linear-gradient(180deg,#1C3E34,#142F28)`（對齊 header 立體感）；active 指示器 `bg-primary` 實心→仿毛玻璃（`bg-white/[0.13]`+border+inset 高光，**不用 backdrop-blur**＝iOS 每幀重繪卡頓）；圓角對齊「課程/概念」switch（learn-tabs）＝三層 `rounded-full`（曾試 `rounded-[20px]` 後 Eason 拍板回 full）。

## 🚧 待辦 / 開放項

- 🆕 **概念側門廢除 + 概念深化頁（2026-06-15 規劃定案，明天做整包）**：方向重定——Eason 覺得「試煉/課程/概念交互連結」實際做出來不是想要的，決定**廢除「概念→課程側門」**（`ConceptMapView` 點戰術卡 `?from=concept` alias 到課程）。概念不該是課程的別名，要變成**「針對單一戰術主題的深化＝課程加深版」**：概念有自己的 `steps`（同一戰術多個變化局面 A/B/C，舉一反三），共享 LessonView 渲染器但吃不同資料來源。
  - **為何整包做、今天不拆**：若只拆側門，概念地圖戰術卡點下去無歸宿（破洞）。拆側門 + 建概念深化頁要一起做，概念地圖才不會留中間破碎狀態。
  - **牽連（拆時要一併處理）**：`LessonView` 的 `fromConcept` 全分支、`lesson-progress` 的 `markSideLearned`/side-learned 集合、`concept-progress` store、`data-sync` 的 `lesson_side_learned` 雲端同步、概念地圖「已學/已練」雙色點的資料來源。
  - **保留**：賽後檢討的 signpost（`ReviewView:433` `?from=lesson` → 試煉 practice）＝真實對局局面導到相關題，有意義，不動。
  - **今天已做**：移除課程完成卡的「練習邀請」CTA（`completionConcepts`/`practise`/相關 import，vue-tsc 0）。
- **migration**：`in_progress_game` 已確認套用（2026-06-12 查 `to_regclass` 有表）。Supabase 6 張表全到位，無待套 migration。
- ~~**push 後待 iPhone 實機驗收（累積）**~~ **2026-06-14 實機過一輪，大致 PASS**：Google 登入 OK、PWA 有擋、訪客 OK、續玩 OK、升變 OK、易位 OK、殘留綠格 OK、試煉全 OK、換頁效能 OK。剩兩個 issue（見下）。
- ✅ **PWA 冷啟動登入閃爍（已修，已 push）**：root cause＝`main.ts` 沒 `await router.isReady()` 就 mount，而 `HomeView` 是同步元件、`initAuth()` 又延到 App `onMounted` 才跑 → 初始導航在 session 未定時先 render home，guard 解析完才重導 sign-in（閃首頁→sign-in）。修法：`main.ts` mount 前先 `useAuthStore().initAuth()`（不 await，交給 guard 內 isAuthLoading watch）+ `router.isReady().then(mount)`，畫面一次到位；`App.vue` 移除 onMounted 的 initAuth、`watch(userId)` 加 `immediate:true`（避免登入態 mount 漏跑 reconcile）。加 regression `test_landingGate_homeRoute_noFlag_redirectsToSignIn`。vue-tsc 0、vitest **665**。**待 Eason iPhone 實機複看冷啟動不再閃**。
- 🆕 **賽後檢討頁還有不少要調整（待 Eason 細列）**：2026-06-14 實機覺得需要打磨，尚未逐項列出。下次開工先請 Eason 指出具體點，或跑 `/redesign` 對賽後檢討頁出 H/M/L。
- ✅ **header logo/GAMBIT 字標對齊**：Cinzel cap-height 偏上致字標視覺高於金徽，`app-nav.vue` 字標加 `translate-y-[1px]` 光學對齊。**待 Eason 實機複看**（本機未截圖驗，純光學微調）。
- ✅ **首頁招呼語 Neve 化**：`HomeView.vue` 大標「今天想下一盤嗎？」→「棋盤未曾離開，你來了。」（neve-home-greeting workflow 6 角度生成 + 3 評審 panel 全票最高分；時間小字早安/午安維持）。**header／招呼語／PWA 三項 2026-06-14 已 push，待 Eason 實機複看**。
- **對局頁「專注模式」自動收 navbar（Eason 提案，未來獨立任務）**：Eason 想要 IG 式「靜止縮小／滑動回復」navbar。
  結論：**捲動驅動不適用對局頁**（一屏不捲＝沒手勢叫回，會卡死）。若要做，改**狀態驅動**——對局進行中
  （PLAYER_TURN/AI_THINKING）自動收底部 nav 進專注模式、結束或底緣上滑叫回。屬**全站導覽改動**（影響每頁），
  要留意 Gambit「平靜少動效」鐵則 + iOS 底緣手勢衝突。IG 原版捲動隱藏留給會長捲的頁（學習/試煉清單）。獨立評估。
- **vue3-chessboard 幾何/易位踩坑（技術護欄，重要）**：①棋盤容器寬須對齊 8 倍數，否則 chessground 把 cg-board floor 成 8n 偏移（`useBoardFit` ResizeObserver 解，套在木框內 `.board-fit`）；②overlay（標註/箭頭/check ring/castle hint/座標）定位要用**真實 cg-board 尺寸＋相對 cg-wrap 原點**，非 cg-wrap 寬（`chess-board.vue` squareToRect 已改，連帶修好 active 舊待辦的 annotation 2-4px 偏移）；③易位 chess.js 只收 `e1→g1/c1`，城堡格手勢要 remap 成 king 兩格目標；④`boardConfig.events.select(key)` 可偵測選子，用來觸發城堡格提示；⑤座標自繪在木框（chessground `coordinates:false`），木框 tray 用 p-3 留帶、font-num 暖米色 `rgba(233,217,186,0.6)`。
  ⑥**不可用 `max-w` 依高度硬縮棋盤**：棋盤高度被內部 pin 住，縮木框寬會把棋盤壓成非正方（h 檔被裁）。要省空間改縮周邊（合併列、棋譜上限），別碰棋盤寬。Tailwind arbitrary calc 內 `-` 兩側要用底線：`calc(100dvh_-_Nrem)`。

- **#3 過場效能**：上面那批是推測性修法，**待 Eason 下次實機確認**點 tab 換頁/膠囊動畫是否變順。
- ~~**試煉題卡「補充描述」逐題撰寫**~~ **done+push**：Puzzle 加必填 `brief`、30 題逐題撰寫、
  題卡常駐渲染、測試內容閘門 + Playwright 截圖驗證。文案討論於 git log。
- **B5 桌機棋盤尺寸已解（root cause 紀錄，重要）**：vue3-chessboard 的 `.main-wrap` SECTION 被釘死
  `width:700px` 撐爆容器（不是 cg-wrap）。解法＝board wrapper 加 class `board-fit` ＋ scoped
  `.board-fit :deep(.main-wrap){width:100%!important;max-width:100%!important;height:auto!important}`，
  main-wrap→main-board(aspect)→cg-board 就一起 follow 外層寬度。課程桌機＝board `lg:flex-1` 主寬、對話
  `lg:w-[26rem]` 次寬、按鈕並排；課程／試煉棋盤都加木框 wooden tray。**其他用到棋盤的頁（PlayView/Review/Replay）
  若也遇棋盤過大，套同一個 `board-fit` :deep fix 即可。**
- **B5 試煉互動需部署實機驗證**：log 框累積對錯、inline 達成（不彈窗）、答錯棋子 setPosition 滑回、課程換步不 remount、
  揭曉箭頭走子後消失——這些互動 chessground 合成事件難在 Playwright 自動觸發，已靠 vue-tsc 0＋645 test＋邏輯正確性保證，
  Eason 部署後實機點一輪確認（特別是答錯滑回＋對手不亂動）。
- **annotation 高亮/箭頭 vs 棋盤格子 2-4px 偏移（polish，後續）**：MoveAnnotationDisplay 用 boardRef
  ＝`elements.wrap`（.cg-wrap，量到 536px）算格子；但 chessground 實際棋盤 `cg-board` 是 531.2px（內部設定、
  左偏 ~5px），導致 keySquare 高亮/箭頭比真實格子算大 sq、整體偏 dx≈-2 dy≈+4。修法：annotation 改用
  `elements.board`（cg-board）的尺寸＋原點，或讓 cg-board=cg-wrap（coords overlay／chessground 重繪）。牽涉
  全站箭頭/標註定位（課程/試煉/review/replay），需獨立驗證故未在 B5 收尾動。
- ~~**課程內容撰寫 (S05)**~~ **done+push（`02e1133`）**：四階課綱 21 課全到位（開局補完、殘局從零建）。
- ✅ **dead-file 稽核已清（2026-06-14，已 push）**：刪 `ui/checkbox·label·progress·tooltip`（孤兒 shadcn）、
  `composables/use-stockfish.ts`＋其測試（引擎實際走 review-engine/play-engine）、`useChessBoard()` 孤兒函式
  （保留有用的 `MoveMadePayload` 型別於同檔）、`docs/engine-reference/`(46)、`CCGS Skill Testing Framework/`(127)、
  `public/board/wood12_bg.jpg`、12 個 godot/unity/unreal specialist agents。vue-tsc 0、vitest **658**（−7＝移除的 use-stockfish 測試）。
  - **未刪、刻意留**：`recommend.ts` 的 `recommended()`（有測試/文件、與 candidates/practiceTarget 成套的保留 API）。
- **Phase C+ / D（未排程）**：捉雙/牽制賽後偵測（需精準度實測）；Claude API 動態講解（選配，最後）。
- **文件**：`epics/index.md` 試煉/學習迴圈狀態待補（純文件）。UI drift 報告
  `production/qa/ui-drift-audit-2026-06-07.md`：整體一致，H/M 級已套、L 級刻意不動。

## 🔑 鐵則 / 技術參考

- **Push guardrail**：`git push origin main`，**絕不 bare `git push`**（origin=你的 fork、upstream=模板）。
  push 前先列 commit message 等 Eason 確認。
- **部署 base path**：JS/inline-style 的資產路徑（`url()`、`<img src>`、`mask-image`）**必加
  `import.meta.env.BASE_URL`**，否則部署子路徑下 404；只有 `.css` 的 `url()` 會被 Vite 自動補。詳見 CLAUDE.md。
- **設計 SoT**：`design/gambit-design-system/`（deep-jade #103029 錨、品牌金 #F8B500 只 focus/reward、
  暖 cream 內容、BIZ UDPMincho 標題 / Sarasa 內文 / LXGW 課文 / Cubic 數字）。Lucide icon、無 emoji、
  touch ≥44px、平靜語氣、**無 streak/timer/leaderboard**。
- **西洋棋用語**：后/城堡/騎士/主教/國王/兵；**禁象棋 車/馬/象**。
- **內容授權**：lichess 題庫位置/解法＝CC0 可商用；lila/chessops/Learn 課文＝禁抄（copyleft），教學文一律
  繁中 clean-room 自寫；棋子 Gioco Wood（CC BY-NC-SA，已標）。
- **Supabase migration**：走 Dashboard SQL Editor 手動套（無 CLI link）；見 `supabase/README.md`。
- **解法驗證**：chess.js（`.move()` 非法步 throw；`isCheckmate()`）。棋盤 `components/chess-board.vue`、
  對局狀態機 `modules/game-lifecycle/use-game-lifecycle.ts`（chess.js 為唯一權威狀態）。
- **截圖/暫存檔**：寫到子目錄、測完自清，不留在專案根目錄。
