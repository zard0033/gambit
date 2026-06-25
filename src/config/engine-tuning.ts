/**
 * Engine tuning knobs for Post-Game Review two-pass analysis.
 * GDD Post-Game Review §Tuning Knobs.
 *
 * OQ-5 resolved 2026-06-25 (Eason): the original provisional values (depth 22 / 10s-per-move /
 * 90s budget) made a full review stare at a progress bar for ~90s on iPhone single-thread WASM.
 * Lowered to target ~20s total. Quality holds for 棋憶's job — it surfaces gross beginner mistakes
 * (60cp / 120cp moment gates, coarse), and Stockfish at depth 16 (~2500 Elo) never misses a hung
 * piece / fork / back-rank mate. The cost is cp-number precision + occasional borderline moments +
 * occasionally a second-best "better move" on deep tactics — acceptable for a calm training tool.
 * Real wall-clock only measurable on device; revisit one notch if it still feels long.
 */

/** Pass-1 (preview) analysis depth. Shallow so whole game reads quickly. */
export const REVIEW_PREVIEW_DEPTH = 12

/** Pass-1 per-position time cap in ms. */
export const REVIEW_PREVIEW_MOVE_TIME_MS = 1_000

/** Pass-2 (deep) analysis depth. Lowered from 22 (OQ-5) — depth 16 still far exceeds beginner play. */
export const REVIEW_TARGET_DEPTH = 16

/** Pass-2 per-position time cap in ms. */
export const REVIEW_MAX_MOVE_TIME_MS = 4_000

/** Hard ceiling on the deep pass in ms (Rule 14). Pass 1 is never cut. Lowered from 90s (OQ-5). */
export const REVIEW_TOTAL_TIME_BUDGET_MS = 12_000

/**
 * Max abs(depthReached[i] − depthReached[i+1]) for a cpLoss to be a final value.
 * Exceeding this shows the cpLoss with preliminary treatment (Rule 22a).
 */
export const DEPTH_MISMATCH_TOLERANCE = 4

/**
 * Centipawn value representing a forced mate for F2 ranking (F4).
 * Affects swing ordering only; mate transitions display via F2b labels.
 */
export const MATE_CP = 30_000
