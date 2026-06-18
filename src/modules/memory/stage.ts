/**
 * 棋憶 (Memory, #22) — F5 stage classification (opening / middlegame / endgame). Pure, no engine call.
 * See GDD Formula F5. Used to tag each moment's stage for the cross-game F4 line.
 *
 * Invariant: ENDGAME_MATERIAL < OPENING_MATERIAL (the tuning ranges preserve it). Endgame is checked
 * first (material is the stronger late signal); middlegame is the catch-all, so every position
 * classifies — no gap, no overlap.
 */

import type { Stage } from '@/types/memory'
import { ENDGAME_MATERIAL, OPENING_PLY_MAX, OPENING_MATERIAL } from '@/config/memory-config'

const NON_PAWN_VALUE: Record<string, number> = { q: 9, r: 5, b: 3, n: 3 }

/** Total non-pawn, non-king material on the board from a FEN (Q=9,R=5,B=3,N=3). Full board = 62. */
export function nonPawnMaterial(fen: string): number {
  const placement = fen.split(' ')[0]
  let sum = 0
  for (const ch of placement) {
    const v = NON_PAWN_VALUE[ch.toLowerCase()]
    if (v !== undefined) sum += v
  }
  return sum
}

export interface StageTuning {
  endgameMaterial?: number
  openingPlyMax?: number
  openingMaterial?: number
}

/**
 * @param ply         position index (state after `ply` plies)
 * @param fen         FEN at that position
 * @param bookExitPly opening boundary from #3 (`identifyOpening().bookExitPly`); null when unknown (EC-8)
 */
export function classifyStage(
  ply: number,
  fen: string,
  bookExitPly: number | null,
  tuning: StageTuning = {},
): Stage {
  const endgameMaterial = tuning.endgameMaterial ?? ENDGAME_MATERIAL
  const openingPlyMax = tuning.openingPlyMax ?? OPENING_PLY_MAX
  const openingMaterial = tuning.openingMaterial ?? OPENING_MATERIAL

  const material = nonPawnMaterial(fen)
  if (material <= endgameMaterial) return 'endgame' // checked first
  if ((bookExitPly !== null && ply <= bookExitPly) || (ply <= openingPlyMax && material >= openingMaterial)) {
    return 'opening'
  }
  return 'middlegame' // catch-all
}
