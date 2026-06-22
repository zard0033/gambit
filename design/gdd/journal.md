# Journal（棋誌 · Neve 記憶的可見載體）

> **Status**: In Design
> **Author**: Eason + Claude（design-system, lean mode）
> **Last Updated**: 2026-06-16（design-review 後 v1 範圍收斂為 啟程＋④＋⑤）
> **Implements Pillar**: 差異化北極星 ②（靈魂教練 Neve）＋ ③（安靜文學式旅程）
> **North Star**: `production/gambit-differentiation-vision.md` §3「棋誌規格」
> **Brief**: `production/session-state/active.md`「棋誌・發想定稿」
> **Governing ADR**: `docs/architecture/adr-0013-journal-data-model-and-session-boundary.md`

## Overview

棋誌是 Neve 一個人寫的、寫「你」的一本書——她記憶的可見載體。它是一條 append-only 的時間軸，每一筆都是 Neve 第一人稱、平靜、綁在一個**真實時刻**的短句：你來的第一天、你走完一個章節、你輸了卻沒有慌的那一段時間。它不是統計（沒有勝率／rating／準確率——那會撞平靜魂），是一本越來越厚、值得回頭重讀的成長之書。棋誌承載 Eason 最初構思的「累積／LEVELUP 感」，但用「回頭重讀一本書」取代「進度條／等級數字」。它是差異化重構 Phase 1 的「心臟」：建立記憶資料模型 ＋ Neve 文學語氣，讓後續「課程長在你自己的棋上」「蘇格拉底教學」全插進來用。

## Player Fantasy

> **這個 app 在看著我下棋，而且記得我。**

新手學棋最大的情緒問題是「覺得自己笨、有壓力、被羞辱」。棋誌的情緒目標不是「成就感」（那是 juice），是**被一個沉靜的人安靜地見證**。你做對了一件事，不會跳彩帶、不會 +50 XP；而是隔幾天回到棋誌，看見 Neve 用她的話記下了那一刻——「今天你走完了規則這一卷。你沒有回頭。我記下來了。」那種「有人一直在、記得我怎麼走到這裡」的溫度，是 chess.com 不會給的。對標是 Calm 不是 chess.com：棋誌要讓人**想回來重讀**，像翻一本關於自己的、越來越厚的書。

而且這本書從你**第一次出現**就開始——啟程筆讓書在第一個 session 就有第一頁，新手不會打開一本空書（design-review 鐵律：心臟必須先跳一次，才有資格挑剔）。

低潮時尤其重要：你輸了棋，棋誌**永不批評**，Neve 只是溫柔地記下你沒有慌的那一段。被她認可，重——因為她不輕易讚美，而且陪伴筆**不會蓋過**你掙來的正向時刻（priority 修正，見 F2）。

## Detailed Design

### Core Rules

**R1 — 只有 Neve 寫。** v1 使用者不寫、不能編輯、不能刪單筆。棋誌是 Neve 的書，不是使用者的筆記本。

**R2 — append-only 時間軸。** 每筆有不可變的 `created_at`，依時間倒序顯示（最新在上；啟程恆在最底＝書的第一頁）。已寫的筆不重寫、不更新。

**R3 — 七種筆（pen），v1 實作三種（啟程＋④＋⑤）。**

v1 範圍鐵律（Eason 2026-06-16 拍板）：只做**從持久狀態可推導**的筆——啟程、④ 抵達、⑤ 陪伴。①②③⑥ 依賴上游尚未產生的事件或數月累積，全部 Phase 2，資料模型已預留 `type`，無需 migration 即可接。

| # | pen（type） | 觸發語意 | register | v1 | 可回放 |
|---|---|---|---|---|---|
| ⓪ | `onset`（啟程） | 第一次真正使用（首個 session）的歡迎・見證起點 | 教學態·第一人稱（短） | ✅ | 否 |
| ① | `epiphany`（頓悟） | 沒用提示就答對一個戰術 | 教學態·第一人稱 | ⏳ Phase 2 | 否 |
| ② | `move`（對局的一筆） | 一盤裡冷靜／漂亮的一手 | 教學態·第一人稱 | ⏳ Phase 2 | 是（深連局面） |
| ③ | `weakness-arc`（弱點克服弧線） | 某戰術從「N 次漏掉」→「今天抓到」 | 教學態·第一人稱 | ⏳ Phase 2 | 是 |
| ④ | `arrival`（階段抵達·回望） | 走完一個章節（卷） | 教學態·第一人稱（稍長） | ✅ | 否 |
| ⑤ | `solace`（低潮的陪伴） | 輸棋時的溫柔記，**永不批評** | 教學態·第一人稱 | ✅ | 否 |
| ⑥ | `retrospect`（時間的回望） | 隔月「三個月前的你 vs 現在」 | 教學態·第一人稱（稍長） | ⏳ Phase 2 | 否 |

