<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Chess } from 'chess.js'
import { ArrowLeft, Lightbulb, Check, X, BookOpen } from 'lucide-vue-next'
import ChessBoard from '@/components/chess-board.vue'
import MoveAnnotationDisplay from '@/components/move-annotation-display.vue'
import { getPuzzleById } from '@/data/puzzles'
import { reviewLinkForMotif } from '@/data/concepts'
import { MOTIF_TO_CONCEPT } from '@/types/concept'
import { useConceptProgressStore } from '@/stores/concept-progress'
import { usePuzzle } from '@/modules/practice/use-puzzle'
import { useReducedMotion } from '@/composables/use-reduced-motion'
import { useBoardFit } from '@/composables/use-board-fit'
import {
  OPPONENT_REPLY_DELAY_MS,
  WRONG_TINT_DURATION_MS,
  HINT_ARROW_ON_SECOND_PRESS,
} from '@/config/practice-tuning'
import type { MoveMadePayload } from '@/composables/use-chess-board'
import type { Annotation } from '@/modules/move-annotation/annotation-types'
import type { Rect } from '@/utils/board-geometry'

const route = useRoute()
const router = useRouter()
const conceptProgress = useConceptProgressStore()
const { prefersReducedMotion } = useReducedMotion()

const puzzle = getPuzzleById(route.params.puzzleId as string)

// 練習模式是唯一模式（2026-08-05，定位 v2 的 D2 砍掉試煉外殼後）：沒有鎖、沒有線性進度、
// 沒有雲端表；解出來只記進 concept-progress 的 practiceSolved。入口是棋憶回放的概念路標。
// Guard: 認不得的題目 → 回課程。
if (!puzzle) router.replace('/learn')

// Track last correct move's destination for the board checkmark badge.
const lastCorrectSquare = ref<string | null>(null)

const playerColor = computed<'white' | 'black'>(() =>
  puzzle && new Chess(puzzle.fen).turn() === 'b' ? 'black' : 'white',
)

const pz = puzzle ? usePuzzle(puzzle) : null

// Wrong-move + hint UI state.
const wrongActive = ref(false)
const hintStage = ref<0 | 1 | 2>(0)

const boardDisabled = computed(
  () => !pz || pz.phase.value === 'solved' || pz.awaitingOpponent.value || wrongActive.value,
)
const boardKey = computed(() => puzzle?.id ?? '')

// ── board geometry plumbing (for the hint arrow), mirrors LessonView ──
const board = ref<{ boardRef: HTMLElement | null; squareToRect: (s: string) => Rect | null; resetPosition: () => void } | null>(null)
const boardFit = ref<HTMLElement | null>(null)
useBoardFit(boardFit)
const geomTick = ref(0)
const boardEl = computed<HTMLElement | null>(() => {
  void geomTick.value
  return board.value?.boardRef ?? null
})
const boardSizePx = computed(() => {
  void geomTick.value
  return boardEl.value?.offsetWidth ?? 0
})
function squareToRect(square: string): Rect | null {
  void geomTick.value
  return board.value?.squareToRect?.(square) ?? null
}
onMounted(async () => { await nextTick(); geomTick.value++ })
watch(boardKey, async () => { await nextTick(); geomTick.value++ })

function cornerBadge(square: string | null) {
  void geomTick.value
  if (!square) return null
  const r = squareToRect(square)
  if (!r) return null
  const size = Math.max(18, r.width * 0.42)
  return { left: r.x + r.width - size / 2, top: r.y - size / 2, size }
}
const correctBadge = computed(() =>
  pz && pz.phase.value === 'solved' ? cornerBadge(lastCorrectSquare.value) : null,
)

// Hint arrow (stage-2 reveal) drawn over the board.
const annotations = computed<Annotation[]>(() => {
  if (!pz || hintStage.value < 2 || !pz.hintArrow.value) return []
  const a = pz.hintArrow.value
  return [{ kind: 'arrow', role: 'bestMove', from: a.orig, to: a.dest }]
})

