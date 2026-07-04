<!-- STATUS -->
Epic: 差異化重構
Feature: 全專案體檢修復 + 概念深化頁收尾（Phase 2）
Task: 7-03 全面 review + 全部拍板事項 ✅ 修畢；precommit deep review 12 findings 亦全修（aria-live 常駐化、solace 時序、COACH_AVATAR 烘 base、5.3MB 原圖出 public…）。vitest 868 綠 / vue-tsc 0 / axe 綠。**待 commit+push**（訊息已擬、等 Eason 確認）→ iPhone 複驗。
<!-- /STATUS -->

> **交接快照**：只留現況 + 待辦 + 未固化的 in-flight 決策。長期鐵則/技術參考在 CLAUDE.md 體系（見「接手必讀」），不複述；**已完成施工細節在 git**。
> **差異化北極星 = `production/gambit-differentiation-vision.md`**——提任何功能/重構/UI 前**先讀**。

---

## 2026-07-03 全面體檢（12 維度審查 + 修復 ✅，未 commit）

三個 workflow（12 維度審查 45→對抗驗證後 33 條確認、盲點補掃 +8 條、8 批並行修復+fresh-context 逐批驗收）。**基準 826 綠 → 現 864 綠（+38 測試，含拍板批）、vue-tsc 0、build 乾淨、axe a11y 綠、UI Playwright 驗過（mobile viewport，含實走 fork 深化進判斷場）**。施工細節在 git diff，重點：

- **[critical] 棋誌管線接線**：`evaluate()` 原本全 app 只有深化 unaided 一處呼叫（onset/arrival/solace 永不出現）→ HomeView mount + game-lifecycle 終局補呼叫。併發安全已獨立驗證（持久層 sourceRefId 判重 + Supabase UNIQUE，不需 mutex）。
- **資料遺失**：離線佇列滿 50 筆「刪最舊」實為 UUID 字典序刪隨機一局 → 改依 completedAt。
- **賽後引擎**：UCI lowerbound/upperbound 未過濾（污染最大失誤）+ init() 併發 spawn 洩漏 Worker → 皆修+測試。
- **首屏 -207KB（根修）**：vite 8 rolldown 的 manualChunks shim 會把 @vue runtime 誤併進 chess-board 命名 chunk（sourcemap 實證）→ 移除 manualChunks 只留 chess-openings 一條；chess.js/棋盤庫不再進 modulepreload。
- **設計系統/a11y 批**：#dc2626→danger token、觸控目標 36→44px（LessonPlayer/RecognitionGate/dialog ×5）、aria-label「王車易位」→「王城堡易位」、鍵盤導覽播報英文→繁中（后/城堡/騎士…）、disabled 盤退出 tab 順序、非 active carousel 盤 inert、RecognitionGate 回饋 aria-live、進度條 clamp+scaleX+progressbar ARIA、MemoryReplay matchMedia 洩漏、redesign diff 裡指示行 ink-faint 13px 退步改回 ink-muted 16px。
- **lesson-progress 根因修**：completedCount 只計現存課程 id（殘留 id 不再出現 20/18）。
- **文件對齊現實 ×7**：README（PWA 假宣稱/Node 26）、設計系統 README（Beth Harmon→Neve、Tailwind v3→v4）、technical-preferences（「No ADRs yet」→列出實有的 adr-0001~0014）、directory-structure（引擎範本→真實結構）、a11y E2E 空殼與 story-005 AC-1 誠實標注、active.md 兩處過時。
- 安全面審查乾淨：9 表 RLS 全 PASS、onConflict 7/7 相符、無金鑰洩漏、CSP 已設。`.gitignore` 加 `.playwright-mcp/`。

