<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { TheChessboard } from 'vue3-chessboard'
import type { BoardApi, BoardConfig } from 'vue3-chessboard'
import type { Key, Elements } from 'chessground/types'
import type { Move } from 'chess.js'
import type { MoveMadePayload } from '../composables/use-chess-board'
import { validateFen, useBoardRenderer, PIECE_MOVE_ANIM_MS } from '../composables/use-board-renderer'
import { BOARD_BRUSHES, buildLegalMoveShapes, buildAnimationDoneAt } from '../composables/use-board-input'
import PromotionDialog from './promotion-dialog.vue'
import { useReducedMotion } from '../composables/use-reduced-motion'
import { useBoardKeyboard } from '../composables/use-board-keyboard'
import { useBoardGeometry } from '../composables/use-board-geometry'
import { useBoardCheckRing } from '../composables/use-board-check-ring'
import { useBoardCastleHints } from '../composables/use-board-castle-hints'
import { useBoardPromotion } from '../composables/use-board-promotion'
import { useBoardCoordinates } from '../composables/use-board-coordinates'

const props = defineProps<{
  fen: string
  playerColor: 'white' | 'black'
  disabled: boolean
  /** Show a–h / 1–8 coordinate labels around the board (default false). Native chessground coords — CSS-positioned, fully responsive. */
  coordinates?: boolean
  /**
   * Last move squares [from, to] for the last-move highlight. The board highlights the player's own
   * drag natively; the opponent's move arrives via setPosition(fen), which leaves the highlight on the
   * player's prior move — so the parent drives it here. `null` clears it; `undefined` (prop omitted)
   * leaves chessground's native behavior untouched (Review/Replay don't pass it).
   */
  lastMove?: readonly [string, string] | null
}>()

const emit = defineEmits<{
  'move-made': [payload: MoveMadePayload]
}>()

const boardApi = ref<BoardApi | null>(null)
// ADR-0009 Decision §1: boardRef captured via boardConfig.events.insert, not template ref
const boardRef = ref<HTMLElement | null>(null)

const { prefersReducedMotion } = useReducedMotion()

const { syncFen, onMoveMade } = useBoardRenderer(() => boardApi.value)

// squareToRect is the sole geometry source for every overlay (check ring, castle hints, coordinate
// labels, keyboard focus cell) AND is re-exposed unchanged to external consumers (ADR-0009 §4).
const { squareToRect } = useBoardGeometry(boardRef, () => props.playerColor)

// Check ring: king-in-check square (drives the sr-only "將軍" region) + its overlay rect.
const { kingInCheckSquare, checkRingRect } = useBoardCheckRing({
  getFen: () => props.fen,
  isReady: () => boardApi.value !== null,
  squareToRect,
})

// Castling hints — owns the chessground selection square (set by events.select below).
const { selectedSquare, castleHints, triggerCastle } = useBoardCastleHints({
  getFen: () => props.fen,
  isDisabled: () => props.disabled,
  squareToRect,
  requestMove: (from, to) => { boardApi.value?.move({ from: from as Key, to: to as Key }) },
})

// Promotion dialog + morph flourish (Deferred Cleanup fallback — behavior must not change).
const {
  pendingPromotion,
  promotionSquareRect,
  promotionMorph,
  isPromotionMove,
  beginPromotion,
  startPromotionMorph,
  handlePromotionSelect,
  handlePromotionCancel,
} = useBoardPromotion({
  getFen: () => props.fen,
  isDisabled: () => props.disabled,
  prefersReducedMotion,
  squareToRect,
  getBoardApi: () => boardApi.value,
  getBoardRef: () => boardRef.value,
  onMoveMade,
  emitMove: (payload) => emit('move-made', payload),
})

// Coordinate labels on the wooden frame (replaces chessground's in-square coords).
const { rankLabels, fileLabels } = useBoardCoordinates({
  boardRef,
  getShowCoordinates: () => props.coordinates ?? false,
  squareToRect,
})

function clearSelectionShapes(): void {
  boardApi.value?.setConfig({ drawable: { shapes: [], brushes: BOARD_BRUSHES } }, false)
}

