# 概念深化頁 — 廢側門、概念地圖通向「更深一層」

> **性質**：方向重構（vision-blessed）。**Supersedes `concept-tab-tactic-entry.md`**（側門加法版）——側門整套拆除，概念地圖改為通向各戰術的「深化頁」。
> **北極星依據**：`production/gambit-differentiation-vision.md` §2 決策 2（課程體驗重設計 ③ 教你怎麼想 + ④ 慢課），Open Questions 已列「概念深化頁」。
> **狀態**：設計拍板（Eason 2026-06-21，先設計再整包做 + 全 8 概念）。實作後補跑 `/design-review` 確認與 learning-loop §3.5 一致。
>
> **§0 修訂註記（2026-06-23，待 Eason 拍板）**：原 spec §2.2 已被 2026-06-22「Neve 收手」redesign（commit `30dccf1`/`df5402d`）取代——深化頁主體（薄殼 `ConceptDeepenView` + 共用 `LessonPlayer` + 8×3 罐頭收手三關 + epiphany 鉤子）**已 ship**。本次增訂處理「雜訊盤面+變體池+交錯遞回」後續磚：§2.2 改寫為實作現況、新增 §10–§13。**設計 workflow 判決＝MINIMAL**（非全量 BUILD）——理由見 §13：① 內容驗證基建（Stockfish 唯一解閘門）尚未存在、現有 data test 有「只驗合法不驗唯一解」的致命洞；② epiphany 鏈未在真機驗過；③ 深化頁 vs signpost 的策略歸宿未定（active.md L60）。故全量擴充擋在兩 gate 後，先做最小可驗版。

---

## 1. 為什麼

側門（`?from=concept` 跳進入門課）解的是「非初學者想直接學某戰術」，但它與新北極星（2026-06-16）的「課程長在你自己棋上 / 慢課 / 教你怎麼想」軸不對齊：側門只是**提前看同一堂入門課**，沒有「更深」。新方向把概念地圖從「入門課的捷徑」升級成「**每個你遇過的戰術 → 走更深一層**」的門。

入門課（線性 track）回答「這是什麼圖案」；深化頁回答「**在更亂的盤面自動看出它**」——服務 ③（怎麼想，不是背步）+ ④（慢，一個局面坐久）。

## 2. 設計

### 2.1 核心轉變
- 概念地圖不再側門跳進入門課。**入門課留在線性課程 track 原位不動。**
- 點概念卡 → 新路由 `/learn/concept/:conceptId`（深化頁）。
- 整套 side-door 機制拆除（見 §6）。

### 2.2 深化頁內容（教學法）— 已被 6-22「Neve 收手」redesign 取代，以下為對齊版

> 原文（3–5 步 Socratic + 夾敘述步 + 結尾一句回望）已過時。實作收斂為下列「收手三關」。

- **固定 3 互動步＝Neve 一段一段放手**（每步皆有 `expectedMove`，無獨立敘述步）：
  - **step0 指給你看**：`highlights` + `arrows` 齊備，文案敘述定義（她示範怎麼看）。
  - **step1 只問一句**：`highlights` 給、文案「換你看／換你收」（她收回敘述、留視覺鷹架）。
  - **step2 沉默**：`highlights: []` 清空、文案統一「這一個，我不說了…自己找找看」。
- **「沉默」的定義邊界**：step2 仍保留 `hint` 與「揭曉答案」逃生梯（與 step0/1 同），所謂沉默**僅指 highlights 清空 + 文案不指方向**，非拿掉所有輔助。揭曉的 `arrows` 只在 `answerRevealed && !solved` 時畫。
- **收尾＝essence 回味卡**（`completionMode='overlay'`，棋盤留場、caller 自彈窗）。**全程零求助**（`unaided`）才多顯 Neve 第一人稱認可句「這一輪，我一句都沒提醒你」+ 觸發 **epiphany 棋誌筆**。`unaided` 判定＝`LessonPlayer.usedAidThisSession`（走錯／按提示／按揭曉答案皆設 true），`complete` 時 `unaided = !usedAid`。
- 進度雙訊號：`deepened`（Supabase `concept_deepened` 雲端 SoT，ADR-0011）+ `deepenedUnaided`（localStorage-only，跨裝置 SoT＝寫出的 epiphany journal entry）。
- Neve 語氣（教學態見 `persona-neve.md`）、**clean-room 自寫**、**每個 FEN/走法 chess.js 實證**（受內容授權 + 棋理兩護欄）。
- **v1 範圍 = 全 8 概念**（已 ship）：material / fork / pin / mate / skewer / discovered / defense / center。每張卡都通向真實深化頁，地圖行為一致。

