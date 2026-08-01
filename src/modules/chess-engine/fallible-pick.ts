/**
 * Deliberate mistakes for the opponent, picked from the engine's own candidate list.
 *
 * Stockfish has no UCI knob that makes it play like a beginner. Measured 2026-08-01 with a
 * "white hangs a knight — does it take?" probe: Skill Level 0 (at depth 1/5/8), `go nodes 1`,
 * `UCI_Elo 1320` (the official floor) and depth caps all took the piece 16-20 times out of 20.
 * `go nodes 1` still takes it because move ordering (MVV-LVA) puts captures first — it does not
 * even need to search. Weakness has to be manufactured outside the engine, which is what this does.
 *
 * The window is what separates this from the random-move injection rejected earlier. Below
 * `minLossCp` the mistake is invisible to a beginner; above `maxLossCp` it is a hung piece, and a
 * player who wins that way knows it was a gift. In between sits the move that loses ground without
 * losing material — measured to be moves like f7f5, g7g5, b7b5, g2g4, Ng1h3 in the opening, which
 * is exactly what a real beginner plays. Engine-bad and beginner-favourite overlap there.
 */

import type { FallibleConfig } from '../../config/difficulty-tuning'

/** One MultiPV line. Index 0 is the engine's best move; the list is sorted by score descending. */
export interface MoveCandidate {
  move: string
  /** Centipawn score, side-to-move relative. Absent when the line is a forced mate. */
  cp?: number
  /** Moves to mate, side-to-move relative. Positive = we mate, negative = we get mated. */
  mate?: number
}

/**
 * Picks a deliberately worse move, or returns undefined to mean "play the engine's best move".
 *
 * Returns undefined (i.e. plays well) when there is a forced mate available — declining to deliver
 * mate reads as the opponent letting you off, which is far more obvious than a positional slip,
 * and it drags the game out.
 *
 * @param candidates - MultiPV lines, best first.
 * @param config - Rung tuning; undefined disables mistakes entirely (top rung).
 * @param roll - Injectable RNG so tests stay deterministic.
 */
export function pickFallibleMove(
  candidates: readonly MoveCandidate[],
  config: FallibleConfig | undefined,
  roll: () => number = Math.random,
): string | undefined {
  if (!config || config.probability <= 0) return undefined
  if (candidates.length < 2) return undefined

  const best = candidates[0]
  // A mate line has no cp score to measure loss against, and we never decline a mate anyway.
  if (best.mate !== undefined || best.cp === undefined) return undefined

  if (roll() >= config.probability) return undefined

  const bestCp = best.cp
  const inWindow = candidates.slice(1).filter((c) => {
    // Mate lines this far down the list are ones where WE get mated. Never pick those.
    if (c.mate !== undefined || c.cp === undefined) return false
    const loss = bestCp - c.cp
    return loss >= config.minLossCp && loss <= config.maxLossCp
  })

  // Nothing in the window — common in endgames where few legal moves exist and all are close.
  if (inWindow.length === 0) return undefined

  return inWindow[Math.min(inWindow.length - 1, Math.floor(roll() * inWindow.length))].move
}
