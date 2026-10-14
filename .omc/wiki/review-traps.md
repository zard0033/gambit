---
title: "review-traps 三個必須記住的陷阱（審查實測，別重新發現）"
tags: ["判斷場", "missed-mate", "MultiPV", "data-sync", "像素回歸"]
created: 2026-10-14T06:22:24.202Z
updated: 2026-10-14T06:22:24.202Z
sources: []
links: []
category: debugging
confidence: medium
schemaVersion: 1
---

# review-traps 三個必須記住的陷阱（審查實測，別重新發現）

1. **題目供給率 ∝ 對手有多弱**：判斷場題目全來自 `selectMissedMates`（要求唯一解 mate-in-1），而 rung 1 有 60% 機率刻意送一手虧 100–300cp。
2. **MultiPV gap ≥150cp 當「有沒有東西」的訊號是壞的**：實測觸發率 7/10/30/15%，恆答「沒有」準確率 70–93%。正解＝chess.js 窮舉前瞻判定（`missed-mate.ts:44-58` 已有一半）。
3. **`data-sync.ts` 不是雲端層，是唯一的持久化層**：guest 佇列與 memory 的讀寫都是純 localStorage。要動必須先拆成 local-store ＋ cloud-adapter 兩層（v2 的 R1）。

另兩條同級別的：
- **像素回歸容差** 0.005；`toHaveScreenshot` 在 CI 是 skip 的，動 UI 後本機自己跑 `npx playwright test visual-regression`。
- **賽後檢討看不見「該殺沒殺」**：cpLoss 對將殺不敏感，第三種訊號候選（mate distance，非 cp）。

來源：`production/session-state/active.md`（2026-10-14 搬入）。
