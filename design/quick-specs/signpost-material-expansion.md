# 棋憶 signpost 概念擴充 — material「無守衛之子」可證明子集 v1

> ⚠️ **施工點已全數失效（2026-09-05，棋憶 wave 2）——判斷仍有效，file:line 一律不可照抄**。
> 本文件的 §3 起處處把施工位置寫死在 `src/modules/learning-loop/recognition-runtime.ts` 與
> `src/components/memory/RecognitionSignpost.vue`（含路由 `?source=recognition`），這三者已整支刪除。
> **新落點**＝`src/components/memory/KeyMomentsCard.vue` 的深青互動格（`cells` 陣列與 `deepSources` 快照）。
> 其中「一屏一卡、mate > material 排他」那條規則在 carousel 形態下**已不是同一個問題**——一次只有
> 一格在畫面上，它變成排序與配額問題，不是互斥問題。真要施工 P2 時照現況重寫 §3，不要沿用行號。
> 仍然有效的部分：§1 的四層誠實性落差、§2 的可證明子集定義、D1–D6 的裁決與那兩個門檻數字。
>
> **性質**：概念擴充設計案。回應 Eason 2026-07-11 拍板：「擴 signpost 概念覆蓋（material）需先過設計——『唯一最佳』無 chess.js 級證明、review 引擎無 MultiPV，勿直接寫 code」（`production/session-state/active.md:97-99`）。本文件即該設計案。
> **狀態**：**Accepted——2026-07-13 Eason 拍板，D1–D6 全數照推薦定案**（含 D2 推翻率門檻 5%、D4 召回門檻「數週內平均 <1 次/5 局即檢討」兩個數字正式生效）。施工前仍須依序過 §3.3 上線前置——**下一步＝D6 離線量測腳本**（推翻率 ≤5% 才開旗施工）。
> **輸入**：5 份現況盤點（pipeline／classifier／engine／gate／vision）＋ 4 份路線提案（provable／engine／ux／skeptic）＋ 8 份雙 lens 對抗審查（honesty／engineering，全數 MAJOR-REVISE、零 KILL）。本文件＝總編收斂稿：provable 為骨架、ux 的提問語意與文案紀律、skeptic 的量測前置、engine 派降為 v2 條件路徑；全部 critical 發現的修正已內建為規格條件（對照表 §2.3；替代案去處 §4）。
> **北極星依據**：`production/gambit-differentiation-vision.md:62-65` 決策②-①「課程長在你自己的棋上」；mate signpost 全鏈已通（active.md:44-45）。

---

## 1. 問題陳述與誠實性難題

### 1.1 要做什麼

mate 的「棋憶 signpost → 判斷場」鏈已上線：review COMPLETE 時擷取「你有殺沒下」的局面（`src/modules/learning-loop/missed-mate.ts:80-107`），棋憶頁亮一張安靜的卡，點進去在你自己的局面上重新判斷。material（錯過拿子的機會）是拍板點名的下一個概念——新手最常見的失誤型態就是看不見沒人守的子。

### 1.2 為什麼難——四層誠實性落差

判斷場的不可協商鐵則：**系統對玩家說的每一句話都必須為真**。mate 能通過，是因為它有 binary oracle；material 沒有現成的：

1. **無「唯一最佳」的 chess.js 級證明**。mate 靠 `isCheckmate()` 窮舉證明「恰好一手將死且＝引擎手」（missed-mate.ts:48-60）；「你錯過的最佳手」對 material 沒有等價的規則層證明（active.md:98 拍板原文）。
2. **classify.ts 的 material 訊號方向相反**。`hungUndefendedMaterial` 偵測「玩家放任被吃」（防守方視角、看對手實際回手，`src/modules/learning-loop/classify.ts:49-92`）；「錯過吃子」是進攻方視角、要看玩家**沒走**的那手之後的假設後果——不同構，只能借它的 `attackers`／`PIECE_VALUE` 工具（classify.ts:36,78），不能挪用判準。missed-mate.ts:1-12 對 mate 已做過同一組區分。
3. **引擎資料的結構限制**。review 是單 PV（`src/modules/chess-engine/handshake.ts:35`）、parser 不分 multipv 索引（`src/modules/chess-engine/review-engine.ts:271-290`）、pv 不持久化（`src/modules/post-game-review/use-post-game-review.ts:46`）；Pass2 deep（depth16）從 ply 0 順跑、12 秒總預算截斷（use-post-game-review.ts:349-357；`src/config/engine-tuning.ts:27`）——iPhone 上 deep 覆蓋通常只有開局前綴，**任何「只信 deep」的偵測器在目標裝置上結構性近死**（ux 案 engineering critical 的核心發現）。
4. **誤判代價是人格級的**。對玩家說「你錯過了」而其實沒有（他晚一手就吃到了、或那顆子其實有守衛）＝臆測意圖＋失誤標籤，違反 `design/gambit-design-system/persona-neve.md:64-67`；repo 已有兩輪「chess.js 全綠仍藏假戰術」前科（CLAUDE.md 棋理護欄）。

