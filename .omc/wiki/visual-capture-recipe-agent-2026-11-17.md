---
title: "visual-capture-recipe 全站截圖與多 agent 視覺審查的做法（2026-11-17）"
tags: ["ui", "playwright", "review", "workflow"]
created: 2026-11-17T16:10:18.259Z
updated: 2026-11-17T16:10:18.259Z
sources: []
links: []
category: pattern
confidence: medium
schemaVersion: 1
---

# visual-capture-recipe 全站截圖與多 agent 視覺審查的做法（2026-11-17）

# visual-capture-recipe 全站截圖與多 agent 視覺審查的做法（2026-11-17）

做全站視覺 review 或每一波重構後重拍對照時用。成果見 `production/visual-review-2026-11-17.md`。

## 截圖（Playwright 腳本放 repo 外，require repo 的 `node_modules/playwright`）

- **viewport 要包在 `viewport: { width, height }` 裡**。直接把 width／height 攤在 `newContext()` 最外層不會報錯，會靜默用預設 1280×720，手機版整批拍成桌機。拍完第一張先看尺寸。
- 手機用 webkit、390×844、`deviceScaleFactor: 2`、`isMobile` 加 `hasTouch`；桌機 chromium 1440×900。
- 訪客進站：`addInitScript` 寫 `sessionStorage['gambit:guest-entry']='1'`。種子對局：`localStorage['chess:unsynced:<id>']` 放 `{id, moves(UCI 陣列), result, playerColor, endReason, aiSkillLevel, completedAt, playerMoveTimes, isTerminal:true}`。
- 首頁場景看時段，`page.clock.setFixedTime()` 要在 goto 前設。
- **棋憶要等 `[data-testid="key-moments"]`（或 `memory-zero-state`）才算分析完**。等「棋憶」標題不夠，標題在分析中就在了，會拍到進度條 87% 的畫面。
- 對局設定彈窗的開始鈕用 `getByRole('button', { name: /開始對局/ })`，別用「dialog 裡最後一顆按鈕」。執子隨機時可能執黑，點格子前先看 `.cg-wrap.orientation-black` 決定座標是否翻轉。
- 這套種子拍不到的狀態：有未下完對局的首頁（「繼續對局」卡）、已登入、失敗狀態、學習頁全部上完。`/learn/concept/pin/judge` 沒題組會被導回棋理頁，拍判斷場要換有題組的概念。
- dev server 上離開棋憶／404／登入頁後整頁空白，是 template 根層註解造成的 dev 假象，部署站正常；截圖前留意別把它當成真的空狀態。

## 多 agent 審查

- 分「畫面組」（首頁與外殼／對局／學習／棋憶與紀錄）加「橫切面」（設計系統落地／辨識度／動效與狀態／實測數字）各一個 agent，每條發現必須附截圖檔名＋區域或 file:line。
- 每個面向配一個專門反駁的 agent 重看重量。147 條零推翻但 62 條被改寫描述，數字類的最常被修。
- 彙整後再放一個找漏洞的 agent，它抓到的比逐條驗證多：講錯的規則衝突、沒拍到的狀態、方向其實不獨立、樣張選錯畫面。這一步不要省。
- 樣張要畫「方向之間真的有差別」的畫面。三個方向對同一頁的描述幾乎一樣時，畫那一頁只會得到三張相同的圖。
- OMC 的 `notepad_write_priority` 這次回報成功但 repo 的 notepad 沒變；寫完回讀，沒落地就直接改檔。