const positionLabel = computed(() => {
  if (!puzzle || !pz) return ''
  const move = Math.floor(pz.plyIndex.value / 2) + 1
  return puzzle.solution.length > 1 ? `第 ${move} 步` : ''
})

// Turn indicator (lichess/chess.com style): tells the player which side they move, so a bare
// prompt like「有子可吃」isn't ambiguous about who acts. Derived from the FEN — no data change.
const turnLabel = computed(() => (playerColor.value === 'white' ? '白方' : '黑方'))

const hintLabel = computed(() =>
  hintStage.value === 0 ? '提示' : hintStage.value === 1 ? '看答案箭頭' : '已給提示',
)

// 棋譜紀錄框：累積每次嘗試的白話對錯（Cubic 11 呈現）。第一次互動才出現。
const PIECE_ZH: Record<string, string> = { p: '兵', n: '騎士', b: '主教', r: '城堡', q: '后', k: '國王' }
// Single most-recent attempt result (replaces, never accumulates) — shown top-right of the card so
// repeated wrong tries don't grow a list that pushes the footer CTA under the mobile URL bar.
const lastResult = ref<{ ok: boolean; text: string } | null>(null)
function describeMove(piece: string, captured?: string): string {
  const p = PIECE_ZH[piece] ?? '棋子'
  return captured ? `${p}吃掉${PIECE_ZH[captured] ?? '一子'}` : `${p}就位`
}

// Deferred move timers — cleared on unmount so a fast 返回/下一題 (RouteView remount) can't fire a
// reset or opponent reply into a discarded puzzle instance.
let wrongTimer: ReturnType<typeof setTimeout> | undefined
let replyTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => {
  clearTimeout(wrongTimer)
  clearTimeout(replyTimer)
})

function handleMove(payload: MoveMadePayload): void {
  if (!pz) return
  const result = pz.submitMove({ from: payload.from, to: payload.to, promotion: payload.promotion })

  if (result.kind === 'wrong') {
    wrongActive.value = true
    lastResult.value = { ok: false, text: '不是這步' }
    // Snap the wrong piece home AFTER the move animation settles — doing it immediately lets
    // chessground's in-flight animation overwrite the reset (the piece stayed put). 600ms 後還原。
    wrongTimer = setTimeout(() => {
      board.value?.resetPosition()
      wrongActive.value = false
      pz.wrong.value = false
    }, prefersReducedMotion.value ? 0 : WRONG_TINT_DURATION_MS)
    return
  }

  if (result.kind === 'correct-advance') {
    lastResult.value = { ok: true, text: describeMove(result.piece, result.captured) }
    lastCorrectSquare.value = payload.to
    hintStage.value = 0
    replyTimer = setTimeout(() => pz.commitOpponentReply(), prefersReducedMotion.value ? 0 : OPPONENT_REPLY_DELAY_MS)
    return
  }

  // correct-solved — 只記進 concept-progress。
  lastResult.value = { ok: true, text: describeMove(result.piece, result.captured) }
  lastCorrectSquare.value = payload.to
  if (puzzle) conceptProgress.markPracticed(puzzle.id)
}

function showHint(): void {
  if (!pz) return
  if (hintStage.value === 0) {
    hintStage.value = 1
  } else if (hintStage.value === 1 && HINT_ARROW_ON_SECOND_PRESS) {
    hintStage.value = 2
  }
}

// Bridge 2 (Learning Loop #20, GDD §3.3): a calm, ALWAYS-visible back-link to the lesson that
// teaches this puzzle's concept — never tied to wrong-attempt count (no implicit failure counter).
const reviewLink = computed(() => (puzzle ? reviewLinkForMotif(puzzle.motif) : null))

function reviewConcept(): void {
  // One concept maps to many puzzles, so 複習 points at the concept hub (the map), not a single
  // lesson — the map highlights this concept and routes onward to its lesson (concept 1 : puzzle N).
  if (puzzle) router.push(`/learn/concepts?focus=${MOTIF_TO_CONCEPT[puzzle.motif]}`)
}

