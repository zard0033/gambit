---
title: "wave2-decisions 棋憶 wave 2 拍板與定位 v2 刪除期判決"
tags: ["棋憶", "positioning-v2", "wave2", "判斷場"]
created: 2026-10-14T06:22:24.146Z
updated: 2026-10-14T06:22:24.146Z
sources: []
links: []
category: decision
confidence: medium
schemaVersion: 1
---

# wave2-decisions 棋憶 wave 2 拍板與定位 v2 刪除期判決

## 未決 → 已於 wave 2 拍板（2026-09-05）

- **深青格走錯了**：棋子靜默滑回（`resetPosition()`），不計次、無懲罰 UI。沿用判斷場既有作法。查證修正：`missedHint` 不在 `RecognitionBoard` 而在 `RecognitionGate`，且只用於「答『這裡沒有』但其實有」的情境，就地走沒有那個動作，所以本來就轉不過來。
- **`markDeepened`**：深青格通關**只做 `markConsumed`，不標已深化**。走一手將殺 ≠ 走完深化課，標了概念地圖會說謊。
- **中間那顆鈕**：不做自動重播，改成**循環步進**（原局面 → 你走了 → 更好的是 → 繞回）。圖示用 `▸` 不用 `↻`（↻ 讀起來是重播）。深青格通關前 disabled——步進正解等於直接給答案。

## 🔪 定位 v2 刪除期（2026-08-02 拍板，2026-08-06 執行完畢）

一句話：**Gambit 把你剛下完的那盤棋，變成明天的題目——而且不告訴你裡面有沒有東西。** 斷層＝**認知遷移**（學到的調用不出來）。目標使用者第一位＝Eason 本人。
D1（棋誌）／D2（試煉外殼）／D4（棋憶敘事外殼）／D5（開局知識卡）／D6（ProfileView）皆已執行；D3（難度五檔）原判死理由誤讀實作，撤銷保留。判決表全文見 `production/positioning-v2-2026-08-02.md`。

同期下架：health-check Q9 訪客齒輪選單、noir 深色主題整組（只留 cream+jade）、D6 ProfileView、D5 開局知識卡（縮小範圍）、D1 棋誌＋D2 試煉外殼、D4 棋憶敘事外殼；匯出接上 UI（D7 撤銷復活）。**蒸餾**：砍整頁前重掃「這頁裡還有什麼是全站唯一入口」；跨 D 項的判死決策會互相連動。

## 標題不寫「這盤」（Eason 拍板）

`pendingFor` 回**最近一局**，A 局漏題沒解就下 B 局，B 局的棋憶第一格會是 A 局的題目。**不改成「只收本局」**——路標已刪，那會讓跨局題目失去唯一入口。

來源：`production/session-state/active.md`（2026-10-14 搬入 wiki 後該檔已刪）。
