# 棋憶 Slideshow (story-008) — Test Evidence

> **Story**: `production/epics/memory/story-008-moment-slideshow.md`
> **Type**: Visual/Feel — DOM/computed-style half automatable; motion half = manual device evidence
> **Date**: 2026-06-19
> **Status**: automatable + **visual rendering ✅ verified** (dev-server screenshots 2026-06-20) · motion/feel ⏳ pending Eason iPhone sign-off (OQ-2)

## Visual rendering verified 2026-06-20 (dev server, seeded game)

Drove a seeded completed game (turning-point + plain-swing moments) into the slideshow and screenshotted:
Wood12 board + played/better annotations render; the ◆ turning-point card shows the comparison
「你走了 把主教移到 g5 │ 更好的是 把城堡移到 e1」 (city = 城堡/rook vocab ✓) + a **neutral** Neve line.

**Two bugs found + fixed during this pass** (unit tests could not catch either):
1. **Design tokens didn't resolve** — components used `var(--danger)`/`var(--surface-card)` (design-system
   raw names) but the app's Tailwind v4 theme exposes `--color-*`; every SVG/inline color fell back to
   black. Renamed to `--color-*` (`--accent-text` → `--color-gold-dark`) across EvalShapeChart /
   ReplayEvalChart / MomentList / MomentCard. (Unit tests asserted the style *attribute contained* the
   token string, not that it *resolved*.)
2. **回顧態 voice on a turning point** — the bare anchor (kind collapses to 'bright' in selection) rendered
   the celebratory「你穩住了…拿回主導權」template — praising the player's costliest move. Fixed:
   turning-point uses the neutral plain template (`MemorySlideshow` `templateKind`).

---

## Automatable (green)

| AC | What | Evidence |
| -- | ---- | -------- |
| **AC-9 (computable half)** | reduced-motion static end-state of a **mistake** carries BOTH played-to + better-to highlights simultaneously; good move shows played→provoked-reply | `tests/unit/memory/choreography.test.ts` — `momentEndState` returns both highlight annotations at once (mistake) / played(gold)+reply(threat) (good); `momentFrames` last frame === end-state |
| **AC-10** | move comparison: both halves same font-size, role by color + weight + leading word (color never sole) | `tests/unit/components/moment-card.test.ts` — `你走了`(ink-muted) / `更好的是`(accent-text, the sanctioned gold-text token, NOT the reward fill) / good `這手很好`(success-dark); neither span overrides font-size |
| **EC-2** | dot band hidden at exactly one moment | `DotBand.vue` `v-if="count > 1"` |
| **EC-14** | kind icon shape + leading words carry meaning without color | `describe.ts` `momentVisualKind` (incl. OQ-R1 turning-point) + `tests/unit/memory/describe.test.ts` |
| build/type | whole 棋憶 stack bundles + typechecks | `npm run build` ✅ ; `vue-tsc -p tsconfig.app.json` exit 0 |
| regression | full unit suite | `vitest run` → 798 passed / 78 files |

## Manual — pending Eason iPhone sign-off (chessground synthetic events are not Playwright-drivable)

- [ ] **Mistake choreography** (Rule 16): pause → play your move → pause to read → move piece back → play the better move (highlighted). v9 timings 650 / 380 / 700 / 520 ms feel calm (**OQ-2** sit-with-it).
- [ ] **Good-move choreography**: play your move → animate the provoked/forced reply.
- [ ] **Skip**: a single tap/key collapses the in-flight animation to its end-state (idempotent).
- [ ] **重播這一手** re-runs the choreography.
- [ ] **Swipe** left/right on the board moves between moments; **arrow keys** parity (desktop).
- [ ] **EC-15**: advancing past the last / before the first moment returns to the dashboard with the visible 「回棋憶」 cue (never a silent jump).
- [ ] **prefers-reduced-motion**: the board jumps straight to the static end-state, no motion, no information lost.
- [ ] **OQ-R1** visual: a bare anchor in a loss reads as a neutral 「轉折點」 (◆ signpost + gold accent bar), NOT the celebratory star — confirm it doesn't read as praise.

> Reach the slideshow: finish a game → 棋憶 dashboard → tap a moment card.
