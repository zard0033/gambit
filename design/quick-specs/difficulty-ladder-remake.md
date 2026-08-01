# 對局難度階梯重製

> **性質**：dev-flow 階段 2 spec（規模＝中）。純對局難度層——不動棋誌／棋憶／課程／賽後檢討。
> **狀態**：第二版已實作（2026-08-02），待 Eason 實玩驗 AC-5。
> **緣起**：Eason 實測「學完課程仍贏不了難度 0」。查證後根因**不在課程系統**——對手從未被調弱。

---

> **以下為第二版（2026-08-01 起）＝現行設計。第一版原文收在文末供追溯。**

第一版上線後 Eason 實玩最低階仍然輸，把 Skill Level 從 3 降到 0 用掉最後的參數空間仍然輸。
本版是對「為什麼參數調不動」的回答，內容**推翻了第一版的兩個核心結論**（見下方對照）。

## 根因：Stockfish 沒有任何 UCI 旋鈕能製造初學者級失誤

2026-08-01 用同一支探針量測——「白方把騎士走到能被吃的格子，引擎會不會放過」——
初學者唯一抓得住的破綻就是對方掛子，所以這是能不能贏的決定性指標：

| 設定 | 吃掉白送的子 | 自己的后被攻擊時逃走 |
| ---- | ---- | ---- |
| Skill Level 0 / depth 1 | 16–27 / 20 | 20 / 20 |
| Skill Level 0 / depth 5、8 | 29–30 / 30 | 30 / 30 |
| `go nodes 1`（砍到一個節點） | 18 / 20 | 20 / 20 |
| `UCI_Elo 1320`（官方支援的最低棋力） | 19 / 20 | 20 / 20 |

`go nodes 1` 照樣吃，是因為它連搜尋都不必：move ordering 的 MVV-LVA 把吃子排在候選第一位。
**弱化必須在引擎外面做。**

## 抄 lichess 參數表是死路（勿再抄）

lichess level 1–3 送的是 `Skill Level -9 / -5 / -1`。官方 Stockfish 宣告該選項為
`spin default 20 min 0 max 20`，**越界值整段拒收、不 clamp**，所以那三級實際跑在預設值 20。
實測 `depth 5 skill -9` 與 `depth 5 skill 20` 行為完全一致（開局 30/30 次同一手）。

推論：**第一版抄來的表有一半是啞彈**，而我們的 `d1 skill 0` 反而比 lichess level 1 弱。
lichess 低階之所以打得贏，靠的是**開局書**（查自家 opening explorer，level 1 對應模擬 rating 400，
照真實 400 分玩家的走法頻率加權隨機挑），不是引擎設定。

開局書我們**知道但不抄**：該 API 2026 年起強制 OAuth、限 25 req/min（建置期抓 5 千節點要 3.3 小時），
且是會被改政策掐掉的外部依賴。全寬 MultiPV 已能近似（見下）。

## 機制：全寬 MultiPV ＋虧損帶挑手

搜尋時把 MultiPV 開到 50（引擎自動夾到合法走法數），拿到完整候選清單後，
從「相對最佳手的虧損落在窗口內」的候選裡隨機挑一手。實作在
`src/modules/chess-engine/fallible-pick.ts`（純函式）。

窗口的兩端各擋一種失敗模式：

- **下限**：低於 `minLossCp` 的錯誤初學者看不出來也利用不了，挑了等於沒挑。
- **上限**：高於 `maxLossCp` 就是掛子。量測顯示 ≥400cp 的候選即送子——玩家靠對方送子贏
  沒有成就感（chess.com 低階 bot 的失敗模式），這正是第一版結論 1 否決的崩盤型。

100–200cp 帶實際挑出來的是 `f7f5`／`g7g5`／`b7b5`／`g2g4`／`Ng1h3`——弱化王翼、浪費節奏、
邊緣馬。**引擎眼中的爛棋與新手愛下的爛棋在開局高度重合**，兩邊犯的是同一類錯，
所以引擎自己就能近似真人開局書。

## 參數表

| 階 | 名稱 | 觸發機率 | cp 帶 | depth | movetime |
| ---- | ---- | ---- | ---- | ---- | ---- |
| 1 | 初學 | 0.6 | 100–300 | 8 | 1000ms |
| 2 | 進階 | 0.4 | 70–200 | 8 | 1000ms |
| 3 | 熟練 | 0.25 | 50–120 | 8 | 1000ms |
| 4 | 精通 | 0.12 | 30–80 | 8 | 1000ms |
| 5 | 大師 | —（不犯錯） | — | 8 | 1000ms |

SoT＝`src/config/difficulty-tuning.ts`。**唯一真正的旋鈕是機率與 cp 帶**，
depth／movetime 對每一階都相同，`skillLevel` 只剩持久化用途（見下）。

## 反轉的第一版結論

1. **壓低 depth 是反效果**（推翻第一版結論 2、3）。depth 越高，候選手的虧損分得越開——
   中局最差的手在 depth 1 只虧 59cp，depth 8 虧到 131cp。壓 depth 不是讓引擎變弱，
   是讓它**分不出好壞**，於是隨便挑一個都差不多好（Skill Level 0 只能在 14cp 內晃）。
   五階 depth 全部回到 8。奇偶效應的討論隨之作廢。