// Non-reactive; subsequent changes handled imperatively via boardApi
const boardConfig: BoardConfig = {
  fen: validateFen(props.fen),
  orientation: props.playerColor,
  // chessground's own coords overlay-print inside edge squares and clash with pieces on them. We
  // render coordinates ourselves on the wooden frame instead (see rankLabels / fileLabels).
  coordinates: false,
  // Always create interactive: chessground binds its pointer (mousedown/touchstart) listeners ONLY
  // when created non-viewOnly, and never rebinds when viewOnly is later toggled off (vendor source).
  // A board created viewOnly (e.g. an off-screen carousel board) would otherwise be permanently
  // unmovable even after becoming active. onBoardCreated applies the real viewOnly immediately.
  viewOnly: false,
  animation: { duration: PIECE_MOVE_ANIM_MS },
  // Native chessground dests: filled dots on quiet moves, rings on captures (chess.com style).
  movable: { free: false, color: props.playerColor, showDests: true },
  drawable: { enabled: true, eraseOnClick: false, brushes: BOARD_BRUSHES },
  highlight: { lastMove: true, check: true },
  events: {
    insert: (elements: Elements) => { boardRef.value = elements.wrap },
    select: (key: Key) => { selectedSquare.value = key },
  },
}

function onBoardCreated(api: BoardApi): void {
  boardApi.value = api
  // Board is created viewOnly:false (so listeners bind); apply the real disabled state now.
  if (props.disabled) api.setConfig({ viewOnly: true }, false)
}

function onMove(move: Move): void {
  selectedSquare.value = null
  clearSelectionShapes()
  if (isPromotionMove(move)) {
    // Freeze board and show dialog — don't emit yet
    beginPromotion(move)
    return
  }
  if (move.promotion) startPromotionMorph(move)
  onMoveMade()
  const fen = boardApi.value?.getFen() ?? ''
  emit('move-made', {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    fen,
    animationDoneAt: buildAnimationDoneAt(boardRef.value),
  })
}

watch(
  () => props.fen,
  (newFen) => { syncFen(newFen) },
)

watch(
  () => props.playerColor,
  (color) => { boardApi.value?.setConfig({ orientation: color }, false) },
)

watch(
  () => props.disabled,
  (disabled) => {
    if (!pendingPromotion.value) {
      boardApi.value?.setConfig({ viewOnly: disabled }, false)
    }
    if (disabled) selectedSquare.value = null
  },
)

// Drive the last-move highlight for moves the board didn't make itself (the opponent's reply, applied
// via setPosition which doesn't touch the highlight). `undefined` = parent opts out (Review/Replay).
watch(
  () => props.lastMove,
  (lm) => {
    if (lm === undefined) return
    boardApi.value?.setConfig({ lastMove: lm ? ([lm[0], lm[1]] as [Key, Key]) : undefined }, false)
  },
)

// Apply prefers-reduced-motion: collapse animation duration to 0
watch(
  prefersReducedMotion,
  (reduced) => {
    boardApi.value?.setConfig({
      animation: { duration: reduced ? 0 : PIECE_MOVE_ANIM_MS },
    }, false)
  },
)

/**
 * Snap the board back to the current `fen` prop (undo a rejected move). MUST be called AFTER the
 * player's move animation has settled — calling it mid-animation lets chessground's in-flight
 * animation overwrite it (the wrong piece stays put, which read as "no snap-back"). The dungeon
 * view delays this until WRONG_TINT_DURATION_MS so the snap lands cleanly; the lesson retry button
 * is a user click long after the move animation, so it's already safe.
 */
function resetPosition(): void {
  boardApi.value?.setPosition(props.fen)
  // A rejected move leaves chessground's native last-move tint on the wrong squares; setPosition
  // doesn't clear it, so drop it explicitly (走錯滑回後殘留綠格修正，與 reapplyFen 同).
  boardApi.value?.setConfig({ lastMove: undefined }, false)
}

/**
 * Force the board to the current `fen` prop even when the FEN string is unchanged — used when
 * the lesson steps between two positions that share the same FEN (Vue's `watch(props.fen)` won't
 * fire on an identical string, so the board would otherwise keep the player's last move on screen).
 */
function reapplyFen(): void {
  boardApi.value?.setPosition(props.fen)
  // Stepping to another lesson position must drop the player's prior-move green highlight —
  // setPosition keeps chessground's native lastMove, so clear it explicitly (上一步/下一步殘留綠格修正).
  boardApi.value?.setConfig({ lastMove: undefined }, false)
}

// ---- Keyboard navigation (ADR-0009, S4-09) ----

const keyboardAnnouncement = ref('')

const keyboard = useBoardKeyboard({
  getFen: () => props.fen,
  getOrientation: () => props.playerColor,
  getPlayerColor: () => props.playerColor,
  onMoveAttempt: (from, to) => {
    if (props.disabled) return
    boardApi.value?.move({ from: from as Key, to: to as Key })
  },
  onPieceSelected: (square, _legalDests) => {
    boardApi.value?.setConfig({
      drawable: { shapes: buildLegalMoveShapes(square as Key, props.fen), brushes: BOARD_BRUSHES },
    }, false)
  },
  onSelectionCleared: () => {
    clearSelectionShapes()
  },
  announce: (text) => { keyboardAnnouncement.value = text },
})