### 1.3 破題——把提問改寫成可證命題

四份提案與八份審查收斂出同一個可行核：**不問「你錯過的最佳手是什麼」（不可證），改問「那一刻，盤上有一顆沒有守衛的子可以拿」（每個成分規則層可證）**：

| 文案成分 | 證明 | 等級 |
| --- | --- | --- |
| 「沒有守衛」 | `chess.attackers(目標格, 對方色).length === 0`（classify.ts:78 同判準） | chess.js 規則層事實 |
| 「可以拿」 | best 是合法吃子＋走完後對方零合法回吃該格 | chess.js 窮舉 |
| 「只有這一手」 | 全域唯一性窮舉（§2.2 條件 10） | chess.js 窮舉（missed-mate.ts:48-60 同構） |
| 「那一刻」 | 目標子追蹤（§2.2 條件 11）——只做時點主張，不宣稱持續狀態 | chess.js 決定性重放 |
| 「你當時沒拿」 | moves[i]≠best 且目標子未被玩家事後吃到 | 棋譜事實 |

引擎（bestMove、cpLoss、evalCp）**降格為佐證與雜訊濾網，不再承擔誠實性**——這一刀同時化解「deep-only 結構性近死」與「preview 無背書」的兩難（§2.7）。

## 2. 建議設計

### 2.1 一句話

新增純函式偵測器 `selectMissedFreeCaptures`（新檔 `src/modules/learning-loop/missed-material.ts`），鏡像 missed-mate.ts 的形狀：只讀既有持久資料（analysisResults ＋ `buildFenSequence` 重建的 fens，use-post-game-review.ts:67-83），**零引擎呼叫、零新持久欄位、免 bump ANALYSIS_CACHE_VERSION**（use-post-game-review.ts:56——只讀既有欄位）。收「幾何零守子、一步可拿、全域唯一、機會確實消失」的最嚴子集，寧漏勿誤（classify.ts:6-7 prefer-silence 文化在擷取端的貫徹）。

### 2.2 偵測器規格（收錄條件，**按此順序求值、任一不成立即短路**）

> 求值順序是規格的一部分（cheap-first，對抗審查兩案 engineering minor 的修正納入規格）：窮舉只發生在過了廉價濾網的少數 ply，COMPLETE watch 同步執行（`src/views/MemoryView.vue:130-145`）不掉幀。主執行緒成本估 <50ms/局【未驗證——量測腳本順帶實測】。

ply i 收錄 iff 全部成立：

