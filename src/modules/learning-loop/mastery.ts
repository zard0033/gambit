/**
 * Concept mastery state (Learning Loop #20, GDD §4.2). Pure functions over injected predicates —
 * no store access — so they unit-test trivially. v1 exposes exactly two boolean states per concept
 * (已學 / 已練); the deferred `encountered(c)` third state (D3) is intentionally absent.
 *
 * 已練的來源自 2026-08-05（v2 的 D2）起只剩 concept-progress 的 `practiceSolved`——試煉的線性
 * `solved` set 隨外殼一起刪除。`isSolved` 仍是注入的述詞，呼叫端自己決定怎麼組。
 */

import type { ChessConcept } from '../../types/concept'
import type { Puzzle } from '../../types/puzzle'
import { getConceptById } from '../../data/concepts'
import { candidates } from './recommend'
import { CONCEPT_PRACTICED_THRESHOLD } from '../../config/learning-loop-tuning'

/**
 * 已學: the concept has ≥1 teaching lesson AND every one is completed. The non-empty guard
 * prevents a vacuous-truth `learned` on a concept with no teaching lessons (GDD §4.2).
 */
export function learned(
  concept: ChessConcept,
  isCompleted: (lessonId: string) => boolean,
): boolean {
  const teaches = getConceptById(concept)?.teaches ?? []
  if (teaches.length === 0) return false
  return teaches.every((id) => isCompleted(id))
}

/** How many of the concept's drill puzzles are solved. 0 for lesson-only concepts. */
export function practicedCount(
  concept: ChessConcept,
  allPuzzles: readonly Puzzle[],
  isSolved: (puzzleId: string) => boolean,
): number {
  return candidates(concept, allPuzzles).filter((p) => isSolved(p.id)).length
}

/**
 * 已練: solved-count ≥ threshold. Lesson-only concepts (no drill puzzles) are always false — so the
 * Concept Map shows them 已學-only and never as a half-lit「未達成」(GDD §3.5). The threshold is
 * clamped to ≥1 so a mis-set `0` knob can never mark every concept practised unconditionally.
 */
export function practiced(
  concept: ChessConcept,
  allPuzzles: readonly Puzzle[],
  isSolved: (puzzleId: string) => boolean,
  threshold: number = CONCEPT_PRACTICED_THRESHOLD,
): boolean {
  return practicedCount(concept, allPuzzles, isSolved) >= Math.max(1, threshold)
}