> **為何 v1 砍到三種**（design-review 2026-06-16）：① 讀的 lesson `motif`＋持久 `hintUsed`＋每題答對事件在 Lesson System #18 **不存在**（#18 只存 `{completed: string[]}`，motif 是 #19/#20 的 puzzle 屬性）；② 讀的 per-move「冷靜／漂亮手」訊號在 Post-Game Review #7 **不存在**（#7 只有 game-level `biggestSwingCursor`＝你最差的一手，全專案無 brilliant 概念）。且 ①② 屬「事件當下 ephemeral 捕捉」，在 iOS Safari 無可靠 app-close 事件下常無法結算。v1 三種筆全可從**已持久化狀態**重建（首次使用旗標／`lesson-progress.completed`＋階 catalog／對局結果序列），徹底繞開上游缺口、ephemeral 與 session 結算時機。①② 留待 Phase 2 與「課程長在你棋上」「蘇格拉底賽後」一起做（它們本來互餵），屆時連同上游補事件介面一起設計。

**R4 — 節制：一個 session 最多三筆（`SESSION_ENTRY_CAP = 3`）。** 一次使用最多寫三筆，且只記「真的值得的」。candidate 多於 cap 時依優先序（見 F2）取前三，否則合格者全寫。v1 三種 pen（onset 一生一次）使單 session 合格候選恆 ≤3，故 v1 等於「合格者全寫」——同一 session 的正向抵達（④）與低潮陪伴（⑤）**並存、不互相壓掉**（design-review：避免棋誌淪為一串安慰）。對上「平靜、不轟炸」：cap=3 仍克制，且 v1 實務上絕大多數 session 只會有 0–1 個候選。

> **2026-06-16 Eason 調整**：原為「最多一筆」，放寬為三。動機＝讓抵達與陪伴在同一 session 能同時被記，而非靠 priority 二選一。priority 不再做 v1 的「選一」，改為決定**顯示順序**（與 Phase 2 候選 >3 時的取捨）。

**R5 — v1：可推導重建，非 ephemeral 捕捉（design-review 2026-06-16 修正）。** v1 三種筆全部從**已持久化狀態**判定，不依賴記憶體 session 緩衝：啟程＝首次使用旗標；④＝`lesson-progress.completed` 由未含某階→含→寫；⑤＝對局結果序列推導連敗。因此 settle 可**惰性執行**（app 啟動／進棋誌／階完成或對局結束事件時評估），不需要 iOS Safari 沒有的可靠 app-close 事件。

> **Phase 2 才需 ephemeral 捕捉**：①（無提示答對當下的 motif/hintUsed）②（賽後算出的最佳手）是事件當下才存在、無法事後回溯的資料，接入時才引入「事件當下推進 session 緩衝」機制；屆時 session 邊界與 ephemeral 遺失風險（見 Edge Cases）才成為硬問題。v1 不背這個包袱。

**R6 — 去重（once-only / genuinely first）。** 每種筆有各自去重鍵，寫入前以該鍵查既有 entry，命中則不寫：

- **啟程**：`onsetWritten` 永久旗標——一個帳號一生只寫一次。
- **④ 抵達**：`stageId`——同一階永不重複記（即使跨 session 補記，見 Edge Cases）。
- **⑤ 陪伴**：非去重而是 `SOLACE_COOLDOWN` 冷卻（見 F1），防低潮筆刷頻。
- **①（Phase 2）**：`sourceMotif`——同 motif 已記過就不再以 `epiphany` 記。

去重鍵在 Supabase 以 `UNIQUE(user_id, source_ref_id)` 強制、在訪客 localStorage 以同鍵掃描（見 ADR-0013），確保訪客→登入合併不產生重複（Edge Cases）。

**R7 — 時間軸組織，卷當里程碑。** 棋誌全覽以**時間軸為組織主軸**（誌的本質）：依時間倒序、按**月份分段**，近期月份展開、更早月份收合成可點細條（收合條疊起來＝累積視覺，scroll 保持短）。啟程恆置最底（書的第一頁）。每筆仍帶 `volume`（見 F3），但**卷不再當每筆的歸屬桶**——它只在「抵達筆」上當「卷X · 名」章節里程碑小標出現（避免 solace/onset 等非學習章節的筆被硬塞進四桶而越長越雜亂）。首頁只露最近幾筆（peek，story-005）。

