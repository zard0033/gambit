# 跨頁 UI Redesign — 主計畫（2026-06）

對齊 Gambit 設計系統，重設計四個主畫面：**對局 / 首頁 / 學習 / 試煉**。採「分步驟 + 先統一語言」：先抽共用 pattern，再一頁一頁 redesign → 驗證 → commit。

> **設計 SoT**：`design/gambit-design-system/`（實作前先讀 README + colors_and_type.css）。
> 驗證：vue-tsc 0 + `npm run test`（645 baseline）+ Playwright 桌機 1280–2560 / 手機 375–414 雙寬截圖，完成後清截圖。

## 鐵則（全程不可違反）

- 棋盤/棋子＝全 app 統一 Wood12 + Gioco Wood（`board-theme.css`，含 PgnViewer）；標註/eval 維持上游中性、不染金。
  redesign 範圍內**不在頁面層碰 `cg-*`**，盤面主題只在 `board-theme.css` 一處改（見 CLAUDE.md 鐵則）。
- 金色僅 focus/reward 的 fill/indicator，**絕不當內文**；內文金限 `#8F6200` 大字；陰影暖棕非純黑。
- 動效 150–300ms，僅 transform/opacity；尊重 `prefers-reduced-motion`。
- 觸控 ≥44×44px；內文最小 16px；notation 用 Cubic（`font-num`）tabular。
- 西洋棋用語：后/城堡/騎士/主教/國王/兵。
- 共用元件優先複用：`ui/gambit/`（dark-panel、pill、card、stat-card、progress-bar、section-label、chapter-badge）。

## 四頁共通問題（盤點結論）

| 共通問題 | 對局 | 首頁 | 學習 | 試煉 |
| --- | --- | --- | --- | --- |
| 桌機響應式浪費（固定窄寬） | ✔→已修 | ✔ | ✔ | ✔ 地圖 320px |
| 玻璃做半套（缺 blur+sheen） | ✔→已修 | 局部 | ✔ tabs/卡 | ✔ pill/謎題卡 |
| 字級雜訊（9/10/11/13、body<16） | ✔→已修 | ✔ 13px 問候 | ✔ | ✔ 9/10px |
| 缺 deep-jade 沉點 | n/a | ✔ 全 cream | ✔ 全 cream | n/a |
| 手寫 div 未複用元件 | 局部 | OK | 局部 | ✔ 嚴重 |
| 金色內文違規 | OK | OK | OK | ✔ 多處 text-gold 內文 |

---

## Phase 0 — 共用語言　✅ DONE（未 commit）

- `src/assets/main.css`：加 `.glass-panel`（半透白+blur+hairline+top sheen+暖陰影）。
- `src/assets/main.css`：**修 `.font-num` 全站 bug** — Tailwind 對 `num` key 產空規則，全站 Cubic 11（eval/棋譜/stats）一直退回 Sarasa；比照 `.font-display` 手動補顯式字串。**這是全站視覺變更**（首頁 stat 0/15、學習/試煉進度數字現在都變 Cubic 點陣字）。
- `src/components/ui/gambit/pill.vue`：`TONES` 加 `glass`。

---

## Phase 1 — 對局 PlayView　✅ DONE（未 commit）

- 桌機**兩欄置中群組**；棋盤 `md:w-[min(74vh,calc(100vw-26rem),56rem)]`（隨視窗高放大、不溢出、上限 56rem）、側板 `md:w-[20rem]` 緊貼右；手機堆疊。1280–2560 無重疊/溢出。
- `:deep(.main-wrap/.main-board/.cg-wrap)` → `width:100% + aspect-ratio:1`（否則 vue3-chessboard 吃 70vh 溢出木框）。
- 木質托盤外框；座標預設開。
- 玻璃側板四塊框：回合徽章（輪到你 jade+金呼吸點；AI glass+呼吸）／身分框（pawn 圖示+你執白/黑·對手 Lv.，文字可讀亮色、棋色交給圖示）／棋譜代碼框（標題列在框內、序號|白|黑 grid、scroll、自動捲底）／控制。
- 悔棋+投降皆**彈窗二次確認**；投降紅色。側板全 Cubic。GAME_OVER 進場動畫。DEV FEN tool 隱藏（Ctrl+Shift+F）。
- **開局流程改全域 modal**：`ui-store`（`showPlaySetup`/`pendingGame`/`requestGame`/`consumePendingGame`）+ `App.vue` 渲染 modal；在當前頁開→確認後跳 `/play` 直接開局。PlayView 改吃 `pendingGame`。
- **導覽移除「對局」**：`app-nav.vue` 去 /play（剩 首頁/學習/試煉），指示器 `w-1/3`。開局入口＝首頁卡片 + 再來一局。

---

