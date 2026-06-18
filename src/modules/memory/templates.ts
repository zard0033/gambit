/**
 * 棋憶 (Memory, #22) — zero-AI Neve templates (F3 per-moment + F4 cross-game line). Pure, no network.
 * See `design/gdd/memory.md` Formulas F3/F4 + `design/gambit-design-system/persona-neve.md` §回顧態.
 *
 * 回顧態 guardrails baked into the copy: 「你」-subject, active voice, never imputes intent, mistakes
 * neutral (no 失誤/錯), good moves stated not gushed, plain kind prefers the quietest phrasing.
 *
 * Moves are rendered in PLAIN LANGUAGE for beginners ("把主教移到 g5"), never chess notation
 * ("Bg5") — the audience cannot read SAN.
 *
 * ponytail: one fixed phrase per concept (not a multi-variant bank yet); the move tokens
 * (中文 piece + destination square) are assembled by the view (007/008) and passed in.
 */

import type { NeveSignal, Stage, MomentKind } from '@/types/memory'
import type { ClassifyResult } from '@/modules/learning-loop/classify'

const STAGE_NAME: Record<Stage, string> = { opening: '開局', middlegame: '中局', endgame: '殘局' }
const CONCEPT_PHRASE: Record<string, string> = { material: '子力安全', mate: '對手的將殺威脅' }

/** F4: render the cross-game line from its signal. */
export function renderNeveLine(signal: NeveSignal): string {
  switch (signal.kind) {
    case 'improving':
      return `你最近${signal.n}盤的${STAGE_NAME[signal.stage]}，比之前穩了一些——我們慢慢練。`
    case 'recurring':
      return `${CONCEPT_PHRASE[signal.concept] ?? '這個地方'}這個，我們之後可以一起多看幾次。`
    case 'neutral':
      return '最近這幾盤都走得挺穩的。'
    case 'first-or-few':
      return '我才剛開始看你的棋——多下幾盤，我會更懂你的棋風。'
  }
}

/** A move described in plain language: which 中文 piece (后/城堡/騎士/主教/國王/兵) moved to which square. */
export interface MoveDesc {
  readonly piece: string
  readonly to: string
}

/** Tokens for a per-moment explanation, assembled by the view from the analyzed line. */
export interface MomentText {
  readonly kind: MomentKind
  readonly concept: ClassifyResult
  /** The move you made. */
  readonly played: MoveDesc
  /** The better move; omit on a good move. */
  readonly best?: MoveDesc
  /** material: the undefended piece left hanging (中文) + the square it sat on. */
  readonly hungPiece?: string
  readonly hungSquare?: string
}

/** "把主教移到 g5" — plain-language move phrase. */
function movePhrase(m: MoveDesc): string {
  return `把${m.piece}移到 ${m.to}`
}

/** F3: render a moment's explanation. Keyed on kind + concept; fills from the analyzed line. */
export function renderMoment(m: MomentText): string {
  const played = movePhrase(m.played)
  const best = m.best ? movePhrase(m.best) : '走穩一點'

  if (m.kind === 'tactical' && m.concept === 'material') {
    return `你的${m.hungPiece ?? '子'}留在 ${m.hungSquare ?? '那裡'}，沒人守著。與其${played}，不如先${best}。`
  }
  if (m.kind === 'tactical' && m.concept === 'mate') {
    return `這裡你忽略了對手的將殺。與其${played}，先${best}，把王照顧好。`
  }
  if (m.kind === 'bright') {
    return `你穩住了——${played} 之後，把主導權拿了回來。`
  }
  // plain swing — prefer-silence: name no tactic, just give a direction
  return `這裡沒有戰術可抓。你${played}，局面鬆了一點；先${best}會穩一些。`
}
