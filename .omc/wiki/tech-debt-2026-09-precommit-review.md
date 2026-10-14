---
title: "tech-debt-2026-09 precommit-review 留下的技術債"
tags: ["技術債", "review", "geomTick", "lintNeve"]
created: 2026-10-14T06:22:24.297Z
updated: 2026-10-14T06:22:24.297Z
sources: []
links: []
category: reference
confidence: medium
schemaVersion: 1
---

# tech-debt-2026-09 precommit-review 留下的技術債

deep review `wf_9edc6475-d91`，29 條 confirmed，4 條 major 已修。

已修：觸控目標 36→44px、`router.push` 改 `replace`（返回會讓 history 無限增長）、標題與內文兩套 kind 推導會互相矛盾（收成 `describe.ts::momentTone` 單一來源，新增 `best-anyway` 語氣——玩家走了最佳手時不套失誤模板）、金色內文改回墨色（`text-gold-dark` 是 large-copy-only）、好棋定格兩支箭頭同色（對手回應改灰）、白話文吃掉吃子／升變／入堡資訊（2026-09-05）。

**未修，按優先序**：
- **`geomTick` + ResizeObserver 那套幾何接線已經第三次複製貼上**（PracticePuzzleView／LessonPlayer／KeyMomentsCard）。第三次是抽 composable 的門檻，下次動到就抽。
- **`lintNeve` 仍無產品呼叫端**：只有測試在跑（F3 模板與短名的每個分支、吃子／升變／易位片語都在測試層過 lint）。元件內硬編的文案（「你走了」「更好的是」）不在覆蓋內。
- **Tier-3 匯出 fallback 面板** `fixed top-24` 是魔術數字、不吃 safe-area、無焦點管理。
- **`isComplete` 在 `MemoryView` 與 `MemoryDashboard` 各算一份**，該經 MemoryContext 共用。
- **返回落點只認兩個入口**（有無 `?gameId`），將來多一個入口會靜默走錯。
- **元件測試裡 `ChessBoard` mock 不 expose `boardRef`/`squareToRect`**，所以 `MoveAnnotationDisplay` 在單元測試中永不渲染——標註那條路只有純模組測試守著。**`key-moments-card.test.ts` 已修**（mock 給真 element ＋ 斷言前 `flushPromises` 等 `onMounted` 的 geomTick），其餘元件測試檔照舊。修之前那裡的「零標記」斷言是恆真的，改的時候記得配一條「有標註」的對照組，否則驗不到東西。

來源：`production/session-state/active.md`（2026-10-14 搬入）。另見 `docs/tech-debt-register.md`。
