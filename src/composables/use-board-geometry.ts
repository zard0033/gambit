import type { Ref } from 'vue'
import { squareToRect as computeSquareRect } from '../utils/board-geometry'
import type { Rect } from '../utils/board-geometry'

/**
 * ADR-0009 Decision §4: the sole source of square geometry for every board overlay
 * (annotations, arrows, check ring, castle hints, coordinate labels, keyboard focus cell).
 *
 * Board-local coordinates, orientation-corrected — measured against the ACTUAL chessground
 * board (cg-board), not the outer wrap. chessground rounds its board DOWN to a multiple of 8
 * and centres it inside the wrap, so cg-board can be a few px smaller / offset; computing from
 * the wrap width left every overlay a few px off the squares (全站標註/箭頭/提示對格偏移修正).
 * We read cg-board's real size + its offset within the wrap.
 *
 * The returned `squareToRect` is re-exposed unchanged by ChessBoard.vue (defineExpose) and
 * consumed by external overlays (move-annotation-display, dungeon/lesson/memory views); its
 * signature and semantics must not drift.
 */
export function useBoardGeometry(
  boardRef: Ref<HTMLElement | null>,
  getOrientation: () => 'white' | 'black',
): { squareToRect: (square: string) => Rect | null } {
  function squareToRect(square: string): Rect | null {
    const wrap = boardRef.value
    if (!wrap) return null
    const cgBoard = wrap.querySelector('cg-board') as HTMLElement | null
    if (!cgBoard) return computeSquareRect(square, wrap.offsetWidth, getOrientation())
    const wr = wrap.getBoundingClientRect()
    const br = cgBoard.getBoundingClientRect()
    const rect = computeSquareRect(square, br.width, getOrientation())
    if (!rect) return null
    return { x: rect.x + (br.left - wr.left), y: rect.y + (br.top - wr.top), width: rect.width, height: rect.height }
  }

  return { squareToRect }
}
