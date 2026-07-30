<!-- STATUS -->
Epic: 差異化重構
Feature: 對局難度階梯重製（引擎弱化＋難度選單）
Task: 2026-07-29 五檔階梯＋選單重製＋出手節奏＋分段條全數上線（vitest 925 綠、三路評審＋
fresh-context 複驗過）。**🔴 AC-5 FAIL（Eason 實玩）：最低階「初學」仍然輸**——depth/movetime
都到底了。下一步＝**MultiPV 挑次好手**（從候選前幾名挑差的，錯得像人；「隨機送子」已否決勿回頭）。
⚠️ 動 engine 解析層時注意：`handshake.ts` 寫死 `MultiPV 1` 且與 review 分析路徑共用，勿污染分析。
<!-- /STATUS -->

> **交接快照**：只留現況＋待辦＋未固化決策；施工細節在 git，歷史輪次全文在
> `archive-2026-07.md`（07-10～07-29 收線記錄）。**收尾覆寫本檔，紅線 ≤150 行**（超線 hook 會叫）。
> **差異化北極星 = `production/gambit-differentiation-vision.md`**——提任何功能/重構/UI 前**先讀**。

## 三件事優先序（Eason 2026-07-29 拍板）

1. **對手強度修正** ← 進行中（AC-5 未過）。修完才有可信的對照組
2. **課程→對局 gap 重估**——等 1 完成後 Eason 重玩再判。候選解＝優勢局面下完／殘局實戰／開局十步
3. **UI/UX design flow 全站化**——最後。先全站 audit 分流，只對真有問題的頁跑完整流程

> 順序理由：1 沒修好，「學完仍贏不了」實驗的對照組是壞的；3 排最後因 2 可能改資訊架構。

## 難度階梯——已定案的關鍵結論（數據與推導全文在歸檔）

- **抄 lichess 五檔**（skill/depth/movetime 三件套），表＝`src/config/difficulty-tuning.ts`（SoT）。
  五輪自製測量的產出是「理解為什麼」不是參數表；上線後靠 Eason 實玩微調，不再自製測量
- **隨機手注入整個放棄**：cpLoss 量測分出兩種弱——隨機注入＝崩盤型（玩家知道是對方送的，
  無成就感）；depth 限制＝持續小虧型（才是要的）。勝率當度量已作廢（樣本小、同組兩輪反序）
- **奇偶 depth 效應**存在，但 lichess 靠 skill 擾動蓋掉——抄它的組合即可，不必避奇數
- 出手節奏＝`MIN_THINK_MS 900`＋jitter 600（引擎實際只花 21ms）；刻度＝五格分段條（A 案）
- 命名：初學／進階／熟練／精通／大師；**不顯示 Skill Level 數值**（Eason 拍板）

## 待辦

- **🔴 AC-5**：MultiPV 次好手方向（見 STATUS）
- **🚩 執子方也改 radiogroup**（Eason 決議列待辦）：`play-setup-modal.vue` 執黑/隨機/執白仍是
  button+aria-pressed，照難度階梯本輪的 radiogroup 寫法抄即可；順手可統一「已選中」視覺
  （現為綠框 vs 金環兩套）
- **🚩 noir DarkPanel 明度**（Eason 決議之後做）：問題是明度差不是色相——modal 底
  `rgb(39,35,32)` 與 jade 漸層亮度太近，錨定失效。hallmark 兩解未擇一（面板提亮一階／
  DialogContent 換偏中性深色）。**DarkPanel 是全站共用件，動前先 A/B demo 讓 Eason 挑**。
  「砍暗色模式」是備案（連 Supabase theme CHECK 一起處理，不可逆，最後才選）
- **欠帳：玄夜輪 ➍➎ 評審從未跑**（hallmark audit＋web-design-guidelines，該批已上線）；
  visual-regression e2e 的 home 基準圖 `--update-snapshots` 也欠
- **iPhone 複驗殘項**：氛圍首頁 D3 手感；深化 mate 新盤（h1 角 Qg2#）手感
- **material 擴充**（設計案 Accepted；施工前置＝D6 離線量測）：樣本歸零（「重置對局」實機驗收
  清空了雲端），續點＝登入態自然累積 ≥10 局後重跑量測腳本（原在 scratchpad 已蒸發，要重建）；
  session token 過期請 Eason 重貼
