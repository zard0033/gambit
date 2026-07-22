<!-- STATUS -->
Epic: 差異化重構
Feature: Phase 3 B 路線——整個 app 佈局 from scratch（徹底顛覆導航範式）
Task: 2026-07-21 佈局 project ⓪➊ 拍板完成——方向＝墨色垂直世界（滑動空間語意＋旅程軸 icon 導覽），
決策記錄寫入 `design/gambit-design-system/navigation-vertical-world.md`。➌ 真開發未開始。
第二主題「深墨綠」深色模式已完成、**已 push**（`feat/theme-deep-jade` 內容已併入並推送到 origin/main）；
Supabase migration（`user_preferences`）**已套用 live**（2026-07-22 anon key PostgREST 驗證確認，見下節）。
（前情：material 撞題 07-14 裁決＝spec 為準、v0 停 `material-v1-parked`；iPhone 四批複驗 07-20 已清，見下節。）
<!-- /STATUS -->

> **交接快照**：只留現況 + 待辦 + 未固化的 in-flight 決策。長期鐵則/技術參考在 CLAUDE.md 體系（見「接手必讀」），不複述；**已完成施工細節在 git**。
> **差異化北極星 = `production/gambit-differentiation-vision.md`**——提任何功能/重構/UI 前**先讀**。

---

## 2026-07-22 墨韻母題改嫁落地（cream / deep-jade 兩主題）

> 另一對話將以此為地基，把墨韻做成全站共通視覺語言逐屏擴散。

- **落了什麼（共用件，一處定義、非 inline）**：`InkBrush`（墨筆底線＋乾筆分隔，同元件靠 width/height
  切換）＋ `InkSplatter`（金墨飛濺）＝ `src/components/ui/gambit/`，已在 `index.ts` 註冊；production CSS
  在 `src/assets/main.css`「墨韻 (INK GARNISH)」段（檔末）。接手對話直接複用元件＋class，不必重刻。
- **兩主題行為**（SoT 已同步：`design/gambit-design-system/colors_and_type.css` 墨韻母題段）：
  - 墨色 token `--color-ink-brush`：cream 深棕墨 `rgba(61,34,16,.68)`、deep-jade 暖白墨 `rgba(236,230,218,.72)`。
  - 金墨飛濺兩主題品牌金；`--fleck-scale` cream=1.6（亮底加大粒子補存在感）、deep-jade=1。
  - **cream 極克制**：只在 reward／章節扉頁／Neve 特殊時刻掛，不進日常 UI；**deep-jade 暖白墨可進日常**。
- **首個掛載＝課程完成卡**（`LessonView.vue` `#completion-card`）：課程名下墨筆底線 ＋ 勳章區金墨飛濺，
  兩主題 reward 時刻。掛載點穩定（不受首頁 from-scratch 重做影響）。
- **筆觸資產**：演算法（buildPath / flecks）在元件內；決策樣張 demo＝`design/demos/ink-garnish-mockup.html`。
- **待擴散（給接手對話）**：乾筆分隔（InkBrush 寬扁）primitive 已備、未掛任何畫面；deep-jade 日常標題
  底線可鋪開；首頁招呼語墨筆待 from-scratch 新 IA 定案後接（星夜元件將拆，故此輪未掛首頁）。

## 2026-07-21 第二主題「深墨綠」完成 ＋ 佈局 from-scratch project 啟動

### 第二主題（深色模式）＝深墨綠，已完成＋已 push（`feat/theme-deep-jade` 內容已併入 main 並推送到 origin）

- **方向探索歷程（教訓：憑空認可挑不出、看實物才準）**：原 noir branch 的 ink-noir（暖黑墨底＋暖白紙、去 jade）
  一路被推翻——Eason 把 cream/noir 擺一起看，覺得 ink-noir「tone 不對、像兩個 app」。診斷＝去 jade 斷了品牌血緣，
  但飽和 jade 貼中性暗底又螢光。探索「鏡像對偶」（noir 配另一靈魂色 X：朱砂／黛紫／黛藍）後，Eason 最後選
  **深墨綠沉浸**：底本身是接近黑的深墨綠 `#0e1411`、jade 是同色系亮階（不螢光）、金唯一高光＝cream（暖亮＋jade）
  的明暗鏡像、同青瓷家族。黑度取「偏黑」版（非較綠版）。
