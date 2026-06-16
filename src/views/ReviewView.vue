<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useGameStore } from '@/stores/game-store'
import { usePostGameReview, buildFenSequence } from '@/modules/post-game-review/use-post-game-review'
import { classify, selectMistakeSignposts, type ClassifiedMistake } from '@/modules/learning-loop/classify'
import { candidates } from '@/modules/learning-loop/recommend'
import { getConceptById } from '@/data/concepts'
import { puzzles } from '@/data/puzzles'
import { MISTAKE_CONCEPT_MAX_LINKS } from '@/config/learning-loop-tuning'
import type { ChessConcept } from '@/types/concept'
import { useReviewEngine } from '@/modules/chess-engine/review-engine'
import { identifyOpening } from '@/modules/opening-id/opening-index'
import type { OpeningResult } from '@/modules/opening-id/opening-index'
import type { EvaluationInput } from '@/modules/move-annotation/annotation-types'
import { ArrowLeft, ChevronLeft, ChevronRight, Zap } from 'lucide-vue-next'
import MoveAnnotationDisplay from '@/components/move-annotation-display.vue'
import PgnViewer from '@/components/pgn-viewer.vue'
import { buildPgn } from '@/modules/game-export/assembler'
import OpeningKnowledgeCard from '@/components/opening-knowledge-card.vue'
import { useDataSyncStore } from '@/stores/data-sync'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'

const router = useRouter()
const gameStore = useGameStore()
const dataSyncStore = useDataSyncStore()
const review = usePostGameReview()
const engine = useReviewEngine()

const syncStatus = computed(() => dataSyncStore.syncStatus)

const openingResult = ref<OpeningResult | null>(null)
const boardWrapperRef = ref<HTMLElement | null>(null)
const pgnRef = ref<InstanceType<typeof PgnViewer> | null>(null)

const pgn = computed<string>(() => {
  const game = gameStore.completedGame
  if (!game) return ''
  try {
    return buildPgn(game)
  } catch {
    return ''
  }
})

const orientation = computed<'white' | 'black'>(
  () => gameStore.completedGame?.playerColor ?? 'white',
)

// ---- Opening header (Rule 25, AC-8, AC-9, AC-10) ----

const openingHeader = computed<string | null>(() => {
  const or = openingResult.value
  if (!or || or.isUnknown) return null
  if (review.cursor.value === 0) return null

  let header = or.name ?? ''
  const n = review.totalPositions.value
  const bp = or.bookExitPly
  if (bp !== null && bp < n && review.cursor.value >= bp) {
    const moveNum = Math.ceil(bp / 2)
    header += ` — 第 ${moveNum} 手離開開局庫`
  }
  return header
})

// ---- cpLoss display (Rule 22, AC-2, AC-3, AC-4, AC-5) ----

/** Returns the F2b mate label when either eval is mate, else null. */
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
  // Both stay in same state — no swing to report
  return null
}