1. **isPlayerMove(i)**（missed-mate.ts:91 同構）。
2. **curr = analysisResults[i] 存在且 `curr.evalMate === undefined`**——有殺局面歸 mate 管線；mate（evalMate===1）與 material 對同一 ply **偵測互斥**，是 §2.4-3 idOf 免遷移的前提，需 unit test 釘住。
3. **cpLoss[i] ≥ `MISSED_MATERIAL_MIN_CPLOSS`（建議 200）**（computeCpLoss 既有 F2 公式，use-post-game-review.ts:100-116）。定位＝佐證（實際那手確實明顯更差），**非**機會倖存證明——倖存由條件 11 承擔（修 ux 案 honesty major「cpLoss≠倖存」的假對應）。
4. **curr.evalCp 存在且 ≥ `MISSED_MATERIAL_MIN_EVAL`（建議 −100）**——排除「在大輸局撿子」的敘事失真（量級閘；evalCp 已持久化、零成本）。
5. **best = curr.bestMove 存在、UCI 長度 4**（升變手整段跳過——RecognitionMove 無 promotion 欄位，`src/types/recognition.ts:16-19`；比照 missed-mate.ts:95）。
6. **moves[i] ≠ best，且 `moves[i].slice(2,4)` ≠ 目標格**——玩家已用另一手（含升變吃，只比 to 格）吃向同一目標 → skip（修 provable 案 honesty critical「玩家實戰已用錯的子吃下同一目標」）。
7. **chess.js 在 fens[i] 重放 best**：是吃子（`move.captured`）、非 en passant（flags 'e'）非升變吃（flags 'p'）（classify.ts:69 同排除）、被吃子 V = PIECE_VALUE[captured] ≥ `MISSED_MATERIAL_MIN_VALUE`（建議 3＝輕子起跳；PIECE_VALUE 複用 classify.ts:36）。
8. **幾何零守子**：在 fens[i] 上 `chess.attackers(目標格, 對方色).length === 0`（classify.ts:78 同判準）。**繼承而非反轉 classify.ts:81-84 的保守讀法**：守子被絕對牽制的「實質無防守」局面一律 skip——那是牽制課、不是懸子課，且文案「沒有守衛」在盤面上會是肉眼可證的假話（修 provable／engine 兩案 honesty critical/major 的同點收斂）。
9. **走完 best 後的三檢**（全量窮舉對方合法著法，含升變）：
   - 對方**零合法回吃**落在目標格——覆蓋條件 8 蓋不到的 discovered-defender 情境（我方吃子讓開線路使對方後排子恢復守格）；
   - 對方**尚有合法著法**：無合法著法＝`isStalemate()` → skip；吃完 `isInsufficientMaterial()`（死和）→ skip（修 ux 案 honesty critical「把和棋手教成正解」；chess.js 內建 API，repo 使用先例引 `src/modules/game-lifecycle/use-game-lifecycle.ts:71-73`【未驗證】）；
   - 對方所有回應中**無任何一手 `isCheckmate()`**（「吃了被一步將死」的反駁 → skip）。
10. **全域唯一性窮舉**（在 fens[i] 窮舉玩家全部合法著法，**全量含 en passant／升變**——排除範圍明文化，修 provable 案 honesty major 的漏檢）：
    - 不存在玩家的任何一步將死（存在 → skip：判斷場滑回真殺著＝說謊；missed-mate.ts:48-60 同構精神）；
    - **免費子全值域唯一**：除目標子外，不存在任何其他「幾何零守子且玩家有合法吃法」的對方子——**不限 V≥3、含兵**。理由：提問「有一顆子沒有守衛」對免費兵同樣為真，玩家吃兵是字面真答案、不能被滑回後又按「沒有」被記 missed（修 ux 案 honesty major 的提問契約縫隙）；
    - **吃向目標格的玩家著法恰好一手（＝best）**：目標子有兩條吃法 → skip——防「用另一子吃同一目標被判錯」（provable 案 honesty critical #2 的判斷場端修正；同時使 expectedMove 單值契約免改，見 §2.5）。
11. **目標子追蹤——機會確實消失且玩家事後沒吃到**（單一機制取代提案原 fens[i+2] 單點檢查，同時修「時間量詞說謊」「游走懸子雙卡」「倖存檢查假對應」三組審查發現）：從 fens[i] 起沿**實際棋譜**追蹤目標子所在格，窗長 W = `MISSED_MATERIAL_TRACK_PLIES`（建議 4，即兩個完整回合）：
    - 任一著法 to == 追蹤格（該子被吃）：吃方必為玩家 → **玩家晚幾手拿到了 → skip**（防「說你沒看見、其實你下一手就吃了」）；
    - 對手著法 from == 追蹤格 → 追蹤格更新為其 to；
    - 每逢玩家待走的局面（i+2、i+4）：以追蹤格重跑條件 7-10 的免費判定——**仍免費 → 機會未消失 → skip**（同一持續懸子只在消失前最後一個 ply 收錄一次；游走懸子因追蹤而不出雙卡）；
    - 窗內該子未被玩家吃且不再免費 → 機會消失成立 → **收錄**；
    - 對局在窗內結束（fens[i+2] 不存在）→ 收錄（機會隨對局結束確定消失；比照 missed-mate.ts:97-98 的缺值語意，此處明文化）。

排序：V 降冪、ply 升冪 tie-break；cap `RECOGNITION_SOURCE_MAX = 3`（`src/config/learning-loop-tuning.ts:32` 既有值）。

