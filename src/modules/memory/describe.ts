/**
 * 棋憶 (Memory, #22) — view-support derivations shared by the dashboard (007) and slideshow (008).
 * Pure: UCI → plain-language move, the visual kind (incl. the OQ-R1 neutral turning-point), and a
 * moment's plain short name. See `design/ux/memory.md` (EC-14 icon/words, OQ-R1) + persona-neve 回顧態.
 *
 * Moves are described in PLAIN LANGUAGE for beginners ("把主教移到 g5"), never SAN.
 */

import { Chess } from 'chess.js'
import type { Moment } from '@/types/memory'
import { MEMORY_BRIGHT_GATE } from '@/config/memory-config'

/**
 * A move described in plain language: which 中文 piece (后/城堡/騎士/主教/國王/兵) moved to which square,
 * plus what else happened on that move. The optional fields exist because「把后移到 f7」was being said
 * for a move that actually **ate the pawn on f7** — the destination alone hides the whole point of the
 * move (2026-08-08 precommit-review). Render with `movePhrase`, never by hand.
 */
export interface MoveDesc {
  readonly piece: string
  readonly to: string
  /** The 中文 piece captured on `to`; absent when the move captured nothing. */
  readonly captured?: string
  /** The 中文 piece a pawn promoted into. */
  readonly promotion?: string
  /** 易位 replaces the whole phrase — 王 and 城堡 both move, so「把國王移到 g1」is a half-truth. */
  readonly castle?: 'short' | 'long'
  /** 吃過路兵: the captured pawn is NOT on `to`, so the phrase must not name a square. */
  readonly enPassant?: boolean
}

/** Chess piece type → 西洋棋 中文 (CLAUDE.md hard rule: 城堡/騎士/主教, never 象棋 車/馬/象). */
const PIECE_ZH: Record<string, string> = { q: '后', r: '城堡', n: '騎士', b: '主教', k: '國王', p: '兵' }

/** chess.js piece type → 中文, for callers holding a raw type char (e.g. `hungMaterialDetail`). */
export function pieceZh(type: string): string {
  return PIECE_ZH[type] ?? '子'
}

/**
 * Plain-language description of a UCI move from the position `fenBefore`.
 * Returns null when the FEN/UCI can't be read or the move is illegal there — callers skip the moment.
 *
 * Uses `move()` rather than `get(from)`: one replay yields the captured piece, the promotion and the
 * castling flag, all of which the phrase needs. Legality now gates the description too, which is
 * stricter than before and matches what `buildMomentDisplays` already checks separately.
 */
export function describeMove(fenBefore: string, rawUci: string | null | undefined): MoveDesc | null {
  if (!rawUci || rawUci.length < 4) return null
  // 升變後綴大小寫不影響同一手（`a7a8Q` === `a7a8q`）；`.move()` 只收小寫，大寫會被當成非法手丟掉。
  const uci = rawUci.toLowerCase()
  let move
  try {
    move = new Chess(fenBefore).move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length === 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined,
    })
  } catch {
    return null
  }
  if (!move) return null

  return {
    piece: pieceZh(move.piece),
    to: move.to,
    captured: move.captured ? pieceZh(move.captured) : undefined,
    promotion: move.promotion ? pieceZh(move.promotion) : undefined,
    castle: move.flags.includes('k') ? 'short' : move.flags.includes('q') ? 'long' : undefined,
    enPassant: move.flags.includes('e') || undefined,
  }
}

/**
 * 「把主教移到 g5」／「用后吃掉 f7 的兵」——白話文的走法片語，**全站唯一出處**。
 *
 * 元件不准自己組（`KeyMomentsCard` 曾經硬編 `把{piece}移到 {to}`，於是卡片說「把后移到 f7」、
 * Neve 的句子說「用后吃掉 f7 的兵」——同一手兩種說法）。
 *
 * 片語內不放逗號：它會被塞進「與其${played}，不如先${best}。」中間，自帶標點會把句子斷成兩截。
 */
export function movePhrase(m: MoveDesc): string {
  if (m.castle) return m.castle === 'short' ? '做短易位' : '做長易位'
  if (m.enPassant) return `用${m.piece}吃過路兵`
  // 升變後綴前的空白只在片語結尾是格號（拉丁字母＋數字）時才加——結尾是中文子名時補空白會多一個
  // 沒來由的停頓。
  if (m.captured) {
    const core = `用${m.piece}吃掉 ${m.to} 的${m.captured}`
    return m.promotion ? `${core}升變成${m.promotion}` : core
  }
  const core = `把${m.piece}移到 ${m.to}`
  return m.promotion ? `${core} 升變成${m.promotion}` : core
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
 * `hungPiece`（中文子名）有值時 material 才點得出是哪顆子；判定給不出來就退回籠統的「漏掉一個子」
 * ——`hungMaterialDetail` 在有疑義時一律回 null（prefer-silence），寧可籠統也不指錯子。
 */
export function momentShortName(
  tone: MomentTone,
  concept: Moment['concept'],
  hungPiece?: string,
): string {
  switch (tone) {
    case 'tactical':
      if (concept === 'mate') return '差點被將死'
      return hungPiece ? `${hungPiece}沒人守著` : '漏掉一個子'
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
