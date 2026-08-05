/**
 * Bridge 1 recommendation (Learning Loop #20, GDD §4.3). Pure functions over the puzzle catalog
 * — no store access — so they are trivially unit-testable. The caller supplies an `isSolved`
 * predicate；自 2026-08-05（v2 的 D2）起唯一來源是 `practiceSolved`。
 *
 * 沒有鎖可以濾（D2 之後練習是唯一模式），recommendation 不做任何解鎖過濾——every puzzle of the concept is a
 * legitimate practice target.
 */

import type { ChessConcept } from '../../types/concept'
import { MOTIF_TO_CONCEPT } from '../../types/concept'
import type { Puzzle, PuzzleMotif } from '../../types/puzzle'

/** Puzzles that drill a concept, ascending by puzzle `order`. May be empty (lesson-only concept). */
export function candidates(concept: ChessConcept, allPuzzles: readonly Puzzle[]): Puzzle[] {
  return allPuzzles
    .filter((p) => MOTIF_TO_CONCEPT[p.motif] === concept)
    .sort((a, b) => a.order - b.order)
}

/**
 * Up to `n` recommended puzzles: unsolved-first, then (for difficulty-match, rec 9) puzzles whose
 * motif equals `preferMotif` first, then by `order`. `preferMotif` lets a lesson offer same-level
 * drills first (e.g. `checkmate-in-one` → `mate-in-1` before `mate-in-2`).
 */
export function recommended(
  concept: ChessConcept,
  allPuzzles: readonly Puzzle[],
  isSolved: (puzzleId: string) => boolean,
  n: number,
  preferMotif?: PuzzleMotif,
): Puzzle[] {
  const ranked = candidates(concept, allPuzzles).slice().sort((a, b) => {
    const aSolved = isSolved(a.id) ? 1 : 0
    const bSolved = isSolved(b.id) ? 1 : 0
    if (aSolved !== bSolved) return aSolved - bSolved // unsolved (0) first
    if (preferMotif) {
      const aPref = a.motif === preferMotif ? 0 : 1
      const bPref = b.motif === preferMotif ? 0 : 1
      if (aPref !== bPref) return aPref - bPref
    }
    return a.order - b.order
  })
  return ranked.slice(0, Math.max(0, n))
}

/**
 * The single puzzle the Bridge-1 CTA deep-links into: the lowest-order unsolved drill, or — when
 * every drill is already solved — the lowest-order solved one (replay, EC-7). Returns `null` only
 * when the concept has no drill puzzles at all (a lesson-only concept → caller shows the EC-1 hint).
 */
export function practiceTarget(
  concept: ChessConcept,
  allPuzzles: readonly Puzzle[],
  isSolved: (puzzleId: string) => boolean,
): Puzzle | null {
  const list = candidates(concept, allPuzzles)
  if (list.length === 0) return null
  return list.find((p) => !isSolved(p.id)) ?? list[0]
}
