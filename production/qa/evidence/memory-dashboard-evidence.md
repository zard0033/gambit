# 棋憶 Dashboard (story-007) — Test Evidence

> **Story**: `production/epics/memory/story-007-dashboard-view.md`
> **Type**: UI — DOM half automatable; visual rendering verified via dev-server screenshots
> **Date**: 2026-06-20
> **Status**: ✅ DOM (unit) + visual rendering verified

## Automatable (green)

| AC | What | Evidence |
| -- | ---- | -------- |
| **AC-1** DOM order | Neve line → eval view → moment list; no verdict/score node | `tests/unit/views/memory-deeplink.test.ts` + visual screenshot |
| **EC-12 / AC-7** drift-guard | chart is a `<button>`; clean tap/keyboard opens replay at anchor ply; >10px drift = scroll (no nav); dots `pointer-events:none` | `tests/unit/components/memory-eval-charts.test.ts` |
| **AC-3** zero-state | F1 → 0 → `EmptyMemory` copy === fixture, no banned tokens | `EmptyMemory.vue` + `MEMORY_ZERO_STATE_COPY` |
| build/type | whole stack | `vue-tsc -p tsconfig.app.json` 0 ; `vitest run` 804 passed |

## Visual rendering verified 2026-06-20 (dev server, seeded game)

Seeded a completed game (turning-point + plain-swing moments) → `/review` dashboard, screenshotted:
- Neve 深青卡 (avatar + NEVE + font-lesson line) on top → eval chart (White-normalized curve, 白優/黑優
  left labels, per-moment dots) → moment list. **DOM order correct; no verdict/score node.**
- Moment cards: ◐ plain「被推著走的一段 / 把兵移到 d3」−1.2 ; ◆ turning-point「這盤的轉折 / 把主教移到 g5」
  −5.3 with the **gold left-accent bar** (OQ-R1 neutral treatment) — NOT a celebratory star.

**Token-resolution bug found + fixed in this pass** (see slideshow evidence): SVG/inline colors used
design-system raw `var(--xxx)` names that don't resolve under the app's Tailwind v4 `--color-*` theme →
all fell back to black (白優/黑優 plates, icons, accents). Renamed to `--color-*` across the 4 components.

## Manual — pending (needs a completed game; chessground not Playwright-drivable)

- [ ] On-device: dashboard layout / spacing / touch targets on iPhone Safari.
- [ ] Progressive (EC-3) "還在細看這盤…" while #7 still ANALYZING (cold open).
