/**
 * Concept deepening (quick-specs/concept-deepening-page.md). Each concept the player has met can be
 * taken "one layer deeper" — a short, transfer-focused mini-course that reuses the lesson player.
 * Reuses {@link LessonStep} verbatim; deepening adds no new step shape, only a new catalog + entry.
 *
 * Static, front-end-only data. `intro` plays the lesson `scenario` role (shown before step 1).
 * Every FEN / move is clean-room and chess.js-verified by tests/unit/data/concept-deepening.test.ts.
 */

import type { ChessConcept } from './concept'
import type { LessonStep } from './lesson'

export interface ConceptDeepening {
  conceptId: ChessConcept
  /** 繁中 title shown in the player header, e.g. '捉雙 · 深化'. */
  title: string
  /** Situational set-up shown before the first step (Neve's method: scenario first). */
  intro: string
  steps: LessonStep[]
  /** The tactic's essence, crystallized — shown in the wrap-up popup for a calm "回味" (A3). */
  essence: string
}