### 2.3 概念地圖狀態（守「不要第三顆待辦點」教訓）
- **維持 已學 / 已練 兩顆點不變**（已學＝入門課線性完成；已練＝解題達標）。side-door 拆除後，已學**只讀線性 `completed`**（不再聯集 `sideLearned`）。
- 深化完成**不加第三顆彩點**——改卡片低調文字：未深化「深入 ›」、已深化「重溫 ›」。平靜、非計分、非待辦。
- 深化頁**不上鎖**（Calm 無鎖鐵則），不要求先完成入門課。已學/已練/已深化三者彼此獨立的安靜狀態。
- 守 §2 Player Fantasy：地圖仍是「你熟了哪些」的平靜反映面，只是每格現在能往深走，不是待辦清單。

## 3. 架構（共享渲染器）

- 從 `LessonView` **抽出 `<LessonPlayer>`**：棋盤幾何 + 步進互動（提示/揭曉/重試/上下步）+ 教練氣泡打字機 + finished 轉場引擎。Props：`steps / playerColor / title / backTo / backLabel`；emit `complete`；slots：`#completion-card`（收尾卡內容）、`#completion-actions`（收尾頁腳動作列）。
- `LessonView` 與新 `ConceptDeepenView` 都變薄殼包 `<LessonPlayer>`：各自帶自己的 guard / 進度寫入 / 返回 / 收尾卡 + 動作列。**`fromConcept` 條件分支整個消失**（每 caller 自帶設定）。
- 資料：`src/data/concept-deepening/` 匯出 `Record<ChessConcept, ConceptDeepening>`，`ConceptDeepening = { conceptId; title; intro: string; steps: LessonStep[] }`。**複用 `LessonStep`**，不另造型別。
- 進度：`concept-progress` store（已管 `practiceSolved`）加 `deepenedConcepts: Set<ChessConcept>` + `markDeepened` + 雲端同步，**取代** `sideLearned`。

## 4. 路由與返回

- 新 `{ path: '/learn/concept/:conceptId', name: 'concept-deepen', component: ConceptDeepenView, meta: { fullBleed: true } }`。
- 深化頁返回鍵 / 收尾返回 → `/learn/concepts`，`aria-label`「返回概念」。
- 未知 conceptId → `router.replace('/learn/concepts')`。

## 5. Calm-rule 合規

無 streak/timer/leaderboard/XP/分數；無「未達成」/「X/8」；西洋棋用語城堡/騎士/主教；狀態以文字+icon 非僅顏色；CJK 不用 italic。深化頁無鎖。

## 6. 拆除清單（side-door 一次清乾淨）

- `ConceptMapView` 的 `?from=concept` tap → 改 `/learn/concept/:id`。
- `LessonView` 的 `fromConcept` 全分支（guard 豁免、提前學註記、`markSideLearned` vs `markComplete`、`backTo`、aria）——隨抽 `<LessonPlayer>` 一併移除。
- `lesson-progress`：`sideLearned` ref / `markSideLearned` / `isLearned` 的 sideLearned 聯集 / `syncFromCloud` + `reconcileOnLogin` 的 sideLearned 分支。`isLearned` 改為 `=== isCompleted`（或 caller 直接讀 `isCompleted`）。
- `data-sync`：`loadSideLearned` / `upsertSideLearned`。
- `learning-loop/mastery.ts`：`learned()` 的 sideLearned 聯集分支 → 只讀 `completed`。
- **保留**：賽後檢討 signpost（`?from=lesson`）、Bridge 1/2/3、已練（concept-progress practiceSolved）。