### 2.3 誠實性機制總表（謊點 → 防線）

| 潛在謊點（對抗審查發現） | 防線 | 級別 |
| --- | --- | --- |
| 「沒有守衛」但被牽制的守子站在旁邊（provable/engine honesty critical/major） | 條件 8 幾何零守子＋繼承 classify 保守讀法 | chess.js 證明 |
| 玩家實戰已用錯的子吃下同一目標（provable critical） | 條件 6（實戰端）＋條件 10 恰好一手（判斷場端） | 棋譜事實＋窮舉 |
| 「一直站在那裡」時間量詞 vs 一瞬機會（provable critical） | 文案全面時點語意（§2.6）＋條件 11 | 文案合約 |
| 另有免費兵／升變吃是字面真答案被判錯（ux/provable major） | 條件 10 全值域唯一（含兵、含 e/p） | 窮舉 |
| 吃了變僵局／死和被教成正解（ux critical） | 條件 9 終局檢查 | chess.js 證明 |
| 吃了被一步將死（ux critical） | 條件 9 反殺窮舉 | 窮舉 |
| 「你沒看見」但玩家晚一手吃到（ux major） | 條件 11 追蹤 → skip | 棋譜重放 |
| 在大輸局撿子、敘事失真（ux/provable minor） | 條件 4 量級閘 | 既有欄位 |
| zwischenzug／離格反擊使白吃實際不划算（各案共同殘餘） | 引擎佐證（best==吃子＋cpLoss）＋文案不承諾「賺」＋§2.7 離線推翻率量測 | 機率壓制＋量測 |

最後一列是本設計**唯一以機率壓制而非證明閉合**的謊點——文案因此絕不寫「拿了就賺／不吃虧」（§2.6），且上線前必須量出殘餘誤率（§2.7）。

### 2.4 store 與整合點

**recognition-source store（`src/stores/recognition-source.ts`）泛化——本磚最大的規格細節，逐條明定**（回應 provable/engine 兩案 engineering 的全部 critical/major）：

1. **conceptId 欄位**：sources 條目加 `conceptId: 'mate' | 'material'`；load() 舊條目無 conceptId 一律補 `'mate'`（型別過濾器 recognition-source.ts:29-37 同步擴充——漏擴充＝material 條目重載後被靜默丟棄，需 persist round-trip 測試釘住）。
2. **著法欄位**：`mateMoveUci` 泛化為 `moveUci`；舊資料處理＝讀取端一行映射 shim（`s.moveUci ?? s.mateMoveUci`，註記下版移除）或一次性丟棄靠重擷取自癒——**決策點 D3**。builder（`src/modules/learning-loop/recognition-runtime.ts:27`）與 load() 過濾器連動同步改。
3. **idOf 維持二段式 `gameId:ply` 不動**（recognition-source.ts:18）：條件 2 保證 mate/material 對同一 ply 偵測互斥、不可能撞鍵 → **零 consumed 遷移、`ConceptDeepenView.vue:72` 的 markConsumed 鍵零改動**（直接化解 provable 案 engineering critical「consumed 遷移缺失＋已解局面復活」）。idOf 旁註記：日後新增與 mate 非互斥的概念時必須三段化＋遷移。
4. **pendingFor per-concept 化**（recognition-source.ts:101-108）：`conceptId !== 'mate'` 硬 gate（:103，管線唯一概念判別點）改為概念→kill-switch 查表；**latestGameId 改為「該概念自己的 unconsumed 最後一筆」per-concept 計算**——修「material 寫入使 mate 卡靜默消失」與「關旗後殘留條目污染 latestGameId」（provable/engine engineering major 同點收斂）。v1 只有 mate 條目時 per-concept 行為 == 現行為，測試釘住此不變式。
5. **最近 3 局 trim 改 per-concept**（recognition-source.ts:81-90）：防連續 material 局把窗內含 mate 的局整批擠掉。
6. **kill switch**：新增 `RECOGNITION_MISSED_MATERIAL_ENABLED`（鏡像 learning-loop-tuning.ts:34-41），**gate 讀寫兩端**——寫入端不擷取、讀取端在 latestGameId 計算之前先按 conceptId+flag 過濾 → 既存 localStorage 條目零行為殘留（複製 `tests/unit/stores/recognition-source-store.test.ts:138-156` 測試 pattern）。

