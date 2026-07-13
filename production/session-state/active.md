<!-- STATUS -->
Epic: 差異化重構
Feature: Phase 2 收尾 + Phase 3 A 路線（氛圍首頁）
Task: signpost material 設計案 ✅ Accepted（D1–D6 照推薦拍板 2026-07-13）＋文件現實對帳 backfill 105 筆
＋4 筆 ambiguous 裁決施行＋epics/index 重算，未 push。下一步＝D6 離線量測腳本（≤5% 才開旗施工）；
iPhone 實機四批 Eason 拍板延後一次測。
<!-- /STATUS -->

> **交接快照**：只留現況 + 待辦 + 未固化的 in-flight 決策。長期鐵則/技術參考在 CLAUDE.md 體系（見「接手必讀」），不複述；**已完成施工細節在 git**。
> **差異化北極星 = `production/gambit-differentiation-vision.md`**——提任何功能/重構/UI 前**先讀**。

---

## 2026-07-13（公司電腦）本日產出（未 push）

- **signpost material 概念擴充設計案 DRAFT**（`6509da5`）＝`design/quick-specs/signpost-material-expansion.md`。
  18-agent workflow（5 盤點→4 提案→8 對抗審查→綜合）。建議路線＝「無守衛之子」chess.js 可證明子集 v1
  （零引擎呼叫、零 schema 侵入；MultiPV 補算降為 v2 條件路徑）。**待 Eason 拍板 §5 的 D1–D6**，拍板前不施工。
- **文件現實對帳 backfill**（`a83d4e7`，68 檔 105 筆）：全 repo epic/story/ADR/GDD/spec 狀態宣稱對齊上線現實，
  全部低報回填、零高報；69-agent 審計＋逐筆核證＋fresh-context 驗收 PASS。**4 筆 ambiguous 待拍板**（見待辦②）。
- **epics/index 彙總表重算**（`4de2633`）：18 epics／87 stories／113 TR-IDs／16 ADRs，補漏列 5 epic＋主表 4 格誤植。

## 現況（產品全線可用；2026-07-10）

- **核心動線**：對局 → 賽後檢討（棋憶）→ 課程 / 試煉 / 深化（判斷場），Google OAuth + 跨裝置同步，guest local-first。
- **測試**：vitest 893 綠、vue-tsc 0、axe a11y 綠、E2E CI 等效全綠（總數以實跑為準，勿照抄）。
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
- **2026-07-10 四磚（工作樹已施工＋全驗證，待 commit）**：
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

- **7-10 批（四磚）複驗進度（2026-07-11 Eason 回報）**：✅ 頭像；✅ mate 判斷場（節奏反饋「完成彈窗
  太快」已修＝留白 1.4s）；✅ signpost 全流程；⏳ 氛圍首頁——**等 V3 接天空 push 上線後再測**（原版
  已被反饋「招呼框太突兀」並重做）；⏳ PWA 加到主畫面＋離線＋autoUpdate 更新（未回報）。
- **7-03 批**：Neve 頭像三處觀感（課程/判斷場 24px、棋憶 28px）；判斷場第 3 盤裸點擊＋真手指滑動；深化
  mate 新盤（h1 角 Qg2#）手感；redesign 三項＝#6 keySquare 高亮環+脈動、#9 概念地圖三階 coin、#11 課程
  氣泡 font-lesson。
- **6-29 批**：#2 誘餌盤互動、#10 棋盤跑版（含試煉）、#7 d4 軟引導、演示節奏、**epiphany 鉤子實際觸發＋
  棋誌顯示**、深化 A3 彈窗。
- **更早**：棋憶賽後 UX 批（`e11d3c6`：失誤動畫節奏、重開同盤 cache 命中）；B5 試煉互動（log 累積、答錯
  滑回、揭曉箭頭）；逐手 PgnViewer「棋盤外藍框 + 座標小偏」（本機渲染不到、待實機指認）。

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
  施工前置＝D6 離線量測腳本（Supabase 樣本＋node 直驅 Stockfish depth16+，推翻率 ≤5% 才開旗），
  之後 selector→store 泛化→signpost 接線（工時估 3–4 sessions，見 spec §6.2）。

### ④ 未來獨立任務

- ✅ **Neve 頭像 presence**（2026-07-10 已施工，見現況四磚⑤）：實機辨識度（尤其深青底）待 7-10 批複驗；
  頭像素材位置與 ffmpeg 重產指令已記入 `design/gambit-design-system/persona-neve.md` 頭像規範節。
- **Phase C+/D**：捉雙/牽制賽後偵測（需精準度實測）；Claude API 動態講解/BYOK（最後）。
- ✅ **PWA 已實作**（2026-07-10，autoUpdate＋ADR-0016，見現況四磚②）：首次 deploy 後所有訪客開始吃 SW；
  之後每次 deploy 由 autoUpdate 自癒，「舊畫面＝裝置快取」的排查註記仍適用於未升級的舊訪客一次。
- **死碼清理**（precommit-review 2026-07-13 點名）：game-history `setExpandedRow`/expanded panel 已被
  row-tap-to-navigate 取代、只剩孤立 unit test 在養（story-003 有記載）——獨立小掃除。
- **opening-lookup 20ms wall-clock 斷言違反 determinism 標準**（coding-standards「no time-dependent
  assertions」）：改 op-count bound 或 fake timers；auth-guard timeout 斷言同查。maxWorkers:4 只是降機率。
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
- **Phase 2 — 課程長在你自己的棋上**：✅ 棋憶全線 ship；✅ 深化頁重設計（判斷場 MINIMAL + 四磚）ship；
  ✅ 階段二 signpost v1 施工完（判斷場接真實對局，mate-only）。🚧 剩 iPhone 複驗定案（見待辦 ①③）。
- **Phase 3 — 沉浸感 + 旅程 IA**：🚧 A 路線（氛圍首頁＋全站轉場）已施工待複驗；B 路線（tab→路/地圖
  IA 重構）未動、待 A 驗證後評估。
- **商業模式**（訂閱/付費深度/BYOK）＝最後。

**關鍵架構事實**（細節在 ADR/git）：ADR-0013（journal）+ ADR-0014（memory）+ ADR-0015（lib/modules 判準）
皆 Accepted；Supabase 現 7 張 live 表（2026-07-10 起，兩張 unused 已 drop）。
