# 對局難度階梯重製

> **性質**：dev-flow 階段 2 spec（規模＝中）。純對局難度層——不動棋誌／棋憶／課程／賽後檢討。
> **狀態**：★ 待 Eason 核可。核可前不寫實作碼。
> **緣起**：Eason 實測「學完課程仍贏不了難度 0」。查證後根因**不在課程系統**——對手從未被調弱。

## 問題

`play-engine` 只送 `setoption name Skill Level`，接著 `go movetime 3000`：無 depth 上限、
無 `UCI_LimitStrength`。搜尋資源遠超 lichess 最高的 level 8（depth 12 / 400ms）。
**現在的「難度 0」不是最低難度**，而且 21 個檔位彼此幾乎無差異（全部 depth 無限，
差別只來自 Skill Level 的隨機擾動）。

## 參數表（抄 lichess level 1/2/3/4/6，已 Eason 核可）

| 檔 | Skill Level | Depth | Movetime |
| ---- | ---- | ---- | ---- |
| 一 | 3 | 1 | 50ms |
| 二 | 6 | 2 | 100ms |
| 三 | 9 | 3 | 150ms |
| 四 | 11 | 4 | 200ms |
| 五 | 17 | 8 | 300ms |

**為什麼抄而不自己算**：本輪跑了五輪自製測量（勝率 ×4、cpLoss ×1），結論是勝率度量在
5–6 局樣本下不可靠（同一組對比兩輪結果相反）。lichess 這張表經幾百萬局真實對局調校，
樣本量差五個數量級。測量的產出是**理解**不是參數——三個進 spec 的結論見下。

### 三個實測結論（決定了本 spec 的形狀）

1. **不注入隨機手**。cpLoss 量測顯示隨機注入產生的是「崩盤型的弱」（median 低、
   ≥300cp 崩盤 5–6/56），玩家贏了知道是對方送的；depth 限制產生「持續小虧型的弱」
   （median 高、崩盤 0/56），才是要的那種。前者＝chess.com 低階 bot 的反面教材。
2. **depth 6 以上人類分不出**：d6 vs d10 六局五局分不出勝負；全力的 mean cpLoss 是 3，
   d6 是 38——都遠強於初學者，多切檔位沒有產品意義。
3. **奇偶效應在 skill=0 時會放大**（d3 輸 d2 0:5）。lichess 用 depth 3 多年無事，
   因為 Skill Level 的候選擾動蓋過它——所以本表**必須連 skill 一起帶**，不可只改 depth。

## 改動範圍

| 檔案 | 改動 |
| ---- | ---- |
| `src/config/difficulty-tuning.ts`（**新增**） | 五檔參數表。gameplay 值一律 data-driven（coding-standards） |
| `src/modules/chess-engine/play-engine.ts` | `play()` input 加 optional `depth`；`go movetime T` → `go depth D movetime T`。**僅此一處**，不碰模組邊界 |
| `src/views/PlayView.vue` | `chosenLevel` 改為檔位（1–5），查表後把 skill/depth/movetime 傳給 engine |
| `src/components/play-setup-modal.vue` | 21 格 → 5 檔。**視覺走 ui-design-flow ⓪，不在本 spec 內定案** |
| `src/utils/game-history-mappers.ts` | `DIFFICULTY_RANGES` 對齊五檔的 skill 值（純顯示層） |

**明確不改**：Supabase schema（`ai_difficulty` 續存 skill level，CHECK 0–20 仍成立）、
`data-sync`、`game-export`（PGN 仍寫 `Stockfish {N}`＝真實 skill level，語意正確）。

### 架構落點（已確認）

隨機手注入原本要放哪的問題**隨結論 1 消失**。剩下的 `depth` 參數放 `play-engine` 是安全的——
它仍只是 UCI 字串組裝，不需要 chess.js、不碰 `PlayResult` 的「only objective chess data」邊界、
不違反 ADR-0002 的 postMessage-only IPC。

## 驗收條件

1. **引擎實際收到 depth**：unit test 斷言 `postMessage` 送出的字串含 `go depth 1 movetime 50`
   （檔一），五檔各驗一次參數與表一致。
2. **舊續玩存檔不壞**：`resume.ts` 的 `level` 存的是 0–20 任意值；讀到不在新表內的值時
   還原成最接近的檔位，不拋錯、不白畫面。
3. **歷史紀錄舊局標籤正確**：既有對局的 `ai_difficulty`（0–20）仍顯示合理標籤。
4. **全量 `npx vitest run` 0 fail**（不是只跑相關 suite）。
5. **★ 真正的目的**：Eason 實玩檔一**贏得了**。這條不能自動化，由 Eason 判定；
   輸了就回頭調表，不改判準。

## 不做什麼

- 不做 `ai_difficulty` migration（見上，不需要）
- 不引入 Maia／lc0（另一套引擎 runtime；日後做「陪練角色」時才評估）
- 不動課程／試煉／深化——**那些的方向是否要調，等本項上線後 Eason 重玩一輪再判斷**
  （現在的「課程沒用」證據來自壞掉的對照組，不可信）

## 施工順序

1. `difficulty-tuning.ts` + `play-engine` 的 depth 參數 ＋ unit test（AC 1）→ 驗證：測試綠
2. `PlayView` 接表 → 驗證：dev server 實跑一局，確認引擎回手速度明顯變快
3. `game-history-mappers` 對齊 ＋ resume 邊界（AC 2/3）→ 驗證：測試綠
4. 選單 UI → **走 ui-design-flow ⓪➊**，Eason 挑樣張後才施工
5. 收尾：全量 vitest ＋ precommit-review ＋ Eason 實玩驗 AC 5