**其餘整合點**：

- `src/views/MemoryView.vue:130-145`：同一 COMPLETE watch 加跑 material selector（idempotent，dedup 由 store 保證）。部署後開舊局棋憶會**追溯擷取**（分析快取命中直達 COMPLETE，use-post-game-review.ts:48-59）——配合下一條的文案去時間指涉後可接受，列入觀察。
- `src/components/memory/RecognitionSignpost.vue:20-37`：conceptId 參數化（可見性、文案、路由 `/learn/concept/material?source=recognition`）；**排他規則＝一屏一卡、mate > material**；**文案去時間指涉**（「有一盤棋」而非「你剛下完的那盤」，:27-28 現文案）——同一刀修掉 per-concept latest 下 mate 卡跨局漂移、與追溯擷取指向舊局兩個文案謊點。
- `src/modules/learning-loop/recognition-runtime.ts:18-39`：intro/prompt/missedHint/successText 依 conceptId 分支（現為 mate 寫死，:31-38）；builder 輸入型別隨 store shape 泛化。
- `src/config/learning-loop-tuning.ts`：kill switch ＋ MIN_VALUE(3)／MIN_CPLOSS(200)／MIN_EVAL(−100)／TRACK_PLIES(4) 四個 knob。
- `src/views/ConceptDeepenView.vue:22-36`：**零改動**——已按 conceptId 泛化讀 pendingFor、建 runtimeSet；material 無罐頭 recognitionSet 無妨（signpost 只在 pending 非空時現身，runtimeSet 必然存在；罐頭缺席時判斷場不出現是既有行為，ConceptDeepenView.vue:34,60-67）。
- **不碰**：`src/types/recognition.ts`、`RecognitionBoard.vue`、`handshake.ts`、`review-engine.ts`、分析快取 schema。

### 2.5 gate 契約

- **全 kind:'real'、無 decoy**——與 mate 動態路徑同一論證：窮舉證得出「有」、證不出「沒有」（recognition-runtime.ts:1-13）。罐頭目錄的 real+decoy 契約測試只掃靜態 recognitionSets（`tests/unit/data/recognition.test.ts:28-34`；目前僅 fork/mate 兩鍵，`src/data/concept-deepening/recognition.ts:13,49`），material 不進罐頭故不受管轄、免造誘餌。
- **expectedMove 維持單一 `RecognitionMove{from,to}`**（types/recognition.ts:29 不動）：多正解在擷取端源頭消滅（條件 10），`RecognitionBoard.vue:104-110` 的精確比對與無懲罰滑回完全複用。
- declareEmpty「這裡沒有」→ missed → missedHint 重看提示：誠實成立，因為收錄局面已窮舉證明確有一顆無守衛之子。
- Stockfish uniqueness spike 不適用也不需要：唯一性由 chess.js 離線窮舉保證（證明等級高於 PV1−PV2 落差），且動態擷取局面本就不進 spike 掃描範圍（spike 只掃 conceptDeepenings 罐頭，`tests/e2e/concept-deepening-uniqueness-spike.spec.ts:42-46`）——與 mate 動態路徑靠 isUniqueOneMoveMate 而非 spike 把關完全同構。

### 2.6 Neve 文案方向（文案紀律合約，吸收 ux 案）

**每句文案對應一個已證 predicate（§1.3 表）；不可證的不寫。** 絕不出現：「最佳一手」「你會贏」「不吃虧」「錯過／失誤」標籤、時間量詞（整局／一直）、任何數字。方向草案（實作時逐句過對抗式人格審查——判斷場文案不在 `tests/unit/learning-loop/gambit-compliance.test.ts:10-19` 自動掃描清單，人工審查必做，CLAUDE.md 文案語氣護欄）：

- signpost 卡：「有一盤棋裡，有一顆子，那一刻沒有守衛。」
- 判斷場 prompt：「這個局面，有沒有一顆沒人守的子可以拿？」
- successText：「就是它。那一刻，它沒有守衛——這次你拿下了。」
- missedHint：「回頭再看一遍——有一顆子，那一刻沒有人守著它。」

（時點語意「那一刻」是條件 11 的直接後果：收錄的全是「機會存在過、隨後消失」的一瞬窗口，宣稱持續狀態必為假——provable 案 honesty critical #3 的修正內建於語形。）

### 2.7 深度政策與離線量測（上線硬前置）

