# 棋憶 Move-by-Move Replay (story-009) — Test Evidence

> **Story**: `production/epics/memory/story-009-replay-pgnviewer.md`
> **Type**: UI — DOM half automatable; board fidelity = screenshot sign-off
> **Date**: 2026-06-19
> **Status**: automatable half ✅ green · **Wood12/Gioco fidelity ✅ verified** (dev-server screenshot 2026-06-20) · prev/next slide feel ⏳ device

## Visual rendering verified 2026-06-20 (dev server, seeded game)

Opened replay at the anchor ply (12-move seeded game) and screenshotted: **Wood12 wood board + Gioco
pieces render correctly — no lichess dark board leaking** (the AC-16 fidelity concern). The self-drawn
ReplayEvalChart shows the **gold cursor** at the current ply + the gold anchor tick; `−5.3 最大轉折`
read-out + `10 / 12` nav + 跳到最大轉折 present. (Token-resolution bug found in this pass — see the
slideshow evidence doc — also fixed ReplayEvalChart's gold cursor/labels.)

---

## Automatable (green)

| AC | What | Evidence |
| -- | ---- | -------- |
| **Eval cursor** | self-drawn SVG eval chart, gold cursor at current ply + anchor tick; gaps break the line | `tests/unit/components/memory-eval-charts.test.ts` — ReplayEvalChart draws 2 accent (gold) lines + splits on null |
| **AC-8 (mount path)** | replay mounts from 棋憶 (deep-link ?ply) and renders the dense surface (board + nav + signpost) | `tests/unit/views/memory-replay-signpost.test.ts` — MemoryView `?ply=0` → MemoryReplay renders; nav + Bridge-3 signpost opt-in intact |
| current-ply highlight + auto-scroll | reused from the shipped PgnViewer (lichess) — native | PgnViewer `toPly()` drives the lichess move list highlight + scroll |
| build/type | whole stack | `vue-tsc -p tsconfig.app.json` 0 ; `npm run build` ✅ ; `vitest run` 798+ green |

## Manual — pending (chessground / lichess-viewer can't be driven headlessly here)

- [ ] **AC-16**: `.lichess-pgn-viewer` root present (not a hand-rolled board); board-theme asset URLs carry `import.meta.env.BASE_URL` (no `/gambit/` 404). Wood12 board + Gioco pieces render, **no lichess dark board leaking** — screenshot sign-off.
- [ ] Prev/next slide the piece (incl. capture + castling), interruptible — device feel.
- [ ] Open-at-ply: from the dashboard chart → anchor ply by default; deep-link to arbitrary ply (story-010).

## Deviation from GDD Rule 20 / AC-8 (flagged, AC-wins reconciliation)

GDD Rule 20 wants the move list to carry **per-move cpLoss chips** + an **anchor accent bar**. The
shipped lichess `@lichess-org/pgn-viewer` renders its **own** move list and does not expose a slot
for per-move chips; injecting them = DOM surgery on a third-party widget (fragile, against the
"reuse the shipped PgnViewer" decision). **Resolution**: the **anchor** is marked instead by the
ReplayEvalChart's gold anchor tick + the "最大轉折 / 跳到最大轉折" affordance (ported from #7), and the
cpLoss is shown by the single cpLoss read-out below the board (the shipped #7 pattern). If inline
move-list chips are wanted later, they need a hand-rolled move list (drops PgnViewer reuse) — a
separate decision for Eason.
