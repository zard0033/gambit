/**
 * 棋憶 (Memory, #22) — slideshow choreography (story-008, GDD Rule 16). Pure: given a moment's
 * pre-move FEN + the played/better/reply moves, it produces the static END-STATE (the reduced-motion
 * target and the skip-to-end target — AC-9 / EC-5) and the animation FRAME sequence.
 *
 * The reduced-motion end-state must lose NO information: a mistake shows BOTH the played-to and the
 * better-to squares highlighted simultaneously; a good move shows played → provoked reply.
 */

import { Chess } from 'chess.js'
import type { Annotation } from '@/modules/move-annotation/annotation-types'

interface UciParts { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' }
function parseUci(uci: string): UciParts | null {
  if (!uci || uci.length < 4) return null
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined,
  }
}

/** FEN after applying a UCI move to `fen`, or null if illegal/malformed. */
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
  /** The better move; null/undefined on a good move (nothing better to show). */
  readonly bestUci?: string | null
  /** The opponent's provoked/forced reply to a good move; null when unknown. */
  readonly replyUci?: string | null
}

export interface MomentFrame {
  readonly fen: string
  readonly annotations: Annotation[]
}

/**
 * The static end-state (AC-9 / EC-5). A mistake holds both halves at once on the pre-move board
 * (played arrow + square in the muted role, better arrow + square in the gold keySquare role); a
 * good move shows the post-reply board with the played move (gold) and the reply (threat).
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

  // Good move: show the position after played + the provoked reply.
  const playedFen = applyUci(input.preMoveFen, input.playedUci) ?? input.preMoveFen
  const replyFen = input.replyUci ? applyUci(playedFen, input.replyUci) ?? playedFen : playedFen
  const reply = input.replyUci ? parseUci(input.replyUci) : null
  const annotations: Annotation[] = []
  if (played) annotations.push({ kind: 'arrow', role: 'keySquare', from: played.from, to: played.to })
  if (reply) annotations.push({ kind: 'arrow', role: 'threat', from: reply.from, to: reply.to })
  return { fen: replyFen, annotations }
}

export interface ChoreographyTimings {
  prePause: number
  moveDuration: number
  readPause: number
  backPause: number
}

/**
 * The animation frame sequence (motion path, GDD Rule 16). Each frame is held for `holdMs` then the
 * next applies. The LAST frame equals `momentEndState`, so skipping/finishing lands on the same
 * board the reduced-motion path shows.
 * - mistake: pre-move (pre-pause) → played (read) → pre-move again (back-pause) → end-state (both)
 * - good   : pre-move (pre-pause) → end-state (played → reply)
 */
export function momentFrames(
  input: ChoreographyInput,
  t: ChoreographyTimings,
): Array<MomentFrame & { holdMs: number }> {
  const end = momentEndState(input)
  const played = parseUci(input.playedUci)
  const isGood = !input.bestUci

  const frames: Array<MomentFrame & { holdMs: number }> = [
    { fen: input.preMoveFen, annotations: [], holdMs: t.prePause },
  ]

  if (!isGood && played) {
    const playedFen = applyUci(input.preMoveFen, input.playedUci) ?? input.preMoveFen
    frames.push({
      fen: playedFen,
      annotations: [{ kind: 'highlight', role: 'playedMove', square: played.to }],
      holdMs: t.readPause,
    })
    frames.push({ fen: input.preMoveFen, annotations: [], holdMs: t.backPause })
  }

  frames.push({ ...end, holdMs: 0 })
  return frames
}