- **落地**：`main.css` `:root[data-theme='noir']` token block（深墨綠色板）＋11 個深區 theme-aware class 的 noir
  漸層值；`colors_and_type.css` noir 段（SoT）同步；toggle 系統（`lib/theme.ts`＋`ui-store`＋`data-sync` 跨裝置
  同步＋ProfileView「外觀」toggle＋`main.ts` 開機套用＋`App.vue` 登入 reconcile）；`theme.test.ts` 6 測試。
  WCAG 五項實算全過（ink 15.66:1、primary 連結 5.93:1、danger 5.95:1…）。vitest 913 綠、vue-tsc 0、cream byte 不變。
- **Supabase migration 已套用 live**（2026-07-22 用 anon key 對 PostgREST 驗證，非文件宣稱）：
  `20260830053143_create_user_preferences.sql`（一人一列 RLS、theme check）。驗法＝`user_preferences` 查詢回
  `[]`（表存在、RLS 正常擋 anon），對照已 drop 表回 `PGRST205`（真不存在）區分兩種情況。跨裝置同步應已生效；
  migration 檔內「NOT applied」warning comment 已過期，已一併移除。
- **兩個小尾巴**：① toggle 中文標籤現為「暖墨」（ink-noir 遺留），深墨綠主題**中文名待正名**（品味題）。
  ② 深區 class 接在**當前佈局**上——佈局 from scratch 後會隨頁面重做而演變，但 token／toggle／migration 是留用資產。
- **實機截圖未完成**（Playwright 分頁反覆被關），但落地值＝Eason 看過選定的 runtime demo（偏黑深墨綠）＋WCAG＋
  build 綠，信度足；Eason 可 `localhost:5173`→我的→外觀→暖墨 自驗。

### 首頁光（backlog，未落地）

- 舊「天頂光暈」核心光帶做不到位（手法先天弱：漂浮無錨點＋WCAG 壓到 alpha 0.03–0.1）。三方向 demo 後 **Eason
  拍板「純星夜」**：拿掉 `--scene-core-*`、星塵密度各時段重給（深夜星滿／白天星稀）表達時段，不靠光。**未落地**，
  之後改 `main.css` scene tokens ＋ `NeveSceneHeader.vue`。

### 佈局 from scratch project：⓪➊ 拍板完成（同日延續，另一對話開工）

- **方向**：Eason 提出「首頁可垂直滑動、滑到底變場景轉換進試煉」的構想，具體化為**墨色垂直世界**
  ——可垂直滑動的沉浸首頁樞紐，取代底部 tab 為主的 SaaS 卡片牆。空間語意固定：上＝沉澱回望
  （棋誌）、中＝當下（對局／首頁落點）、下＝深處挑戰（試煉）。範圍只換首頁樞紐＋跨場景轉場，
  功能頁本身維持正常頁面不整頁沉浸化。逃生艙（不迷路的保底導覽）選融入式常駐導覽，非點開才現的羅盤。
- **技術驗證**：Eason 擔心純 CSS 效果有限——demo 證實不需要 WebGL，Canvas 星塵＋CSS 3D＋
  scroll-driven 動效即可做出空間感與慣性視差。
- **迭代歷程（教訓：加法不等於加分）**：拋棄式 demo（`design/demos/layout-vertical-world.html`）
  兩輪大改＋一輪否決——① 右側導覽從圓點升級成「棋座標軸」（數字 rank）與「深度計」（連續指針）
  兩個新方向，Eason 實測後判「都很醜，比原本圓點更差」；② 改成重用每層本來就有的 glyph（書／
  學士帽／棋盤格／時鐘／拱門）縮小當導覽 icon、維持簡約，Eason 拍板「先這樣吧」。滑動吸附
  跨兩層的手感問題桌機測不出結論（滑鼠/觸控板跟 iPhone 觸控物理不同），留待 ➌ 真機驗證。