## Phase 2 — 首頁 HomeView　✅ DONE（未 commit）

主檔：`src/views/HomeView.vue`。`/redesign` skill 對 1280/375/320 實審後施工。

- **High**：deep-jade 沉點＝沿用既有 NEW GAME DarkPanel（桌機 `md:h-full` 填欄高變強錨，降級不另加深色塊）；問候字 13px→16px（`text-base`）；StatCard `flex`→`grid grid-cols-3`（修中間 RouterLink 巢狀 `flex flex-1`），RouterLink 改 `block`。
- **Medium**：**桌機雙欄**（`md:grid-cols-2 md:items-stretch`：左 hero｜右繼續學習等高，總覽全寬在下）；容器 `md:max-w-4xl`、h1 `md:30px`；StatCard locked 加右上角 Lock icon。
- **Low**：hero CTA 箭頭 16→18（done）。**刻意不做**：SectionLabel 微分隔（卡片已是強分組，加線違背平靜調性）；locked 對比拉高（disabled 佔位該退到背景，WCAG 對 disabled 豁免，拉高反搶真資料份量）。
- **Eason 回饋後追加**：桌機隱藏「繼續學習」外部小標 → 兩 hero 卡頂底等高（左右都靠卡內小標）；locked StatCard 拿掉「開局庫」label，icon 對齊頂線、「即將推出」於下方區置中對齊一般卡的數字+文字。
- 共用元件動到：`section-label.vue` 加 `class` 透傳（桌機覆寫 `md:mt-0`，Phase 3/4 沿用）；`stat-card.vue` 加 Lock + locked 改 icon 頂對齊 + 文字置中、`label` 改 optional。
- 注意：首頁「開始新對局」卡 `@click` 開全域 modal（Phase 1），未改回 router.push。

## Phase 3 — 學習 LearnView + ConceptMapView + LessonView　✅ DONE（未 commit）

`/redesign` 對 375/1280 實審後施工。vue-tsc 0、645 passed、Playwright 雙寬三頁實測。

- **ConceptMapView（重點）**：頂部 deep-jade 介紹 banner（複用 `DarkPanel`，方案 A，跨有/無熟悉概念狀態都成立）作沉點；概念卡（lit+dormant）套 `.glass-panel`（Eason 拍板，cream 上呈亮白玻璃感、邊界清晰、對比足夠）；桌機 `lg:grid-cols-4` + 容器 `lg:max-w-3xl`；intro 14→16px。
- **LearnView**：頁頭分隔 `border-line-subtle`→`border-line`；桌機 `lg:max-w-2xl`；ChapterBadge 42→40；字級收斂（繼續/完成/章節標注 9–10px→11px）；課名 `truncate`→`line-clamp-2`。**不另加深色沉點**（已有 DarkPanel 章節卡，與 Phase 2 HomeView 降級決策一致）。
- **LessonView 完成卡**：scrim `bg-black/60`→`rgba(16,48,41,0.72)` deep-jade 調；shadow 純黑→暖棕 `rgba(61,34,16,0.45)`；漸層 `#1E4D3E,#142E26`→`#163929,#0C2118` 加深。
- **共用**：`learn-tabs.vue` 軌道硬編碼 `#ddd0b8`→`bg-surface-mid` token 化。
- **刻意不做**：`.coin` 抽元件（純技術債、僅一處用）；Alert 邊框柔化（variants 已用 light 底 + 半透邊框 `/40`–`/60`，已合理）。

## Phase 4 — 試煉 DungeonMapView + DungeonPuzzleView　⏳ TODO

- **High**：**金色軌跡 map trail**（SVG path 淡灰白→金，locked 段暖駝）目前完全沒做；**金色內文違規**（DungeonPuzzle 提示 `text-[#F5D070]`、節點 label `text-gold/90`、錯誤 `text-gold/80`）→ 改 `ink-on-deep` 或 `#8F6200`；玻璃做半套（Header pill、謎題卡）套 `.glass-panel`；地圖桌機固定 320px → 加 `lg:` 寬度應變。
- **Medium**：h1 `font-num`→`font-display`；Level 標籤 9px→12px；謎題卡/完成 Modal 改用 `Card`；current 節點 focus ring 白→金。
- **Low**：進度 pill 對比、label 對齊簡化、<320px padding、`aria-current="step"`。

---

## 收尾待辦（全 Phase 後）

- **全站字體使用規則 redesign**（Eason 指定）：`.font-num` 修好後全站數字第一次真用 Cubic；需逐頁判斷哪裡用 Cubic vs Sarasa，必要處設例外，最後寫回 Gambit 字型章節。
- commit 策略：每 Phase 獨立 commit（繁中、Conventional Commits）；push 前列 commit message 等 Eason 確認，`git push origin main`。
