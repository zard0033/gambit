/**
 * 棋憶 — 一個 moment 的靜態定格（GDD Rule 16 的 end-state）。純函式：吃走子前的 FEN ＋
 * 你走的／更好的／對手回應這三手，吐出「該顯示哪個局面、盤上標什麼」。
 *
 * 定格不能少掉任何資訊：失誤同時標出**你走到的格**與**更好那手的目標格**；好棋則走到你走完、
 * 對手回應之後的局面，讓你看到那一手逼出了什麼。
 *
 * 2026-08-08 自 `e2cb898~1` 復原（D4 連坐刪除）。**只復原 end-state**：動畫分鏡 `momentFrames`
 * 與它的 timings 這一波沒有呼叫端（動畫延後，手感要實機驗），搬回來等於留一具沒有日期也沒有
 * 具名用途的屍體（technical-preferences 的 Deferred Cleanup 教訓）。要做動畫時再從同一個 commit 取。
 */

import { Chess } from 'chess.js'
import type { Annotation } from '@/modules/move-annotation/annotation-types'

interface UciParts {
  from: string
  to: string
  promotion?: 'q' | 'r' | 'b' | 'n'
}

function parseUci(uci: string): UciParts | null {
  if (!uci || uci.length < 4) return null
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? (uci[4].toLowerCase() as 'q' | 'r' | 'b' | 'n') : undefined,
  }
}

/** 對 `fen` 套用一手 UCI 後的 FEN；走法非法或格式壞掉時回 null。 */
function applyUci(fen: string, uci: string): string | null {
  const p = parseUci(uci)
  if (!p) return null
  try {
    const chess = new Chess(fen)
    chess.move({ from: p.from, to: p.to, promotion: p.promotion })
    return chess.fen()
  } catch {
    return null
  }
}

export interface ChoreographyInput {
  readonly preMoveFen: string
  readonly playedUci: string
  /** 更好的那一手；好棋時為 null／undefined（沒有更好的可標）。 */
  readonly bestUci?: string | null
  /** 好棋逼出的對手回應；不明時為 null。 */
  readonly replyUci?: string | null
}

export interface MomentFrame {
  readonly fen: string
  readonly annotations: Annotation[]
}

/**
 * 靜態定格。失誤＝在走子前的盤上同時掛兩組標註（你走的用 playedMove 次要角色，更好的用 keySquare
 * 金色角色）；好棋＝走到你走完＋對手回應之後的盤面，標你的那手與對手的回應。
 */
export function momentEndState(input: ChoreographyInput): MomentFrame {
  const played = parseUci(input.playedUci)
  const isGood = !input.bestUci

  if (!isGood && input.bestUci) {
    const best = parseUci(input.bestUci)
    const annotations: Annotation[] = []
    if (played) {
      annotations.push({ kind: 'arrow', role: 'playedMove', from: played.from, to: played.to })
      annotations.push({ kind: 'highlight', role: 'playedMove', square: played.to })
    }
    if (best) {
      annotations.push({ kind: 'arrow', role: 'keySquare', from: best.from, to: best.to })
      annotations.push({ kind: 'highlight', role: 'keySquare', square: best.to })
    }
    return { fen: input.preMoveFen, annotations }
  }

  const playedFen = applyUci(input.preMoveFen, input.playedUci) ?? input.preMoveFen
  const replyFen = input.replyUci ? applyUci(playedFen, input.replyUci) ?? playedFen : playedFen
  const reply = input.replyUci ? parseUci(input.replyUci) : null
  const annotations: Annotation[] = []
  if (played) annotations.push({ kind: 'arrow', role: 'keySquare', from: played.from, to: played.to })
  // 對手的回應用 playedMove 的灰而非 threat：`move-annotation-display.vue` 的 ROLE_COLORS 裡
  // threat 與 keySquare 是同一個琥珀色，兩支同色的箭頭疊在同一盤上分不出哪支是自己走的。
  // 這裡取的是「灰＝次要、不是焦點」的視覺角色，焦點留給你自己那一手。
  if (reply) annotations.push({ kind: 'arrow', role: 'playedMove', from: reply.from, to: reply.to })
  return { fen: replyFen, annotations }
}