- **DESIGN.md 落地**：決策寫入 `design/gambit-design-system/navigation-vertical-world.md`（不建
  獨立 root DESIGN.md，避免與既有 SoT 分裂）；README.md 導覽段補註記「Phase 3 B redesign in
  progress」，現行 bottom-tab 描述仍屬實未改。
- **➌ 真開發未開始**：待 IA 全盤點（五層是否為導覽全集）＋ 補 44px 觸控命中區 ＋ focus-visible
  ring，細節見 DESIGN.md「已知待驗證」節。
- **不變約束**：iPhone 單手可用、觸控 ≥44px、a11y、深墨綠+cream 雙主題、Gambit 視覺 SoT（Wood12 盤、
  Neve 人格、西洋棋用語）。深墨綠色票＝資產。

---

## 2026-07-20 iPhone 複驗回合（三真 bug 修復＋待回報項清空）

Eason 用 iPhone 走完 4 批複驗清單逐項回報，逐一分流：多數 OK；三項是真 bug，已修＋驗證；兩項澄清為
設計本來如此（清單描述過期，非退步）；一項 backlog。**已 push**（`a804adc`，2026-07-22 核對 origin/main 確認）。

- **PgnViewer（棋憶回放）座標終於對齊木框**（待實機指認項終於複現，真 bug）：根因＝
  `@lichess-org/pgn-viewer` 用 snabbdom `patch()` 掛載，會把傳進去的 DOM 節點整個**替換**成它自己蓋的新節點
  （remove+insert，不是就地寫入）——Vue 的 `ref` 綁的是原本那個被丟棄的節點，座標讀取一直讀到孤兒節點、
  回傳空陣列。修法＝`pgn-viewer.vue` 改用 `frameRef`（外層永不被替換的 wrapper）取代 `containerRef` 做
  幾何量測與 `:deep()` CSS 錨點；關閉原生 chessground 座標（`coordinates:false`）、自繪 rank/file 標籤到
  木框上，跟試煉/課程/對局統一（不再是 lichess 風格印在格內角）；`.lpv__board` 補 12px padding 讓標籤有地方
  站；`board-theme.css` 移除變成死碼的原生座標樣式區塊。黑方/白方 orientation 皆已 Playwright 實測正確翻轉。
- **課程「控制中心」d4/e4 內容矛盾**：第一個互動步的 `text`／`hint` 都寫「e4/d4 這類中心格」暗示兩者等價，
  但 `expectedMove` 只認 e4（d4 只觸發 softReject 溫和帶回，不算過關），跟 `objectives` 早就寫的
  「練習用 e4」矛盾。改法＝`text`／`hint` 收斂成明確指向 e4，不再暗示 d4 同樣算完成。
- **概念地圖「未學」coin 改虛線描邊**：原本刻意做成幾乎看不見的淡環（安靜預設），但 Eason 反饋認不出第三階；
  出 3 個方案 demo 拍板選虛線描邊（A），語意直接、跟另兩階同量級但不搶色。
- **釐清非 bug（清單描述過期，不是退步）**：試煉「沒有 LOG」——現在是刻意只顯示最近一次結果、不累積
  （避免清單把底部 CTA 推到手機網址列下面），清單項目寫的是改版前的舊行為。
- **backlog（Eason 拍板先不動）**：epiphany 棋誌文案「太 AI 太假」——六個模板都用同一種「我沒做 X，你卻/仍 Y」
  否定式排比骨架，加上「這不容易」「是你掙來的」偏評價語，違反 Neve「不輕易讚美」人格規則；之後再處理
  （見待辦④）。
- 驗證足跡：vitest 907/907（含一次疑似快取假紅、單獨重跑即綠，同 technical-preferences 已知模式）、
  vue-tsc 0、PgnViewer 座標＋coin 樣態均 Playwright 實截圖確認（桌機/手機雙寬）。

