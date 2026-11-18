---
title: "e2e-load-flaky webkit E2E 在平行負載下的兩種假紅，與 Stockfish 握手 5 秒的隱憂（2026-11-18）"
tags: ["e2e", "playwright", "webkit", "stockfish", "flaky"]
created: 2026-11-18T14:38:37.579Z
updated: 2026-11-18T14:38:37.579Z
sources: []
links: []
category: debugging
confidence: medium
schemaVersion: 1
---

# e2e-load-flaky webkit E2E 在平行負載下的兩種假紅，與 Stockfish 握手 5 秒的隱憂（2026-11-18）

# e2e-load-flaky webkit E2E 在平行負載下的兩種假紅，與 Stockfish 握手 5 秒的隱憂（2026-11-18）

全套 `--grep-invert '@spike'` 平行跑時 webkit 偶發紅、單獨跑就綠。查證過的兩個根因：

1. **rAF 探針被餓死**：負載下 WebKit 的 requestAnimationFrame 每秒只剩幾格、空檔 1–1.6 秒，逐幀取樣會漏掉只停留幾百 ms 的 DOM 狀態。要記「某狀態出現過」改用 `MutationObserver`（style／class／childList），`expect.poll` 上限給 10 秒（成立就返回，不放寬語意）。實例：`tests/e2e/memory-deep-cell.spec.ts`。
2. **Stockfish 握手超時 → AI 認輸**：`src/modules/chess-engine/handshake.ts` 的 uciok 上限 5 秒，裡面其實包含 7MB WASM 的下載與編譯。負載下超時後引擎標成 CRASHED，玩家一走子 AI 就認輸、終局、續玩快照被清。測續玩這類非引擎行為的 E2E，用 `page.route('**/stockfish/stockfish-18-lite-single.js')` 換假 worker（只回 uciok／readyok）。實例：`tests/e2e/play-fullbleed.spec.ts` (c)。

**未處理的產品隱憂（推論，未實測）**：真實使用者首次載入遇到慢網路，WASM 5 秒內下載編譯不完，也會被判成引擎壞掉、AI 直接認輸。要處理的話是把「下載」和「握手」分開計時，或首次載入放寬上限。

另：PowerShell 裡 `--grep-invert @spike` 要加引號（`'@spike'`），否則 `@` 被當 splatting 變數。

