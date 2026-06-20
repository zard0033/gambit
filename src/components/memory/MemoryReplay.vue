<script setup lang="ts">
/**
 * 棋憶 Move-by-Move Replay (story-009) — the dense surface. Reuses the shipped PgnViewer (Wood12 +
 * Gioco) + Move Annotation Display + the #7 cpLoss display contract. Opens at a ply (from the trend
 * chart → anchor ply by default; deep-linkable for the 棋誌 coupling, story-010). Reads the single
 * review instance from MemoryContext — runs NO analysis itself (ADR-0014).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronLeft, ChevronRight, Zap } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useGameStore } from '@/stores/game-store'
import { classify, selectMistakeSignposts, type ClassifiedMistake } from '@/modules/learning-loop/classify'
import { candidates } from '@/modules/learning-loop/recommend'
import { getConceptById } from '@/data/concepts'
import { puzzles } from '@/data/puzzles'
import { MISTAKE_CONCEPT_MAX_LINKS } from '@/config/learning-loop-tuning'
import type { ChessConcept } from '@/types/concept'
import type { EvaluationInput } from '@/modules/move-annotation/annotation-types'
import { buildFenSequence } from '@/modules/post-game-review/use-post-game-review'
import MoveAnnotationDisplay from '@/components/move-annotation-display.vue'
import PgnViewer from '@/components/pgn-viewer.vue'
import { useMemoryContext } from './memory-context'
import ReplayEvalChart from './ReplayEvalChart.vue'

const props = defineProps<{ ply: number }>()

const ctx = useMemoryContext()
const review = ctx.review
const gameStore = useGameStore()

const boardWrapperRef = ref<HTMLElement | null>(null)
const pgnRef = ref<InstanceType<typeof PgnViewer> | null>(null)

// ---- cpLoss display (reused #7 display contract, Rule 22) ----
function getMateLabel(i: number): string | null {
  const curr = review.analysisResults.value[i]
  const next = review.analysisResults.value[i + 1]
  if (!curr || !next) return null
  const currIsMate = curr.evalMate !== undefined
  const nextIsMate = next.evalMate !== undefined
  if (!currIsMate && !nextIsMate) return null
  const hadMate = currIsMate && curr.evalMate! > 0
  const nowMated = nextIsMate && next.evalMate! > 0
  if (hadMate && !nowMated) return '錯過殺著'
  if (!hadMate && nowMated) return '放任被將死'
  return null
}

const cpLossDisplay = computed<{ text: string; preliminary: boolean; omit: boolean }>(() => {
  const i = review.cursor.value
  const n = review.totalPositions.value
  if (!review.isPlayerMove(i)) return { text: '—', preliminary: false, omit: false }
  if (i >= n - 1) return { text: '—', preliminary: false, omit: false }
  const curr = review.analysisResults.value[i]
  const next = review.analysisResults.value[i + 1]
  if (curr && curr.bestMove === null) return { text: '—', preliminary: false, omit: false }
  if (review.phase.value === 'COMPLETE' && (!curr || !next)) return { text: '—', preliminary: false, omit: false }
  if (review.phase.value === 'ANALYZING' && (!curr || !next)) return { text: '…', preliminary: false, omit: false }
  if (!curr || !next) return { text: '—', preliminary: false, omit: false }
  const playedMove = gameStore.completedGame?.moves[i]
  const bestMove = curr.bestMove
  if (playedMove && bestMove && playedMove.toLowerCase() === bestMove.toLowerCase()) {
    return { text: '', preliminary: false, omit: true }
  }
  const mateLabel = getMateLabel(i)
  if (mateLabel) return { text: mateLabel, preliminary: false, omit: false }
  const loss = review.computeCpLoss(i)
  if (loss === null) return { text: '—', preliminary: false, omit: false }
  const isFinal = review.isCpLossFinal(i)
  const pawns = (loss / 100).toFixed(1)
  const display = loss === 0 ? '0.0' : `-${pawns}`
  const preliminary = !isFinal
  return { text: preliminary ? `~${display}` : display, preliminary, omit: false }
})

// ---- Eval bar (desktop calm default, mobile hidden) ----
const _mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)') : null
const isMobile = ref(_mq?.matches ?? false)
function _onMqChange(e: MediaQueryListEvent) { isMobile.value = e.matches }
if (_mq) _mq.addEventListener('change', _onMqChange)

const currentBestUci = computed<string | null>(() => {
  const best = review.analysisResults.value[review.cursor.value]?.bestMove
  return best && best.length >= 4 ? best : null
})
const currentEvaluation = computed<EvaluationInput | null>(() => {
  const i = review.cursor.value
  const result = review.analysisResults.value[i]
  if (!result) return null
  return { evalCp: result.evalCp, evalMate: result.evalMate, sideToMove: i % 2 === 0 ? 'w' : 'b' }
})
const displayEvaluation = computed<EvaluationInput | null>(() => (isMobile.value ? null : currentEvaluation.value))

function syncBoard(): void {
  pgnRef.value?.toPly(review.cursor.value)
  pgnRef.value?.setBestArrow(currentBestUci.value)
}
watch(() => review.cursor.value, syncBoard)
watch(currentBestUci, (uci) => pgnRef.value?.setBestArrow(uci))
function onMoveSelected(): void { review.goTo(pgnRef.value?.getCurrentPly() ?? 0) }

// ---- Biggest swing (anchor) ----
const biggestSwingCursor = computed(() => (review.phase.value === 'COMPLETE' ? review.biggestSwingCursor.value : null))
function jumpToBiggestSwing(): void {
  const bsc = biggestSwingCursor.value
  if (bsc !== null) review.goTo(bsc)
}

// ---- Bridge 3 — concept signposts (Learning Loop #20) ----
interface Signpost { index: number; concept: ChessConcept; label: string; lessonId: string | null; puzzleId: string | null }
function allowedForcedMate(i: number): boolean {
  const curr = review.analysisResults.value[i]
  const next = review.analysisResults.value[i + 1]
  if (!curr || !next) return false
  const hadMate = curr.evalMate !== undefined && curr.evalMate > 0
  const nowMated = next.evalMate !== undefined && next.evalMate > 0
  return !hadMate && nowMated
}
const mistakeSignposts = computed<Signpost[]>(() => {
  if (review.phase.value !== 'COMPLETE') return []
  const game = gameStore.completedGame
  if (!game) return []
  const fens = buildFenSequence([...game.moves])
  const classified: ClassifiedMistake[] = []
  for (let i = 0; i < game.moves.length; i++) {
    if (!review.isPlayerMove(i)) continue
    if (!review.isCpLossFinal(i)) continue
    const loss = review.computeCpLoss(i)
    if (loss === null || loss <= 0) continue
    const concept = classify({
      fen: fens[i],
      playerMoveUci: game.moves[i],
      opponentReplyUci: game.moves[i + 1],
      signals: { allowedForcedMate: allowedForcedMate(i) },
    })
    if (concept === 'none') continue
    classified.push({ index: i, concept, cpLoss: loss })
  }
  return selectMistakeSignposts(classified, MISTAKE_CONCEPT_MAX_LINKS).map((m) => {
    const meta = getConceptById(m.concept)
    return {
      index: m.index,
      concept: m.concept,
      label: meta?.label ?? m.concept,
      lessonId: meta?.teaches[0] ?? null,
      puzzleId: candidates(m.concept, puzzles)[0]?.id ?? null,
    }
  })
})
const signpostForCursor = computed<Signpost | null>(
  () => mistakeSignposts.value.find((s) => s.index === review.cursor.value) ?? null,
)
const showConceptDetail = ref(false)
watch(() => review.cursor.value, () => { showConceptDetail.value = false })

onMounted(() => {
  review.goTo(props.ply)
  syncBoard()
})
</script>

<template>
  <div class="flex w-full max-w-md flex-col items-center">
    <!-- Board (PgnViewer = lichess chessground, Wood12 + Gioco) + eval bar overlay -->
    <div ref="boardWrapperRef" class="board-fit relative mb-3 w-full">
      <PgnViewer
        ref="pgnRef"
        :pgn="ctx.pgn.value"
        :orientation="ctx.orientation.value"
        :keyboard-to-move="false"
        :show-controls="false"
        @move-selected="onMoveSelected"
      />
      <MoveAnnotationDisplay
        :annotations="[]"
        :evaluation="displayEvaluation"
        :square-to-rect="() => null"
        :board-ref="boardWrapperRef"
      />
    </div>

    <!-- Self-drawn eval chart with a gold cursor at the current ply (story-009 AC) -->
    <ReplayEvalChart
      class="mb-3 w-full"
      :series="ctx.series.value"
      :cursor="review.cursor.value"
      :anchor-ply="biggestSwingCursor"
    />

    <!-- cpLoss display -->
    <div class="mb-3 flex min-h-[28px] w-full items-center justify-center">
      <template v-if="!cpLossDisplay.omit">
        <span
          :class="[
            'font-num text-sm tabular-nums px-2 py-1 rounded',
            cpLossDisplay.text === '—' || cpLossDisplay.text === '…'
              ? 'text-ink-faint'
              : cpLossDisplay.preliminary ? 'text-ink-muted bg-surface-hover' : 'text-ink bg-surface-hover',
          ]"
        >{{ cpLossDisplay.text }}</span>
        <span
          v-if="review.phase.value === 'COMPLETE' && biggestSwingCursor === review.cursor.value"
          class="ml-2 text-xs font-semibold text-hint"
        >最大轉折</span>
      </template>
    </div>

    <!-- Navigation -->
    <div class="mb-4 flex items-center gap-4">
      <Button variant="secondary" size="icon" aria-label="上一步" :disabled="!review.canGoPrev.value" @click="review.goPrev()">
        <ChevronLeft :size="18" :stroke-width="1.8" />
      </Button>
      <span class="font-num text-sm tabular-nums text-ink-muted">{{ review.cursor.value }} / {{ review.totalPositions.value }}</span>
      <Button variant="secondary" size="icon" aria-label="下一步" :disabled="!review.canGoNext.value" @click="review.goNext()">
        <ChevronRight :size="18" :stroke-width="1.8" />
      </Button>
    </div>

    <!-- Jump to biggest swing -->
    <div v-if="review.phase.value === 'COMPLETE' && biggestSwingCursor !== null" class="mb-3">
      <Button class="bg-hint text-sm text-hint-fg hover:bg-hint-dark" @click="jumpToBiggestSwing">
        <Zap :size="15" :stroke-width="1.8" /> 跳到最大轉折
      </Button>
    </div>

    <!-- Bridge 3 — concept signpost (opt-in, behind detail) -->
    <div v-if="signpostForCursor" class="mb-3 w-full">
      <button
        v-if="!showConceptDetail"
        type="button"
        class="min-h-[44px] w-full rounded-lg border border-primary/20 bg-surface-hover px-4 text-sm text-ink-muted"
        @click="showConceptDetail = true"
      >顯示細節</button>
      <div v-else data-testid="review-detail-panel" class="rounded-lg border border-primary/20 bg-surface-hover p-4">
        <div data-testid="concept-signpost" class="flex flex-col gap-3">
          <p class="text-sm text-ink">相關概念：{{ signpostForCursor.label }}</p>
          <div class="flex flex-wrap gap-3">
            <RouterLink
              v-if="signpostForCursor.lessonId"
              :to="`/learn/${signpostForCursor.lessonId}`"
              class="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg"
            >複習這個概念</RouterLink>
            <RouterLink
              v-if="signpostForCursor.puzzleId"
              :to="`/dungeon/${signpostForCursor.puzzleId}?from=lesson`"
              class="inline-flex min-h-[44px] items-center rounded-lg border border-primary/30 px-4 text-sm font-semibold text-primary"
            >去試煉</RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