const cpLossDisplay = computed<{ text: string; preliminary: boolean; omit: boolean }>(() => {
  const i = review.cursor.value
  const n = review.totalPositions.value

  // not-applicable cases (Rule 22 branch 1)
  if (!review.isPlayerMove(i)) return { text: '—', preliminary: false, omit: false }
  if (i >= n - 1) return { text: '—', preliminary: false, omit: false }

  const curr = review.analysisResults.value[i]
  const next = review.analysisResults.value[i + 1]

  // EC-8: terminal position
  if (curr && curr.bestMove === null) return { text: '—', preliminary: false, omit: false }

  // COMPLETE + null entry = engine error (AC-20)
  if (review.phase.value === 'COMPLETE' && (!curr || !next)) {
    return { text: '—', preliminary: false, omit: false }
  }

  // pending (Rule 22 branch 2)
  if (review.phase.value === 'ANALYZING' && (!curr || !next)) {
    return { text: '…', preliminary: false, omit: false }
  }

  if (!curr || !next) return { text: '—', preliminary: false, omit: false }

  // confirming case (Rule 22 branch 3 / AC-23)
  const playedMove = gameStore.completedGame?.moves[i]
  const bestMove = curr.bestMove
  if (playedMove && bestMove && playedMove.toLowerCase() === bestMove.toLowerCase()) {
    return { text: '', preliminary: false, omit: true }
  }

  // mate transition (Rule 22 branch 4 / AC-15)
  const mateLabel = getMateLabel(i)
  if (mateLabel) return { text: mateLabel, preliminary: false, omit: false }

  // value (Rule 22 branch 5)
  const loss = review.computeCpLoss(i)
  if (loss === null) return { text: '—', preliminary: false, omit: false }

  const isFinal = review.isCpLossFinal(i)
  const pawns = (loss / 100).toFixed(1)
  const display = loss === 0 ? '0.0' : `-${pawns}`
  const preliminary = !isFinal

  return { text: preliminary ? `~${display}` : display, preliminary, omit: false }
})

// ---- Progress indicator (Rule 12, AC-16) ----

const progressLabel = computed<string | null>(() => {
  if (review.phase.value !== 'ANALYZING') return null
  const n = review.totalPositions.value
  const count = review.progressCount.value
  if (review.progressPass.value === 'preview') {
    return `分析中… ${count}/${n}`
  }
  return `深入分析… ${count}/${n}`
})

// ---- Mobile calm default (S4-06, TR-post-game-review-006) ----
// < 768px: bestMove arrow only, no eval bar. BINDING per control manifest.

const _mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)') : null
const isMobile = ref(_mq?.matches ?? false)

function _onMqChange(e: MediaQueryListEvent) { isMobile.value = e.matches }
if (_mq) _mq.addEventListener('change', _onMqChange)

// The board's best-move arrow is drawn by chessground (via PgnViewer), not the SVG overlay —
// the played move is already shown by the board's own last-move highlight.
const currentBestUci = computed<string | null>(() => {
  const best = review.analysisResults.value[review.cursor.value]?.bestMove
  return best && best.length >= 4 ? best : null
})

// review.cursor is the single source of truth; mirror it onto the pgn-viewer board.
function syncBoard(): void {
  pgnRef.value?.toPly(review.cursor.value)
  pgnRef.value?.setBestArrow(currentBestUci.value)
}
watch(() => review.cursor.value, syncBoard)
watch(currentBestUci, (uci) => pgnRef.value?.setBestArrow(uci))

// User clicked a move in the pgn-viewer move list → move our cursor there.
function onMoveSelected(): void {
  review.goTo(pgnRef.value?.getCurrentPly() ?? 0)
}

const currentEvaluation = computed<EvaluationInput | null>(() => {
  const i = review.cursor.value
  const result = review.analysisResults.value[i]
  if (!result) return null
  return { evalCp: result.evalCp, evalMate: result.evalMate, sideToMove: i % 2 === 0 ? 'w' : 'b' }
})

const displayEvaluation = computed<EvaluationInput | null>(() =>
  isMobile.value ? null : currentEvaluation.value,
)

// ---- Biggest swing (Rules 30-32, AC-24) ----

const biggestSwingCursor = computed(() => {
  if (review.phase.value !== 'COMPLETE') return null
  return review.biggestSwingCursor.value
})

function jumpToBiggestSwing(): void {
  const bsc = biggestSwingCursor.value
  if (bsc !== null) review.goTo(bsc)
}

// ---- Bridge 3 — concept signposts (Learning Loop #20, GDD §3.4 / §4.4) ----
// A neutral, opt-in tag attached to a classified mistake. Never in the default render (D2): it lives
// behind the Show-detail affordance and only on the move the signal fired on.

interface Signpost {
  index: number
  concept: ChessConcept
  label: string
  lessonId: string | null
  puzzleId: string | null
}

