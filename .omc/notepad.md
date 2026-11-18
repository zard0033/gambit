# Notepad
<!-- Auto-managed by OMC. Manual edits preserved in MANUAL section. -->

## Priority Context
<!-- ALWAYS loaded. Keep under 500 chars. Critical discoveries only. -->
Epic: 全站視覺重構（2026-11-17 起）。現況：審查報告完成＝`production/visual-review-2026-11-17.md`，`src/` 一行都還沒動。
Task: 方向已拍板＝混搭（`design/demos/visual-redesign-2026-11/mix.html`）。對局頁全屏、側板中文回黑體、練習頁退役外殼也已拍板；五處超標動效要逐項做對照給 Eason 看。拍板紀錄在同目錄 `decisions.md` 最上面。第 1 波 1a（對局全屏＋記譜紙＋完局印、棋憶深青頂列＋分析中同版面、走錯不滑回三處修正）已完成。對局頁三組循環動畫拍板保留現況。下一步＝1b（課程、深化、判斷場換共用骨架）。他拍板前不動 src/ 的 UI。黑體缺字已修（16edabd）。細節在 MANUAL「視覺重構交接」。
判斷訓練釐清（Q3 起）暫停中，待辦在 MANUAL。
⚠️ 動 engine 解析層：`handshake.ts` 寫死 `MultiPV 1` 且與 review 分析共用，勿污染分析。
定位 SoT＝`production/positioning-v2-2026-08-02.md`。

## Working Memory
<!-- Session notes. Auto-pruned after 7 days. -->

## MANUAL
<!-- User content. Never auto-pruned. -->
### 視覺重構交接（2026-11-18 凌晨，家用桌機 EasonLeePC 寫）
起因：Eason 覺得 Gambit「不像作品，像半成品／prototype」，Tally 那次視覺重構效果好，想比照做全站 review＋視覺重構。走法照 Tally：先 review → 出樣張 → Eason 選 → 才施工。

已完成
- 審查報告 `production/visual-review-2026-11-17.md`：六個根本原因、逐頁重點、13 項順手修、五波重構範圍、9 件待拍板（第 7 節）、三個方向（第 8 節）。依據是 48 張真實截圖（訪客＋4 盤種子對局），8 個面向 147 條發現逐條驗過，再由一個 agent 找漏洞並改進報告。
- `CONTEXT.md`：`markDeepened` 改成已拍板的結論、active.md 標成已退役。`.gitignore`：`.omc/wiki/environment.md` 不追蹤（OMC 開場自動產生，內容重複且有 bug）。

樣張（第 0 波）——已完成，等 Eason 看
- 全在 `design/demos/visual-redesign-2026-11/`。**先開 `compare.html`**（雙擊就能開）：七個畫面，每列「現況｜地基｜B｜C」。要他決定的事在同目錄 `decisions.md`，各份修了什麼、還弱在哪在 `review-notes.md`（最上面「第二版結果」）。
- 三份都是第二版：地基（只收齊骨架）、B 棋境一景（地基＋一幅木棋桌的畫，只用在首頁頂帶與 404）、C 木、紙、墨（米白扉頁＋大墨筆、記譜紙側板、棋子印）。
- 獨立評審（沒參與製作）的結論：單一方向都不夠。B 有 3／7 張和地基同一張圖；C 的棋盤頁最強但首頁最弱。所以另做了 `mix.html`：骨架用地基、首頁頂帶與 404 用 B 的畫、對局側板與完局用 C 的記譜紙和印、棋憶用地基，全部畫面用同一份假資料，另加輸局、44 回合長局、Neve 頭像調色對照。這是推薦方案，但還沒經 Eason 看過。
- 單獨開樣張要 `npm run dev` 後開 `http://localhost:5173/design/demos/visual-redesign-2026-11/`（字型、棋子、木盤走 `public/`）。樣張 HTML 就是正本，直接改；桌機暫存目錄裡的產生器不再同步。
- 截圖與各 agent 的補拍在桌機 `D:/Temp/claude/gambit-review-2026-11-17/`（只在桌機，可能被清掉）；報告裡 `work-*/…png` 的路徑都指那裡。要重拍照 wiki `visual-capture-recipe`。

