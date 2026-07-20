<script setup lang="ts">
/**
 * 棋憶 Moment Slideshow (story-008) — one moment at a time. Board re-plays the moment (GDD Rule 16
 * choreography), the move comparison + Neve explanation (MomentCard), a dot band, and nav (chevrons
 * / arrow keys / Escape). A single tap/key skips the in-flight animation to its end-state; "重播這
 * 一手" re-runs it. `prefers-reduced-motion` short-circuits straight to the static end-state, which
 * loses no information (mistake = both played-to + better-to highlighted — AC-9 / EC-5). Past-last /
 * before-first returns to the dashboard with a visible cue (EC-15). Cross-links to replay (EC-13).
 *
 * The animation timing/feel = manual device evidence (chessground synthetic events aren't
 * Playwright-drivable, technical-preferences); the end-state derivation is unit-tested (choreography.ts).
 */
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ChevronLeft, ChevronRight, RotateCw, LayoutGrid } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import ChessBoard from '@/components/chess-board.vue'
import MoveAnnotationDisplay from '@/components/move-annotation-display.vue'
import { useBoardFit } from '@/composables/use-board-fit'
import { useReducedMotion } from '@/composables/use-reduced-motion'
import type { Rect } from '@/utils/board-geometry'
import { describeMove, momentVisualKind, momentShortName } from '@/modules/memory/describe'
import { renderMoment } from '@/modules/memory/templates'
import {
  MEMORY_BRIGHT_GATE,
  ANIM_FIRST_MOVE_PRE_PAUSE_MS,
  ANIM_READ_PAUSE_MS,
  ANIM_BACK_PAUSE_MS,
  ANIM_MOVE_DURATION_MS,
} from '@/config/memory-config'
import { momentEndState, momentFrames, type MomentFrame } from '@/modules/memory/choreography'
import { useMemoryContext } from './memory-context'
import MomentCard from './MomentCard.vue'
import DotBand from './DotBand.vue'

const props = defineProps<{ index: number }>()
const ctx = useMemoryContext()
const { prefersReducedMotion } = useReducedMotion()

const count = computed(() => ctx.moments.value.length)
const moment = computed(() => ctx.moments.value[Math.min(props.index, Math.max(0, count.value - 1))] ?? null)
const moves = computed(() => ctx.game.value?.moves ?? [])
const preMoveFen = computed(() => (moment.value ? ctx.fens.value[moment.value.ply] ?? '' : ''))

const visualKind = computed(() => (moment.value ? momentVisualKind(moment.value) : 'plain'))
const isGood = computed(() => moment.value?.kind === 'bright' && (moment.value?.fav ?? 0) >= MEMORY_BRIGHT_GATE)
const playedUci = computed(() => (moment.value ? moves.value[moment.value.ply] ?? '' : ''))
const bestUci = computed(() => (moment.value ? ctx.review.analysisResults.value[moment.value.ply]?.bestMove ?? null : null))
const replyUci = computed(() => (moment.value ? moves.value[moment.value.ply + 1] ?? null : null))

const played = computed(() => describeMove(preMoveFen.value, playedUci.value))
const best = computed(() => (isGood.value ? null : describeMove(preMoveFen.value, bestUci.value)))
const shortName = computed(() => (moment.value ? momentShortName(moment.value) : ''))
const swingText = computed(() => {
  const m = moment.value
  if (!m) return ''
  const swing = visualKind.value === 'bright' ? m.fav : -m.cp
  return `${swing >= 0 ? '+' : '−'}${(Math.abs(swing) / 100).toFixed(1)}`
})
const neveText = computed(() => {
  const m = moment.value
  if (!m) return ''
  // selection collapses the anchor into kind='bright'; only a GENUINE bright (isGood) gets the
  // celebratory template. A bare anchor (turning point, OQ-R1) reads as a neutral plain swing —
  // never the "你穩住了…拿回主導權" praise for the player's costliest move (回顧態 guardrail).
  const templateKind = isGood.value ? 'bright' : m.kind === 'bright' ? 'plain' : m.kind
  return renderMoment({
    kind: templateKind,
    concept: m.concept,
    played: played.value ?? { piece: '子', to: '' },
    best: isGood.value ? undefined : best.value ?? undefined,
  })
})

// ---- Board geometry for the annotation overlay (chessground gotchas: read the real cg-board) ----
const board = ref<{ boardRef: HTMLElement | null; squareToRect: (s: string) => Rect | null } | null>(null)
const boardFit = ref<HTMLElement | null>(null)
useBoardFit(boardFit)
const geomTick = ref(0)
const boardEl = computed<HTMLElement | null>(() => { void geomTick.value; return board.value?.boardRef ?? null })
const boardSizePx = computed(() => { void geomTick.value; return boardEl.value?.offsetWidth ?? 0 })
function squareToRect(square: string): Rect | null { void geomTick.value; return board.value?.squareToRect?.(square) ?? null }
let boardRO: ResizeObserver | null = null

