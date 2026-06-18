/**
 * 棋憶 (Memory, #22) — persona lint for rendered Neve sentences (回顧態). See GDD AC-11b +
 * `design/gambit-design-system/persona-neve.md` §回顧態.
 *
 * Reuses the house emoji + xiangqi-piece-term check (journal `lintBody`) and adds 棋憶's banned
 * tokens. CJK-not-italic is a render-time CSS concern asserted in the view layer, not here.
 */

import { lintBody } from '@/lib/journal/persona-lint'

/** 回顧態 banned tokens (AC-11b): no intent-imputation (你想), no shame (blunder/錯), no reflexive praise (恭喜). */
export const MEMORY_BANNED_TOKENS = ['你想', 'blunder', '錯', '恭喜'] as const

/** Lint a rendered Neve sentence. Returns violation codes (empty = clean). */
export function lintNeve(text: string): string[] {
  const violations = lintBody(text) // emoji + xiangqi piece terms (車/馬/象) — shared house rules
  for (const token of MEMORY_BANNED_TOKENS) {
    if (text.includes(token)) violations.push(`banned:${token}`)
  }
  return violations
}
