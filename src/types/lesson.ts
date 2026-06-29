/**
 * Lesson System types (GDD: design/gdd/lesson-system.md — Appendix: Lesson Data Schema).
 *
 * Static, front-end-only data. A lesson is an ordered list of steps, each bound to
 * one board position (FEN). A step is *interactive* iff it declares `expectedMove`;
 * otherwise it is a *narration* step (the presence of `expectedMove` is the explicit
 * step-kind discriminator — there is no separate `kind` field).
 */

import type { ChessConcept } from './concept'

/** A piece-promotion target for an interactive step's expected move. */
export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

/** A chessground arrow shape (origin → destination squares, e.g. e2 → e4). */
export interface LessonArrow {
  orig: string
  dest: string
}

/**
 * One step of a lesson, pinned to a single board position.
 *
 * - Narration step: `expectedMove` absent — player advances by clicking "Next".
 * - Interactive step: `expectedMove` present — player advances only by playing it.
 */
export interface LessonStep {
  /** Board position for this step (FEN). The step's side-to-move must match the player for interactive steps. */
  fen: string
  /** Coach narration, or the prompt for an interactive step. */
  text: string
  /** Optional coach arrows drawn over the board (chessground brush shapes). */
  arrows?: LessonArrow[]
  /** Optional squares to highlight, e.g. ['e4', 'd4']. */
  highlights?: string[]
  /** Present iff the step is interactive; the single move the player must play to advance. */
  expectedMove?: { from: string; to: string; promotion?: PromotionPiece }
  /**
   * Legal, reasonable moves that aren't the taught answer (e.g. d4 when the lesson drills e4).
   * Playing one is NOT a mistake: the piece slides home, Neve gently redirects with `note`, and it
   * counts as no aid (no ✗, no hint penalty). Anything not here and not `expectedMove` is a wrong move.
   */
  softRejects?: { from: string; to: string; note: string }[]
  /** Shown after a wrong-but-legal attempt on an interactive step. */
  hint?: string
  /** Shown after the correct move on an interactive step. */
  successText?: string
}

/**
 * Lesson topic category. 1:1 with `tier`:
 * rules→1, tactics→2, opening-principles→3, endgame→4.
 */
export type LessonCategory = 'rules' | 'tactics' | 'opening-principles' | 'endgame'

/** Curriculum tier (shallow → deep). Groups the catalog; see {@link LESSON_TIERS}. */
export type LessonTier = 1 | 2 | 3 | 4

/** Difficulty label shown in the catalog. Display-only — unlocking is purely by `order`. */
export type LessonDifficulty = 'beginner' | 'intermediate' | 'advanced'

/** A single scripted lesson. */
export interface Lesson {
  id: string
  title: string
  category: LessonCategory
  difficulty: LessonDifficulty
  /** Curriculum tier; must match {@link LESSON_TIERS}[category]. Groups the catalog. */
  tier: LessonTier
  /** Global position in the linear curriculum (1-based). Drives the unlock predicate. */
  order: number
  summary: string
  /**
   * Concepts this lesson teaches (Learning Loop #20). Additive/optional — a lesson without it
   * keeps working unchanged. Drives Bridge 1 (course→puzzle) and the Concept Map's 已學 state.
   * `tests/unit/data/concepts.test.ts` asserts each concept's `teaches` lesson carries it here.
   */
  concepts?: ChessConcept[]
  /** Situational set-up shown before the first step (Neve's method: scenario first). */
  scenario?: string
  /** What the player will learn. */
  objectives: string[]
  steps: LessonStep[]
  /** Board orientation; defaults to 'white' when omitted. */
  playerColor?: 'white' | 'black'
}

/** Canonical category → tier mapping. The single source of truth for the 1:1 relationship. */
export const LESSON_TIERS: Record<LessonCategory, LessonTier> = {
  rules: 1,
  tactics: 2,
  'opening-principles': 3,
  endgame: 4,
}

/** Display heading for each tier, in catalog order. */
export const LESSON_TIER_LABELS: Record<LessonTier, string> = {
  1: '基礎規則',
  2: '基本戰術',
  3: '開局原則',
  4: '殘局技術',
}

/** Gioco Wood piece code per tier — the chapter badge piece, matching the board set. */
export const LESSON_TIER_PIECES: Record<LessonTier, string> = { 1: 'bP', 2: 'bN', 3: 'bR', 4: 'bK' }

/** Chinese numeral per tier (第一章 … 第四章). */
export const LESSON_TIER_NUMERALS: Record<LessonTier, string> = { 1: '一', 2: '二', 3: '三', 4: '四' }

/**
 * The single coach persona shown in the lesson player (UI label, not embedded in
 * each step's text). Neve — an original character (the board-spirit of Gambit); see
 * design/gambit-design-system/persona-neve.md for the full persona SoT.
 */
export const COACH = { name: 'Neve', nameEn: 'Neve' } as const