- **v1 收 preview ply、不硬性要求 pass==='deep'**。理由：deep-only 在 iPhone 結構性近死（Pass2 從 ply 0 順跑、12s 總預算截斷，use-post-game-review.ts:349-357、engine-tuning.ts:27；懸子高發的中殘局幾乎全是 preview）——ux 案 engineering critical 的結論直接採納。誠實主張本體已由 chess.js 承擔（§1.3），引擎僅佐證。
- **代價誠實記帳**：preview 端 cpLoss 是 preliminary（isCpLossFinal 對「任一端 preview」明文不 final，use-post-game-review.ts:122-131）；preview bestMove 有小機率看漏離格反擊。因此——
- **上線硬前置＝離線量測腳本**（scratchpad node 腳本；node 直驅 Stockfish＝`.claude/docs/technical-preferences.md:90-94` 明文的「設計階段快速自驗」定位，`factory('lite-single')`＋`sendCommand`）：對既有對局樣本（來源＝決策點 D6）全量跑 selector →（a）**命中率**（每局平均收錄數，對照退場門檻）；（b）對收錄樣本以 depth16+ 重算 →**推翻率**（深算後 bestMove 不再是該吃子、或評分翻轉的比率）。**推翻率 ≤ 門檻（建議 5%，決策點 D2）才開旗**；超標 → v2 引擎補算閘啟動（§4.1）。腳本輸出的收錄實例同時餵**對抗式棋理抽查**（多 agent 找反駁——CLAUDE.md 棋理護欄的既有要求，此處對象是偵測器輸出樣本，回應 ux 案 honesty minor「回報通道不存在」的批評：抽查在上線前做、不依賴玩家踩雷）。
- 這支腳本同時用數據回答「兵納不納入」「MIN_CPLOSS 200 vs 150」兩個 knob 題。

### 2.8 觸發率計數 lite（吸收 skeptic B3，修正 dedupe）

capture 端「本局收錄筆數」＋ signpost「首次曝光」（以 pending 批次 gameId 去重，防重訪重複計數——skeptic 案 engineering major 的修正）兩個計數落 localStorage，dev seam 讀取。定位＝退場條款的可觀測性前提（無計數則「數週不亮」無法歸因——engine 案 engineering minor 點名的最貴結局）。是否隨磚上線＝決策點 D5。

## 3. MINIMAL 範圍 ＋ 退場條款

### 3.1 只做

material 一個概念、動態路徑 only（符合擴池 HOLD 拍板，active.md:97）；§2.2 最嚴子集全 11 條；全 real 無 decoy；交付＝一個 selector 檔＋store 泛化＋signpost 參數化＋runtime 文案分支＋四 knob＋一 kill switch＋計數 lite＋離線量測腳本。

### 3.2 明確不做

不做交換結算／SEE、不收兵為目標（V≥3）、不收多步組合戰術（依賴假設性 pv＝GDD 延後 fork/pin 同理，`design/gdd/learning-loop.md:186-204`）、不收升變（雙向：best 是升變 skip、另有免費升變吃 skip）；不動 gate 型別、不碰引擎（零 MultiPV）、不 bump 分析快取、不建 material 罐頭、不做跨裝置同步（mate 同病、既列升級路徑 active.md:45）。

### 3.3 上線前置（依序，缺一不可）

1. 本文件拍板；
2. 離線量測過雙門檻（命中率＋推翻率，§2.7）；
3. 收錄樣本對抗式棋理抽查無 critical；
4. 文案 3-lens 對抗式人格審查過。

### 3.4 退場條款

- kill switch 一鍵零行為殘留（讀寫兩端 gate，§2.4-6）。
- 觀察期（比照 mate 拍板的「真實使用數週」）：material signpost 出現率過低（門檻＝決策點 D4）→ 判定最嚴子集召回不足 → pivot 至 v2（引擎補算放寬）或放寬 knob；只賠 selector 檔＋文案＋量測腳本。
- 實測或抽查出現任一例誤判提問 → 立即關旗、回量測循環。
- **誠實記帳（單向門）**：store 的 conceptId／per-concept pendingFor／trim 泛化對 mate 向後相容、退場後留用不回滾——這部分不在「只賠一個 selector」的帳裡（provable 案 engineering minor 的修正：不誇稱零殘留）。

## 4. 被否決或延後的替代案與理由