const focusCellRect = computed(() => squareToRect(keyboard.currentSquare.value))

// ARIA grid position of the single roving focus cell (1-based; orientation-aware, matching the
// board-geometry col/row convention). Feeds aria-rowindex / aria-colindex so assistive tech knows
// where this one cell sits within the declared 8×8 grid.
const focusCellRow = computed(() => {
  const rank = parseInt(keyboard.currentSquare.value[1], 10)
  return props.playerColor === 'white' ? 9 - rank : rank
})
const focusCellCol = computed(() => {
  const file = keyboard.currentSquare.value.charCodeAt(0) - 96
  return props.playerColor === 'white' ? file : 9 - file
})

defineExpose({ boardRef, squareToRect, resetPosition, reapplyFen })
</script>

<template>
  <div data-testid="chess-board-root" class="relative min-w-0 sm:min-w-[352px]">
    <TheChessboard
      :boardConfig="boardConfig"
      @boardCreated="onBoardCreated"
      @move="onMove"
    />

    <!-- Check indicator: glow + border ring on the king square in check (story-006-visual-feedback.md AC-2) -->
    <svg
      v-if="checkRingRect"
      class="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
      aria-hidden="true"
    >
      <!-- Glow (opacity pulse — reduced-motion: skip animation, keep residual opacity) -->
      <rect
        :x="checkRingRect.x + 1"
        :y="checkRingRect.y + 1"
        :width="checkRingRect.width - 2"
        :height="checkRingRect.height - 2"
        rx="2"
        fill="var(--color-danger)"
        fill-opacity="0.4"
        :class="prefersReducedMotion ? '' : 'check-glow-pulse'"
      />
      <!-- Border ring (always visible when in check, regardless of reduced-motion) -->
      <rect
        :x="checkRingRect.x + 1"
        :y="checkRingRect.y + 1"
        :width="checkRingRect.width - 2"
        :height="checkRingRect.height - 2"
        rx="2"
        fill="none"
        stroke="var(--color-danger)"
        stroke-width="3"
      />
    </svg>

    <!-- Check is a persistent state → polite, so it doesn't clobber the keyboard move announcements. -->
    <span
      class="sr-only"
      aria-live="polite"
      aria-atomic="true"
    >{{ kingInCheckSquare ? '將軍' : '' }}</span>
    <!-- Keyboard move announcements are one-shot actions → their own assertive region. -->
    <span
      class="sr-only"
      aria-live="assertive"
      aria-atomic="true"
    >{{ keyboardAnnouncement }}</span>

    <!-- Promotion dialog — shown only when a pawn reaches the back rank -->
    <PromotionDialog
      v-if="pendingPromotion && promotionSquareRect"
      :playerColor="playerColor"
      :squareRect="promotionSquareRect"
      @select="handlePromotionSelect"
      @cancel="handlePromotionCancel"
    />

    <!-- Pawn → promoted-piece transform flourish on the promotion square (transform/opacity only).
         Overlaid above the board so it masks chessground's instant piece swap underneath. -->
    <div
      v-if="promotionMorph"
      class="promotion-morph"
      :style="{
        left: `${promotionMorph.rect.x}px`,
        top: `${promotionMorph.rect.y}px`,
        width: `${promotionMorph.rect.width}px`,
        height: `${promotionMorph.rect.height}px`,
        filter: promotionMorph.isDark ? 'brightness(var(--piece-dark-brightness))' : undefined,
      }"
      aria-hidden="true"
    >
      <img :src="promotionMorph.pawnSrc" class="promotion-morph-img promotion-morph-pawn" alt="" />
      <img :src="promotionMorph.pieceSrc" class="promotion-morph-img promotion-morph-piece" alt="" />
    </div>

    <!-- Castling hints (chess.com style): a tappable dot on the rook square while the king is selected.
         Mirrors chessground's native dest-dot look so both castling targets read identically. -->
    <button
      v-for="h in castleHints"
      :key="h.rookSquare"
      type="button"
      class="castle-hint absolute z-20 cursor-pointer border-0 bg-transparent p-0"
      :style="{ left: `${h.rect.x}px`, top: `${h.rect.y}px`, width: `${h.rect.width}px`, height: `${h.rect.height}px` }"
      aria-label="王城堡易位"
      @click="triggerCastle(h.kingDest)"
    />

    <!-- Coordinate labels on the wooden frame (ranks down the left gutter, files along the bottom).
         Positioned just outside the board so they never sit on a piece; the views' tray padding
         reserves the wood band they land in. font-num = Cubic 11, recessive warm tone on dark wood. -->
    <template v-if="coordinates">
      <span
        v-for="r in rankLabels"
        :key="`rank-${r.label}`"
        class="cb-coord cb-coord-rank font-num"
        :style="{ top: `${r.y}px` }"
        aria-hidden="true"
      >{{ r.label }}</span>
      <span
        v-for="f in fileLabels"
        :key="`file-${f.label}`"
        class="cb-coord cb-coord-file font-num"
        :style="{ left: `${f.x}px`, top: `${f.y}px` }"
        aria-hidden="true"
      >{{ f.label }}</span>
    </template>

    <!-- Keyboard-navigable virtual grid (ADR-0009, S4-09): a transparent overlay carrying the grid
         semantics so it holds ONLY the row → gridcell the grid role requires. The board and every
         decorative overlay (check ring, live regions, promotion, castle hints, coordinates) stay
         OUTSIDE the grid, so none of them count as disallowed grid children (WCAG
         aria-required-children). inset-0 over the .relative root keeps the cell's board-local
         coordinates valid; pointer-events-none lets piece drags pass through to chessground. -->
    <div
      class="absolute inset-0 pointer-events-none"
      role="grid"
      aria-label="西洋棋棋盤"
      aria-rowcount="8"
      aria-colcount="8"
      tabindex="-1"
    >
      <div role="row" :aria-rowindex="focusCellRow">
        <div
          class="absolute opacity-0 pointer-events-none focus:outline-2 focus:outline-blue-500"
          role="gridcell"
          :aria-colindex="focusCellCol"
          :tabindex="props.disabled ? -1 : 0"
          :aria-label="keyboard.currentSquareLabel.value"
          :style="focusCellRect
            ? { left: `${focusCellRect.x}px`, top: `${focusCellRect.y}px`, width: `${focusCellRect.width}px`, height: `${focusCellRect.height}px` }
            : { display: 'none' }"
          @keydown="keyboard.handleKeydown($event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Check glow: opacity pulse then fade to residual. Uses opacity only (no layout/paint). */
