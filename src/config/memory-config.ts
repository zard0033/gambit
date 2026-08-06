/**
 * 棋憶 (Memory, #22) tuning constants — GDD `design/gdd/memory.md` Tuning Knobs + Formulas.
 *
 * All values are the GDD defaults. The Acceptance Criteria are test-frozen against their own
 * fixtures (not these live values), so retuning a knob never flips a unit test.
 *
 * `MEMORY_SUMMARY_SCHEMA_VERSION` is the durability contract (ADR-0014 §5): bump it in the SAME
 * commit that changes F1 selection or F5 stage classification, so a stale-schema summary is
 * ignored (mergeCurrentSchema) rather than mixed in as inconsistent data.
 */

export const MEMORY_SUMMARY_SCHEMA_VERSION = 1

// ---- F1: key-moment selection ----
/** Min cpLoss (centipawns) for a swing to surface. */
export const MEMORY_MOMENT_CP_GATE = 60
/** Min cpLoss for the anchor to show (0 = always show when biggestSwingCursor is non-null). */
export const MEMORY_ANCHOR_FLOOR = 0
/** Min favorable swing (cp) for a bright move to surface. */
export const MEMORY_BRIGHT_GATE = 120
/** Rank boost (cp-equivalent) for a classified tactical concept. */
export const CONCEPT_BONUS = 100
/** Hard cap on moments shown — the "calm, not a wall" promise rests here. */
export const MEMORY_MOMENT_MAX = 5

// ---- F5: stage classification ----
/** Non-pawn material at/below which a position is endgame (must stay < OPENING_MATERIAL). */
export const ENDGAME_MATERIAL = 12
/** Max ply still considered opening when out of book. */
export const OPENING_PLY_MAX = 16
/** Non-pawn material above which early plies are opening. */
export const OPENING_MATERIAL = 56

// ---- Zero-state copy (EC-1 / AC-3) ----
/** The calm, non-congratulatory line shown when a steady game surfaces no moments (GDD EC-1).
 *  AC-3 asserts the rendered copy equals this string and contains none of 做得好/恭喜/完美. */
export const MEMORY_ZERO_STATE_COPY = '這盤你走得很穩，沒有需要特別停下來看的地方。'

/** Neve's loading-state line (棋憶 analysis still running). First-person present — she is looking at
 *  this game WITH you while it analyzes (persona-neve §棋憶 loading 態). Calm presence, not a spinner. */
export const MEMORY_ANALYZING_COPY = '讓我順著你的每一步，慢慢看過這盤。'