### 4.1 engine 派（COMPLETE 後 MultiPV=2 補算閘）→ 延後為 v2 條件路徑

- **為何不進 v1**：(a) 其 honesty critical 證明 cp-gap 閘擋不住「同樣滿足提問描述但 cp 較差的手」——性質唯一性無論如何都要 chess.js 窮舉（recognition-runtime.ts:10-12 早已寫明 eval dominance ≠ 性質唯一性）；窮舉做了之後，MultiPV 的邊際價值只剩「深度佐證」，而這可由離線量測免費取得。(b) 其 engineering critical：verify 模組建立在不存在的 worker API 上（review-engine 的 `_worker` 閉包私有，review-engine.ts:82-88,328-333），必須動全案最敏感檔案＋獨占機制＋screenedGameIds 承重決策＋bound 行 parser——工程費 M-L，換的只是佐證。
- **v2 觸發條件**：離線推翻率 > 門檻，或未來放寬判準（交換／多步）需要引擎背書。
- **吸收入 v2 前置清單**：(b′) 時點（COMPLETE 後、signpost 亮之前；結果只寫 recognition store、**絕不回寫 analysisResults** → biggestSwingCursor 不受影響，use-post-game-review.ts:283-292）；parser 必須濾 lowerbound/upperbound 行（runtime analyze() 有濾、spike parser 沒濾，review-engine.ts:271-276 vs spike:124-128）；MultiPV 用後還原紀律＋review-engine 先設計官方 seam；screenedGameIds 持久化＋screeningVersion。

### 4.2 ux 派（acceptedMoves 多正解型別遷移）→ v1 否決、條件重開

- **為何否決**：條件 10 在源頭消滅多解後不需要；遷移動已上線契約四處（types/recognition.ts:29、RecognitionBoard.vue:104-110、fork/mate 罐頭、recognition.test.ts:51-60），與新功能捆一磚違反一磚一事；其 deep-only 前提被自己的 engineering critical 判結構性近死。
- **吸收**：存在性提問語意（§1.3）、文案紀律合約（§2.6）、cheap-first 求值順序（§2.2）、isCpLossFinal 語意意識（§2.7）。
- **重開條件**：量測顯示「多枚免費子 skip」佔比高到吃掉大半召回 → 先做獨立的「acceptedMoves 語意中性遷移」磚（單獨上線＋完整回歸），再做放寬磚——照其 engineering 審查的兩磚拆法。

### 4.3 skeptic 反方（mate 先做深、material 不做）→ 核心論證被推翻、方法論被吸收

- **被推翻的部分**：「material 無 oracle」——本案證明窄形式存在（幾何零守子＋全域唯一免費吃法＝與 isCheckmate 同級的規則層可證命題；skeptic 自己的 openQuestion 也預留此可能）。「等 mate 數據」的機會成本：唯一數據源是 Eason 個人使用（零遙測、樣本小週期長），且 mate 觸發率隨棋力提升自然下降——被動等待會讓 signpost 學習迴圈荒著。
- **吸收**：量測前置精神（→§2.7 升格為上線硬前置）；B3 計數（→§2.8，修 dedupe）；**B1 升變殺著解鎖＝獨立候選磚**、不併本案（其 engineering 審查確認 effort=S、核心宣稱屬實，但 accept-set 計算時點與升變 UI 保真度兩個 major 需先補規格）。
- **B2 動態誘餌盤＝不排入**：自身雙 critical——把客觀好手（將軍捉雙、mate-in-2 起手）演成陷阱＝直接說謊；recognition store 無版本機制 × PWA 舊分頁會把 decoy 當 real 盤宣告假將死。可修但需獨立設計案；其問題意識（動態判斷場全 real → 玩家學會「答案永遠是有」→ 判斷退化成執行）記入 §6，是 mate/material 動態路徑共同的長期債。

### 4.4 material 罐頭 recognitionSets → 否決

擴池 HOLD 拍板明文否決手工罐頭 variant（active.md:97）；且罐頭路徑強制 real+decoy 契約（recognition.test.ts:28-34）＝吞下誘餌造題這個「全案最大未知」（`design/quick-specs/concept-deepening-page.md` §15.11）。

## 5. Eason 決策點（✅ 2026-07-13 全數拍板＝照推薦；D2 取 5%、D4 取 <1 次/5 局）