**拍板結果（Eason 2026-07-03）＋執行狀態：**
- **已執行 ✅**（vitest 864 綠、vue-tsc 0、axe 綠）：
  - #5 chess-board god-component 拆分：606→474 行薄殼 + 5 個新 composables（use-board-geometry/check-ring/castle-hints/promotion/coordinates），props/emits/expose 逐位元不變；**順手修掉 axe 首跑抓到的兩條 critical**（aria-required-children/parent——grid role 改掛專用 pointer-events-none overlay，row→gridcell 結構合規）。
  - #6 lib/ vs modules/ 統一：src/lib/journal/ 全數搬 src/modules/journal/、persona-lint 共用核心抽 src/lib/persona-lint.ts（詞表單一定義）、**ADR-0015** 定判準（「刪掉其他所有 feature 仍成立＝lib/」）。
  - #7 循環依賴解耦：data-sync 加 `syncVersion` 計數器成純葉節點，game-history 靜態 import + `watch({flush:'sync'})`，雙側動態 import 移除。
  - #8 金字三處：兩個 11px 徽章→`text-ink-muted`、MomentCard→`--color-hint-dark`（hint 語意色，不受 gold large-only 限制）。
  - #10 a11y E2E 真實化：`@axe-core/playwright@4.12.1` 已裝、spec 真斷言（掃 /learn/pawn-basics、exclude .cg-wrap vendor 層）、**首跑即抓到 ARIA grid 兩條 critical → 已修 → 綠**。
  - #11 加固：兩份 workflow 全部 action pin 40 字 SHA；`20260830041917_add_explicit_rls_with_check.sql`（9 表）。
  - #12 清表：`20260830053142_drop_unused_tables.sql`（skill_scores + lesson_side_learned）。**兩個 migration 皆未套用 live**——Eason 手動 Dashboard SQL 跑，DROP 會永久刪該兩表資料。
  - #1 game-export、#4 開局知識卡＝**待接 UI 的功能，勿刪**——已寫進 technical-preferences「Deferred Cleanups」。
- **Neve 頭像接入 ✅（Eason 2026-07-03 交辦）**：三處文字徽章（LessonPlayer/RecognitionGate 24px、NeveCard 28px）換 `<img>`；圖走 `COACH_AVATAR` 常數（types/lesson.ts，單點換圖）+ BASE_URL 前綴 + object-cover 圓裁。**效能**：原圖 1254px/1.8MB 只顯示 24–28px → ffmpeg 產 192px 徽章縮圖 `public/avatars/neve-badge.png`（~54KB），原圖保留、換 variant 只重產縮圖。三處截圖驗收 PASS（含實打一局進棋憶驗 NeveCard）、零破圖。
- **/play 直連彈回 bug ✅（截圖驗收 agent 路過抓到）**：直接 URL 進 /play → 按「開始對局」→ 被 modal-dismiss guard 誤判取消而彈回首頁（pendingGame 已被消費、isGameInProgress 要到第一步才 true）。修＝guard 改語意判準 `phase === 'SETUP'`（本 visit 從未開局）；spa-deep-link.spec.ts 加回歸測試。完整 E2E（CI 等效、chromium+webkit）24 passed / 0 failed。
- **加碼修復 ✅（UI 驗收 agent 抓到的既有潛伏 bug，非 refactor 回歸）**：判斷場 carousel 第 3 盤 **stale bounds**——chessground 建立時 memo bounds，translateX 偏移處建立的盤切 active 後點擊座標全錯、整盤點不動（實機上可能被 URL bar 收合的 resize 掩蓋）。修＝`RecognitionBoard.vue` activation watch 內 reapplyFen 後補 `window.dispatchEvent(new Event('resize'))`（chessground 自己的 bounds.clear 路徑）；已固化進 technical-preferences「viewOnly 盤」gotcha 第二層。
- **#2/#3/#9 拍板執行結果（2026-07-03 晚）**：
  - #3 ✅ sync-tuning 三死常數已刪（`UNSYNCED_QUEUE_MAX` 保留）；GDD supabase-integration 補 status note。
  - #2 ✅：`SHOW_CONCEPT_MAP`、`LESSON_TO_PUZZLE_COUNT` 已刪 + GDD learning-loop 補注。`CLASSIFIER_SIGNALS` Eason 拍板「接」→ 已接線：`classify(input, signals = CLASSIFIER_SIGNALS)` 依賴注入、兩偵測分支各自 gate，4 個新 gating 測試（停用 mate→落到 material、停用 material→靜默、空清單→全靜默、預設＝原行為）。
  - #9 ✅ 深化 mate 沉默關換盤，**兩輪**才定案：第一輪 a8 角（Kc6+Qb7#）被教學對抗審查退回——終局殺型撞 rules.ts 兩堂必修課（只查 FEN 字面重複不夠，殺型也要跨資料集掃）。定案＝**h1 角**（bKh1/wKf3/wQg8→Qg2#，全資料集 K+Q vs K 窮舉掃描唯一零使用角落；上下翻轉破壞「往上攻」圖式、比鏡像更真的遷移測試）。過全部閘門：chess.js 窮舉 28 走法唯一殺、uniqueness spike 3/3、棋理+教學雙對抗審查 PASS。驗盤方法已固化 technical-preferences（stockfish 18.0.8 sendCommand API、chess.js 窮舉、殺型跨集掃描）。
  - 審查附帶三個未來項：① mate 沉默關文案「王罩住逃生格—后貼上去」洩題傾向（舊有）② mate 第三關長期可比照 fork 升級 Recognition Gate ③ 新盤 Qg3 是緊鄰正解的**逼和陷阱**——若日後 fail feedback 想特判「這是逼和」是好教學點。