## 2026-07-14（家用機）收線紀錄

- **D3 招呼框銜接修復**（`241e4ea`）：iPhone 反饋「漸層切割感明顯」＝banding；三方向 demo 盲選拍板 D3
  ＝色溫過渡壓縮前 40%、其餘 sky-b 實色、底部硬切＋1px inset 細影，結構上無長漸層段。基準圖重生
  home×2＋play×2/concepts（stale 修正）。
- **開局面板閃現修復**（`1f8ac2d`）：Eason 反饋開新對局「棋盤先出、下面 block 晚出且閃現」。根因＝
  PlayView onMounted 先 await engine.init()（Stockfish 握手）才撥 phase 離開 SETUP，面板 v-if 綁 phase
  被卡 ~183ms 後無過渡蹦出。修法＝開局邏輯移到握手前（面板與棋盤同幀），握手完輪 AI 才補 requestAiMove()
  （既有 no-op guard，不動狀態機）。插樁實測 gap 183ms→0ms。
- **以上皆已 push**（`8c3b41a`＋教訓文件 `4823805`）；push 途中三連撞 vitest 假紅，根因＝prepush hook 是
  PreToolUse（指令執行前先跑），「mv 快取+push 同一條指令」無效——處方已補進 technical-preferences。
- **⚠️ material 撞題事故與裁決**：家用機 07-12 晚依當日三題拍板（offense／平行欄位／規則層審查）把
  material **完整實作**（6 條件 selector＋37 樣本抽查 0 誤收＋逼和排除——與 spec 條件 9 獨立收斂），
  但未 push；公司機 07-13 不知情之下重跑設計、產出更嚴的 11 條件 Accepted spec（D1–D6 拍板）。
  **07-14 Eason 裁決：spec 為準；v0 實作停車到 branch `material-v1-parked`**（含測試/抽樣工具/樣本集，
  正式版照 spec 施工時拆件用、上線後刪分支）。**教訓：跨機開工前先 `git fetch` 看對方 session 的
  active.md；未 push 的施工要在 active.md 標記「in-flight」。**
- 附帶：判斷場完成留白/slideshow 門等第二批已於 07-12 上線（`bed83ae`），公司機 07-13 的 907 綠已含之。

## 2026-07-13（公司電腦）本日產出（已 push，`4de2633`…`42a4791`）

- **signpost material 概念擴充設計案 → Accepted**（`6509da5` 產出、`6d44489` 拍板）＝
  `design/quick-specs/signpost-material-expansion.md`。18-agent workflow（5 盤點→4 提案→8 對抗審查→綜合）。
  路線＝「無守衛之子」chess.js 可證明子集 v1（零引擎呼叫、零 schema 侵入；MultiPV 補算＝v2 條件路徑）。
  D1–D6 全數照推薦（D2 推翻率門檻 5%、D4 召回 <1 次/5 局）。
- **文件現實對帳 backfill**（`a83d4e7`，68 檔 105 筆）：全 repo epic/story/ADR/GDD/spec 狀態宣稱對齊上線現實，
  全部低報回填、零高報；69-agent 審計＋逐筆核證＋fresh-context 驗收 PASS；4 筆 ambiguous 同日裁決施行。
- **epics/index 彙總表重算**（`4de2633`）：18 epics／87 stories／113 TR-IDs／16 ADRs，補漏列 5 epic＋主表 4 格誤植。
- **vitest 假紅根治**：`.vite` dep-optimizer 快取損毀型假紅（91 檔全掛、重跑不會好）＝搬走快取重建即綠；
  處方入 technical-preferences、`maxWorkers: 4` 入 vitest.config（治另一種 timeout 間歇紅）。
- **precommit-review deep 過**（1 major 修＋2 minor 入 backlog）；環境順修＝`precommit-review.js` CRLF→LF、
  executor role 加「禁止再委派」鐵則。

