/**
 * 棋憶 (Memory, #22) tuning constants — GDD `design/gdd/memory.md` Tuning Knobs + Formulas.
 *
 * All values are the GDD defaults. The Acceptance Criteria are test-frozen against their own
 * fixtures (not these live values), so retuning a knob never flips a unit test.
 *
 * `MEMORY_SUMMARY_SCHEMA_VERSION` is the durability contract (ADR-0014 §5): bump it in the SAME
 * commit that changes F1 selection or F5 stage classification, so F4 ignores summaries written
 * under an incompatible version rather than mixing inconsistent data.
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

// ---- F4: cross-game Neve line ----
export const OBS_WINDOW = 10
export const OBS_MIN_SAMPLE = 6
export const OBS_MIN_STAGE = 3
export const OBS_IMPROVE_DELTA = 0.3
export const OBS_CONCEPT_FRAC = 0.5

// ---- F2: shape-of-game eval chart ----
/** Display clamp (centipawns, ±4 pawns) for the White-normalized eval series. */
export const EVAL_CHART_CLAMP_CP = 400

// ---- F5: stage classification ----
/** Non-pawn material at/below which a position is endgame (must stay < OPENING_MATERIAL). */
export const ENDGAME_MATERIAL = 12
/** Max ply still considered opening when out of book. */
export const OPENING_PLY_MAX = 16
/** Non-pawn material above which early plies are opening. */
export const OPENING_MATERIAL = 56

// Slideshow animation knobs (GDD v9: 650/380/700/520 ms) land with story-008, their first consumer.