2. **`skillLevel` 不再送給引擎**。有 `fallible` 設定時一律送 20，讓引擎自己的候選擾動
   不干擾我們要挑的排序。該欄位只留作 `game_sessions.ai_difficulty` 的持久化值與
   `rungForSkillLevel` 的反查鍵，五個值必須保持相異。

第一版結論 1（不注入隨機手）**維持有效**，並升級成 `maxLossCp` 這個可檢查的守衛。

## 改動範圍（第二版）

| 檔案 | 改動 |
| ---- | ---- |
| `src/modules/chess-engine/fallible-pick.ts`（**新增**） | 挑手純函式：窗口過濾、mate 保護、注入式 RNG |
| `src/config/difficulty-tuning.ts` | 表換成五組窗口；depth 全回 8；`FallibleConfig` 型別定義 |
| `src/modules/chess-engine/play-engine.ts` | 每次搜尋自送 MultiPV 與 Skill Level；收集全部候選；bestmove 時替換 |
| `src/views/PlayView.vue` | 傳 `fallible` |

**明確不改**：`handshake.ts` 的 `MultiPV 1`（與 review 分析路徑共用，開寬會污染分析）、
Supabase schema、`data-sync`、`game-export`。

## 驗收條件（第二版）

1. **引擎實際收到寬搜尋設定**：unit test 斷言有 `fallible` 時送 `MultiPV 50` ＋ `Skill Level 20`，
   無 `fallible` 時送 `MultiPV 1` ＋該階自己的 skill level。
2. **候選解析與替換正確**：unit test 餵一串 `info … multipv N …` 後接 `bestmove`，
   斷言回傳的 `bestMove` 是窗口內的替代手而非引擎的 bestmove；`bestmove 0000` 時絕不替換。
3. **窗口守衛**：表的每一階 `maxLossCp` < 400；機率與 cp 帶隨階數單調收窄。
4. **舊續玩存檔不壞**：`resume.ts` 的 `level` 存 0–20 任意值，讀到表外的值還原成最接近的階。
5. **全量 `npx vitest run` 0 fail**。
6. **★ 真正的目的**：Eason 實玩最低階**贏得了**。這條不能自動化，由 Eason 判定；
   輸了就調機率與 cp 帶（**先加機率，不要加 `maxLossCp` 到 400 以上**），不改判準。

## 不做什麼

- 不讓子（material odds）——Eason 2026-08-01 否決
- 不抓 lichess opening explorer 打包開局書（見上，外部依賴＋建置期成本）
- 不引入 Maia／lc0（另一套引擎 runtime；日後做「陪練角色」時才評估）
- 不做 `ai_difficulty` migration

---

## 第一版（2026-07-29，已被第二版取代）

> 以下保留原文供追溯。**參數表與結論 2、3 已被推翻**，不要照著實作；
> 結論 1（不注入隨機手）仍然有效。

### 問題

`play-engine` 只送 `setoption name Skill Level`，接著 `go movetime 3000`：無 depth 上限、
無 `UCI_LimitStrength`。搜尋資源遠超 lichess 最高的 level 8（depth 12 / 400ms）。
**當時的「難度 0」不是最低難度**，而且 21 個檔位彼此幾乎無差異（全部 depth 無限，
差別只來自 Skill Level 的隨機擾動）。

### 參數表（抄 lichess level 1/2/3/4/6）🪦 已作廢

| 檔 | Skill Level | Depth | Movetime |
| ---- | ---- | ---- | ---- |
| 一 | 3 | 1 | 50ms |
| 二 | 6 | 2 | 100ms |
| 三 | 9 | 3 | 150ms |
| 四 | 11 | 4 | 200ms |
| 五 | 17 | 8 | 300ms |

**為什麼抄而不自己算**：本輪跑了五輪自製測量（勝率 ×4、cpLoss ×1），結論是勝率度量在
5–6 局樣本下不可靠（同一組對比兩輪結果相反）。lichess 這張表經幾百萬局真實對局調校，
樣本量差五個數量級。測量的產出是**理解**不是參數。

> 🪦 第二版查證：這張表本身有一半是啞彈（負 Skill Level 被 Stockfish 拒收），
> 「經幾百萬局調校」對 level 1–3 並不成立。

#### 三個實測結論

1. **不注入隨機手**（✅ 仍有效）。cpLoss 量測顯示隨機注入產生的是「崩盤型的弱」（median 低、
   ≥300cp 崩盤 5–6/56），玩家贏了知道是對方送的；depth 限制產生「持續小虧型的弱」
   （median 高、崩盤 0/56），才是要的那種。前者＝chess.com 低階 bot 的反面教材。
2. 🪦 **depth 6 以上人類分不出**：d6 vs d10 六局五局分不出勝負。
   ——第二版推翻：這只說明 depth 不是可用的難度旋鈕，不代表該把 depth 壓低。
3. 🪦 **奇偶效應在 skill=0 時會放大**（d3 輸 d2 0:5），故表必須連 skill 一起帶。
   ——第二版作廢：五階 depth 統一為 8，且 skill 不再送進引擎。

### 驗收條件 🪦 已由第二版取代

1. 引擎實際收到 depth：斷言送出的字串含 `go depth 1 movetime 50`。
2. 舊續玩存檔不壞。
3. 歷史紀錄舊局標籤正確。
4. 全量 vitest 0 fail。
5. ★ Eason 實玩檔一贏得了。——**這條沒過，才有第二版。**
