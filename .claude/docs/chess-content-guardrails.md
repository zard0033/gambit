# Chess Content Guardrails

觸發時機：新增或修改 `data/lessons/*`、`data/puzzles/*`、`data/concept-deepening/*` 的局面，
或潤飾 `design/gambit-design-system/persona-neve.md` 相關文案。其餘工作不需要讀這份檔案。

> **課程／練習題棋理護欄**：新增或修改 `data/lessons/*`、`data/puzzles/*` 的局面後，
> 內容閘門測試（`tests/unit/data/*.test`）只驗「FEN／走法合法、mate 題結尾將死」，
> **不驗**最佳解、子力交換結算、概念是否匹配。必須額外用 chess.js 實證：將殺宣稱跑
> `isCheckmate()`、子力交換逐步推算、確認 expectedMove／solution 是客觀最佳解、局面
> 真的匹配要教的概念。2026-06-14 一次審出 10 處「合法但棋理錯」（假將殺、升變送子變和棋、
> 加防守者範例、釘后概念不成立等），全數 chess.js 驗證後才修。
> **chess.js + 手動實證仍驗不出「對手有反駁」**（戰術根本不成立）：批次新增教學內容
> （`data/lessons/*`、`data/puzzles/*`、`data/concept-deepening/*`）後，**加跑一次對抗式棋理審查**
> （多 agent 各自找反駁）。2026-06-21 概念深化頁就靠它抓到 2 個 chess.js 全綠、卻被 `Qe8`／`Kxd8`
> 反殺、白方反丟子的「假戰術」——單元測試與人工逐步推算都漏了。
> **對抗式審查也會漏，最後一道＝Stockfish 唯一解閘門**：批次新增/修改戰術局面後，跑
> `tests/e2e/concept-deepening-uniqueness-spike`（MultiPV=2、≤5s/局面、@spike CI 排除；
> `CONCEPT=<x>` 可單跑一概念）。它對每個 `expectedMove` 驗「PV1==教學手 且 PV1−PV2 ≥200cp」
> （將殺題：唯一 mate-in-N）——抓得出對抗審查漏的「贏了子卻 K+單馬 vs K 和棋／白方仍落後／
> 被更簡單手支配」。2026-06-23 此閘門首跑即在過了 2 輪對抗審查的 shipped 深化內容裡抓到 6 處
> （fork#2 假贏成和棋、pin#2 靠對手送子、mate#2 非唯一將殺、discovered#1 被直接吃后支配…）。
> defense／center 概念本質多解，閘門對它們走 weak-rule（不驗唯一性）。
> **weak-rule 下「pv1==教學手」只是 REVIEW、必要非充分**：2026-06-24 重做 defense#2 時，Stockfish
> pv1 ✓matches 卻仍藏「城堡被自家王守＝『補不了防守』假前提」＋「Rd4 反擊對稱→K+R vs K+B 和棋」
> 雙缺陷，是對抗式棋理審查（gate ③）抓出的、閘門放行。故 weak-rule 概念的把關主力＝gate ③，閘門
> 只證「教學手不是被支配的爛手」。對抗審查 prompt 要明問「前提是否屬實／反擊是否對稱／概念是否唯一可讀」。

> **文案語氣護欄**：批次「潤飾 Neve 文案」（純改字、零棋理）後，跑一次對抗式人格審查
> （多 lens 對 `design/gambit-design-system/persona-neve.md` 逐句 verdict），別只信 vitest／
> persona-lint——它們只驗硬規則（FEN／走法合法、無 emoji／車馬象／blame／digit），**驗不出語氣退步**
> （丟 motif 定義線索、評判腔、丟方向性）。2026-06-23 一輪文案收斂即靠 3-lens（register／自然度／
> 懷疑論者）審出 3 處退步、vitest 815 全綠：pin brief 丟「動不了」、fork brief「不該」帶評判、
> mate-in-2「離角落不遠」丟逼王方向動態。與上面「棋理護欄」同構：硬閘門驗不出的，靠對抗式審查補。

> **內容授權護欄**：lichess 題庫位置／解法＝CC0，可商用直接採；lila／chessops／Learn 課文
> ＝copyleft（**禁抄**），教學文一律繁中 clean-room 自寫；棋子 Gioco Wood＝CC BY-NC-SA 4.0
> （已在 `public/CREDITS.md` 標註）、棋盤 Wood12＝CC0。引入任何外部內容前先確認授權。