**R8 — 語氣硬性對齊 persona。** 全部筆遵守 `design/gambit-design-system/persona-neve.md` 教學態：第一人稱「我」對「你」、平靜、**不反射式讚美**（用「我看見了什麼」代替「好棒」）、西洋棋用語（后／城堡／騎士／主教／國王／兵）、無 emoji、CJK 不斜體。⑤ 低潮筆**永不批評、不檢討錯誤**（F1/AC 以 forbidden-token lint 強制）。

**R9 — 零 AI。** 所有筆＝寫好的模板填入真實局面數據，非 LLM 生成（守願景「核心零 AI、零邊際成本」）。因此每筆 body 是 `render(template_id, params)` 的**可決定性**輸出，可用 golden-file 斷言驗證（見 AC）。

### States and Transitions

棋誌系統本身是 append-only，無複雜狀態機；v1 的「一筆產生流程」是**惰性評估**而非記憶體 session 緩衝：

| 狀態 | 說明 | 轉移 |
|---|---|---|
| `idle` | 無待評估觸發 | 發生持久狀態變化（完成一階／對局結束／首次啟動）→ `evaluate` |
| `evaluate` | 從持久狀態算出本次合格 candidate 集合 | 有合格 → 依 F2 取 priority 前 `SESSION_ENTRY_CAP`(3) 筆寫入 → `idle`；無 → `idle` |

- **settle 時機（v1）**：app 啟動、進棋誌、階完成事件、對局結束事件——任一即觸發 `evaluate`。因全可從持久狀態重建，多次觸發冪等（去重鍵保證不重複寫）。
- **session 概念（v1）**：僅用於 ⑤ 的 `sessionsSinceLastSolace` 冷卻計數與 ④ 跨 session 補記語意，由 `SESSION_IDLE_TIMEOUT` 界定（細節入 ADR-0013）；**不**作為「必須在 session 結束前結算否則遺失」的硬邊界（v1 無 ephemeral）。

### Interactions with Other Systems

棋誌**只讀**上游持久狀態、**只寫**自己的 store/table；不修改任何上游。

