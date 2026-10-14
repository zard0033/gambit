# Notepad
<!-- Auto-managed by OMC. Manual edits preserved in MANUAL section. -->

## Priority Context
<!-- ALWAYS loaded. Keep under 500 chars. Critical discoveries only. -->
Epic: 棋憶（/review）文案準確度——hanging-piece 判定接線＋走法白話文補上吃子／升變／易位
Feature: 已實作完畢，待 review→push
Task: 下一步＝判斷訓練釐清 Q3 起（P2 仍卡在對局數個位數，樣本不足；待辦全文在 notepad MANUAL）
⚠️ 動 engine 解析層時注意：`handshake.ts` 寫死 `MultiPV 1` 且與 review 分析路徑共用，勿污染分析。
定位 SoT＝`production/positioning-v2-2026-08-02.md`，提功能／重構／UI 前先讀。歷史在 wiki 與 `production/session-state/archive-2026-07.md`。

## Working Memory
<!-- Session notes. Auto-pruned after 7 days. -->

## MANUAL
<!-- User content. Never auto-pruned. -->
### 2026-10-14 06:22
待辦（本輪之外，2026-09-05 快照自 active.md 搬入）
- 🔜 判斷訓練最小版——釐清階段拍板中途暫停：走子前強制答「有／沒有」、不給回饋、局後一次列對照表（約 150 行，chess.js 窮舉不開引擎）。已拍板：Q1 不可取代好處成立、Q1b v1 只用自己對局出題、Q2 這是主線。待續（Q3 起）：現在做值不值得（Jobs 視角）、Q12 驗收條件、Q10 難度/fallible 衝突、範圍（mate-only vs 強制贏子）、跟既有判斷場的關係。前置閘門已解除（P1，2026-08-13 跑完）：五盤紙筆實驗，rung 5（關 fallible），命中率約 1–2/5，遠低於 70% 門檻——v2 主軸（斷層卡在察覺階段）不被推翻，成立。
- missed-mate 從 mate 擴到 material（v2 的 P2，也是擴大深青互動格題目供給的前置）：若既有對局跑 `selectMissedMates` 產出 ≥1 題比例 <30%，主路徑必須先擴到 material 才成立。2026-08-06 查過 Eason 現有對局數＝個位數，樣本太小，等累積後再量。
- v2 末尾另有 8 題待答（棋力現況、下棋 vs 寫 app 時數比、四週對照實驗、自用產品的驗收條件等）。