- **D1 收錄門檻與兵**：目標子 V≥3（兵不當目標），但唯一性排除全值域含兵（另有免費兵即整筆 skip）。推薦照此；理由：兵目標教學張力低、雜訊高，但不做全值域排除會讓「吃免費兵」這個字面真答案被判錯。
- **D2 深度政策與推翻率門檻**：v1 收 preview ply、以離線量測「depth16+ 推翻率 ≤5%」為開旗硬前置；超標走 v2 引擎補算。推薦照此；理由：deep-only 在 iPhone 結構性近死（12s 前綴截斷），誠實主張已由 chess.js 承擔，5% 是初始值需拍板。
- **D3 store 舊資料處理**：`mateMoveUci`→`moveUci` 用讀取端一行映射 shim（註記下版移除）vs 一次性丟棄靠重擷取自癒。推薦 shim；理由：一行成本保住已亮的 mate pending 卡不無聲消失。
- **D4 mate/material 競合與退場門檻**：一屏一卡、mate 優先、被壓的 material 隨 per-concept 規則自然過期（靜默丟棄，不做補位狀態）；觀察期出現率門檻建議「數週內平均 <1 次/5 局即檢討」。推薦照此；理由：零新狀態、material 資料非稀缺（下一局再產），門檻數字需拍板。
- **D5 觸發率計數 lite 是否隨磚上線**：推薦是（兩計數＋gameId 去重＋dev seam 讀取）；理由：退場條款需要可觀測性，否則「數週不亮」無法歸因、停損判斷變成拍腦袋。
- **D6 離線量測樣本來源**：Supabase 已同步對局跑一次性腳本（推薦）vs 本機 3 局快取 vs 加 dev counter 收數週。理由：樣本量足、立即可跑，depth16+ 重算順帶得出推翻率，不用等數週。

## 6. 開放問題與工時粗估

### 6.1 開放問題

- 追蹤窗 W=4 ply 夠不夠（vs 掃到局終）：W 大→「晚很多手才吃到」也 skip（召回降）；W 小→「晚三手吃到」仍被說沒看見。建議 4 起步、量測數據回頭調。
- **決定性張力（收 preview 的代價）**：同一局在不同裝置 deep 覆蓋不同 → cpLoss 數字可能不同 → signpost 出現與否可能裝置間不一致，與「從持久狀態決定性推導」文化有張力。量測時順帶觀察；嚴重則改用 isCpLossFinal（需重新面對召回）。
- missed-mate.ts 自身的 pass 未過濾缺口（classifier 盤點點名，missed-mate.ts:80-107 未見 pass 過濾）是否順修——另立決定，不進本磚。
- 「動態判斷場全 real → 答案永遠是有」的判斷退化（skeptic B2 的問題意識）——mate/material 共同長期債，等獨立的誘餌設計案。
- `docs/architecture/control-manifest.md:99-100` Review Hash=32 vs handshake.ts:32 Hash=16 既存落差——本案不修，僅記錄。
- material 深化頁既有 3 步課程與判斷場的體驗銜接順序——實作時看實機手感。

### 6.2 工時粗估（誠實記帳——比 provable 案自估 1-2 session 高，因量測前置與 11 條修正條件內建）

| 塊 | 內容 | 估 |
| --- | --- | --- |
| 離線量測腳本＋跑數據＋抽查樣本整理 | scratchpad node 腳本（chess.js selector＋depth16+ 重算） | 1 session |
| selector＋追蹤器＋fixtures | ~250 行純函式＋~17 個測試局面 | 1 session |
| store 泛化＋signpost＋runtime 文案＋回歸 | ~150 行＋既有測試改 | 0.5–1 session |
| 文案人格審查＋棋理抽查（人工兩輪） | | 0.5–1 session |
| **合計** | | **3–4 sessions（M）** |

fixture 最小清單：牽制守子 skip／discovered-defender 回吃 skip／第二免費子（兵）skip／免費升變吃 skip／en passant skip／目標雙吃法 skip／mate-in-1 共存 skip／吃後僵局 skip／吃後死和 skip／吃後被反殺 skip／玩家晚吃 skip／游走懸子單卡／窗內對局結束收錄／偵測互斥（同 ply mate vs material）／store round-trip（舊格式補 conceptId）／kill switch 讀寫兩端零殘留／per-concept latest 對 mate-only 資料行為不變。