## 現況（產品全線可用；2026-07-10）

- **核心動線**：對局 → 賽後檢討（棋憶）→ 課程 / 試煉 / 深化（判斷場），Google OAuth + 跨裝置同步，guest local-first。
- **測試**：vitest 907 綠（2026-07-13 實跑）、vue-tsc 0、axe a11y 綠、E2E CI 等效全綠（總數以實跑為準，勿照抄）。
  **視覺回歸守門**（`tests/e2e/visual-regression.spec.ts`）：每路由結構不變量（橫向溢出／var() 色票變純黑／
  非方棋盤／JS 例外）＝CI 硬閘、決定性；像素回歸 `toHaveScreenshot`＝本機 push 前跑（基準圖 chromium-win32、
  依平台而異故 CI skip）。改 UI 後基準圖需 `--update-snapshots` 重生並目視確認。
- **7edc660（2026-07-03 全面體檢，94 檔）已 push**：12 維度審查 41 findings 修復（棋誌 settle 接線、離線佇列
  completedAt 淘汰、賽後引擎 lowerbound/spawn、首屏 -207KB、a11y/設計系統批、文件對齊 ×7）＋七項拍板
  （chess-board 拆分 606→474+5 composables、journal 搬家 modules/+ADR-0015、data-sync 解耦 syncVersion、
  axe E2E 真實化、Actions pin SHA、RLS WITH CHECK + DROP 兩表 migration）＋ Neve 頭像接入、判斷場 stale
  bounds、/play 直連彈回、深化 mate 換盤 h1 角、死常數清理+CLASSIFIER_SIGNALS 接線。細節＝git log + ADR-0015。
- **Supabase 兩 migration 已套 live（2026-07-10，Eason 於 Dashboard SQL editor 手動跑）**：RLS 顯式
  WITH CHECK＋DROP `skill_scores`/`lesson_side_learned`。PostgREST 已驗：兩表回 PGRST205（確實消失）、
  餘 7 表 RLS 正常擋 anon。WITH CHECK 行為中立、僅間接驗證；要鐵證在 SQL editor 查
  `pg_policies` 的 `with_check is not null`（7 行全 true 即過）。
- **2026-07-10 四磚（已 push 上線 `a80fc9e`）**：
  ① **氛圍首頁 IA-A**：`NeveSceneHeader` 四時段天色（night/morning/afternoon/evening，`timeBucketForHour` 純函式）
  ＋緩亮 620ms（唯一允許超過 300ms 的氛圍例外）＋全站 `journey` 路由轉場（App.vue Transition out-in 200ms）；
  h1 focus 因 out-in 時序改掛 `@after-enter`（router afterEach 保留管首次載入）。
  ② **PWA**：`vite-plugin-pwa` autoUpdate＋**ADR-0016**（precache app shell 73 項/2.6MB；stockfish/fonts 排除
  precache 走 runtime CacheFirst；Supabase 永不快取）。bash 跑帶 base 的 build 要 `MSYS_NO_PATHCONV=1`
  （MSYS 會把 `/gambit/` 改寫成 Windows 路徑、silent 壞 base）。
  ③ **mate 深化磚**：沉默關文案去洩題；判斷場 3 盤（悶殺 Nf7#／雙城堡樓梯 Rb8#／底線假殺 decoy Rd8+→Rxd8），
  全過 chess.js 窮舉唯一性＋3-lens 對抗棋理審查＋uniqueness spike 3/3；Qg3 逼和特判（`trapFeedback` 資料驅動，
  LessonStep 新選配欄位）。
  ④ **棋憶 signpost→判斷場接真實對局 v1**（mate-only）：review COMPLETE 時 `selectMissedMates` 擷取
  （**關鍵語意：classifier 的 mate 訊號＝「放任被將死」，missed-mate＝新偵測器，勿混用**）→
  `recognition-source` store（localStorage、冪等、consumed FIFO 300、只留最近 3 局）→ 棋憶 signpost 卡 →
  `/learn/concept/mate?source=recognition` 動態組全 real 判斷場。**擷取硬閘（precommit-review critical 修復）：
  只收 `evalMate===1` 且 chess.js 窮舉「恰好一個殺著、且＝引擎手」的局面**——否則「一步將死?」的 prompt 會對
  二步殺說謊、多殺著局面會把玩家的真殺著誤判 missed。v1 守衛：white-only（黑方翻盤+tap 座標未驗）、跳過升變
  殺著；升級路徑=黑方 orientation、material 概念、跨裝置同步走 journal/data-sync。
  ⑤ **Neve 頭像**：共用 `NeveAvatar`（ui/gambit/）24→32、28→36px，深底 ring+提亮，單次進場動效；
  persona-neve.md 已補頭像視覺規範。
  驗證足跡：vitest 898/898、vue-tsc 0、E2E CI 等效 96 綠、視覺結構不變量全綠、7 項中央驗證 findings＋
  precommit-review deep 11 confirmed（1C/2M/8m）修 10——1 項不修（HomeView 淡入未抽 composable＝美化債）。
  已知 flaky：全量 vitest 在重負載（VSCode 重建索引）下 auth-guard timeout 與 opening-lookup 20ms 效能斷言
  會間歇紅，隔離單跑全綠；`--maxWorkers=4` 降競爭即 898 全綠。
