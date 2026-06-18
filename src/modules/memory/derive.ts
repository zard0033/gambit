/**
 * 棋憶 (Memory, #22) — F2 White-normalized eval series for the shape-of-game chart.
 * Pure derivation over Post-Game Review (#7) output (ADR-0014 §3). See GDD Formula F2.
 *
 * #7 stores `evalCp` in side-to-move convention, so a raw plot zig-zags by whose turn it is.
 * Normalize to White's perspective: even ply → White to move (already White's view); odd → negate.
 * Mate scores map to the clamp bound by sign; all values clamp to ±EVAL_CHART_CLAMP_CP for legibility.
 */

import type { StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'
import { EVAL_CHART_CLAMP_CP } from '@/config/memory-config'

function clamp(cp: number): number {
  return Math.max(-EVAL_CHART_CLAMP_CP, Math.min(EVAL_CHART_CLAMP_CP, cp))
}

/** White-normalized, clamped eval at position i. `null` where no analysis exists yet (chart gap). */
function evalWhiteAt(entry: StoredAnalysisEntry | null, i: number): number | null {
  if (!entry) return null
  let e: number
  if (entry.evalMate !== undefined) e = entry.evalMate > 0 ? EVAL_CHART_CLAMP_CP : -EVAL_CHART_CLAMP_CP
  else if (entry.evalCp !== undefined) e = clamp(entry.evalCp)
  else return null
  return i % 2 === 0 ? e : -e
}

/** E_white[i] across the whole game (GDD Rule 8 / F2): White-advantage positive, clamped to ±4 pawns. */
export function evalWhiteSeries(
  analysisResults: ReadonlyArray<StoredAnalysisEntry | null>,
): Array<number | null> {
  return analysisResults.map((entry, i) => evalWhiteAt(entry, i))
}