/** #7 F2b reused (zero new logic): did the player's move i allow a forced mate? (放任被將死 transition) */
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

/** The signpost on the move under the cursor (GDD §3.4: the tag sits on its own move), else null. */
const signpostForCursor = computed<Signpost | null>(
  () => mistakeSignposts.value.find((s) => s.index === review.cursor.value) ?? null,
)

// Opt-in (D2): the signpost is never rendered by default. Each move is an independent opt-in, so the
// reveal state resets when the cursor moves.
const showConceptDetail = ref(false)
watch(() => review.cursor.value, () => { showConceptDetail.value = false })

// ---- Lifecycle ----

onMounted(async () => {
  const game = gameStore.completedGame
  if (!game) {
    router.push('/')
    return
  }

  // Opening identification (Rule 3)
  openingResult.value = identifyOpening([...game.moves])

  // Start analysis
  review.init(game, ({ fen, targetDepth, movetimeMs, signal }) =>
    engine.analyze({ fen, targetDepth, movetimeMs, signal }),
  ).catch(() => {
    // Aborted or engine error — review remains partially usable
  })
})

onUnmounted(() => {
  review.abort()
  engine.dispose()
  if (_mq) _mq.removeEventListener('change', _onMqChange)
})

function handleExit(): void {
  review.abort()
  router.push('/')
}
</script>