## 2026-06-25 iPhone 實機反饋（第一批已修，待 push 部署後複驗）

Eason iPhone 實測深化頁/棋憶/試煉，反饋分三批處理。**本 commit ＝第一批（清楚、零決策）：**

- **棋盤跑版**（棋憶失誤動畫 + 試煉，Eason 圖1）：root cause＝MemorySlideshow 用了 `board-fit` class 但**漏抄** `.main-wrap` 覆寫 → vue3-chessboard 撐到 700px 溢出。修法＝把覆寫**全域化**進 `board-theme.css`（`.board-fit .main-wrap`，隨 class 走、根治複發），刪 DungeonPuzzle/LessonPlayer 兩份重複。試煉本機 iPhone viewport 實證 main-wrap=344px 正方。**棋憶失誤動畫 chessground 合成事件本機測不到，待實機複驗。**
- **1-A(a)** 深化 step 加執色：LessonPlayer `turnLabel`（FEN side-to-move 推白/黑方），「輪到你了——你執X方，在棋盤上走一步」。
- **2(c)** 走勢圖加執色 chip：EvalShapeChart 加 `orientation` prop（預設 white）+「你執白/黑」dot+label，MemoryDashboard 傳 `ctx.orientation`。
- **1-C** 拿掉 epiphany inline 自誇句：移除「深化完成」彈窗內「這一輪我一句都沒提醒你」（Eason 嫌自我邀功、違 Neve 安靜人格）；**journal epiphany 記錄保留**（默默承載）。
- **型別債**（順手）：清掉 9 個既有 vue-tsc 紅（pgn-viewer/resume-game mock 型別、cross-game 死 import、vite.config manualChunks return）→ vue-tsc 現 **0 error**。

**同日晚間更新：**
- **board 跑版「修了還壞」真相＝裝置舊快取（孤兒 SW），非 code bug**：桌機 Chromium+WebKit 連舊 code 都正方無溢出、Eason 無痕分頁正常、部署站查得 0 SW/sw.js 404 → 307d2cc 一直是對的，是 Eason 裝置殘留舊 service worker 餵舊版。**清網站資料後正常**。連帶修 CLAUDE.md/technical-preferences 假的「vite-plugin-pwa 已裝」→「未實作」+ PWA 進 backlog（commit 310e507）。**測試教訓：驗剛部署的版本一律用無痕分頁，別信常駐分頁。**
- **2(b) loading 實測 <10s** ✅（Eason iPhone，比 ~20s 目標還快；品質對新手足夠、不回調）。
- **走勢圖 badge 重排（Eason 第二輪「item 4」，≠ 下方重置功能那個 item 4）✅ 本 commit push**：EvalShapeChart 移除 header 圓點 chip、「逐手覆盤」併到標題旁；「你執白/黑」改成圖內白優/黑優軸上的 jade badge（命名常數 `PLATE_W_SELF<PAD_L` 不變式）。vue-tsc 0、818 綠、五維+ponytail 過。**本機渲染不了此圖（game-store 記憶體態無法 seed、自動打局未啟動），視覺待 Eason 裝置複看（用無痕分頁）。**
- **本機互動測試解鎖**：`page.mouse.click(x,y)` 真實座標可驅動 chessground tap-to-move（已固化進 technical-preferences）；深化 unaided→epiphany 鏈已本機驗。