// 練習是從課程／棋憶岔出來的一趟，解完就回去，不接「下一題」的線性流。
function goBack(): void {
  router.push('/learn')
}
</script>

<template>
  <div v-if="puzzle && pz" class="min-h-dvh bg-surface-dungeon pb-[calc(2rem+env(safe-area-inset-bottom))] lg:pb-8">
    <!-- Top bar: back + calm progress (進度淡化，不搶戲) -->
    <div class="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <button
        type="button"
        class="flex min-h-[44px] items-center gap-1 px-1 font-sans text-xs font-semibold text-gold/70 active:scale-95"
        @click="goBack"
      >
        <ArrowLeft :size="16" :stroke-width="1.8" /> 課程
      </button>
    </div>

    <!-- 銘牌：道場匾額 + 細金分隔線。原本寫「第 N 關」，D2 砍掉關卡地圖後那個編號不再指向任何東西，
         改以題目自己的標題當標題。 -->
    <div class="px-6 pb-3 pt-1 text-center">
      <h1 class="font-display text-[22px] font-bold tracking-[0.06em] text-ink-on-deep" tabindex="-1">
        {{ puzzle.title }}
      </h1>
      <div class="mx-auto mt-2.5 h-px w-12 bg-[linear-gradient(90deg,transparent,#F8B500,transparent)] opacity-60" />
    </div>

    <!-- Board in a wooden tray (複用對局木盤語彙)，放寬填滿畫面。木框／尺寸在外層；內層 `relative`
         緊貼棋盤，讓提示箭頭疊層對齊（padding 在 positioned 祖先會整排偏移）。 -->
    <div class="mx-auto w-full max-w-[min(96vw,30rem)]">
      <div class="rounded-[12px] bg-[linear-gradient(160deg,#6f4b30,#523722)] p-3 ring-1 ring-black/30 shadow-[0_12px_32px_rgba(10,30,24,0.45),inset_0_1px_0_rgba(255,228,194,0.20),inset_0_-2px_6px_rgba(0,0,0,0.38)]">
        <div ref="boardFit" class="relative board-fit">
          <ChessBoard
            :key="boardKey"
            ref="board"
            :fen="pz.fen.value"
            :player-color="playerColor"
            :disabled="boardDisabled"
            :coordinates="true"
            @move-made="handleMove"
          />
          <MoveAnnotationDisplay
            v-if="boardEl"
            :key="`anno-${boardKey}`"
            :annotations="annotations"
            :evaluation="null"
            :square-to-rect="squareToRect"
            :board-ref="boardEl"
            :board-size-px="boardSizePx"
            :shaft-scale="0.5"
          />
          <!-- 正解角標：完成後在目標格顯示勾勾 -->
          <div
            v-if="correctBadge"
            class="pointer-events-none absolute z-10 flex items-center justify-center rounded-full bg-success text-success-fg shadow-button"
            :style="{ left: `${correctBadge.left}px`, top: `${correctBadge.top}px`, width: `${correctBadge.size}px`, height: `${correctBadge.size}px` }"
            aria-hidden="true"
          ><Check :size="correctBadge.size * 0.62" :stroke-width="3" /></div>
        </div>
      </div>
    </div>

    <!-- 石碑題卡：解題態＝turn＋目標＋提示／複習；達成態＝inline（成就＋successText＋回地圖／下一題，
         取代彈窗，單步多步皆同）。棋譜紀錄框累積每次嘗試的白話對錯，兩態共用。 -->
    <div class="mx-auto max-w-[420px] px-4 pt-4">
      <div class="puzzle-result-panel rounded-[14px] border border-gold/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35)]">

        <!-- ===== 達成態（inline，正解後對手不再動）===== -->
        <template v-if="pz.phase.value === 'solved'">
          <div class="mb-2 flex items-center gap-2">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold bg-gold/15" aria-hidden="true">
              <Check :size="14" :stroke-width="3" class="text-gold" />
            </span>
            <b class="font-display text-base font-bold tracking-wider text-[#F5D070]">
              {{ hintStage > 0 ? '看了提示，完成' : '完成' }}
            </b>
          </div>
          <p class="font-lesson text-sm leading-relaxed text-ink-on-deep-dim">{{ puzzle.successText }}</p>
        </template>

        <!-- ===== 解題態 ===== -->
        <template v-else>
          <!-- Turn indicator — which side you move, plus position for multi-step puzzles -->
          <div class="mb-2 flex items-center gap-2 font-sans text-xs text-ink-on-deep-dim">
            <span
              class="h-3 w-3 shrink-0 rounded-full border"
              :class="playerColor === 'white' ? 'border-black/20 bg-[#fbfbf6]' : 'border-white/20 bg-[#2a2a2a]'"
              aria-hidden="true"
            />
            {{ turnLabel }} · <b class="font-bold text-ink-on-deep">輪你走</b>
            <span v-if="positionLabel">· {{ positionLabel }}</span>
            <!-- Last attempt result — single, replaced each move, pinned top-right so it never grows -->
            <span
              v-if="lastResult"
              class="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-num text-[11px]"
            >
              <component :is="lastResult.ok ? Check : X" :size="13" :stroke-width="3" :class="lastResult.ok ? 'text-[#7FCBA9]' : 'text-[#E8A892]'" />
              <span class="text-ink-on-deep-dim">{{ lastResult.text }}</span>
            </span>
          </div>

          <!-- Goal (prompt) — the headline; never leaks the solution -->
          <p class="font-display text-[19px] font-bold leading-snug text-ink-on-deep">{{ puzzle.prompt }}</p>

          <!-- Brief — one concrete sentence clarifying the goal; sits above the on-demand hint -->
          <p class="mt-1.5 font-lesson text-[13px] leading-relaxed text-ink-on-deep-dim">{{ puzzle.brief }}</p>

          <!-- Hint text (stage 1+) -->
          <div v-if="hintStage >= 1" class="mt-3 rounded-lg bg-gold/10 px-3 py-2 ring-1 ring-gold/20">
            <p class="font-lesson text-sm leading-relaxed text-ink-on-deep">{{ puzzle.hint }}</p>
            <p v-if="hintStage >= 2" class="mt-1 font-sans text-sm text-ink-on-deep-dim">答案箭頭已畫在棋盤上。</p>
          </div>
        </template>

        <!-- ===== Footer ===== -->
        <!-- 達成：單一「回課程」 -->
        <div v-if="pz.phase.value === 'solved'" class="mt-3.5 flex items-center gap-2 border-t border-white/8 pt-3">
          <button
            type="button"
            class="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full bg-linear-to-b from-gold-light to-gold px-5 font-sans text-sm font-bold text-gold-ink shadow-[0_2px_12px_rgba(248,181,0,0.4)] active:scale-95"
            @click="goBack"
          >
            <ArrowLeft :size="16" :stroke-width="1.8" /> 回課程
          </button>
        </div>

        <!-- 解題：提示（低調收進卡內）+ 概念複習連結 -->
        <div v-else class="mt-3.5 flex items-center justify-between border-t border-white/8 pt-3">
          <button
            type="button"
            class="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-gold/25 bg-gold/8 px-3.5 font-sans text-[13px] font-semibold text-[#F5D070] active:scale-[0.98]"
            @click="showHint"
          >
            <Lightbulb :size="15" :stroke-width="1.8" /> {{ hintLabel }}
          </button>

          <!-- Bridge 2: calm back-link to the concept's lesson (Learning Loop #20) -->
          <button
            v-if="reviewLink"
            type="button"
            data-testid="concept-review-link"
            class="inline-flex min-h-[44px] items-center gap-1.5 font-sans text-[12.5px] font-medium text-ink-on-deep-dim/80 active:scale-[0.98]"
            @click="reviewConcept"
          >
            <BookOpen :size="15" :stroke-width="1.8" /> 複習「{{ reviewLink.label }}」
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