- **視覺回歸 spec 已固定時鐘 15:00**（首頁天色隨時段變，不固定像素基準不決定性）；4 張基準圖重生已目視
  （desktop/mobile-home、mobile-lesson、mobile-concept-deepen）。已知 pre-existing advisory：/play 像素
  間歇 0.47 漂移＝board-fit settle race，非本輪造成。
- **行為變更注意**：Home mount / 對局終局現在會跑 `journal.evaluate()`——**全新玩家首次進站即有 onset 開場
  條目**（首頁 peek 顯示 1 筆是設計行為，對應 E2E 斷言已改）。
- **已完成里程碑**（細節在 git）：試煉道場 #19、學習迴圈 #20、課程四階 21 課、UI Redesign Phase 0–4、
  Google OAuth、訪客 local-first+續玩、棋誌 Phase 1、棋憶 #22 全 Done、判斷場 MINIMAL、深化四磚。

---

## 待辦

### ① iPhone 實機複驗（累積四批，deploy 後用無痕分頁）

- **7-10 批（四磚）複驗進度**：✅ 頭像；✅ mate 判斷場（「完成彈窗太快」已修＝留白 1.4s）；✅ signpost
  全流程；⏳ **氛圍首頁 D3 版已上線可測**（V3 漸層被反饋 banding 後重做為 D3 純深底，2026-07-14 已 push）；
  ✅ PWA 加到主畫面＋離線＋autoUpdate 更新（2026-07-22 複驗 OK）；✅ 順驗：開新對局棋盤與下方面板同幀出現
  （2026-07-22 複驗 OK）。
- **7-03 批**：✅ Neve 頭像三處觀感（課程/判斷場 24px、棋憶 28px，2026-07-22 複驗 OK）；✅ 判斷場第 3 盤裸點擊＋
  真手指滑動（2026-07-20 複驗 OK）；⏳ 深化 mate 新盤（h1 角 Qg2#）手感；redesign 三項＝✅ #6 keySquare 高亮環+
  脈動、✅ #9 概念地圖三階 coin（2026-07-20 認不出第三階→改虛線描邊已修，見上方 07-20 節）、✅ #11 課程氣泡
  font-lesson（皆 2026-07-20 複驗 OK）。
- ✅ **6-29 批全數結案（2026-07-20 複驗）**：#2 誘餌盤互動 OK；#10 棋盤跑版（含試煉）OK；#7 d4 軟引導——
  清單描述有誤（功能只在課程「控制中心」，不在開新對局），順帶抓到內容矛盾已修（見上方 07-20 節）；
  演示節奏 OK；epiphany 鉤子實際觸發＋棋誌顯示 OK（文案語氣另立 backlog，見待辦④）；深化 A3 彈窗 OK。
