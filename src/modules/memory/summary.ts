/**
 * 棋憶 (Memory, #22) — F4 Step 1: per-game tagging into a durable MemoryGameSummary. Pure.
 * See `design/gdd/memory.md` Formula F4 + F4-schema; ADR-0014 §1.
 *
 * `stageCounts`/`conceptCounts` count the PRE-CAP gated candidates (F1 Step 3, via gatedCandidates),
 * not the displayed ≤5 moments — so a calm game still contributes honest stage data.
 */

import type { Moment, Stage, MemoryGameSummary } from '@/types/memory'

export interface BuildGameSummaryInput {
  readonly gameId: string
  /** epoch ms (the game's completion time) — for F4 chronological ordering. */
  readonly createdAt: number
  /** Pre-cap gated candidates (from `gatedCandidates`). */
  readonly gated: ReadonlyArray<Moment>
  /** Caller injects stage per ply (classifyStage over the game FENs) — keeps this pure. */
  readonly stageOf: (ply: number) => Stage
  /** #7's biggestSwingCursor; null on a steady game. */
  readonly anchorPly: number | null
  readonly schemaVersion: number
}

export function buildGameSummary(input: BuildGameSummaryInput): MemoryGameSummary {
  const stageCounts: Record<Stage, number> = { opening: 0, middlegame: 0, endgame: 0 }
  const conceptCounts: Record<string, number> = {}

  for (const m of input.gated) {
    stageCounts[input.stageOf(m.ply)] += 1
    if (m.concept !== 'none') conceptCounts[m.concept] = (conceptCounts[m.concept] ?? 0) + 1
  }

  return {
    schemaVersion: input.schemaVersion,
    gameId: input.gameId,
    createdAt: input.createdAt,
    stageCounts,
    conceptCounts,
    anchorStage: input.anchorPly !== null ? input.stageOf(input.anchorPly) : null,
  }
}
