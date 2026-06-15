# Story 006: Engine Migration — Stockfish 16 → Stockfish 18 Lite (single-threaded)

> **Epic**: game-replay
> **Sprint**: S10-06 (Must Have — unplanned, surfaced during S10-03 browser QA)
> **Status**: Done (2026-06-02)
> **Layer**: Foundation / Chess Engine
> **Type**: Dependency upgrade + worker migration
> **Governing ADR**: ADR-0001 (amended 2026-06-02)
> **TR**: TR-chess-engine-001, TR-chess-engine-002
> **ADR**: ADR-0001, ADR-0004, ADR-0007

## Context

Browser smoke testing of S10-03 (replay analysis) revealed the engine hung with
`go` never returning a `bestmove`. Root cause: SF16's NNUE network file
(`nn-5af11540bbfe.nnue`, ~40 MB) was **never deployed** to `public/stockfish/`, so
`Use NNUE true` failed with "network file was not loaded successfully" and the search
never produced a move. This silently broke **post-game review too** (same NNUE path);
unit tests passed only because they mock the worker.

Decision (with Eason): rather than commit a 40 MB external network, upgrade to
**`stockfish-18-lite-single`** — NNUE embedded in the ~7.3 MB WASM, single-threaded
(no COOP/COEP cross-origin-isolation headers, so it works on GitHub Pages), always-NNUE.
One build now serves play, review, and replay.

## Acceptance Criteria

- [x] **AC-01**: `stockfish@18.0.7` installed; `stockfish-18-lite-single.{js,wasm}` in `public/stockfish/`; SF16 files + any external `.nnue` removed
- [x] **AC-02**: All three worker factories load the lite build via `import.meta.env.BASE_URL` (correct under GitHub Pages base path)
- [x] **AC-03**: Review/replay engine produces eval + bestmove in-browser (verified: replay depth-12 over a full game, 11/11 positions, eval bar + best-move arrow)
- [x] **AC-04**: Dead NNUE/HCE switch removed from review-engine (SF18 has no `Use NNUE` option)
- [x] **AC-05**: Full unit/integration suite green; `vue-tsc` + `vite build` green
- [x] **AC-06**: Play sanity check on `/play` — verified in-browser (Playwright real drag): White e2e4 → engine replied e7e5 (`...8/4p3/4P3/8...`, move 2, White to move)

## Verification

- Isolated worker probe (browser): `Stockfish 18 Lite WASM`, `NNUE evaluation using nn-9067e33176e8.nnue (11MiB)` embedded, `bestmove e2e4` returned.
- Replay E2E (browser): nav + eval bar (+0.4 → updates per move) + best-move arrow (b8→c6) + depth 12.

## Notes

- ADR-0001 amended (2026-06-02) with the migration rationale.
- Strength delta vs SF16 is irrelevant for a beginner trainer; SF18 Lite is far above any human.
- The Fast/Strong toggle considered earlier is **not needed** — lite is fast and strong enough as a single mode.
- `play-engine.ts` / `use-stockfish.ts` still send a now-ignored `Use NNUE` setoption (harmless; SF18 ignores unknown UCI options). Optional cleanup later.