## 7. Supabase

- 新表 `concept_deepened (user_id uuid, concept_id text, created_at)`，`UNIQUE(user_id, concept_id)` + RLS（owner-only，比照 `lesson_side_learned`）。
- `lesson_side_learned` 表**留著不刪**（避免破壞性 DROP；停用即可，資料無遷移必要——side-door 本就邊緣使用）。
- **migration 由 Eason 手動套 + gate**（比照 011/ADR-0014）。注意 noir worktree 共用 origin，timestamp 錯開。

## 8. Acceptance Criteria

**自動（blocking）：**

1. **8 概念深化資料合法**：每概念 deepening 的每個 FEN 含雙王且 chess.js 可載；每個 `expectedMove` 在該 FEN 為合法走法；宣稱將殺者 `isCheckmate()` 真為 true。*(data test)*
2. **深化完成寫獨立訊號**：完成某概念深化 → `conceptProgress.deepenedConcepts` 含該 id；`lessonProgress.completed` / `isUnlocked` / `nextLesson` **皆不變**。*(store/unit)*
3. **共享渲染器無回歸**：抽出 `<LessonPlayer>` 後，既有 lesson 單元 + e2e（lesson 流程）全綠，行為不變。*(既有測試)*
4. **側門已除**：`?from=concept` 不再有任何 production 引用；`grep` 0 命中（測試除外）；帶 `?from=concept` 進 LessonView 不再有豁免分支。*(grep + component)*
5. **概念卡導向深化**：點任一概念卡 → `/learn/concept/:id`；返回落在 `/learn/concepts`，aria「返回概念」。*(component)*
6. **地圖狀態**：已學讀 `isCompleted`（非聯集）；已深化卡顯示「重溫 ›」、未深化「深入 ›」；無「未達成」、無第三顆彩點。*(component)*
7. **Calm/Gambit 合規**：`gambit-compliance.test` 對概念地圖 + 深化頁全綠（無 未達成/streak/emoji/象棋用語/CJK italic）。*(grep)*
8. **觸控目標 ≥44px**：每張可點概念卡 boundingBox ≥ 44×44。*(Playwright)*

**手動（advisory）：**

9. **視覺走查**：深化頁讀起來比入門課「更深一層」、Neve 語氣平靜；概念地圖仍是反映面非待辦；木盤主題吃到、無 lichess 深盤漏；CJK 不 italic。截 概念地圖 + 一個深化頁完局 二畫面。

## 9. 測試衝擊

- `tests/unit/views/concept-map-view.test.ts`：改 tap 斷言（→ `/learn/concept/:id`）、已學讀 isCompleted、深入/重溫 文字。保留不變式（無未達成）。
- `tests/unit/stores/lesson-progress-store.test.ts`：移除 sideLearned 測試（或改為「無 sideLearned」迴歸）。
- `tests/unit/learning-loop/mastery.test.ts`：`learned()` 移除 sideLearned 聯集分支測試。
- 新 `tests/unit/data/concept-deepening.test.ts`：§8-AC1 chess.js 驗證。
- 新 `tests/unit/stores/concept-progress-store.test.ts`（或擴充）：deepenedConcepts/markDeepened + AC2 不污染。
- `tests/unit/learning-loop/gambit-compliance.test.ts`：納入深化頁 view，保留全綠。

---

# 後續磚增訂（2026-06-23，MINIMAL 判決，待拍板）

> 設計 workflow（7 agent，含「signpost 才是歸宿」反方）判決＝**MINIMAL**。下列 §10–§12 是「雜訊盤面+變體池」的完整設計（未來全量擴充時照此做）；§13 規定**現在只做最小可驗版**，全量擋在兩 gate 後。

## 10. 變體池（Variant Pool）

**問題**：現在每概念是固定一條 3 步序列，重訪永遠同一盤 → 會變成背座標。變體池讓「重溫」換盤，製造「我是真的看出來、不是背的」。

