/** Chess piece terms Neve may use (西洋棋用語). */
export const PIECE_TERMS = ['后', '城堡', '騎士', '主教', '國王', '兵'] as const

/** Xiangqi (Chinese chess) piece terms — forbidden everywhere (use PIECE_TERMS). */
export const XIANGQI_TERMS = ['車', '馬', '象'] as const

/** Blame / error vocabulary forbidden in solace entries (journal R8 永不批評). */
export const SOLACE_FORBIDDEN = ['錯', '失誤', '應該', '不該', '漏', '可惜'] as const

const EMOJI_RE = /\p{Extended_Pictographic}/u
const DIGIT_RE = /[0-9]/

/**
 * Persona-lint a rendered body — the house rules shared by every Neve-voiced surface
 * (journal, memory). Returns a list of violation codes (empty = clean).
 * - Always: no emoji; no xiangqi piece terms (車/馬/象).
 * - When `opts.solace`: additionally no blame/error tokens and no digits
 *   (solace must never criticise or quote eval numbers — journal R8 / AC-solace-3).
 *
 * CJK-not-italic is a render-time CSS concern asserted in the view layer, not here.
 */
export function lintBody(text: string, opts: { solace?: boolean } = {}): string[] {
  const violations: string[] = []
  if (EMOJI_RE.test(text)) violations.push('emoji')
  for (const term of XIANGQI_TERMS) {
    if (text.includes(term)) violations.push(`xiangqi:${term}`)
  }
  if (opts.solace) {
    for (const token of SOLACE_FORBIDDEN) {
      if (text.includes(token)) violations.push(`blame:${token}`)
    }
    if (DIGIT_RE.test(text)) violations.push('digit')
  }
  return violations
}