@keyframes check-glow-pulse {
  0%   { opacity: 0.4; }
  30%  { opacity: 0.7; }
  100% { opacity: 0.2; }
}

.check-glow-pulse {
  animation: check-glow-pulse 800ms ease-out forwards;
}

/* Coordinate labels on the wooden frame. Warm parchment tone, recessive (low opacity) so it reads as
   an engraved marking — legible on the dark wood but never competing with the board or pieces. */
.cb-coord {
  position: absolute;
  z-index: 5;
  font-size: 11px;
  line-height: 1;
  color: rgba(233, 217, 186, 0.6);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.28);
  pointer-events: none;
  user-select: none;
}
.cb-coord-rank {
  left: -6px;
  transform: translate(-50%, -50%);
}
.cb-coord-file {
  transform: translate(-50%, -50%);
}

/* Castling hint dot on the (occupied) rook square — matches chessground's occupied-dest ring
   (cg-board square.oc.move-dest) so it reads identically to a native capture/occupied target. */
.castle-hint {
  background: radial-gradient(transparent 0%, transparent 80%, rgba(20, 85, 0, 0.3) 80%);
}
.castle-hint:hover {
  background: radial-gradient(transparent 0%, transparent 79%, rgba(20, 85, 0, 0.45) 79%);
}

/* Last-move highlight contrast via chessground's .cg-last-dests class.
   Chessground natively renders last-move tint via .cg-last-dests — no override needed. */

/* Promotion morph: pawn fades/shrinks out while the chosen piece scales up + fades in.
   transform/opacity only (no layout/paint), 300ms to land as chessground reveals the real piece. */
.promotion-morph {
  position: absolute;
  z-index: 9;
  pointer-events: none;
}
.promotion-morph-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform-origin: center;
}
@keyframes promo-pawn-out {
  0%   { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.62); }
}
@keyframes promo-piece-in {
  0%   { opacity: 0; transform: scale(0.55); }
  55%  { opacity: 1; }
  100% { opacity: 1; transform: scale(1); }
}
.promotion-morph-pawn  { animation: promo-pawn-out 300ms cubic-bezier(0.4, 0, 0.6, 1) forwards; }
.promotion-morph-piece { animation: promo-piece-in 300ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards; }
@media (prefers-reduced-motion: reduce) {
  .promotion-morph { display: none; }
}

/* forced-colors fallback: check ring uses CanvasText; dots/rings use system Highlight */
@media (forced-colors: active) {
  .check-glow-pulse {
    fill: Highlight;
    opacity: 1;
  }
}
</style>
