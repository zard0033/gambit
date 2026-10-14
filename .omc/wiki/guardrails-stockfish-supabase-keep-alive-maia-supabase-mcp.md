---
title: "guardrails 護欄備忘：Stockfish、Supabase keep-alive、Maia、Supabase MCP"
tags: ["Stockfish", "Supabase", "Maia", "MCP", "護欄"]
created: 2026-10-14T06:22:24.345Z
updated: 2026-10-14T06:22:24.345Z
sources: []
links: []
category: environment
confidence: medium
schemaVersion: 1
---

# guardrails 護欄備忘：Stockfish、Supabase keep-alive、Maia、Supabase MCP

- **Stockfish 無旋鈕可製造初學者級失誤**：要它犯錯只能在引擎外面做（`fallible-pick.ts`）。讓子（material odds）已否決，勿再提案。
- **Supabase keep-alive workflow** 每天一次、每次連打 5 次實表查詢、只認 200。舊版每 3 天一次仍在 2026-09-10～13 間被暫停（之後連續 10 次 exit 6），所以是**降低機率不是保證**，變紅多半＝已暫停（看 log：000／exit 6＝DNS 已撤，去 dashboard 按 Resume）；**GitHub 政策 repo 60 天無 commit 自動停用**。
- **Maia（人類化 NN 引擎）＝日後「陪練角色」**：2026-08-07 查證，「要後端所以不做」的前提已翻案——**只有 Maia-1 可行**（官方 ONNX ~3.3MB／級距，9 檔 Elo 1100–1900，`onnxruntime-web` 純 client-side，權重 GPL-3.0）；**Maia-2／3 不走**（無官方 ONNX、AGPL、23M 版 91.8MB 超出 150MB 預算；且「單一模型涵蓋全棋力」對 web 是退步）。**綠燈後第一驗證項**＝查官方前端怎麼從 policy head 取手：**若是 argmax，實際棋力會高於標稱 Elo、失誤遠少於真人**，要 temperature sampling 才有真實失誤率。**決策歸屬**：不開獨立線，折進暫停中的判斷訓練 grilling。
- **Supabase MCP**：stdio、user scope、**read-only**、`--project-ref=vfnzekqtvxhewifnmtnz`、token 走 `$env:SUPABASE_ACCESS_TOKEN`；需重開 Claude Code 才 Connected。

長期規則與技術參考都在 **CLAUDE.md 與它 `@`-include 的 docs**（技術棧、CI Node 26 鎖、push guardrail、部署 base path、E2E 盲區、棋理護欄、視覺設計 SoT、教練人格 Neve、Pre-Push Checklist）；`.claude/docs/technical-preferences.md`（測試規範、Board/chessground gotchas、Deferred Cleanups）；設計 SoT＝`design/gambit-design-system/`；Supabase migration＝`supabase/README.md`；lib/ vs modules/ 判準＝**ADR-0015**。

來源：`production/session-state/active.md`（2026-10-14 搬入）。
