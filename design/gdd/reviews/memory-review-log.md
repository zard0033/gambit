# Review Log — 棋憶 (Memory, #22)

## Review — 2026-06-18 — Verdict: MAJOR REVISION NEEDED → revisions applied same session
Scope signal: L
Specialists: game-designer, systems-designer, ux-designer, qa-lead → creative-director (synthesis). Run via general-purpose with persona load (game-repo agents not registered to Task).
Blocking items: 4 specialist tracks converging on ~12 blockers | Recommended: ~15

**Summary of key findings (creative-director synthesis):**
The GDD was complete (8/8) and dependency-clean, but read against its own north star the dashboard
quietly rebuilt the "report card" the product exists to refuse. Three design-level issues + a false
data-availability claim were the core:
1. **Vision violation** — `F4 weak(stage)` ("your endgame is weakest") = a banned cross-game thematic
   verdict (vision「棋誌不是數據／不是評分」; #7 "never forms a thematic verdict across games").
2. **Report-card framing** — Neve verdict → eval *graph* → ranked error *list* is the grammar of a
   report card even when every pixel is calm; #7's binding "calm default, opt-in detail" was dropped.
3. **Engine vocabulary leak** — "沒有戰術的轉折" only parses if you know a classifier exists.
4. **False data claim** — F1's `E[i]` and the trend chart need a White-normalized series #7 does NOT
   expose (`getEvalCp` private, side-to-move-relative); plus mate-poisoned bright detection, same-ply
   double-card + anchor-eviction nondeterminism (the GDD's own worked example, ply 13, was the
   counterexample), and a `MemoryGameSummary` durability trap (#7 persists no analysisResults).

**Revisions applied (Eason chose: cut weak, keep eval view, reframe — CD-recommended):**
- F4: cut `weak(stage)`; priority now improving > recurring(invitation) > neutral; added div-by-zero
  guard (`OBS_MIN_STAGE`), raised `OBS_MIN_SAMPLE` to 6, added `MemoryGameSummary` schema with
  `schemaVersion`.
- Dashboard reframed: eval view = "shape of the game" not a score; moment list chronological not
  ranked; no verdict on top. AC-1 rewritten so the report-card layout is not a pass condition.
- F2: stated 棋憶 derives `E[i]` itself + White-normalization `E_white[i]=(i even?E[i]:-E[i])`.
- F1: mate guard on bright detection; same-ply merge (priority tactical>anchor>bright>plain);
  anchor force-include before cap; anchor gate-exempt via `MEMORY_ANCHOR_FLOOR`; degenerate paths
  (null `biggestSwingCursor`) specified; gate default 60 (matches approved demo, resolves OQ-1).
- Moment kinds made internal (icon/color/animation only); no engine-jargon labels on cards.
- ACs: added AC-2b/2c/2d (cap/gate/same-ply), AC-11b (no-AI + no-weak lint), AC-12b (F4 priority),
  strengthened AC-13 (F5 boundary fixtures); split AC-8/9/16 into automatable + manual-evidence
  halves; added AC-17 (keyboard/a11y); rewrote AC-3/AC-16 to be testable.
- Edge cases EC-12..EC-15 added (chart drift-guard, two-door clarity, color-blind, last-moment cue).

**Deferred to a UX spec / frontend pass (fix #5):** two-door affordance + slideshow↔replay cross-link,
chart drift-guard, color-blind channel, reduced-motion full-comparison, keyboard parity, ≥44px dots,
back-nav targets. Conformance against the existing house a11y/visual standard, not GDD design holes.

**Open (tune, don't block):** OQ-2 animation pacing; OQ-R1 anchor hue in a loss.
Prior verdict resolved: First review.

## Review — 2026-06-18 — Verdict: APPROVED (round 2, lean — no agents)
Scope signal: L
Specialists: none (single-session structural re-check, per Eason).
Blocking items: 0 | Recommended: 2 | Nice-to-have: 2
Summary: All 12 round-1 blockers verified resolved (weak-stage cut, dashboard reframed + AC-1, kinds
internalized, E[i] derivation + White-normalization, mate guard, same-ply merge + anchor force-include,
schemaVersion, gate→60, AC rewrites). Consistency re-checked: F1 pipeline deterministic (ply-13 merge
→ weightedScore 390, kind tactical); F5 invariant holds across tuning ranges; F4 noise floor blocks
one-game false trends with no div-by-zero. Residual is advisory only: journal.md (#21) should back-
reference 棋憶 as the review destination; fix-#5 UX spec must be its own story preceding slideshow/
dashboard implementation; AC renumbering + bright max-1 tie-break are cosmetic.
Verdict: APPROVED — design-review closed at round 2 (the 2-round cap). Ready for /create-epics.
Prior verdict resolved: Yes (round-1 MAJOR REVISION fully addressed).