## 深化頁重設計拍板（2026-06-25 晚）＝「判斷場 / RecognitionGate」

Eason 對深化頁不滿（跟課程毫無二致、沒「更深一層」感）→ 跑 12-agent workflow（優化 vs 重練；brief 在 run `wf_1da48163-e57`）。

**核心洞見**：問題不在文案、在結構——深化頁進去就告訴你「這是捉雙頁、這盤有捉雙」，所以你**只練 execution（找+走已知戰術），從沒練 recognition（判斷有沒有）**。「學以致用」的客觀定義＝沒人提示時你能不能認出時機（**含認出「這裡沒有」**）。現況完全沒碰這層 → 潤色救不了。

**判決＝hybrid 分兩階段**（同一個 `RecognitionGate` 元件、換觸發源、非重做）：
- **階段一（先做）＝辨時機關**：深化第三步（沉默關）從「單盤找答案」改成「判斷場」。
- **階段二（後做，北極星歸宿）＝接棋憶 signpost**：同元件改由「你真實對局裡偵測到錯過的該概念機會」觸發。**受 `classify.ts` 只可靠分類 material+mate 限制**（fork/pin pv 不可靠 defer）→ 8 概念只覆蓋 2，須先評估擴 classifier，故排第二。

**UX 已與 Eason 走過、鎖定**（捉雙為例）：
- 三步放手：① 她指給你看 ② 她只問一句（此二步**維持單盤、沿用 LessonPlayer**；fading 結構學習科學上是對的）③ **判斷場**。
- 判斷場＝**carousel**（**3 張全尺寸盤、左右滑、不用縮圖+放大**——避開醜轉場，棋盤尺寸全程不變、只水平 slide）。**2 真 + 1 誘餌**（誘餌＝看似有戰術、對手能反駁）。
- 有捉雙→走出來；沒有→按「這裡沒有」。
- **漏看真盤**（按了「這裡沒有」但其實有）→ 判完她一句「還有一手在等你」、**不點破哪盤**（Eason 選 A）。
- **走了誘餌**→ 子滑回、**事後**Neve 解釋為何不成立（反駁理由**必須與 Stockfish PV 對得上**，否則講錯比假將殺更傷）（Eason OK）。
- **全真盤收完 + 誘餌跳過才過關**（無「完成」鈕可亂按、「跳過」不能當作弊）→ 精髓彈窗；全程未求助→棋誌 epiphany（走既有 settle 管線、不從 view 直接 append）。
- **關鍵架構**：第三步抽成獨立 `RecognitionGate.vue`、**不再 import LessonPlayer**——這是「視覺/任務跟課程拉開」與「階段二複用」的雙重關鍵。沿用全 app 棋盤主題（Wood12+Gioco、board-fit、觸控≥44px）。

**下一步（先內容、後元件）＝設計 fork 1 概念的 3 張盤**（2 真過 Stockfish 唯一解閘門、1 誘餌過反向閘門＋對抗審查），每張附 FEN/走法/Neve 文案，棋理站得住再寫元件。**棋理是這磚真風險，UI 是熟路。**

**開放問題**（workflow 列）：① 誘餌造題工時＝全案最大未知（先用 fork 單概念量測）② unaided/epiphany 在 recognition 流程下的門檻鬆緊 ③ 階段二要不要投資擴 classifier 到 fork/pin（pv 不可靠是已知難題）④ ~~既有變體池降級為真盤來源~~ **已否決**：稀疏舊變體圖案一眼可見＝退回 execution，判斷場 3 盤全做 L1 雜訊盤、不複用。