// ---- Choreography driver (GDD Rule 16) ----
const choreoInput = computed(() => ({
  preMoveFen: preMoveFen.value,
  playedUci: playedUci.value,
  bestUci: isGood.value ? null : bestUci.value,
  replyUci: replyUci.value,
}))
const currentFrame = ref<MomentFrame>({ fen: preMoveFen.value, annotations: [] })
let timers: number[] = []
function clearTimers(): void { timers.forEach((t) => clearTimeout(t)); timers = [] }

function playMoment(): void {
  clearTimers()
  if (!moment.value) return
  if (prefersReducedMotion.value) {
    currentFrame.value = momentEndState(choreoInput.value)
    return
  }
  const frames = momentFrames(choreoInput.value, {
    prePause: ANIM_FIRST_MOVE_PRE_PAUSE_MS,
    moveDuration: ANIM_MOVE_DURATION_MS,
    readPause: ANIM_READ_PAUSE_MS,
    backPause: ANIM_BACK_PAUSE_MS,
  })
  currentFrame.value = frames[0]
  let at = 0
  for (let i = 1; i < frames.length; i++) {
    at += frames[i - 1].holdMs
    const frame = frames[i]
    timers.push(window.setTimeout(() => { currentFrame.value = frame }, at))
  }
}
function skipToEnd(): void {
  clearTimers()
  if (moment.value) currentFrame.value = momentEndState(choreoInput.value)
}
function replayMoment(): void { playMoment() }

watch(() => props.index, () => playMoment())
watch(prefersReducedMotion, () => playMoment())

// ---- Nav (EC-15 visible return cue) ----
const returning = ref(false)
function leave(): void {
  returning.value = true
  window.setTimeout(() => ctx.backToDashboard(), 350)
}
function prev(): void { if (props.index <= 0) leave(); else ctx.openMoment(props.index - 1) }
function next(): void { if (props.index >= count.value - 1) leave(); else ctx.openMoment(props.index + 1) }

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
  else if (e.key === 'ArrowRight') { e.preventDefault(); next() }
  else if (e.key === 'Escape') { e.preventDefault(); ctx.backToDashboard() }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skipToEnd() }
}

const rootRef = ref<HTMLElement | null>(null)
onMounted(async () => {
  rootRef.value?.focus()
  await nextTick()
  geomTick.value++
  const el = board.value?.boardRef
  if (el) { boardRO = new ResizeObserver(() => geomTick.value++); boardRO.observe(el) }
  playMoment()
})
onBeforeUnmount(() => { clearTimers(); boardRO?.disconnect(); boardRO = null })
</script>

<template>
  <div ref="rootRef" class="relative flex w-full max-w-md flex-col gap-3 rounded-2xl outline-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base" tabindex="0" @keydown="onKeydown">
    <!-- Board re-plays the moment; tap skips to the end-state -->
    <div class="rounded-[12px] bg-[linear-gradient(160deg,#6f4b30,#523722)] p-3 ring-1 ring-black/30" @click="skipToEnd">
      <div ref="boardFit" class="board-fit relative">
        <ChessBoard ref="board" :fen="currentFrame.fen" :player-color="ctx.orientation.value" :disabled="true" :coordinates="true" />
        <MoveAnnotationDisplay
          v-if="boardEl"
          :annotations="currentFrame.annotations"
          :evaluation="null"
          :square-to-rect="squareToRect"
          :board-ref="boardEl"
          :board-size-px="boardSizePx"
          :shaft-scale="0.5"
        />
      </div>
    </div>

    <DotBand :count="count" :current="index" />

    <MomentCard
      v-if="moment"
      :visual-kind="visualKind"
      :short-name="shortName"
      :swing-text="swingText"
      :played="played"
      :best="best"
      :neve-text="neveText"
    />

    <!-- Actions -->
    <div class="flex items-center justify-between gap-2">
      <Button variant="secondary" size="icon" aria-label="上一個" @click="prev"><ChevronLeft :size="18" :stroke-width="1.8" /></Button>
      <button
        type="button"
        class="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 font-sans text-sm text-ink-muted hover:text-ink"
        @click="replayMoment"
      ><RotateCw :size="15" :stroke-width="1.8" /> 重播這一手</button>
      <button
        type="button"
        class="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 font-sans text-sm text-primary hover:text-primary-dark"
        @click="moment && ctx.openReplay(moment.ply)"
      ><LayoutGrid :size="15" :stroke-width="1.8" /> 在棋盤上逐手看</button>
      <Button variant="secondary" size="icon" aria-label="下一個" @click="next"><ChevronRight :size="18" :stroke-width="1.8" /></Button>
    </div>

    <!-- EC-15 visible return cue -->
    <div
      v-if="returning"
      class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-card bg-surface-base/70 font-sans text-sm text-ink-muted"
      aria-live="polite"
    >回棋憶…</div>
  </div>
</template>