- **epiphany 文案語氣**（backlog）：六模板同款否定式排比＋評價語，違反 Neve「不輕易讚美」；
  處理時走 3-lens 對抗審查（CLAUDE.md 文案語氣護欄）
- **Phase C+/D**：捉雙/牽制賽後偵測（需精準度實測）；Claude API 動態講解/BYOK（最後）

## 評審提出但不做（別重新發現一次）

連續卡關無差異化陪伴（要新持久狀態，超範圍）；五階打穿無收尾肯定；執子方/難度「已選中」
兩套視覺語言（金限 focus/reward 鐵則故未動，radiogroup 待辦時可順手統一）。

> 本輪三條量測陷阱（背景分頁 throttle／modal 進場動畫假座標／字階 16px 誤判）已升格進
> `.claude/docs/technical-preferences.md` Testing 段，此處不重複。

## 護欄備忘

- Supabase keep-alive workflow 每 3 天打實表查詢（免費層 7 天無活動即暫停；暫停的專案連 DNS
  都消失——NXDOMAIN ≠ 被刪）。**GitHub 政策：repo 60 天無 commit 自動停用 scheduled workflow**
- Maia（人類化 NN 引擎）＝日後「陪練角色」的答案，現在不做（要第二套 runtime、最低 1100 仍偏強）

## 接手必讀（鐵則不在這個檔）

長期規則與技術參考都在 **CLAUDE.md 與它 `@`-include 的 docs**，每次 session 自動載入：

- **CLAUDE.md**：技術棧、CI Node 26 鎖、push guardrail、部署 base path、E2E 盲區、棋理護欄、
  內容授權、視覺設計 SoT（全 app 棋盤＝Wood12+Gioco）、教練人格 Neve、西洋棋用語、
  單人模式＋Pre-Push Checklist。
- **`.claude/docs/technical-preferences.md`**：測試規範（@spike、Node26 shim、vitest 快取假紅、
  chessground 合成事件測不到、node 直驅 Stockfish 驗盤法）、Board/chessground gotchas
  （viewOnly 兩層修法、stale bounds、PgnViewer CSS 汙染）、Deferred Cleanups。
- **`.claude/docs/coding-standards.md`**：commit 格式、截圖自清。
- 設計 SoT＝`design/gambit-design-system/`；GDD＝`design/gdd/`；Supabase migration＝
  `supabase/README.md`；lib/ vs modules/ 判準＝**ADR-0015**。
- **Supabase MCP**：stdio、user scope、**read-only**、`--project-ref=vfnzekqtvxhewifnmtnz`、
  token 走 `$env:SUPABASE_ACCESS_TOKEN`；需重開 Claude Code 才 Connected。可查表除錯、不能跑 migration。
- **Gambit-noir 平行 worktree** 共用同 origin：加 Supabase migration 時編號接續 repo 現有最大值
  （已到 202608305xxxxx，非真日期；撞號前例見 memory）。

## 北極星 + 重構路線圖

> 一句話：解新手**情緒問題**、對標 Calm 非 chess.com、Neve 安靜陪伴、課程長在你自己棋上＋棋誌、
> 核心零 AI、氛圍 vs juice。完整見 vision 文件。

**三階（鐵律：一次蓋一塊磚，每塊能單獨上線、單獨證明靈魂）：**

- **Phase 1 — 棋誌**：✅ 已上線（settle 管線全面接線）。
- **Phase 2 — 課程長在你自己的棋上**：✅ 棋憶／深化頁／signpost v1 皆 ship。🚧 剩 iPhone 複驗
  殘項與 material 擴充（見待辦）。
- **Phase 3 — 沉浸感＋旅程 IA**：🚧 A 路線（氛圍首頁＋轉場）已施工待複驗；B 路線未動，待 A 後評估。
- **商業模式**（訂閱/付費深度/BYOK）＝最後。

**關鍵架構事實**（細節在 ADR/git）：ADR-0013（journal）＋ADR-0014（memory）＋ADR-0015
（lib/modules 判準）皆 Accepted；Supabase 現 7 張 live 表（兩張 unused 已 drop）。