- ✅ **更早批全數結案（2026-07-20 複驗）**：棋憶賽後 UX 批（`e11d3c6`：失誤動畫節奏 OK、重開同盤 cache
  命中 OK）；B5 試煉互動（log 累積——清單描述過期，現在刻意單筆不累積，非 bug；答錯滑回 OK；揭曉箭頭 OK）；
  逐手 PgnViewer「棋盤外藍框 + 座標小偏」——實機終於複現，是真 bug，根因與修法見上方 07-20 節。

### ② 待 Eason 拍板

- ✅ **signpost material 設計案 D1–D6**（2026-07-13 拍板＝全數照推薦，含 D2 推翻率 5%、D4 召回門檻
  <1 次/5 局）：定案記錄在 `design/quick-specs/signpost-material-expansion.md` §0/§5。施工前置＝D6 離線量測。
- ✅ **docs 對帳 4 筆 ambiguous**（2026-07-13 拍板＝照建議施行）：① visual-identity EPIC → Complete＋
  被 Wood12+Gioco 承接註記 ② ADR-0012 → Accepted（觸發條件早已跨過，回填理由在檔內）③ ADR-0007
  排程措辭更新（真機量測 outstanding as of 2026-07-13）④ vision「已規劃」→「已上線的概念深化頁（判斷場）」。
- ✅ **失誤 slideshow 入口**（2026-07-11 拍板＝單一安靜入口）：新 `MomentSlideshowDoor`（cream 底
  Neve 卡，走勢圖下方、有重點步才現身）→ openMoment(0) 進 slideshow。與點圖跳手互補
  （工具 vs Neve 陪看），不恢復整排 list。
- ✅ 已施工（2026-07-11 第二批，細節在 git）：重置對局記錄（拍板 scope＝只清對局列表；ProfileView
  「資料」區＋二次確認 dialog，登入清 Supabase game_sessions＋本機、訪客清本機；棋誌/棋憶/進度不動）、
  走勢圖點圖跳手（EvalShapeChart plyAtClientX，MomentList 已刪）、控制中心 tile line-clamp-2
  （真身在 ConceptMapView）、賽後 Neve loading（查明既有實作，免改）、判斷場完成彈窗留白
  （RECOGNITION_COMPLETE_LINGER_MS=1400，iPhone 複驗反饋）、招呼框 V3 接天空
  （結構性 full-bleed：HomeView root 拆兩層，nav-join #183e35 三段漸層淡出到 cream，vignette 移除）。

### ③ 深化頁後續磚

- ✅ **階段二 signpost v1 已施工**（2026-07-10，見現況四磚④）：mate-only、localStorage、無 decoy。
  ✅ **黑方擷取已解鎖**（2026-07-11）：Playwright 實測黑方翻盤＋tap 座標端到端可用（playerColor 一路傳到
  chessground orientation）、evalMate＝side-to-move 慣例（ADR-0007）黑方不需反號 → 移除 MemoryView
  white-only 守衛。後續磚：material 概念擴充、動態 decoy 造題（工時未估）、unaided/epiphany 門檻鬆緊
  （沿用既有，未調）。
- ✅ **mate 沉默關三項已施工**（2026-07-10，見現況四磚③）：去洩題文案／判斷場（比照 fork）／Qg3 逼和特判。
- **擴池＝HOLD（2026-07-11 Eason 拍板）**：不再手工造罐頭 variant；深化題真正歸宿=signpost
  （mate 已通、黑方已解鎖）。material 擴充**設計案已 Accepted（2026-07-13，D1–D6 照推薦）**；
  施工前置＝D6 離線量測（推翻率 ≤5% 才開旗），之後 selector→store 泛化→signpost 接線（估 3–4 sessions）。
  **量測腳本已就緒但樣本歸零**（scratchpad `measure-missed-material.mjs`，fixtures 8/8＋engine smoke 過；
  anon key＋session 驗證 auth 正常，但 `game_sessions` 0 筆——「重置對局」實機驗收把雲端清空了）。
  **續點（Eason 2026-07-13 拍板＝選路 1）**：登入態自然累積新對局（≥10 局）、實際玩過給 feedback 後
  重跑腳本出命中率／推翻率；session token 在 scratchpad `sb-session.json`（過期就請 Eason 重貼）。