- **資料形狀遷移**：`ConceptDeepening.steps: LessonStep[]` → `variants: LessonStep[][]`。每個 inner array 仍是一條完整 3 步收手梯度（step0→1→2）。舊單序列＝`variants.length === 1` 的退化情況，**零破壞遷移**（既有 8 概念全部以長度 1 遷移，行為不變）。
- **變體單位＝整條 triplet，不是單步**：收手三關的放手節奏與 step2 統一文案「這一個，我不說了」必須整條成立，跨 triplet 混步會語意斷裂。
- **決定性選法（零 AI、可重現鐵則）**：`variantIndex = deepenedCount[conceptId] % variants.length`。第一次進＝variant0（乾淨示範）、重溫＝下一條。**無 `Math.random`、無 LLM**，輸入只有一個持久整數。
- `concept-progress` STORAGE_KEY 加 `deepenedCount: Record<ChessConcept, number>`（localStorage-only，比照 `deepenedUnaided`），`markDeepened` 時對該概念 `++`。**須確認從 store return 導出**，否則 view 取 index 得 undefined。
- **N 不必大**：新手不會刷到記住多條序列；重點是重溫不重播。MINIMAL 階段只給 fork 加第 2 條變體；驗證手感後才談補 N=2 全 8 概念、再到 N=3。
- **`deepenedCount` localStorage-only 是刻意取捨**：清快取/換裝置重置成 0 → 又從 variant0 開始（只影響換盤體感、不影響正確性）。下游勿當 bug。

## 11. 雜訊盤面（Noise Boards）

**問題**：乾淨示範盤（只有戰術相關子）→ 接近實戰的雜訊盤（加無關子力，圖案不再一眼可見），訓練「在亂局自動看出圖案」。

- **雜訊＝「盤面雜亂度」正交屬性，與收手三關（放手度軸）解耦**——不綁 step0=乾淨/step2=最亂（否則 step2 雙重難度疊加傷 Calm）。
- **四條可程式驗證的鐵則**：
  1. **不碰戰術骨架**：解涉及的子＋王＋解法路徑格＝凍結集；雜訊子永不落凍結格、不攻擊/保護骨架成員。
  2. **不創造第二解**：Stockfish MultiPV=2 驗 PV1 與 PV2 cp 落差 ≥ 門檻。
  3. **不破壞原解**：加子後 `expectedMove` 仍是 PV1/bestmove。
  4. **不引入更亮釣餌**：雜訊子不可被白吃、不可開更短將殺。
- **放置原則**：雜訊子與骨架曼哈頓距離 ≥ 3、以兵為主（射程短最安全）、后/城堡極謹慎；總子數 ≤ 12（含雙王）防 Calm 過載。
- **難度分級（內部資料屬性、玩家側不顯示任何計量）**：L0 乾淨 0 子／L1 +2~3 兵為主距骨架 ≥3／L2 +4~6 含 1~2 輕子像真實中殘局。
- **center（開局原則）類概念例外**：開局多手等價、無唯一解 → 若日後加變體，驗證改「弱規則：該步確實佔/攻中央 d4/d5/e4/e5 四格之一」，**不套 ==bestmove 唯一解門檻**。

## 12. 內容驗證三道 gate（補現有 data test 缺口）

> 現有 `concept-deepening.test.ts` 只驗 FEN 合法／expectedMove 合法／side-to-move=白／mate `isCheckmate` — **完全沒驗唯一解/最佳解/對手反駁**。這正是棋理護欄記載的 6-21「chess.js 全綠卻被反殺」陷阱；雜訊盤是假戰術高發區，N 倍放大此風險。三道全過才入資料檔：

1. **chess.js**：合法 + mate `isCheckmate()` + **白王不在被將**（新增；雜訊子可能誤造非法/被將局面）。
2. **Stockfish MultiPV（新 gate，現無）**：node 端一次性 `@spike` 腳本（不進 CI 預設套件、不進 runtime bundle、不拖 vitest），複用 `depth-22-spike` 的 Worker+UCI harness。`setoption MultiPV 2` + `go movetime 5000`（對齊 iPhone ≤5s/局面）。
   - 戰術題：PV1 bestmove == `expectedMove` 且與 PV2 cp 落差 ≥ 200cp（約兩兵）；fork/skewer/discovered 額外驗「對手最佳應對下白方淨賺子力」（chess.js 驗不出的反駁層）。
   - mate 題：PV1 = mate-in-N（N 與原步一致），PV2 不得是同 N 或更短 mate。
   - center 類：改弱規則「佔/攻中央四格」。
   - 產出 per-variant 通過清單；新增變體後手動跑一次再 commit。**這支腳本是 MINIMAL 的核心交付物之一。**
