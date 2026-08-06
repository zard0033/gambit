/**
 * 棋憶 (Memory, #22) shared types. See `design/gdd/memory.md` + ADR-0014.
 *
 * Pillar-3 / Principle-4 discipline: these surfaced types carry NO emotive or score field
 * (no `grade`, `rating`, `weakness`, `blunder`). `kind` is an INTERNAL taxonomy that never
 * renders as a visible category label (GDD Rule 11/12).
 */

import type { ClassifyResult } from '@/modules/learning-loop/classify'

/** Internal moment taxonomy (GDD Rule 12) — drives icon + color + animation, never a visible label. */
export type MomentKind = 'tactical' | 'bright' | 'plain'

/** Game stage of a position (GDD F5). */
export type Stage = 'opening' | 'middlegame' | 'endgame'

/**
 * Durable per-game summary (the only thing 棋憶 persists across sessions). NOT a per-game moment
 * cache (ADR-0014). `stageCounts`/`conceptCounts` count the GATED candidates pre-cap (F1 Step 3),
 * not the displayed ≤5 moments (GDD F4-schema).
 *
 * D4 (2026-08) retired the only reader (the cross-game F4 Neve line) — still written every game
 * (recordSummary in MemoryView). Registered Deferred Cleanup, see
 * .claude/docs/technical-preferences.md "Deferred Cleanups" (review by 2026-11-06).
 */
export interface MemoryGameSummary {
  readonly schemaVersion: number
  readonly gameId: string
  /** epoch ms (mirrors the row's created_at) — F4 orders the window chronologically by this. */
  readonly createdAt: number
  readonly stageCounts: Record<Stage, number>
  /** concept tag → count; open record so future concepts (fork/pin…) need no schema change. */
  readonly conceptCounts: Record<string, number>
  readonly anchorStage: Stage | null
}

/** A selected key moment (F1 output). Selection-relevant fields only; display move strings are
 *  attached by the view layer from the game line. */
export interface Moment {
  /** Position index i (the player's move under inspection). */
  readonly ply: number
  readonly kind: MomentKind
  /** The largest-swing anchor (biggestSwingCursor) carries this flag for emphasis (GDD Rule 13). */
  readonly anchor: boolean
  readonly concept: ClassifyResult
  /** cpLoss at this position (centipawns, ≥ 0). */
  readonly cp: number
  /** Favorable swing (> 0 when the player outperformed); -Infinity when not a clean bright candidate. */
  readonly fav: number
}