### ④ 未來獨立任務

- ✅ **Neve 頭像 presence**（2026-07-10 已施工，見現況四磚⑤）：實機辨識度（尤其深青底）待 7-10 批複驗；
  頭像素材位置與 ffmpeg 重產指令已記入 `design/gambit-design-system/persona-neve.md` 頭像規範節。
- **Phase C+/D**：捉雙/牽制賽後偵測（需精準度實測）；Claude API 動態講解/BYOK（最後）。
- ✅ **PWA 已實作**（2026-07-10，autoUpdate＋ADR-0016，見現況四磚②）：首次 deploy 後所有訪客開始吃 SW；
  之後每次 deploy 由 autoUpdate 自癒，「舊畫面＝裝置快取」的排查註記仍適用於未升級的舊訪客一次。
- ⏳ **死碼清理 + 效能斷言修正**（2026-07-22 施工完成、**尚未 commit**——改動仍在該對話的 working tree，
  push 前需自行 commit＋過 review）：game-history `expandedRowId`/`setExpandedRow`/展開面板已被
  row-tap-to-navigate 取代，一併清 store（`game-history.ts`）、元件（`history-row.vue` 展開面板＋prop）、
  消費端（`HistoryView.vue`）、孤立測試（store 4 個 + view AC-12 1 個）；`opening-lookup` wall-clock 斷言
  （違反 coding-standards「no time-dependent assertions」）改成正確性斷言（不再測 ms，效能改註解說明已手動
  Chrome DevTools 驗證）；`auth-guard` timeout 查過＝非硬編時間斷言、是重負載下 vitest 逾時保護，非違規，
  無需修（`--maxWorkers=4` 仍是既有緩解）。清理後 working tree 實測 vitest 911/911、vue-tsc 0
  （911 為清理後數字；origin/main 的 tree 仍是清理前狀態）。
- ✅ **第二主題（深墨綠）已完成並 push**（見上方 07-21 節）：舊待辦記的方向是「noir/Dusk」暖黑探索，
  最終拍板落地的是深墨綠，這條過期待辦移除。
- **epiphany 棋誌文案語氣待收斂**（2026-07-20 iPhone 複驗反饋「太 AI 太假」，Eason 拍板先放 backlog）：
  六個模板（`src/data/journal-templates/epiphany.ts`）同一種「我沒做 X，你卻/仍 Y」否定式排比骨架，
  加上「這不容易」「是你掙來的」偏評價語，違反 Neve「不輕易讚美」人格規則（見
  `design/gambit-design-system/persona-neve.md`）。處理時走文案語氣護欄的 3-lens 對抗式審查
  （見 CLAUDE.md「文案語氣護欄」）。

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
- **Phase 2 — 課程長在你自己的棋上**：✅ 棋憶全線 ship；✅ 深化頁重設計（判斷場 MINIMAL + 四磚）ship；
  ✅ 階段二 signpost v1 施工完（判斷場接真實對局，mate-only）。🚧 剩 iPhone 複驗定案（見待辦 ①③）。
- **Phase 3 — 沉浸感 + 旅程 IA**：🚧 A 路線（氛圍首頁＋全站轉場）已施工待複驗；B 路線（tab→路/地圖
  IA 重構）未動、待 A 驗證後評估。
- **商業模式**（訂閱/付費深度/BYOK）＝最後。

**關鍵架構事實**（細節在 ADR/git）：ADR-0013（journal）+ ADR-0014（memory）+ ADR-0015（lib/modules 判準）
皆 Accepted；Supabase 現 7 張 live 表（2026-07-10 起，兩張 unused 已 drop）。
