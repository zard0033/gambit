import { ref, onBeforeUnmount } from 'vue'
import { Chess } from 'chess.js'
import type { Move } from 'chess.js'
import type { BoardApi } from 'vue3-chessboard'
import type { Rect } from '../utils/board-geometry'
import type { MoveMadePayload } from './use-chess-board'
import { buildAnimationDoneAt } from './use-board-input'

/** Pawn → promoted-piece "transform" flourish duration (transform/opacity only; Gambit motion rule). */
const PROMOTION_MORPH_MS = 300

const pieceAssetUrl = (code: string): string => `${import.meta.env.BASE_URL}pieces/${code}.svg`

export interface PromotionMorph {
  rect: Rect
  isDark: boolean
  pawnSrc: string
  pieceSrc: string
}

/**
 * Custom promotion dialog + morph flourish. **Deferred Cleanup — a fallback for when
 * vue3-chessboard doesn't resolve the promotion itself; behavior must not change** (see
 * technical-preferences). `onMove` in the shell calls `isPromotionMove` → `beginPromotion`
 * to freeze the board and open the dialog; the dialog's select/cancel resolve it here.
 */
export function useBoardPromotion(deps: {
  getFen: () => string
  isDisabled: () => boolean
  prefersReducedMotion: import('vue').Ref<boolean | undefined>
  squareToRect: (square: string) => Rect | null
  // Pick<> — ref() 的 UnwrapRef 會剝掉 BoardApi 的 class 私有成員，完整型別對不上；只宣告實際用到的兩個方法
  getBoardApi: () => Pick<BoardApi, 'setConfig' | 'setPosition'> | null
  getBoardRef: () => HTMLElement | null
  onMoveMade: () => void
  emitMove: (payload: MoveMadePayload) => void
}): {
  pendingPromotion: import('vue').Ref<{ from: string; to: string } | null>
  promotionSquareRect: import('vue').Ref<Rect | null>
  promotionMorph: import('vue').Ref<PromotionMorph | null>
  isPromotionMove: (move: Move) => boolean
  beginPromotion: (move: Move) => void
  startPromotionMorph: (move: Move) => void
  handlePromotionSelect: (piece: 'q' | 'r' | 'b' | 'n') => void
  handlePromotionCancel: () => void
} {
  const pendingPromotion = ref<{ from: string; to: string } | null>(null)
  const promotionSquareRect = ref<Rect | null>(null)
  const promotionMorph = ref<PromotionMorph | null>(null)
  let morphTimer: number | null = null

  function isPromotionMove(move: Move): boolean {
    // vue3-chessboard handles promotions internally before emitting @move; by the time onMove
    // fires, move.promotion is already set. Only show our dialog if it wasn't already handled.
    return move.flags.includes('p') && !move.promotion
  }

  /** Freeze the board and open the promotion dialog on the destination square. */
  function beginPromotion(move: Move): void {
    deps.getBoardApi()?.setConfig({ viewOnly: true }, false)
    pendingPromotion.value = { from: move.from, to: move.to }
    promotionSquareRect.value = deps.squareToRect(move.to)
  }

  function startPromotionMorph(move: Move): void {
    if (deps.prefersReducedMotion.value) return
    const rect = deps.squareToRect(move.to)
    if (!rect) return
    const cc = move.color === 'w' ? 'w' : 'b'
    promotionMorph.value = {
      rect,
      isDark: move.color === 'b',
      pawnSrc: pieceAssetUrl(cc + 'P'),
      pieceSrc: pieceAssetUrl(cc + (move.promotion as string).toUpperCase()),
    }
    if (morphTimer) clearTimeout(morphTimer)
    morphTimer = window.setTimeout(() => { promotionMorph.value = null }, PROMOTION_MORPH_MS + 40)
  }

  function handlePromotionSelect(piece: 'q' | 'r' | 'b' | 'n'): void {
    const pending = pendingPromotion.value
    if (!pending) return

    // Compute correct FEN with user-chosen promotion piece
    const chess = new Chess(deps.getFen())
    chess.move({ from: pending.from, to: pending.to, promotion: piece })
    const fen = chess.fen()

    // Sync chessground with the corrected position
    deps.getBoardApi()?.setPosition(fen)

    const animationDoneAt = buildAnimationDoneAt(deps.getBoardRef())

    closePendingPromotion()
    deps.onMoveMade()
    deps.emitMove({ from: pending.from, to: pending.to, promotion: piece, fen, animationDoneAt })
  }

  function handlePromotionCancel(): void {
    // Snap pawn back by restoring pre-move position
    deps.getBoardApi()?.setPosition(deps.getFen())
    closePendingPromotion()
  }

  function closePendingPromotion(): void {
    pendingPromotion.value = null
    promotionSquareRect.value = null
    deps.getBoardApi()?.setConfig({ viewOnly: deps.isDisabled() }, false)
  }

  onBeforeUnmount(() => {
    if (morphTimer) clearTimeout(morphTimer)
  })

  return {
    pendingPromotion,
    promotionSquareRect,
    promotionMorph,
    isPromotionMove,
    beginPromotion,
    startPromotionMorph,
    handlePromotionSelect,
    handlePromotionCancel,
  }
}
