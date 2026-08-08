/**
 * 棋憶 (Memory, #22) — view-support derivations shared by the dashboard (007) and slideshow (008).
 * Pure: UCI → plain-language move, the visual kind (incl. the OQ-R1 neutral turning-point), and a
 * moment's plain short name. See `design/ux/memory.md` (EC-14 icon/words, OQ-R1) + persona-neve 回顧態.
 *
 * Moves are described in PLAIN LANGUAGE for beginners ("把主教移到 g5"), never SAN.
 */

import { Chess, type Square } from 'chess.js'
import type { Moment } from '@/types/memory'
import { MEMORY_BRIGHT_GATE } from '@/config/memory-config'

/** A move described in plain language: which 中文 piece (后/城堡/騎士/主教/國王/兵) moved to which square. */
export interface MoveDesc {
  readonly piece: string
  readonly to: string
}

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
 * 一個 moment 的語氣——**標題與內文的唯一推導來源**。決定短名、決定要套哪個 F3 文案模板。
 *
 * 為什麼要收成一支：`selection.ts` 的 `displayKind` 把 anchor（這盤代價最大的一手）和真正的好棋
 * 都壓成 `'bright'`，而「玩家走的是不是最佳手」（isOwn）根本不在 `Moment` 裡。這兩件事各自被
 * 拆開判斷過一次，結果同一張卡的標題說「你穩住了自己」、內文說「局面鬆了一點」——
 * 稱讚與批評同一手（2026-08-08 precommit-review 抓到）。
 *
 * - `isOwn`（玩家走的 === 引擎最佳手）時**沒有「更好的」可講**：只有 fav 過得了門檻才是真好棋，
 *   其餘都是「被迫的局面裡已經走了最好的一手」——不能拿失誤模板去指控一手正確的走法。
 * - `!isOwn` 時沿用 OQ-R1：光禿禿的 anchor（swing 對玩家不利、fav 低於門檻）是中性的「轉折」，
 *   不是好棋該有的慶祝。
 */
export type MomentTone = 'tactical' | 'bright' | 'turning-point' | 'plain' | 'best-anyway'

export function momentTone(m: Moment, isOwn: boolean): MomentTone {
  const isGenuinelyBright = m.kind === 'bright' && m.fav >= MEMORY_BRIGHT_GATE
  if (isOwn) return isGenuinelyBright ? 'bright' : 'best-anyway'
  if (m.kind === 'tactical') return 'tactical'
  if (m.kind === 'bright') return isGenuinelyBright ? 'bright' : 'turning-point'
  return 'plain'
}

/**
 * 一個 moment 的白話短名（GDD Rule 11）——卡片的標題。不用引擎術語。
 * ponytail: material 的情況顯示籠統的「漏掉一個子」而不指名是哪顆子——指名需要 hanging-piece
 * 推導（見 technical-preferences 的 Deferred Cleanup）。接上之後這裡與 F3 模板會一起變好。
 */
export function momentShortName(tone: MomentTone, concept: Moment['concept']): string {
  switch (tone) {
    case 'tactical':
      return concept === 'mate' ? '差點被將死' : '漏掉一個子'
    case 'bright':
      return '你穩住了自己'
    case 'turning-point':
      return '這盤的轉折'
    case 'best-anyway':
      return '已經是最好的一手'
    case 'plain':
      return '被推著走的一段'
  }
}
