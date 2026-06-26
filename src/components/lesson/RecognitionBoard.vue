<script setup lang="ts">
/**
 * One board of the Recognition Gate carousel (quick-specs/concept-deepening-page.md §15). The
 * judgement field stays SILENT — no highlights, no arrows, no hint/reveal escape hatch — so the
 * player must recognise the tactic (or its absence) unaided. The board owns its own geometry
 * (board-fit + wooden tray, matching LessonPlayer) and the refutation demo; the parent gate owns
 * the carousel, Neve's bubble, and the verdict state machine.
 *
 * Judge results emitted to the parent (parent reads board.kind to pick Neve's words):
 *   real  + 'correct' = played the fork    | real  + 'missed' = pressed「這裡沒有」(missed it)
 *   decoy + 'correct' = pressed「這裡沒有」 | decoy + 'trap'   = played the tempting move
 *
 * Demo (§15.5): playing/declaring a decoy plays the refutation [temptMove, refutation] by stepping
 * the `:fen` prop — chessground animates the single piece each step. Pure visual: no move-made emit,
 * no chess.js advance. The board freezes (viewOnly) during the demo, then snaps back to its FEN.
 */
import { ref, computed } from 'vue'
import { Chess } from 'chess.js'
import ChessBoard from '@/components/chess-board.vue'
import { useBoardFit } from '@/composables/use-board-fit'
import { useReducedMotion } from '@/composables/use-reduced-motion'
import type { RecognitionBoard } from '@/types/recognition'
import type { MoveMadePayload } from '@/composables/use-chess-board'

const props = withDefaults(
  defineProps<{
    board: RecognitionBoard
    playerColor?: 'white' | 'black'
    /** This is the carousel's current board — only the active board accepts input. */
    active: boolean
    /** Verdict已定為 correct → board frozen (no re-judging a solved board). */
    locked: boolean
  }>(),
  { playerColor: 'white' },
)

const emit = defineEmits<{ judge: [result: 'correct' | 'missed' | 'trap'] }>()

const { prefersReducedMotion } = useReducedMotion()

// `:fen` the chess-board renders. Mutable only for the refutation demo, then snapped back.
const displayFen = ref(props.board.fen)
const lastMove = ref<readonly [string, string] | null>(null)
// True during the demo — freezes the board so the player can't interrupt the animation.
const demoing = ref(false)

const boardFit = ref<HTMLElement | null>(null)
useBoardFit(boardFit)
const boardCmp = ref<{ resetPosition: () => void } | null>(null)

// Disabled unless this is the active, unsolved board and no demo is running.
const disabled = computed(() => !props.active || props.locked || demoing.value)

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Play the decoy's refutation on the board (§15.5). Steps `:fen` through [temptMove, refutation];
 * chessground animates the single changed piece each step. After a 'trap' the player already moved
 * the temptMove, so the first step is a no-op visually (board already there) and only gxf6 animates.
 */
async function playRefutation(): Promise<void> {
  if (props.board.kind !== 'decoy') return
  demoing.value = true
  const chess = new Chess(props.board.fen)
  // Under reduced-motion (220ms) stepMs is below chess-board's internal move-anim timer (~316ms),
  // so a refutation FEN set mid-animation is queued and lands on that flush, not at 220ms — the
  // renderer's latest-wins queue self-heals, the two-step demo still reads correctly.
  const stepMs = prefersReducedMotion.value ? 220 : 850
  for (const mv of [props.board.temptMove, props.board.refutation]) {
    chess.move({ from: mv.from, to: mv.to })
    displayFen.value = chess.fen()
    lastMove.value = [mv.from, mv.to]
    await delay(stepMs)
  }
  // Snap back to the original position so the board reads as "judged", not mid-line.
  displayFen.value = props.board.fen
  lastMove.value = null
  demoing.value = false
}

function onMove(payload: MoveMadePayload): void {
  if (disabled.value) return
  const b = props.board
  if (b.kind === 'real') {
    if (payload.from === b.expectedMove.from && payload.to === b.expectedMove.to) {
      emit('judge', 'correct')
    } else {
      boardCmp.value?.resetPosition() // wrong piece → slide home (silent, no penalty UI)
    }
  } else {
    if (payload.from === b.temptMove.from && payload.to === b.temptMove.to) {
      emit('judge', 'trap')
      void playRefutation()
    } else {
      boardCmp.value?.resetPosition()
    }
  }
}

/** Called by the gate's「這裡沒有」button (it lives in Neve's bubble) for the active board. */
function declareEmpty(): void {
  if (disabled.value) return
  if (props.board.kind === 'decoy') {
    emit('judge', 'correct')
    void playRefutation()
  } else {
    emit('judge', 'missed') // a real board declared empty — recorded, surfaced later, never named
  }
}

defineExpose({ declareEmpty })
</script>

<template>
  <div class="w-full shrink-0 px-4">
    <!-- wooden tray：與課程／試煉／對局同款木盤。「這裡沒有」鈕在 Neve 對話框（父元件），棋盤保持乾淨。 -->
    <div class="w-full rounded-[12px] bg-[linear-gradient(160deg,#6f4b30,#523722)] p-3 ring-1 ring-black/30 shadow-[0_12px_32px_rgba(10,30,24,0.45),inset_0_1px_0_rgba(255,228,194,0.20),inset_0_-2px_6px_rgba(0,0,0,0.38)]">
      <div ref="boardFit" class="relative board-fit">
        <ChessBoard
          ref="boardCmp"
          :fen="displayFen"
          :player-color="playerColor"
          :disabled="disabled"
          :coordinates="true"
          :last-move="lastMove"
          @move-made="onMove"
        />
      </div>
    </div>
  </div>
</template>