## 判斷場 MINIMAL 實作 ✅（2026-06-26，未 push）

- **棋理 3 盤過三道 gate**（fork、密度 L1 輕雜訊 ~10 子，Eason 拍板）：真A `8/7p/2r3k1/pp6/7P/5N2/P5P1/4K3` Ne5+（叉王+城堡，gap 1005cp）、真B `2q3k1/p5pp/8/3N4/8/8/P5PP/4K3` Ne7+（叉王+后，gap 703cp）、誘餌 `6k1/5ppp/8/3r4/4N3/5P2/P6P/4K3`（Nf6+ 被 gxf6 反駁、PV1=安靜步、關鍵 g7 藏進 f7/g7/h7 兵陣）。驗法＝chess.js + **node 直驅 Stockfish**（`require('stockfish')('lite-single')`+`sendCommand`+攔 `console.log`，無需 dev server，比 @spike 輕）+ 2 獨立對抗審查全清。
- **元件**：`components/lesson/RecognitionBoard.vue`（子：棋盤+演示 `playRefutation`，純 `:fen` prop driven 零 emit 副作用、reduced-motion 自動）+ `RecognitionGate.vue`（父：carousel slide + verdict 狀態機 + Neve 氣泡）。資料 `data/concept-deepening/recognition.ts`、型別 `types/recognition.ts`（real/decoy discriminated union）。
- **串接**：fork 深化改 2 步 lead-in（**刪舊 step2 沉默單盤 + variant1 雜訊變體池**，Eason 選 A——重溫終極歸宿＝接棋憶真實對局，不堆罐頭重溫盤）；`ConceptDeepenView` 兩階段（LessonPlayer step0/1 → RecognitionGate），epiphany=兩階段都 unaided。
- **redesign**（Eason「對話框很亂」→ `/redesign` H/M/L 全做）：氣泡收斂成「頂列(Neve+導航) + 主問(執色併提問『你執**白方**，這一盤有沒有捉雙？』) + 小字引導 + 鈕」單一精簡卡（內容高度、不撐滿）；intro 移進場一次性過場。本機 Playwright 截圖驗過渲染/carousel/演示/層次。
- spec §15 固化（`concept-deepening-page.md`）。**vue-tsc 0、相關 40 測試綠**（新 recognition gate 7）。

**判斷場 MINIMAL ＋ 2026-06-29 iPhone bug 批已 push**（含上方收尾項：Stockfish memory 已寫、五維+ponytail review 已過）。

## 2026-06-29 iPhone 反饋 11 項（bug＋內容批已修＋push）

Eason iPhone 實測判斷場/課程/棋憶。施工細節在 git；兩個真 bug 的 root cause 已固化進 `technical-preferences.md`「Board/chessground gotchas」：
- **#2 誘餌盤不能動（真 bug）**：chessground `viewOnly` 建立時不綁 pointer listener 且永不重綁 → `chess-board.vue` 一律 created `viewOnly:false` + `onBoardCreated` 套真實 viewOnly；carousel 切 active 後 360ms `reapplyFen` 重整 selectable。本機 Playwright 實走誘餌觸發 trap 驗證。
- **#10 棋憶破版（真 bug、全站汙染）**：lichess-pgn-viewer.css 全域 `.cg-wrap` aspect 規則汙染 vue3-chessboard（疊加 → 高度雙倍），進過棋憶後全站盤跟著壞。修＝`board-theme.css` scope `.main-wrap .cg-wrap` reset。本機 seed 局驗 312² 正方。
- **#3** 演示 stepMs 850→1300、**#4** missedHint 改對當前盤、**#7** d4 軟引導（`LessonStep.softRejects` 資料驅動 + regression test）、**#8** tab 概念→棋理／分組棋局原則→棋局概念／回X地圖一致、**#5** 拍板維持無提示。五維 APPROVE + ponytail Lean、vue-tsc 0、vitest 826。

