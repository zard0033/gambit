/**
 * 棋憶 (Memory, #22) — view-support derivations shared by the dashboard (007) and slideshow (008).
 * Pure: UCI → plain-language move, the visual kind (incl. the OQ-R1 neutral turning-point), and a
 * moment's plain short name. See `design/ux/memory.md` (EC-14 icon/words, OQ-R1) + persona-neve 回顧態.
 *
 * Moves are described in PLAIN LANGUAGE for beginners ("把主教移到 g5"), never SAN.
 */

import { Chess, type Square } from 'chess.js'
import type { Moment } from '@/types/memory'
import type { MoveDesc } from './templates'
import { MEMORY_BRIGHT_GATE } from '@/config/memory-config'

/** Chess piece type → 西洋棋 中文 (CLAUDE.md hard rule: 城堡/騎士/主教, never 象棋 車/馬/象). */
const PIECE_ZH: Record<string, string> = { q: '后', r: '城堡', n: '騎士', b: '主教', k: '國王', p: '兵' }

/**
 * Plain-language description of a UCI move from the position `fenBefore`.
 * Returns null when the FEN/UCI can't be read (missing best move, malformed) — callers fall back.
 */
export function describeMove(fenBefore: string, uci: string | null | undefined): MoveDesc | null {
  if (!uci || uci.length < 4) return null
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  let piece
  try {
    piece = new Chess(fenBefore).get(from as Square)
  } catch {
    return null
  }
  if (!piece) return null
  return { piece: PIECE_ZH[piece.type] ?? '子', to }
}

/**
 * The visual kind that drives icon + color (GDD Rule 12 + OQ-R1 ruling in the UX spec).
 * `kind` from selection collapses anchor and bright into 'bright'; here we split out the OQ-R1
 * case: a bare anchor (a swing AGAINST the player, fav below the bright gate) is the player's
 * costly turning point in a loss — it gets a NEUTRAL 'turning-point' treatment, NOT the
 * celebratory star/success of a genuine bright recovery.
 */
export type MomentVisualKind = 'tactical' | 'bright' | 'plain' | 'turning-point'

export function momentVisualKind(m: Moment): MomentVisualKind {
  if (m.kind === 'tactical') return 'tactical'
  if (m.kind === 'bright') {
    // genuine bright recovery (player outperformed) vs bare anchor (biggest loss) — OQ-R1
    return m.fav >= MEMORY_BRIGHT_GATE ? 'bright' : 'turning-point'
  }
  return 'plain'
}

/**
 * A moment's plain short name (GDD Rule 11) — the card's headline. No engine-taxonomy label.
 * ponytail: the material case shows a generic 「漏掉一個子」 rather than naming the hung piece —
 * naming it needs a hanging-piece re-derivation (real work); the template degrades cleanly. Upgrade
 * path: pass the resolved hung piece in when F3's hungPiece is wired.
 */
export function momentShortName(m: Moment): string {
  switch (momentVisualKind(m)) {
    case 'tactical':
      return m.concept === 'mate' ? '差點被將死' : '漏掉一個子'
    case 'bright':
      return '你穩住了自己'
    case 'turning-point':
      return '這盤的轉折'
    case 'plain':
      return '被推著走的一段'
  }
}
