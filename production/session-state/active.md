<!-- STATUS -->
Epic: 差異化重構
Feature: Phase 2 ① — 課程長在你自己的棋上（棋憶 / Memory）
Task: **棋憶 epic 已切完，進入實作**。GDD APPROVED=`design/gdd/memory.md`(#22)。**已產出（2026-06-18）**：`ADR-0014`（memory 資料模型 + #7 唯讀消費邊界，**Proposed**；A 方案=game_sessions 加欄 已否決，採 B=獨立 `memory_summaries` 表比照 journal/ADR-0013，訪客 localStorage→登入 union reconcile）、`production/epics/memory/EPIC.md`、**11 張 story（001…011，全 Ready）**、`TR-memory-001…011` 進 tr-registry、index 更新。**下一步＝逐 story 實作**，建議序 **002→003（純函式零相依、可立刻紅綠燈）→005→004→001→006→007→008/009→010→011**。鐵則：純邏輯(002–005)對 Proposed ADR 即可開工；**story-011=ADR-0014 Accepted+live migration 閘**（解 001/010 的 live 驗證 + 007 的 recordGame）；**story-006 UX spec(fix#5) 須 /ux-review APPROVED 才動 007/008**；story-010 補 `journal.md` 回指棋憶（#21 per-game pen 屬 Phase 2，若未上線只先接 deep-link target）。ADR/epic/stories/demo/GDD 皆**尚未 push**。
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

> ✅ **2026-06-18：棋憶 GDD 已落成＝`design/gdd/memory.md`（系統 #22）+ 已過 design-review（MAJOR REVISION 已套，log 見 `reviews/memory-review-log.md`）。** 下方 demo 迭代 v1→v9 紀錄＝設計決策來源，已被 GDD 取代；接手看 GDD + STATUS 即可，這段保留只為追溯 demo 決策脈絡。

- 🆕 **賽後檢討「重點回播」redesign**（Eason 構想＝Phase 2 ① 的 UX）：不逐手翻，只 **highlight 3-5 個關鍵時刻**（重用既有 cpLoss/最大轉折/`classify()`＝篩選+呈現非新邏輯，且只看關鍵手＝更平靜、對上「寧少勿濫」）。每時刻顯示**戰術名 + 你的步 vs 最佳步差異**，Neve **模板 per mistake-concept** 解釋（零 AI）；v2＝任意局面自由解釋（AI/BYOK，最後）。**咬合**：每個被點出的時刻＝一筆棋誌（②/③），review＝②蘇格拉底教學。⚠️ 大改 `ReviewView` 互動模型，依鐵則先 `/design-review`→拍板→才施工。
  - **可重用料（現成在 `ReviewView.vue` / `modules/learning-loop`）**：`computeCpLoss`、`biggestSwingCursor`、`classify()`（已產 concept）、`mistakeSignposts`、`selectMistakeSignposts`。棋盤＝剛上線的 `PgnViewer`。
  - **本 session 已提案、待 Eason 拍板的決策**：① 時刻怎麼選（推薦：玩家手依 deep cpLoss 排序、取有 concept 或大 swing 的前 3-5；是否也放 1 個「漂亮的一手」②未定）② 逐手瀏覽（推薦保留為次要 toggle，不丟現有 nav）③ Neve 講解＝每 mistake-concept 一個模板「我看到你想…，這裡…更好，因為…」④ eval bar / 棋譜列在重點回播模式收掉（平靜），逐手模式才出現 ⑤ 棋誌咬合先做 UI、寫入留一張 story。
  - ✅ **可點 demo＝`design/demos/highlight-replay-demo.html`（已迭代到 v2，過 Playwright 驗證 6 畫面）**。本機開：`cd design/demos && python -m http.server` → 瀏覽器 `localhost:8000/highlight-replay-demo.html`（file:// 被 Playwright 擋，直接拖進瀏覽器也行）。
  - **已迭代到 v5，落實四輪 Eason 回饋（2026-06-17）**。結構：**dashboard-first**——第一頁＝Memory dashboard（**頂塊已拿掉**，只留：三時刻可點列表＋**Neve 跨對局質化觀察**＋逐手覆盤入口）→ 點時刻進**幻燈片**（動畫重現：走你那手→0.42s→移回→0.26s→走正確手；好手則帶出對手被迫回應如騎士被趕回 b6）→ **逐手覆盤**（滿版棋盤＋eval bar＋棋譜＋上下一步**動畫滑動非瞬移**，含吃子/易位）。上下一步在**牌卡底列**；「你走了 ┃ 更好的是」同字級只用顏色分；選時刻三類＝戰術相關＋整局最關鍵一手＋無戰術轉折；**Neve 文案＝「你」主詞主動語氣、不臆測意圖**。
  - **跨對局統計＝確定走質化版（不靠 AI）**：Eason 認可。做法＝每盤標階段(開局/中局/殘局)+concept→跨盤累積統計→**規則挑最強趨勢+模板填數**出 Neve 一句觀察（非評分條、非 rating 曲線，守住「棋誌不是數據」護欄）。量化能力分數版**不做**。
  - **棋子/棋盤/棋譜樣式 demo 不擬真**——實作時套既有 Wood12+Gioco Wood+PgnViewer（CLAUDE.md 視覺 SoT）。
  - **棋誌↔回顧 模型已確認**：點棋誌那一筆即開此回顧；一盤必存一筆（與是否點開無關，故 dashboard 不放「已存入」動作提示）。
  - **v6（第五輪）再調**：動畫每步間隔再拉長；逐手覆盤併進三時刻那組（虛線安靜列，去孤兒感）。
  - **v7（第六輪）**：①第一手起步前停頓加長 ②**自刻 SVG eval 折線圖**（不裝圖表庫，守「整包框架不裝」護欄），放棋憶 dashboard 頂部滿版。
  - **v8→v9（第七輪定版）＝拆兩條路線＋Neve 升級**：① 清單回到 **ICON＋顏色**（不用編號，Eason 偏好）② **拆兩條路線**：整張 eval 走勢圖＝**逐手覆盤入口**（整圖點擊，手機好點，不靠小圓點；圖上三個重點時刻仍以小色點標示、與清單同色）；**重點時刻**走下面的清單卡（點卡→該時刻）③ **Neve 升級**為醒目**深青卡＋頭像＋文楷**（套 persona 視覺嗓音）、**移到最上當開場**（Eason 覺得原本被輕視）。dashboard 定版順序＝**Neve（深青卡）→ 整局走勢(圖→逐手覆盤) → 重點時刻(清單)**。圖拉高 104px、白/黑優標籤移左側加底襯不被曲線壓。**棋憶 demo 至此 Eason 認可、暫告段落**（下一步：要動工時開 `design/gdd/memory.md` GDD→/design-review→切 stories）。
  - **✅ 命名定案＝「棋憶」**（諧音記憶、呼應 Neve 記得你；UI 全繁中規則查證屬實，英文只給 GAMBIT 字標）。功能＝棋憶；內含「重點時刻」（幻燈片）＋「逐手覆盤」。demo 已全面更名。
  - **✅ Neve 語氣＋視覺嗓音已固化進 `design/gambit-design-system/persona-neve.md`**：(1)「回顧態」register＋撰寫補充（你-主詞、主動、不臆測意圖、濃縮、失誤中性、好手不反射讚美、無戰術轉折 prefer-silence）；(2)「Neve 視覺嗓音」段——**全站 Neve 第一人稱的話統一 `font-lesson` 文楷＋頭像容器**建立識別，**Cubic 11 只當小 NEVE 名牌**、內文不排（點陣字長句難讀＋8-bit 感悖平靜人格）。Eason 已拍板採此方案（否決「全 Neve 用 Cubic 11」）。
  - **🔑 重點時刻「生成邏輯」（Eason 問，要進 GDD Formulas/Tuning）**：**數量不固定**（非永遠 3）——上限 ~5、下限可為 1，門檻 gate（cpLoss < 閾值不選）、寧少勿濫（穩盤就少、不灌水）。候選來自三源：①戰術相關＝`classify()` 命中 concept（material/mate；日後 fork/pin…）②整局最關鍵一手＝最大 swing（anchor）＋玩家的亮點/好手 ③無 concept 的大 swing（prefer-silence）。排序＝cpLoss 大小為主、concept 命中加權；去重（相鄰手取大者）；幻燈片**依手數順序**呈現、最大 swing 標 anchor。每盤再各時刻標**階段**（開局/中局/殘局，由手數+子力數判定）→ 餵跨對局質化統計。**全程零 AI**（Stockfish cpLoss + classify 規則 + 模板）。
  - **✅ 累積數字的家＝棋誌頁，不是棋憶 dashboard**（Eason 2026-06-17 拍板）：全站走過的累積（Neve 記得 N 盤／棋誌 N 則／同行 N 天）放**棋誌頁**（＝既有 `JournalView`，Phase 1 已上線）當頂部累積區，呼應 vision「回頭重讀一本越來越厚的書」。棋憶 dashboard 保持**單盤聚焦、平靜**，不放全站數字（試過一版已移除）。→ **棋誌頁累積頭部＝未來獨立增強**，非本次棋憶 GDD 範圍；要做再單獨 mock。
  - **🔑 剩餘待拍板**：動畫快慢是否 OK（已把第一手起步前停頓加長到 650ms）。棋憶 dashboard 內容大致定（Neve 觀察＋三時刻＋逐手覆盤）。
  - 拍板後 → 寫進 `design/gdd/post-game-review.md`（或新 `memory.md`）→ `/design-review` → 切 stories。**demo 尚未 push**。
- **概念側門廢除 + 概念深化頁**：廢除「概念→課程側門」（`ConceptMapView` 戰術卡 `?from=concept` alias 到課程），概念改成「單一戰術主題的深化＝課程加深版」（自有 `steps`、共享 LessonView 渲染器吃不同資料）。**整包做**（只拆側門會留破洞）。牽連 `LessonView` `fromConcept` 分支、`lesson-progress` `markSideLearned`、`concept-progress` store、`data-sync` `lesson_side_learned`、概念地圖雙色點。**保留**賽後檢討 signpost（`ReviewView` `?from=lesson`→試煉）。**已做**：移除課程完成卡練習邀請 CTA。

### 待 Eason iPhone 實機複看（皆已修/已 push）

- PWA 冷啟動登入閃爍、header logo 光學對齊、首頁招呼語 Neve 化、過場效能。2026-06-14 實機過一輪大致 PASS。
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