**redesign 三項 ✅ 施工完（2026-07-03 凌晨，未 commit）**——`/redesign` 審查（H/M/L）→ Eason 拍板全做（含 L2）→ 施工＋本機 Playwright 驗證（手機+桌機 viewport 截圖）全過。改動 4 元件＋1 測試檔：
- **#6（H1+L2）**`move-annotation-display.vue`：keySquare 高亮加**同色琥珀高不透明內縮描邊環**（寬=格寬6%、fill 0.30→0.35；原半透明 tint 在木紋盤上實測完全看不見）＋進場單次雙脈動（只動 opacity、respect reduced-motion、key 改 per-square 使 resize 不重播）。scope 只 keySquare（棋憶 choreography 的 keySquare 同受益、playedMove 灰 tint 不動）。
- **#9（H2+M1+L1）**`ConceptMapView.vue`：拿掉標題旁 inline 小點（修「子…」截斷）；coin 三階進階感＝未學淡環 → 已學或已練 **jade 環** → 已學且已練 **金環+✓徽章**（金=reward 正用、✓=shape cue 解 color-only；金用量比舊版「lit 全金」反而減少）；圖例改環樣式；blurb 10→11px。測試同步改 coin-stage 標記（`concept-map-view.test.ts`）。
- **#11（H3）**`LessonPlayer.vue`：課程氣泡套判斷場層級——step 主文 `font-sans`→`font-lesson`（同時修正 SoT 偏離：設計系統本規定 lesson body 用 LXGW）；「輪到你了」行改「你執**白方**，在棋盤上走一步」13px ink-faint 小字尾、執色粗體。
- **#1（M2）**`RecognitionGate.vue`：氣泡卡原生 touch 左右滑切盤（>48px 水平且 |dx|>|dy|；手勢區不放棋盤——pointer 歸 chessground）；chevron 保留。合成 TouchEvent 本機驗過 track 正確位移。

**剩（後續）：**
1. **commit 前**：跑 `precommit-review` workflow（本輪只施工未 review）→ 修 findings → commit。vitest 826 已全綠（commit 時照規矩再跑）。
2. **redesign 遺留一小項（待拍板）**：「控制中心」標題在 tile 上截成「控…」——**pre-existing**（4 字標題＋深入 affordance 擠壓，手機桌機都有、與本次 inline 點無關）。選項：縮短 label／標題允許兩行／深入改純 icon。低優先。
3. **iPhone 複驗（併 6-29 批）**：本批＝#6 高亮環+脈動實機觀感、#9 三階 coin、#11 課程氣泡 font-lesson 觀感、#1 判斷場真手指滑手感；6-29 批＝#2 誘餌互動、#10 棋盤（含試煉、無痕分頁）、#7 走 d4 引導、演示節奏、epiphany；**逐手 PgnViewer「棋盤外藍框 + 座標小偏」**（本機 PgnViewer board 未渲染、待實機指認）。

**待 Eason 拍板（第二批，需決策，未動工）：**
- ~~**1-A 深化頁命運（最關鍵）**~~ ✅ **已拍板＝改「判斷場 / RecognitionGate」（見上方專段「深化頁重設計拍板」）**。下一步＝先設計 fork 3 盤再寫元件。
- **item 4 重置對局記錄**：原估「小修」誤判——實為跨 store 破壞性刪除（Supabase delete + localStorage + 衍生 journal/memory 資料完整性）。待 scope：只清 list？還是連 concept-progress/journal 一起重置（測試用）？guest-only local vs 含 Supabase？
- **2(e) 重點步 list 無用**：走勢圖下方一句小字+數字沒給可行動資訊。建議改「點圖轉折→跳該手」或拿掉。
- ~~**2(b) loading 太慢**~~ ✅ **已調（OQ-5 resolved 2026-06-25）**：賽後深算旋鈕下調瞄準 ~20s 總時間——
  `REVIEW_TARGET_DEPTH` 22→16、`REVIEW_MAX_MOVE_TIME_MS` 10s→4s、`REVIEW_TOTAL_TIME_BUDGET_MS` 90s→12s、
  `REVIEW_PREVIEW_MOVE_TIME_MS` 1.5s→1s（`engine-tuning.ts`）。bump `ANALYSIS_CACHE_VERSION` 1→2 使舊 depth-22
  cache 失效。同步 control-manifest/GDD/ADR-0007 status note。**真實秒數待 Eason iPhone 實測**，不夠快再砍一格。
