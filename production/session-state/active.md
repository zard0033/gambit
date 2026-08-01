<!-- STATUS -->
Epic: 差異化重構
Feature: 對局難度階梯重製（引擎弱化＋難度選單）
Task: AC-5 修復**已實作、待 Eason 實玩驗收**（2026-08-02）。機制＝全寬 MultiPV ＋虧損帶挑手
（新檔 `modules/chess-engine/fallible-pick.ts`）。vitest 951 綠、typecheck／build 乾淨、
自我對局實跑 80 手：犯錯率 56%（設定 60%）、cpLoss 中位數 106（目標 ~100）、超窗 0、無非法手。
**尚未在瀏覽器裡跑過**——實玩即驗收，順便校準五檔窗口。
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

- **🔴 Stockfish 無旋鈕可製造初學者級失誤**（2026-08-01 實測定案）。探針＝「白方白送一隻馬，
  引擎會不會放過」，四維度全部 16–20/20 照吃：skill 0（試過 depth 1/5/8）、`go nodes 1`
  （砍到一個節點也照吃——move ordering 的 MVV-LVA 把吃子排第一，它不搜也會下）、
  `UCI_Elo 1320`（官方最低）、depth 限制。**要它犯錯只能在引擎外面做**：拿到 bestmove 後換手
- **🔴 抄 lichess 參數表是死路，勿再抄**：lichess level 1–3 的 `Skill Level -9/-5/-1` 在官方
  Stockfish 上**整段被拒收**（引擎宣告 `spin default 20 min 0 max 20`，越界不 clamp），
  實際停在預設 20 滿血。實測 `d5 skill -9` 與 `d5 skill 20` 行為完全一致。
  **我們現在的 d1 skill 0 已經比 lichess level 1 弱**——表＝`src/config/difficulty-tuning.ts`（SoT）
- **✅ 定案解＝全寬 MultiPV ＋虧損帶挑手**（2026-08-01 量測）。MultiPV 設成合法走法數（開局 20–31、
  中局 40），depth 8 全寬跑完最慢 156ms（桌機；手機打 4 倍仍在 `MIN_THINK_MS 900` 內，等於免費）。
  100–200cp 帶挑出來的是 f7f5／g7g5／b7b5／g2g4／Ng1h3——**引擎眼中的爛棋與新手愛下的爛棋在開局
  高度重合**，所以引擎自己就能近似真人開局書。≥400cp 帶＝送子，整個排除掉（那是已否決的崩盤型）。
  兩個旋鈕：**觸發機率**（人是偶爾犯錯，不是每手都爛）×**cp 帶**（上限＝不送子那條線）
- **⚠️ 前一輪 MultiPV 15 挑不到差手是取樣不足，不是方案不成立**：開局有 20–31 個合法走法，
  15 只涵蓋前半。全寬才看得到尾端
- **lichess 開局書：知道但不抄**。它靠 opening explorer（level 1 對應模擬 rating 400）拿真人走法，
  但該 API 2026 年起強制 OAuth、限 25 req/min（建置期抓 5 千節點要 3.3 小時），還是個會被改政策
  掐掉的外部依賴。全寬 MultiPV 已能近似，不值得。lichess 另有 zerofish bot 走 CPL 目標抽樣
- **depth 壓低是反效果**：depth 越高候選虧損分得越開（中局 d1 最多虧 59cp、d8 到 131cp）。
  壓 depth 不是讓它變弱，是讓它分不出好壞，skill 擾動跟著塌縮。新表的 depth 應回到 8
- **隨機手注入整個放棄**：cpLoss 量測分出兩種弱——隨機注入＝崩盤型（玩家知道是對方送的，
  無成就感）；depth 限制＝持續小虧型（才是要的）。勝率當度量已作廢（樣本小、同組兩輪反序）
- **讓子（material odds）已否決**（Eason 2026-08-01），不要再提案
- 出手節奏＝`MIN_THINK_MS 900`＋jitter 600（引擎實際只花 21ms）；刻度＝五格分段條（A 案）
- 命名：初學／進階／熟練／精通／大師；**不顯示 Skill Level 數值**（Eason 拍板）

## 待辦

- **🟡 AC-5**：機制已實作，等實玩驗收＋校準五檔窗口（旋鈕＝`difficulty-tuning.ts` 的 `fallible`：
  probability 調犯錯頻率、min/maxLossCp 調錯得多重；maxLossCp 別碰 400，那條線以上是送子）
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
