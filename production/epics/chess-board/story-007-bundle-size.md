# Story 007: Bundle Size and Performance Budget Verification

> **Epic**: Chess Board & Move System
> **Status**: Ready
> **Layer**: Foundation (Core — chess board substrate)
> **Type**: Config/Data
> **Estimate**: S (1–2 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-chess-board-007
> **ADR**: ADR-0006, ADR-0009

## Context

**GDD**: `design/gdd/chess-board-and-move-system.md`
**Requirement**: `TR-chess-board-007`
*(Requirement text lives in `docs/architecture/tr-registry.yaml`)*

**ADR Governing Implementation**: ADR-0009: Chess Board Substrate, vue3-chessboard Integration, Keyboard Model
**ADR Decision Summary**: The chess board subsystem (vue3-chessboard + chess.js + piece-set SVGs + ChessBoard.vue) must total ≤ 120 KB gzipped. All animations use `transform` and `opacity` only (never layout/paint properties). This story verifies the budget is met after all Stories 001–006 are implemented.

**Secondary ADR**: N/A — bundle budget is a constraint from the GDD and ADR-0009, not a separate ADR.

**Engine**: Web App — Vite 5 build | **Risk**: LOW
**Engine Notes**: Vite's `rollup-plugin-visualizer` or `vite-bundle-visualizer` produces gzip-size breakdown per chunk. The chess board component and its direct dependencies (vue3-chessboard, chess.js, piece SVGs) should land in a dedicated chunk isolated by `manualChunks`.

**Control Manifest Rules (Foundation layer)**:
- Guardrail: Chess Board subsystem bundle ≤ 120 KB gzipped (CI gate)
- Guardrail: Initial bundle targets < 3s on mobile 4G cold-start (after lazy-splitting)

---

## Acceptance Criteria

*From GDD `design/gdd/chess-board-and-move-system.md` — performance ACs:*

- [ ] **GIVEN** the board subsystem bundle is built for production, **WHEN** measured gzipped, **THEN** chess-board JS + chess.js + piece-set SVGs total ≤ **120KB gzipped**.
- [ ] **GIVEN** any single move animates on a fixed-CPU CI runner (Chromium with 4× CPU throttle), **WHEN** a CDP performance trace is captured, **THEN** no frame in the trace exceeds **20ms** AND the p95 frame time is ≤ **16.6ms** (tagged `@perf` — excluded from default suite).
- [ ] **GIVEN** the board mounts on Chromium with `Mobile - Slow 4G` Lighthouse-CI profile, **WHEN** Lighthouse reports, **THEN** Time-to-Interactive ≤ **3s including bundle download**.

---

## Implementation Notes

*Derived from ADR-0009 §Perf + GDD Performance ACs:*

- **Build verification**: add a CI step in `.github/workflows/tests.yml`:
  1. Run `vite build --mode production`
  2. Use `du -sh dist/assets/chess-board-*.js` or `rollup-plugin-visualizer` JSON output to extract the chess-board chunk gzip size
  3. Assert ≤ 120,000 bytes gzipped (`node -e "const s = require('fs').statSync('dist/assets/chess-board.HASH.js.gz').size; if (s > 120000) process.exit(1)"`)
- **`manualChunks` in vite.config.ts**: split chess-board-related modules into a dedicated chunk:
  ```ts
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'chess-board': ['vue3-chessboard', 'chessground']
        }
      }
    }
  }
  ```
- **Piece SVG handling**: import piece set SVGs as assets (not inlined). Vite will copy them as separate files — they do NOT count toward the JS gzip budget but total page weight matters.
- **Performance frame trace** (tagged `@perf`): write a Playwright test that:
  1. Mounts ChessBoard on a throttled Chromium page (CDP `Emulation.setCPUThrottlingRate(4)`)
  2. Simulates a move event
  3. Captures a CDP trace for 500ms
  4. Parses trace events and asserts p95 frame time ≤ 16.6ms
  This test is tagged `@perf` and run separately (not in default Vitest suite).
- **Lighthouse CI**: integrate `lhci autorun` or `@lhci/cli` in GitHub Actions. Config targets `performance.interactive < 3000` on the `Slow 4G` preset.

---

## Out of Scope

*Handled by neighbouring stories:*

- [Stories 001–006]: All implementation that this story verifies. This story only adds build measurement + CI gates, not new functionality.

---

## QA Test Cases

*Config/Data story — smoke check.*

- **AC-1**: Bundle size ≤ 120 KB gzipped
  - Run: `npm run build` → check gzip size of chess-board chunk
  - Pass condition: gzip size reported ≤ 120,000 bytes; CI step exits 0

- **AC-2**: Performance frame trace (@perf)
  - Run: `npx playwright test --grep "@perf"` (on CI with 4× CPU throttle)
  - Pass condition: all frames ≤ 20ms; p95 ≤ 16.6ms

- **AC-3**: Lighthouse TTI ≤ 3s
  - Run: `lhci autorun --config=lighthouserc.json`
  - Pass condition: `interactive` metric < 3000ms on Slow 4G profile; LHCI exits 0

---

## Test Evidence

**Story Type**: Config/Data
**Required evidence**:
- `production/qa/smoke-chess-board-bundle.md` — record of build output showing bundle size ≤ 120 KB

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: **All Stories 001–006 must be DONE** (measures the final built artifact)
- Unlocks: Epic game-lifecycle (ChessBoard is a dependency — Foundation bottleneck cleared)
