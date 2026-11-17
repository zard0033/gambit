# Notepad
<!-- Auto-managed by OMC. Manual edits preserved in MANUAL section. -->

## Priority Context
<!-- ALWAYS loaded. Keep under 500 chars. Critical discoveries only. -->
Epic: 全站視覺重構（2026-11-17 起）。現況：審查報告完成＝`production/visual-review-2026-11-17.md`，`src/` 一行都還沒動。
Task: 等 Eason 看樣張選方向（地基／B 棋境一景／C 木紙墨）＋拍板報告第 7 節 9 件事；之後才開第 1 波。報告第 6 節 13 項「順手修」可先做（含棋憶深青格走錯解不了的 bug）。細節在 MANUAL「視覺重構交接」。
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

樣張（第 0 波）
- 三份：地基（只收齊骨架，不加新東西）、B 棋境一景（加一幅夜裡木棋桌一角的畫）、C 木、紙、墨（放大墨筆與棋子印章，做減法）。每份 7 個手機畫面。
- 在 `design/demos/visual-redesign-2026-11/`。看法：`npm run dev` 後開 `http://localhost:5173/design/demos/visual-redesign-2026-11/`（直接開檔案會掉字型）。字型、棋子、木盤走 `public/`；`fonts/*.recut.woff2` 是樣張自己重切的黑體子集。
- 版本：地基＝已照兩位審查的評語修過一輪；B、C＝初版（各自看圖修過 3 輪，但還沒吃審查評語）。初版評分完成度 5–6.5／10，主體感 B、C 比地基高 2–3 分。B、C 的修訂版若有再 push，看該目錄的 git log。
- 做地基的 agent 回報：app 上線的 Sarasa 黑體子集只有 759 個漢字，缺「投、降」等字（所以樣張重切了子集）。**未查證**，若屬實是全站字型缺字的 bug，動工前先確認。
- 截圖與各 agent 的補拍在桌機 `D:/Temp/claude/gambit-review-2026-11-17/`（暫存目錄，只在桌機，可能被清掉）；報告裡引用的 `work-*/…png` 路徑都指那裡，筆電上看不到。

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