已修的 bug
- 黑體缺字（commit 16edabd）：Sarasa 子集原本 759 個漢字，Vue 模板用到的 222 字缺 44 個。`scripts/subset-sarasa.py` 重切成 1219 字（各約 200KB），`tests/smoke/font-coverage.test.ts` 守門，新文案帶進缺字會紅，重跑腳本即可（原始 TTF 在 `%LOCALAPPDATA%\Microsoft\Windows\Fonts`）。腳本同時把 `fonts.css` 的網址改成 `?v=<hash>`，否則 service worker 的 CacheFirst 會讓舊裝置一直用舊字型（wiki `pwa-runtime-cache-trap`）。vitest 全量 71 檔 871 條綠、typecheck 0、像素回歸 40/40 綠。
- 本機跑 vitest 要走 PowerShell 並設 `VITEST_CACHE_DIR=node_modules/.vite-manual`；Git Bash 下連既有 smoke 都假紅（`reading 'config'`）。

待查的產品隱憂
- Stockfish 握手 uciok 上限 5 秒包含 7MB WASM 下載與編譯；慢網路首次載入可能被判成引擎壞掉、AI 一走子就認輸。推論未實測，細節在 wiki `e2e-load-flaky`。

1a 之後的後續（review 列的 LOW，排進 1b）
- 「思考中」文字在呼吸動畫低點對比約 3.4:1（動畫只該作用在點上）；完局沒有讀屏播報；棋憶流式棋譜 11px；`buildAnimationDoneAt` 的 `.cg-board piece` 選擇器實際對不到（只靠 fallback 計時器）；score-sheet 捲到最新一手沒有 E2E；`index.html` 缺 `viewport-fit=cover`；對局中途離開後 `isGameInProgress` 不歸零；練習頁同型走錯 bug（頁面要退役，不修）。

還沒看、動工前要補
- 已登入的畫面（48 張全是訪客）、失敗狀態、學習頁全部上完的樣子、判斷場完整流程、reduced-motion、實機（Windows 的 Playwright WebKit 字重不準）。

沒人拍板前不要做的
- 不要直接開第 1 波：它依賴對局頁要不要全屏隱藏底部導覽、側板回黑體（推翻 2026-06-09）、練習頁去留、五處超標動效留哪些。
- `CLAUDE.md` 的「UI 潤飾路由」指向 `~/.claude/rules/ui-design-flow.md`，該檔已不存在，路由是斷的；要不要改指 impeccable 待 Eason 決定。

### 2026-10-14 06:22
待辦（本輪之外，2026-09-05 快照自 active.md 搬入）
- 🔜 判斷訓練最小版——釐清階段拍板中途暫停：走子前強制答「有／沒有」、不給回饋、局後一次列對照表（約 150 行，chess.js 窮舉不開引擎）。已拍板：Q1 不可取代好處成立、Q1b v1 只用自己對局出題、Q2 這是主線。待續（Q3 起）：現在做值不值得（Jobs 視角）、Q12 驗收條件、Q10 難度/fallible 衝突、範圍（mate-only vs 強制贏子）、跟既有判斷場的關係。前置閘門已解除（P1，2026-08-13 跑完）：五盤紙筆實驗，rung 5（關 fallible），命中率約 1–2/5，遠低於 70% 門檻——v2 主軸（斷層卡在察覺階段）不被推翻，成立。
- missed-mate 從 mate 擴到 material（v2 的 P2，也是擴大深青互動格題目供給的前置）：若既有對局跑 `selectMissedMates` 產出 ≥1 題比例 <30%，主路徑必須先擴到 material 才成立。2026-08-06 查過 Eason 現有對局數＝個位數，樣本太小，等累積後再量。
- v2 末尾另有 8 題待答（棋力現況、下棋 vs 寫 app 時數比、四週對照實驗、自用產品的驗收條件等）。

