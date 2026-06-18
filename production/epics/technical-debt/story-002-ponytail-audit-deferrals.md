# Story 002: Ponytail Audit Deferrals & Follow-ups

> **Epic**: Technical Debt
> **Status**: Open
> **Layer**: Cross-cutting
> **Type**: Cleanup follow-up / deferred wiring
> **Source**: 全 repo ponytail over-engineering audit（2026-06-18，branch `chore/ponytail-cleanup`）

## Context

A ponytail audit cleaned dead code, deduped logic, and removed concluded spike scripts
(commits A/B/C 區). A few flagged items were **deliberately NOT actioned** because they
are GDD-planned features, AC-backed contracts, or需要瀏覽器驗證的 UI 變更。記錄於此，避免「留著就漏做」。

---

## 1. GDD-planned, code written but UI not wired (decide: build or delete)

- [ ] **匯出超大警告（game-export）** — `src/modules/game-export/assembler.ts` 的
  `isOversizePayload` / `isLongGame` / `estimatePayloadTokens` 已實作，但 UI 從未 render
  那個 non-blocking note。GDD `game-export-share.md §7`（`promptTokenBudget` 預設 4000、
  `maxPlyBeforeWarn` knob、super-long-game edge case）有規劃。
  **決策**：超大匯出警告要做 → 補 UI 接上；不做 → 刪函式 + `ExportConfig` 兩個 knob，做時照 GDD 重寫。

- [ ] **identifyPosition 消費端串接（opening-id / game-replay）** —
  `src/modules/opening-id/opening-index.ts` 的 `identifyPosition(fenOrEpd)` 已實作且有
  4 條完整 AC（`opening-identification.md` AC + integration table），但 post-game review /
  replay 逐局面尚未呼叫它。GDD 標記為 **Optional**（replay scrubbing 顯示開局名）。
  **決策**：要做 replay 逐局面開局名 → 接上消費端；確定砍掉此 Optional 功能 → 刪函式 + 其 AC test。

---

## 2. AC-backed but production-redundant (decide: call it or delete it + ACs)

- [ ] **isCpLossPreliminary**（`src/modules/post-game-review/cploss.ts`）— preliminary `~`
  功能已**內聯**實作在 `use-post-game-review.ts`（Rule 22a depth guard），此獨立函式無生產 caller，
  但有 AC-4/AC-5/AC-7（`cploss-formula.test.ts`，story-002-cploss-formula）。
  **決策**：DRY 正解＝production 改呼叫 `isCpLossPreliminary` 取代內聯；或刪函式 + 對應 AC test。

---

## 3. Audit candidates intentionally skipped (not safe as mechanical cleanup)

- **replay eval bar 共用** — `replay-analysis-overlay.vue` 與 `move-annotation/annotation-formulas`
  數學**不同**（前者 linear-clamp `(clamp(cp/100,±4)+4)/8` + ASCII minus；後者 arctan
  `atan(cp/300)/π+0.5` + sign normalization + U+2212 minus + em-dash terminal）。
  合併＝改變 replay bar 的填充曲線與字形，屬設計決策非 dedup。要統一須先定哪套數學為準。
- **board-fit `.main-wrap` CSS 共用** — 移到全域 `board-theme.css` 在邏輯上 scope 等價，但
  `technical-preferences.md` 將 per-view scoped `:deep()` 記為既定 pattern，且棋盤渲染無法 headless 驗證。
  要做須實機/部署站確認盤面不跑掉。

---

## 4. Note: stale typecheck baseline

`active.md` 記「vue-tsc 0」已 stale。clean HEAD 上 `npx vue-tsc --noEmit` 有 **9 個既有錯誤**
（`pgn-viewer.test.ts` ×2、`resume-game.test.ts` ×6、`vite.config.ts` ×1），來自 bleeding-edge
依賴型別（vitest ^4 / @types/node ^25 / typescript ^6）。非本次 cleanup 造成；但 typecheck gate 名存實亡，值得另開修。