- **2(a) loading 結合 Neve「思考中」對話框**：小工程，未動。

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

**關鍵架構事實**（細節在 ADR/git）：**ADR-0013**（journal）＋ **ADR-0014**（memory `memory_summaries`）皆 Accepted、migration 已套 live + RLS PASS；Supabase 現 **9 張 live 表**。

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

- **🎨 Neve 頭像 presence 加大（redesign 待辦，Eason 2026-07-03 提出）**：頭像圖剛接入三處（課程/判斷場氣泡 24px、棋憶 NeveCard 28px），Eason 實感偏小、想讓這個元素更有存在感。屆時照鐵則走 `/redesign` 對真實畫面出報告 → 拍板 → 施工，候選方向：單純加大尺寸／氣泡頂列頭像+名字排版重整／出場動效。另一併考慮：截圖驗收發現深青底（棋憶 NeveCard）上頭像整體偏暗、與 deep-jade 底色調接近，24–28px 下辨識度比 cream 底低——可能要加細邊框或提亮。素材注意：徽章縮圖 `public/avatars/neve-badge.png` 為 192px（撐到約 64px@3x 顯示都夠）；三張 1254px 原圖在 `design/gambit-design-system/avatars/`（precommit review 把它們移出 public/——5.3MB 零引用死重量不該進每次 deploy），要更大就重產：`ffmpeg -y -i design/gambit-design-system/avatars/neve-main.png -vf "scale=<N>:<N>:flags=lanczos" public/avatars/neve-badge.png`。

- **Phase C+/D**：捉雙/牽制賽後偵測（需精準度實測）；Claude API 動態講解/BYOK（最後）。
- **PWA / Add-to-Home-Screen ⏸ 未實作**：目前零 service worker、零 manifest、`vite-plugin-pwa` 沒裝（CLAUDE.md
  舊版誤列為已裝、2026-06-25 修正）。要做時：① 裝 `vite-plugin-pwa` + manifest + 圖示（pwa-192 已有）②
  **必用 `registerType: 'autoUpdate'`**——否則 SW 把舊版鎖死、部署更新卡住（本次就因裝置殘留舊快取繞兩輪）③
  Required ADRs 第 6「PWA caching strategy」要先寫。觸發＝要離線/裝成 App 的需求出現。**非 Phase 2 關鍵路徑。**
- **epics/index Summary/Story Count 兩張彙總表過時**（沒納入 journal/memory/dungeon/learning-loop），獨立重算、刻意未動。
- **🎨 第二主題（noir / "Dusk"）** ⏸ 低優先、未施工。設計定案、spec 已固化進 SoT（`colors_and_type.css` 的 `[data-theme="noir"]` 區塊 + 兩條護欄：金只給 reward/eval/focus、沉浸區靠 elevation/glass 分層）；demo＝`design/demos/{theme-tokens-mockup,ink-noir-explore}.html`。production 0 實作。**刻意延後**（不在 Phase 2 關鍵路徑、無需求方、上線即雙主題維護稅）。屆時排序：① `[data-theme="noir"]` token 層（`src/assets/main.css` @theme + shadcn HSL 雙寫、~70% 重用 on-deep）② toggle（ProfileView + localStorage/Supabase 同步、尊重 `prefers-color-scheme`）③ 深區 ~30 處寫死漸層 hex 隨頁面逐步 tokenize（別全域 sweep）④ CI WCAG 對比 gate。觸發＝Phase 2 告一段落/有需求/當賣點。