| 上游系統 | 流入棋誌的訊號 | 對應 pen | 卷 | 介面擁有者 |
|---|---|---|---|---|
| App 啟動 / 首次使用 | 第一個 session（`onsetWritten == false`） | ⓪ onset | 不歸卷 | 棋誌讀 `onsetWritten` 持久旗標 |
| Lesson System (#18) | 完成一階（`lesson-progress.completed` 由未含某階→含） | ④ arrival | 該階對應卷 | 棋誌讀 `lesson-progress.completed` + 課 catalog 的 stage（皆已存在） |
| Game History (#12) / Game Lifecycle (#5) | 偵測連敗（連續 N 盤負） | ⑤ solace | 卷二戰術（預設） | 棋誌讀對局結果序列（已存在） |
| Data Sync (#11) | 雲端持久化、跨裝置同步 | 全部 | — | 透過 `data-sync` store（**不**直接 `supabase.from`，守 ADR-0011；表結構見 ADR-0013） |
| (Phase 2) Lesson #18 答對事件 | 無提示首次答對 motif | ① epiphany | 依課所屬階 | 需 #18 補：每題答對事件含 `motif`＋持久 `hintUsed` |
| (Phase 2) Post-Game Review (#7) | 賽後「冷靜／漂亮一手」 | ② move | 卷二（預設） | 需 #7 補/重定義：per-move 冷靜手訊號＋ deep-pass cpLoss；含 gameId+ply |
| (Phase 2) Game Replay / `PgnViewer` | ② 的可回放入口 | — | — | by-id replay 入口＝**棋憶 (#22)**：journal entry tap → `/review?gameId&ply` 開該局棋憶 dashboard、`ply` 直接落 replay（story-010 已接 `?ply` target；`?gameId` 載任意局待 #21 per-game ② pen 出現 caller 後再接） |

> **下游**：未來「課程長在你棋上（①深化）」「蘇格拉底賽後教學（②）」會**讀**棋誌 entry 當素材。v1 不實作，但資料模型對外穩定。**棋憶 (#22) 是 journal entry 的賽後回顧目的地**（GDD `memory.md` Rule 23：tap 一筆 entry → 開該局棋憶；雙向 deep-link 用 #7 對外的 `gameId+ply` handle）。目前 v1 entry（onset/arrival/solace）非 per-game review 筆——solace 的 `sourceRefId` 雖帶 gameId，但「tap entry→棋憶」要等 #21 的 per-game ② pen（Phase 2）才有語意正確的 caller。

## Formulas

### F1 — 每種筆的合格條件（eligibility gate，布林）

**v1 gate（啟程／④／⑤）——皆零 AI、純規則、可從持久狀態判定：**

| pen | gate 條件 |
|---|---|
| ⓪ onset | `onsetWritten == false`（此帳號從未寫過啟程筆）。零內容門檻——只要第一次來就寫 |
| ④ arrival | `stageJustCompleted == true`（某階最後一課由未完成→完成）AND `arrivalNotYetRecorded(stageId) == true` |
| ⑤ solace | `consecutiveLosses ≥ SOLACE_LOSS_STREAK` AND `sessionsSinceLastSolace ≥ SOLACE_COOLDOWN` |

**Phase 2 gate（①②，待上游補介面後接入）：**

| pen | gate 條件 | 上游缺口 |
|---|---|---|
| ① epiphany | `lessonSolvedCorrect AND hintUsed == false AND firstTimeForMotif(motif)` | #18 須補：每題答對事件含 `motif`＋持久 `hintUsed`（現只存 `completed[]`） |
| ② move | 該盤存在一手低 `cpLoss` 且為關鍵手 | #7 須補/重定義：per-move 冷靜手訊號（現只有 game-level `biggestSwingCursor`＝最差手，無 brilliant 概念） |

**Variables（v1）:**

| Variable | Type | Range | Description |
|---|---|---|---|
| `onsetWritten` | bool | — | 此帳號是否已寫過啟程筆（持久旗標，跨裝置同步） |
| `stageJustCompleted` | bool | — | 某階最後一課剛由未完成→完成（讀 `lesson-progress.completed` diff） |
| `arrivalNotYetRecorded(stageId)` | bool | — | 既有 entry 無此 `stageId` 的 ④ 筆（R6 去重） |
| `consecutiveLosses` | int | 0–∞ | 最近連續負局數（從 game-history 結果序列推導） |
| `SOLACE_LOSS_STREAK` | int | 2–5（預設 **3**） | 觸發 ⑤ 的連敗門檻；越大越嚴 |
| `SOLACE_COOLDOWN` | int (sessions) | 1–10（預設 **3**） | 兩筆 ⑤ 之間至少間隔的 session 數（防低潮筆刷頻） |

> Phase 2 變數（`cpLoss`、`CALM_MOVE_MAX_CPLOSS`、`isPivotalOrBrilliant`、`firstTimeForMotif`）接入 ①② 時定義，連同上游介面一起設計。

**Output Range:** 每個 gate 回傳 bool。**Example:** 你剛完成「規則」卷最後一課、此 `stageId` 尚無 ④ 筆 → ④ eligible = true。

### F2 — session 結算選筆（cap=3，R4）

`chosen = topN(eligibleCandidates, SESSION_ENTRY_CAP, by priority desc)`；即依 priority 由高到低取前 `SESSION_ENTRY_CAP`（=3）筆；`eligibleCandidates` 為空則不寫。**v1 合格候選恆 ≤3，故 cap 永不截斷＝合格者全寫**；priority 在 v1 只決定**顯示順序**（同一 evaluate 寫入的多筆，新覽中依 priority 由高到低排列，onset 例外恆置底）。

**優先序（priority，數字大者優先）：**

| pen | priority | 角色 |
|---|---|---|
| ⓪ onset | **5** | 只發生一次的起點＝書的第一頁（顯示恆置底） |
| ④ arrival | **3** | 章節抵達＝正向見證 |
| ⑤ solace | **2** | 低潮陪伴 |

> **Phase 2 插入**：① epiphany（4）介於啟程與抵達之間；② move（1）墊底。屆時序為 ⓪5 > ①4 > ④3 > ⑤2 > ②1；候選 >3 時 cap 才真正截斷，依此 priority 取前三。

**Output Range:** 0–3 筆寫入。**Example（v1）:** 一個 session 裡你既完成一階（④）又因連敗觸發陪伴（⑤）→ **兩筆都寫**（cap=3 未截斷），顯示時 ④ 在 ⑤ 之上。若是第一個 session 又同時完成一階：onset＋④＋⑤＝3 筆全寫。若該 session 只有連敗 → 只寫 ⑤。

> 同 priority 不會發生（每 pen priority 唯一）。④ arrival 跨 session 不丟：階完成是持久狀態，v1 因 cap 不截斷故不會被擠出（見 Edge Cases；carryover 規則保留給 Phase 2 候選 >3 的情形與穩健性）。

### F3 — 卷歸屬（volume）

`volume(entry) = volumeOf(sourceDomain)`

| sourceDomain | volume |
|---|---|
| 規則階課程／rules | 卷一 規則 |
| 戰術課／連敗 | 卷二 戰術 |
| 開局課／開局相關 | 卷三 開局 |
| 殘局課 | 卷四 殘局 |

④ arrival 的卷＝剛完成那一階對應的卷。⑤ solace（連敗）預設歸卷二戰術。**啟程不歸卷**——永遠是書的第一頁（時間最早、置於全覽最底），不參與分卷。

## Edge Cases

- **若一個 session 同時有多個合格 candidate**：依 F2 取 priority 前 `SESSION_ENTRY_CAP`（=3）筆。v1 候選恆 ≤3 故全寫；僅 Phase 2 候選 >3 時才丟棄低 priority 者。
- **啟程只寫一次**：`onsetWritten` 旗標持久且跨裝置同步；任何重整／重開／換裝置都不再寫第二筆啟程（訪客→登入合併時以固定 `source_ref_id` 去重）。
- **④ arrival 跨 session 補記（Phase 2／穩健性）**：階完成是持久事實；若某次 `evaluate` 因 cap 截斷未寫到此階 ④，下次 `evaluate` 時 `arrivalNotYetRecorded(stageId)` 仍真，重新成為 candidate（以 `stageId` 去重，永不重複記同一階）。v1 cap 不截斷，此情形不發生，規則保留。
- **若使用者連輸但未達 `SOLACE_LOSS_STREAK`**：⑤ 不觸發（避免每輸必記＝濫）。達標但在 `SOLACE_COOLDOWN` 內：不重複記。
- **若未登入（訪客模式）**：entry 寫 localStorage（local-first，key 見 ADR-0013），登入後 reconcile 上雲（以 `source_ref_id` union，append-only，與 lesson-progress 同模式，不重複、不遺失）。
- **若同一觸發因重整／重複進入被評估兩次**：以 `source_ref_id`（啟程＝固定常數、④＝`stageId`、⑤＝觸發連敗的最末 `gameId`）冪等去重，不產生重複 entry（Supabase `UNIQUE(user_id, source_ref_id)` 強制）。
- **settle 時機 / 強制關閉**：v1 因全可推導，`evaluate` 惰性執行於 app 啟動／進棋誌／階完成或對局結束；不依賴 app-close 事件（iOS Safari 不可靠）。即使瀏覽器被強關，下次啟動仍能從持久狀態重建所有 v1 candidate——**v1 無「未結算遺失」問題**（此為 ①② 接入時才需面對的 Phase 2 風險）。
- **若 prefers-reduced-motion**：棋誌的「累積感視覺」（書架長卷／光）改為靜態呈現，不做緩慢轉場動畫（守動效鐵則）；新筆出現亦無入場轉場。
- **（Phase 2）② replayRef 指向已刪除／裁切的對局**：entry 文字保留可讀，回放入口 disable 並顯示「這盤已不在紀錄裡」（文字 per persona，不報錯彈窗）；接入 ② 時實作。

## Dependencies

| 方向 | 系統 | 性質 | 介面 |
|---|---|---|---|
| 上游（硬·v1） | Lesson System (#18) | hard | `lesson-progress.completed` ＋ 課 catalog 的 stage（④ 用；皆已存在，無需上游改動） |
| 上游（軟·v1） | Game History (#12) / Game Lifecycle (#5) | soft | 對局結果序列（推導連敗）；無則 ⑤ 不觸發但啟程／④ 仍運作 |
| 上游（硬·v1） | Data Sync (#11) | hard | 透過 `data-sync` store 持久化／同步（守 ADR-0011，不直連 supabase；表結構見 ADR-0013） |
| 上游（Phase 2·硬待補） | Lesson #18 答對事件 / Post-Game Review (#7) | hard | ① 需 #18 每題答對含 `motif`＋持久 `hintUsed`；② 需 #7 per-move 冷靜手訊號＋ deep-pass `cpLoss`＋ gameId+ply |
| 上游（Phase 2·軟） | Game Replay / `PgnViewer` | soft | ② 可回放深連；需 by-id replay route（MVP `/history/:gameId`） |
| 下游 | 課程個人化①／蘇格拉底②（Phase 2） | — | 讀棋誌 entry 當教學素材（v1 不實作） |

> **雙向一致性待補**：本 GDD 上線後，需在 Lesson System (#18) 的 Dependencies 補「depended on by: Journal（讀 `lesson-progress.completed`＋stage catalog）」；Game History (#12) 補「depended on by: Journal（讀對局結果序列）」。Post-Game Review (#7) 的回填留待 Phase 2 ② 接入時，連同 #7 的 per-move 冷靜手訊號一起補。

## Tuning Knobs

| Knob | 預設 | 安全範圍 | 影響 | 太高 | 太低 |
|---|---|---|---|---|---|
| `SOLACE_LOSS_STREAK` | 3 | 2–5 | ⑤ 觸發的連敗門檻 | 很少安慰、低潮被忽略 | 輸兩盤就記，顯得濫情 |
| `SOLACE_COOLDOWN` | 3 sessions | 1–10 | 兩筆 ⑤ 間隔 | ⑤ 太稀疏 | ⑤ 刷頻、失去重量 |
| `HOMEPAGE_PEEK_COUNT` | 3 | 1–5 | 首頁露出的最近筆數 | 首頁太擠、失去「只露一角」的克制 | 看不到累積感 |
| `SESSION_ENTRY_CAP` | 3 | 1–3 | 一個 session 最多寫幾筆（候選超過依 priority 取前 N） | 一次塞太多筆＝轟炸、傷平靜 | 回到「最多一筆」，正向與陪伴只能二選一 |
| `SESSION_IDLE_TIMEOUT` | 30 min | 10–60 | session 邊界判定（僅用於 ⑤ 冷卻計數／④ 跨 session 語意） | session 過長、⑤ 冷卻過慢 | 一次使用被切成多 session、⑤ 冷卻計數失準 |

> Phase 2 接入 ② 時再加 `CALM_MOVE_MAX_CPLOSS`（② 認定漂亮一手的嚴格度）。
> 模板文案本身（per pen 的句庫）是**內容資料**（`data/journal-templates/*`），非 tuning knob，但需可獨立增修不動程式（守 data-driven 鐵則）。

## Visual/Audio Requirements

**視覺方向＝ demo C「深色沉浸」**（Eason 2026-06-16 拍板，demo 暫存 `d:\tmp\gambit-journal-demo.html`）：

- **場景**：deep-jade `#103029` 世界 ＋ 一盞燈的光（暖光暈，非純白）；光之後用 Inspira UI aurora 真做（見 `production/tooling-inspira-ui.md`，只偷氛圍元件、剝 juice）。
- **讀字載體**：暖 cream 卡片承載 Neve 的字，與深色世界對比讓字「浮」在光裡。卡片文字對比須達 AA（aurora 暖光暈勿壓低 cream 卡邊緣字的對比——art-bible/asset-spec 時驗證）。
- **字型**：Neve 的文字用課程內文 `font-lesson`（LXGW WenKai）或標題 `font-display`（BIZ UDPMincho），呼應「文學書」質感；時間戳用 `font-num`（Cubic）。卡片間若有落在 deep-jade 上的標籤，用 `ink-on-deep` 不用 `text-gold`（金限 focus/reward fill）。
- **累積感＝無字視覺**：書架長卷／深色場景隨筆數變化，**不用統計數據**（無勝率/rating/準確率）。最強累積感留給 Phase 2 的 ⑥ 時間回望。
  - **註（2026-06-22，與 memory GDD Rule 24 調和）**：此處禁的是**績效統計**（勝率/rating/準確率＝計分板）。**陪伴標記**（Neve 記得 N 盤／同行 N 天／寫下 N 篇）是另一類——量的是「我們一起走了多久」非表現好壞，由 memory GDD Rule 24 指定家在 JournalView。已實作為頁首 Neve 第一人稱**一句話**（`font-lesson`，`src/lib/journal/totals.ts`），**非數據儀表板**，故不違反本條的「無字計分板」精神。「同行 N 天」自啟程單調遞增、不重置（陪伴非 streak）。
- **動效**：只動 transform／opacity，150–300ms，緩慢優美（氛圍非 juice）；尊重 `prefers-reduced-motion`。**禁** box-shadow 動畫、彩帶、震動、彈窗慶祝。
- **音訊（選配）**：可有極輕的環境音，但 v1 不必做；棋誌不需音效回饋（守平靜）。

📌 **Asset Spec** — Visual/Audio requirements are defined. After the art bible is approved, run `/asset-spec system:journal` to produce per-asset visual descriptions, dimensions, and generation prompts from this section.

## UI Requirements

- **入口（v1）**：獨立 route `/journal` ＋ 首頁一角 peek。**不**因此提早啟用底部 tab bar（守 navigation-and-routing #2/#3：v0/v1 無持久 nav bar）；棋誌頁以**頁內返回鈕**回首頁，進棋誌靠首頁 peek 點入。`/journal` 須登記進 navigation-and-routing 的 route 表（待補一致性）。
- **首頁一角**：首頁（抵達場景）露出最近 `HOMEPAGE_PEEK_COUNT` 筆（倒序），點入進棋誌全覽。peek 區塊由 **HomeView 擁有**（非棋誌全覽元件），棋誌只提供「最近 N 筆」查詢。
- **棋誌全覽**：append-only 時間軸，依時間倒序，**按月份分段**（近期展開、舊月收合成「N 篇」可點細條＝累積視覺）；啟程恆置最底。卷不分組，僅在抵達筆當章節里程碑小標。無「編輯／刪除」按鈕（R1）。視覺＝deep-jade 沉浸（demo C）＋ Inspira beam 燈光（暖象牙燭光，非品牌金）。
- **單筆呈現**：Neve 文字（cream 紙頁卡）為主角 ＋ 安靜小標日期（font-num）；抵達筆加「卷X · 名」里程碑小標。（Phase 2：② 筆有「回到那一手」入口 → 深連 by-id replay，定位到 `gameId+ply`，不在棋誌內自繪棋盤。v1 無回放筆。）
- **未讀記號（v1 規格定案）**：以**裝置本地、單一 watermark**判定——存 `journalLastSeenAt` 時間戳（**不**同步、**非** per-entry flag），`created_at > journalLastSeenAt` 即「未讀」。記號為**二元**（有新筆／無），**永不顯示數量**（「3 則未讀」＝重新引入 stat 焦慮，禁）。顏色用**非金**柔和記號（如淡 jade／cream-dim 點；金限 focus/reward）。**只出現在棋誌視圖內**，不在 tab／首頁掛紅點 badge。看過（開啟棋誌）即更新 watermark、記號消失，不再復現。
- **空狀態**：尚無筆時（理論上僅啟程寫入前的瞬間），顯示固定空狀態文案常數（Neve 語氣，如「還沒有什麼好寫的。先下一盤吧。」per persona），非空白或 emoji。
- **觸控目標 ≥44px**；無 hover-only 互動（iPhone Safari）；內文最小 16px。

> **📌 UX Flag — Journal**: 此系統有 UI 需求。Phase 4（Pre-Production）跑 `/ux-design` 為「棋誌全覽」與「首頁一角」各出 UX spec（含空狀態子態：篩到空卷、各卷空 scaffolding；單筆卡版式），再寫引用 UI 的 story（應 cite `design/ux/journal.md`，非直接 cite 本 GDD）。本節已 pin 的三項（`/journal` route 不啟 tab bar、未讀 watermark 規格、首頁 peek 歸 HomeView）為**寫 v1 story 前必須定案**項，已定，不再延後。

## Acceptance Criteria

> 語氣／register 斷言一律以「固定 `template_id` 的 golden 輸出 ＋ forbidden-token/emoji/italic lint」驗證，不用「感覺平靜」等主觀判斷——因 R9 零 AI，每筆 body 是 `render(template_id, params)` 的可決定性輸出，golden 斷言可精確。

**啟程（onset）**

- **AC-onset-1**（Logic）**GIVEN** 全新使用者（`onsetWritten == false`），**WHEN** 第一個 session `evaluate`，**THEN** 寫入恰一筆 `type == 'onset'`，`body == render(onset_template, params)`，不歸卷、`created_at` 為最早，且 `onsetWritten` 置為 true。
- **AC-onset-2**（Logic·冪等）**GIVEN** `onsetWritten == true`，**WHEN** 任何後續 `evaluate`（含重整、換裝置、訪客→登入合併），**THEN** 不新增第二筆 onset（`count(type=='onset') == 1`）。

**④ 抵達（arrival）**

- **AC-arrival-1**（Logic）**GIVEN** 某階最後一課由未完成→完成 且該 `stageId` 無既有 ④，**WHEN** `evaluate`，**THEN** 寫入一筆 `type == 'arrival'`，`volume == volumeOf(stage)`，`source_ref_id == stageId`。
- **AC-arrival-2**（Logic·去重）**GIVEN** 該 `stageId` 已有 ④，**WHEN** 再次 `evaluate`，**THEN** 不新增（`count(arrival, stageId) == 1`）。
- **AC-arrival-3**（Logic·跨 session 補記）**GIVEN** 階 S 完成但該 session 由啟程奪得 F2、且無 S 的 ④，**WHEN** 下個 session `evaluate`，**THEN** 寫入 S 的 ④；第三個 session 再 `evaluate` 不新增（`stageId` 去重）。

**⑤ 陪伴（solace）**

- **AC-solace-1**（Logic）**GIVEN** `consecutiveLosses ≥ SOLACE_LOSS_STREAK` 且 `sessionsSinceLastSolace ≥ SOLACE_COOLDOWN`，**WHEN** `evaluate` 且無更高 priority candidate，**THEN** 寫入一筆 `type == 'solace'`，`volume == 卷二戰術`。
- **AC-solace-2**（Logic·冷卻抑制）**GIVEN** 連敗達標但 `sessionsSinceLastSolace < SOLACE_COOLDOWN`，**WHEN** `evaluate`，**THEN** 不寫 solace。
- **AC-solace-3**（Logic·禁批評 lint）**GIVEN** 任一 solace entry，**WHEN** 渲染，**THEN** `body` 不含批評/錯誤詞彙集合 {錯、失誤、應該、不該、漏、可惜} 且不含任何 cpLoss/eval 數字（forbidden-token 斷言，守 R8 永不批評）。

**寧少勿濫 / 優先序**

- **AC-priority-1**（Logic·R4 cap）**GIVEN** 任一 session 有合格 candidate，**WHEN** `evaluate`，**THEN** 該 session 新增筆數 `== min(|eligibleCandidates|, SESSION_ENTRY_CAP)` 且 `≤ 3`。
- **AC-priority-2**（Logic·並存＋順序）**GIVEN** 同 session ④ 與 ⑤ 皆合格（總候選 ≤ `SESSION_ENTRY_CAP`），**WHEN** `evaluate`，**THEN** ④ 與 ⑤ **皆寫入**（不再二選一），且顯示順序中 ④ 在 ⑤ 之上（priority 3 > 2）。
- **AC-priority-3**（Logic·cap 截斷，以合成候選測；v1 實務不發生）**GIVEN** 合格候選數 > `SESSION_ENTRY_CAP`，**WHEN** `evaluate`，**THEN** 只寫入 priority 最高的 `SESSION_ENTRY_CAP` 筆、其餘不寫。

**渲染 / 持久化 / 跨裝置**

- **AC-tone-lint**（UI·Visual）**GIVEN** 任一筆，**WHEN** 渲染，**THEN** (a) `body == render(template_id, params)`（golden）；(b) 無 emoji codepoint；(c) 若出現棋子名僅用「后／城堡／騎士／主教／國王／兵」，不含「車／馬／象」；(d) CJK 文字節點 computed `font-style != italic`。
- **AC-guest-reconcile**（Integration）**GIVEN** 訪客（未登入）已累積數筆，**WHEN** 登入，**THEN** 本地筆以 `source_ref_id` union 上雲、跨裝置（第二客戶端讀取）可見、無重複（`count == |distinct source_ref_id|`）、無遺失（每個本地 `source_ref_id` 都在雲端）。
- **AC-order**（UI）**GIVEN** ≥2 筆，**WHEN** 全覽渲染，**THEN** 依 `created_at` 嚴格倒序，啟程恆在最底。
- **AC-no-edit**（UI·R1）**GIVEN** 任一棋誌視圖，**WHEN** 渲染，**THEN** 無任何編輯或刪除控制項。
- **AC-empty-state**（UI）**GIVEN** 棋誌無任何筆，**WHEN** 開啟棋誌，**THEN** 顯示固定空狀態文案常數，元素非空、無 emoji。
- **AC-unread**（UI）**GIVEN** 存在 `created_at > journalLastSeenAt` 的筆，**WHEN** 開啟棋誌，**THEN** 顯示二元未讀記號（非數字、非金、僅棋誌視圖內）；**WHEN** 看過後再開，**THEN** `journalLastSeenAt` 已更新、記號消失且不復現。
- **AC-reduced-motion**（UI·Visual·advisory）**GIVEN** `prefers-reduced-motion: reduce`，**WHEN** 進入棋誌，**THEN** 累積感視覺節點無 running transition/animation（`getAnimations().length === 0` 或 `transition-duration: 0s`）。

## Open Questions

- **session 邊界精確值**：`SESSION_IDLE_TIMEOUT` 實測值？→ 入 ADR-0013，僅影響 ⑤ 冷卻計數/④ 跨 session 語意（v1 非硬結算邊界）。
- **模板句庫規模**：每個 pen 需幾條變體才不重複感？**v1 最低 ≥5 變體/pen**，並把具體數據（階名、卷名、連敗段落概述）注入句身而非只蓋日期戳，避免兩筆結構雷同（design-review：canned 感會殺掉差異化）。依實際觸發頻率擴充。
- **（已解決）Supabase schema / 資料模型 / 去重 / session 惰性結算**：定案於 `docs/architecture/adr-0013-journal-data-model-and-session-boundary.md`，走 Dashboard SQL Editor 手動套並更新 `supabase/README.md`。
- **（Phase 2）①② 接入**：需 #18 補每題答對 motif＋hintUsed 事件、#7 補/重定義 per-move 冷靜手訊號＋ by-id replay route；連同跨局弱點追蹤引擎（③）、數月累積（⑥）一起，資料模型已預留 `type`，無需 migration。