3. **對抗式棋理審查**：多 agent 各自找反駁，抓「Stockfish 全綠但有實戰反駁」的假戰術（6-21 正是靠它抓到 2 個）。批次加雜訊後必跑。

## 13. MINIMAL gate + 退場/重定位條款

- **狀態：MINIMAL 先行**。主體（8×3 乾淨盤）已 ship 不拆；雜訊盤+變體池**全量擴充擋在兩 gate 後**。
- **Gate 1（signpost 成熟度）**：signpost Phase C+ 把 fork/pin 對局回推上線 + 真機觸發率達 **[待定義量化門檻]**。理由：內化的真正歸宿可能是 signpost（北極星①「課程長在你棋上」），深化頁是「離開你的棋、回罐頭局面」的並行面，等 signpost 養肥後深化頁可能降級成 signpost 的目的地內容。
- **Gate 2（自身實機驗）**：`unaided → deepenedUnaided → epiphany` 鏈在 iPhone 真機點通一次（合成事件本機/Playwright 測不到）。
- **MINIMAL 範圍（兩 gate 之間唯一動作）**：fork 1 個雜訊盤沉默關 variant + 先建 Stockfish 唯一解閘門腳本 → 驗「雜訊盤手感 + unaided + epiphany」核心假設。**成立** → 未來 signpost 養肥後再決定擴或併；**不成立** → 停/pivot，只賠 1 個概念的內容。
- **第三層「時間軸主動遞回」明確延後**：真正該「隔時間帶回來」的是「你上週被捉雙輸子那一手」，歸宿在 signpost（賽後第 N 次認出同 concept → journal 推一筆中性回望 pen，與 epiphany/arrival 同 SettleSnapshot 模式），**不是深化頁長一個獨立 scheduler**（違反 YAGNI + active.md L60）。
- **退場/重定位條款**：若 Gate 1 後判定深化頁該併入 signpost，退場路徑＝深化頁內容降級為 signpost 目的地（從真實對局點進）、概念地圖入口弱化，並連帶重畫 vision §5 付費邊界。

## 14. 新增 Acceptance Criteria（MINIMAL）

**自動（blocking）：**

- **AC-V1**（形狀遷移無破壞）：`steps` → `variants`，8 概念全部以 `variants.length===1` 遷移，既有單變體行為完全不變。
- **AC-V2**（決定性選擇）：同 `deepenedCount` → 同 `variantIndex`；無 random/LLM。
- **AC-V3**（計數持久化+導出）：`deepenedCount` 隨 `markDeepened` ++、從 store return 導出、`reconcileOnLogin` 不重置。
- **AC-N1**（雜訊不破壞唯一解）：每雜訊 variant 過 Stockfish MultiPV——戰術題 PV1==expectedMove 且與 PV2 ≥200cp；mate 題 N 不變且 PV2 非同/更短 mate。
- **AC-N2**（不引入更亮釣餌 + 雙王安全）：雜訊子不可白吃、不開更短將殺；side-to-move=白、白王不被將、總子數 ≤12。
- **AC-N3**（兩軸解耦）：雜訊等級是內部屬性，玩家側不顯示「難度 X/3」「雜訊 L2」等任何計量；step2 不與最高雜訊強制綁定。

**手動（advisory）：**

- **AC-M1**（核心假設可驗）：fork 有 ≥1 雜訊盤沉默關 variant、過三道 gate；iPhone 實機點通「沉默關走對 → unaided → epiphany 棋誌寫入並顯示」+ 重溫換盤手感。
- **AC-C1**（Calm）：地圖仍只「深入›/重溫›」兩態、不加第三顆彩點、不上鎖、無「X/N 變體」「還有 N 盤」量詞；變體輪替對玩家隱形。