<template>
  <div class="flex flex-col items-center p-4 min-h-dvh">
    <!-- Header row -->
    <div class="mb-3 flex w-full max-w-md items-center justify-between">
      <Button variant="secondary" size="sm" @click="handleExit">
        <ArrowLeft :size="16" :stroke-width="1.8" /> 返回
      </Button>
      <h1 class="font-display text-xl font-bold text-ink" tabindex="-1">複盤</h1>
      <div class="w-16" />
    </div>

    <!-- Opening header + knowledge card (OKC-01, OKC-02, OKC-03) -->
    <OpeningKnowledgeCard
      :eco="openingResult?.eco ?? null"
      :header-text="openingHeader"
    />

    <!-- Sync status badge (SUPA-AC-13, AC-S7-02~05) -->
    <Badge
      v-if="syncStatus !== 'idle'"
      :variant="syncStatus === 'syncing' ? 'hint' : syncStatus === 'synced' ? 'success' : 'danger'"
      class="mb-2"
      aria-live="polite"
    >
      <span v-if="syncStatus === 'syncing'">儲存中…</span>
      <span v-if="syncStatus === 'synced'">已儲存</span>
      <span v-if="syncStatus === 'error'">未儲存</span>
    </Badge>

    <!-- Progress indicator (Rule 12, AC-16) -->
    <div
      v-if="progressLabel"
      class="w-full max-w-md text-xs text-center text-ink-muted mb-2"
    >
      {{ progressLabel }}
    </div>

    <!-- Real board (PgnViewer = lichess chessground) + eval-bar overlay.
         Board + best-move arrow come from chessground; the SVG overlay supplies only the
         eval bar (desktop). Mobile calm: displayEvaluation is null < 768px → no eval bar. -->
    <div ref="boardWrapperRef" class="relative w-full max-w-md mb-3">
      <PgnViewer
        ref="pgnRef"
        :pgn="pgn"
        :orientation="orientation"
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

    <!-- cpLoss display (AC-2, AC-3, AC-4, AC-5) -->
    <div class="w-full max-w-md flex items-center justify-center mb-3 min-h-[28px]">
      <template v-if="!cpLossDisplay.omit">
        <span
          :class="[
            'font-num text-sm tabular-nums px-2 py-1 rounded',
            cpLossDisplay.text === '—' || cpLossDisplay.text === '…'
              ? 'text-ink-faint'
              : cpLossDisplay.preliminary
                ? 'text-ink-muted bg-surface-hover'
                : 'text-ink bg-surface-hover',
          ]"
        >
          {{ cpLossDisplay.text }}
        </span>
        <span
          v-if="review.phase.value === 'COMPLETE' && biggestSwingCursor === review.cursor.value"
          class="ml-2 text-xs text-hint font-semibold"
        >
          最大轉折
        </span>
      </template>
    </div>

    <!-- Navigation row (Rules 15-17, AC-11, AC-12) -->
    <div class="mb-4 flex items-center gap-4">
      <Button
        variant="secondary"
        size="icon"
        aria-label="上一步"
        :disabled="!review.canGoPrev.value"
        @click="review.goPrev()"
      >
        <ChevronLeft :size="18" :stroke-width="1.8" />
      </Button>
      <span class="font-num text-sm tabular-nums text-ink-muted">
        {{ review.cursor.value }} / {{ review.totalPositions.value }}
      </span>
      <Button
        variant="secondary"
        size="icon"
        aria-label="下一步"
        :disabled="!review.canGoNext.value"
        @click="review.goNext()"
      >
        <ChevronRight :size="18" :stroke-width="1.8" />
      </Button>
    </div>

    <!-- Jump to biggest swing (Rules 31-32, AC-24) -->
    <div
      v-if="review.phase.value === 'COMPLETE' && biggestSwingCursor !== null"
      class="mb-3"
    >
      <Button
        class="bg-hint text-sm text-hint-fg hover:bg-hint-dark"
        @click="jumpToBiggestSwing"
      >
        <Zap :size="15" :stroke-width="1.8" /> 跳到最大轉折
      </Button>
    </div>

    <!-- No big swings empty state (Rule 32) -->
    <div
      v-if="review.phase.value === 'COMPLETE' && biggestSwingCursor === null && review.totalPositions.value > 0 && !review.analysisResults.value.every(r => r === null)"
      class="text-sm text-ink-muted text-center"
    >
      這盤沒有大轉折 — 全程穩定
    </div>

    <!-- Bridge 3 — concept signpost (Learning Loop #20, GDD §3.4 D2: neutral, opt-in, behind detail) -->
    <div v-if="signpostForCursor" class="w-full max-w-md mb-3">
      <button
        v-if="!showConceptDetail"
        type="button"
        class="min-h-[44px] w-full rounded-lg border border-primary/20 bg-surface-hover px-4 text-sm text-ink-muted"
        @click="showConceptDetail = true"
      >
        顯示細節
      </button>
      <div
        v-else
        data-testid="review-detail-panel"
        class="rounded-lg border border-primary/20 bg-surface-hover p-4"
      >
        <div data-testid="concept-signpost" class="flex flex-col gap-3">
          <p class="text-sm text-ink">相關概念：{{ signpostForCursor.label }}</p>
          <div class="flex flex-wrap gap-3">
            <RouterLink
              v-if="signpostForCursor.lessonId"
              :to="`/learn/${signpostForCursor.lessonId}`"
              class="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg"
            >
              複習這個概念
            </RouterLink>
            <RouterLink
              v-if="signpostForCursor.puzzleId"
              :to="`/dungeon/${signpostForCursor.puzzleId}?from=lesson`"
              class="inline-flex min-h-[44px] items-center rounded-lg border border-primary/30 px-4 text-sm font-semibold text-primary"
            >
              去試煉
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Engine error state (AC-30 / Visual Requirements §Error State) -->
    <Alert
      v-if="review.phase.value === 'COMPLETE' && review.totalPositions.value > 0 && review.analysisResults.value.every(r => r === null)"
      variant="danger"
      class="mt-4 w-full max-w-md text-center"
    >
      <p class="mb-3 text-sm font-semibold text-danger">無法分析這盤棋</p>
      <div class="flex justify-center gap-3">
        <Button variant="danger" class="text-sm" @click="handleExit">離開</Button>
      </div>
    </Alert>
  </div>
</template>
