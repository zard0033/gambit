<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, RotateCw, Lightbulb, Check, X } from 'lucide-vue-next'
import ChessBoard from '@/components/chess-board.vue'
import MoveAnnotationDisplay from '@/components/move-annotation-display.vue'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { getLessonById, lessons } from '@/data/lessons'
import { COACH, LESSON_TIER_LABELS } from '@/types/lesson'
import type { LessonStep, LessonTier } from '@/types/lesson'
import { ChapterBadge } from '@/components/ui/gambit'
import type { Annotation } from '@/modules/move-annotation/annotation-types'
import type { MoveMadePayload } from '@/composables/use-chess-board'
import type { Rect } from '@/utils/board-geometry'
import { useBoardFit } from '@/composables/use-board-fit'
import { useReducedMotion } from '@/composables/use-reduced-motion'
import { useLessonProgressStore } from '@/stores/lesson-progress'

const TIER_PIECE: Record<LessonTier, string> = { 1: 'bP', 2: 'bN', 3: 'bR', 4: 'bK' }
const TIER_NUM: Record<LessonTier, string> = { 1: '一', 2: '二', 3: '三', 4: '四' }

const route = useRoute()
const router = useRouter()
const progress = useLessonProgressStore()

const lesson = getLessonById(route.params.lessonId as string)

// Concept-tab side-door (Learning Loop #20): `?from=concept` lets a non-beginner open a tactic's
// lesson out of linear order. Mirrors the dungeon practice side-door; return nav routes back to 概念.
const fromConcept = route.query.from === 'concept'
const backTo = fromConcept ? '/learn/concepts' : '/learn'

// Guard: unknown or still-locked lesson → back to the catalog. The side-door bypasses the lock.
if (!lesson || (!progress.isUnlocked(lesson) && !fromConcept)) {
  router.replace('/learn')
}

const playerColor = computed<'white' | 'black'>(() => lesson?.playerColor ?? 'white')

const stepIndex = ref(0)
const currentStep = computed<LessonStep | null>(() => lesson?.steps[stepIndex.value] ?? null)
const isInteractive = computed(() => !!currentStep.value?.expectedMove)
const isLastStep = computed(() => !!lesson && stepIndex.value >= lesson.steps.length - 1)

// Per-step interaction state — reset whenever the step changes.
const solved = ref(false)
const wrongMove = ref<{ from: string; to: string } | null>(null)
const everWrong = ref(false)
const hintShown = ref(false)
const answerRevealed = ref(false)

watch(stepIndex, async () => {
  solved.value = false
  wrongMove.value = null
  everWrong.value = false
  hintShown.value = false
  answerRevealed.value = false
  // Force the board onto the new step's FEN even when it's an identical string to the previous
  // step (Vue won't re-fire watch(props.fen); the player's last move would otherwise stay on the
  // board — 上一步沒把棋子移回修正).
  await nextTick()
  board.value?.reapplyFen()
})

// Board key is the lesson id (NOT the step) so stepping never remounts the board — chessground
// syncs each step's FEN via setPosition (smooth), instead of a full rebuild that replays the
// piece entry animation (上一步/下一步換步棋盤 dash 修正).
const boardKey = computed(() => lesson?.id ?? '')
const boardDisabled = computed(() => !isInteractive.value || solved.value || !!wrongMove.value)

const board = ref<{ boardRef: HTMLElement | null; squareToRect: (s: string) => Rect | null; resetPosition: () => void; reapplyFen: () => void } | null>(null)
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

let _boardRO: ResizeObserver | null = null
onMounted(async () => {
  await nextTick()
  geomTick.value++
  // Recompute LessonView's overlay geometry (wrong-tint / ✓✗ badges / boardSizePx) when the board
  // resizes — viewport rotate or useBoardFit width change otherwise leaves them on stale coords.
  const el = board.value?.boardRef
  if (el) {
    _boardRO = new ResizeObserver(() => geomTick.value++)
    _boardRO.observe(el)
  }
})
onBeforeUnmount(() => {
  _boardRO?.disconnect()
  _boardRO = null
})
watch(boardKey, async () => {
  await nextTick()
  geomTick.value++
})

// Annotations: highlights always show; arrows only on narration steps or after answer revealed.
const annotations = computed<Annotation[]>(() => {
  const step = currentStep.value
  if (!step) return []
  const out: Annotation[] = []
  for (const sq of step.highlights ?? []) {
    out.push({ kind: 'highlight', role: 'keySquare', square: sq })
  }
  // Once solved, drop the answer arrow — the player already made the move (走子後箭頭消失).
  const showArrows = !isInteractive.value || (answerRevealed.value && !solved.value)
  if (showArrows) {
    for (const a of step.arrows ?? []) {
      out.push({ kind: 'arrow', role: 'bestMove', from: a.orig, to: a.dest })
    }
  }
  return out
})

// Wrong-move square tint geometry.
const wrongGeom = computed(() => {
  void geomTick.value
  const wm = wrongMove.value
  if (!wm) return null
  const from = squareToRect(wm.from)
  const to = squareToRect(wm.to)
  return from && to ? { from, to } : null
})

function cornerBadge(square: string | undefined) {
  void geomTick.value
  if (!square) return null
  const r = squareToRect(square)
  if (!r) return null
  const size = Math.max(18, r.width * 0.42)
  return { left: r.x + r.width - size / 2, top: r.y - size / 2, size }
}
const wrongBadge = computed(() => (wrongMove.value ? cornerBadge(wrongMove.value.to) : null))
const correctBadge = computed(() =>
  solved.value ? cornerBadge(currentStep.value?.expectedMove?.to) : null,
)

function handleMove(payload: MoveMadePayload): void {
  const exp = currentStep.value?.expectedMove
  if (!exp || solved.value || wrongMove.value) return
  const correct =
    payload.from === exp.from &&
    payload.to === exp.to &&
    (exp.promotion === undefined || payload.promotion === exp.promotion)
  if (correct) {
    solved.value = true
  } else {
    wrongMove.value = { from: payload.from, to: payload.to }
    everWrong.value = true
  }
}

function retry(): void {
  wrongMove.value = null
  board.value?.resetPosition() // snap the wrong piece home without remounting (no entry-animation replay)
}

const canAdvance = computed(() => !isInteractive.value || solved.value)
const lightbulbGlowing = computed(
  () => everWrong.value && !wrongMove.value && !solved.value && !hintShown.value,
)

// ── Typewriter effect for coach narration ──
const { prefersReducedMotion } = useReducedMotion()
const displayedText = ref('')
let typewriterTimer: ReturnType<typeof setTimeout> | null = null

function startTypewriter(text: string): void {
  if (typewriterTimer !== null) clearTimeout(typewriterTimer)
  if (prefersReducedMotion.value) {
    displayedText.value = text
    return
  }
  displayedText.value = ''
  let i = 0
  const step = (): void => {
    displayedText.value = text.slice(0, i + 1)
    i++
    if (i < text.length) typewriterTimer = setTimeout(step, 8)
  }
  step()
}

function skipTypewriter(): void {
  if (typewriterTimer !== null) {
    clearTimeout(typewriterTimer)
    typewriterTimer = null
  }
  displayedText.value = currentStep.value?.text ?? ''
}

// 對話框自動捲：教練文字逐字長出、或提示／回饋／成功訊息新增時，把焦點維持在最新內容。
const coachScroll = ref<HTMLElement | null>(null)
function scrollCoachToBottom(): void {
  const el = coachScroll.value
  if (el) el.scrollTop = el.scrollHeight
}
watch(
  [displayedText, hintShown, wrongMove, answerRevealed, solved],
  async () => {
    await nextTick()
    scrollCoachToBottom()
  },
)

// Watch stepIndex (not the text string): two adjacent steps with identical text must still replay
// the typewriter, which a string-diff watch would skip.
watch(
  stepIndex,
  () => startTypewriter(currentStep.value?.text ?? ''),
  { immediate: true },
)
onBeforeUnmount(() => { if (typewriterTimer !== null) clearTimeout(typewriterTimer) })

// ── Bridge 1 (Learning Loop #20): in-bubble lesson wrap-up + course→puzzle invitation ──
// 課末不跳彈窗：最後一步按「完成課程」才就地切成收尾（重點 + 練習邀請），動作列換成下一課／返回。
// 必須由使用者明確觸發——不能在「走到最後一步」自動完成，否則敘述型 5/5 會被秒跳過（4/5 走對就快轉）。
const finished = ref(false)
function complete(): void {
  if (finished.value) return
  finished.value = true
  // Side-door entry lights 已學 via the separate signal only — it must NOT advance linear progress
  // (no markComplete → no isUnlocked leak; GDD §3.2 D1 pattern).
  if (lesson) {
    if (fromConcept) progress.markSideLearned(lesson.id)
    else progress.markComplete(lesson.id)
  }
  nextTick().then(scrollCoachToBottom)
}


// 繼續下一課（從課程正常路徑進入時才顯示，概念側門不顯示）
const nextLesson = computed(() => {
  if (!lesson || fromConcept) return null
  const idx = lessons.findIndex((l) => l.id === lesson!.id)
  return idx >= 0 ? (lessons[idx + 1] ?? null) : null
})

function goToNextLesson(): void {
  if (nextLesson.value) router.push(`/learn/${nextLesson.value.id}`)
}

function next(): void {
  stepIndex.value++
}
function prev(): void {
  if (stepIndex.value > 0) stepIndex.value--
}
</script>

<template>
  <!-- 課程內頁：整頁錨進 deep-jade，棋盤浮在 jade 上聚焦；課文收進底部暖色教練氣泡（IG 對話框語彙）。
       固定視口高 flex column：header / 棋盤(shrink-0 不被擠) / 氣泡(flex-1 自捲、捲軸隱藏) / CTA(shrink-0 固定底)。 -->
  <div v-if="lesson" class="flex h-dvh flex-col bg-surface-deep text-ink-on-deep">

    <!-- Header: back + title + step counter -->
    <header class="flex shrink-0 items-center gap-3 px-4 pb-2 pt-[calc(0.625rem+env(safe-area-inset-top))]">
      <button
        type="button"
        :aria-label="fromConcept ? '返回概念' : '返回課程清單'"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/8 text-ink-on-deep transition-colors hover:bg-white/[0.14] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold active:scale-95"
        @click="router.push(backTo)"
      ><ArrowLeft :size="20" :stroke-width="1.8" /></button>
      <h1 class="flex-1 truncate font-display text-lg font-bold text-ink-on-deep" tabindex="-1">{{ lesson.title }}</h1>
    </header>

    <!-- Side-door context note: quiet, neutral — never judges the out-of-order entry -->
    <p
      v-if="fromConcept"
      data-testid="lesson-from-concept-note"
      class="shrink-0 px-4 pb-1 font-sans text-xs text-ink-on-deep-dim"
    >你從概念地圖提前學這個戰術</p>

    <!-- Content: board (fixed) on mobile stacked, side-by-side on desktop -->
    <div class="flex min-h-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-5xl lg:flex-row lg:items-start lg:gap-6 lg:px-4 lg:py-2" :class="{ 'lg:justify-center': finished }">

      <!-- Board floats on jade; capped so the coach bubble keeps room on the first screen.
           Padding/size live on the OUTER box; the inner `relative` box hugs the board so the
           annotation overlay (absolute inset-0) aligns with the squares — padding on the positioned
           ancestor would shift every arrow sideways (課程答案箭頭偏移修正). -->
      <div v-if="!finished" class="mx-auto w-full shrink-0 px-4 pt-1 lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1 lg:self-start lg:px-0 lg:pt-1">
        <!-- wooden tray：棋盤木框（與試煉／對局同款木盤） -->
        <div class="rounded-[12px] bg-[linear-gradient(160deg,#6f4b30,#523722)] p-3 ring-1 ring-black/30 shadow-[0_12px_32px_rgba(10,30,24,0.45),inset_0_1px_0_rgba(255,228,194,0.20),inset_0_-2px_6px_rgba(0,0,0,0.38)]">
        <div ref="boardFit" class="relative board-fit">
        <ChessBoard
          :key="boardKey"
          ref="board"
          :fen="currentStep?.fen ?? ''"
          :player-color="playerColor"
          :disabled="boardDisabled"
          :coordinates="true"
          @move-made="handleMove"
        />

        <!-- Blue answer arrow / highlights -->
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

        <!-- Wrong-move square tint (no arrow) -->
        <svg
          v-if="wrongGeom"
          class="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <rect
            :x="wrongGeom.from.x" :y="wrongGeom.from.y"
            :width="wrongGeom.from.width" :height="wrongGeom.from.height"
            fill="#dc2626" opacity="0.18"
          />
          <rect
            :x="wrongGeom.to.x" :y="wrongGeom.to.y"
            :width="wrongGeom.to.width" :height="wrongGeom.to.height"
            fill="#dc2626" opacity="0.32"
          />
        </svg>

        <!-- Corner badges: ✗ wrong / ✓ correct -->
        <div
          v-if="wrongBadge"
          class="pointer-events-none absolute z-10 flex items-center justify-center rounded-full bg-danger text-danger-fg shadow-button"
          :style="{ left: `${wrongBadge.left}px`, top: `${wrongBadge.top}px`, width: `${wrongBadge.size}px`, height: `${wrongBadge.size}px` }"
          aria-hidden="true"
        ><X :size="wrongBadge.size * 0.62" :stroke-width="3" /></div>
        <div
          v-if="correctBadge"
          class="pointer-events-none absolute z-10 flex items-center justify-center rounded-full bg-success text-success-fg shadow-button"
          :style="{ left: `${correctBadge.left}px`, top: `${correctBadge.top}px`, width: `${correctBadge.size}px`, height: `${correctBadge.size}px` }"
          aria-hidden="true"
        ><Check :size="correctBadge.size * 0.62" :stroke-width="3" /></div>
        </div>
        </div>
      </div>

      <!-- Coach bubble:暖色對話框浮在 jade。氣泡自身 flex column——上半教練文字可捲、下半動作列釘在
           氣泡底（手機/桌機統一，按鈕永遠可見、不被捲走）。底部 safe-area 留白防 iPhone 圓角吃按鈕。 -->
      <div class="flex min-h-0 flex-1 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-1 lg:w-104 lg:flex-none lg:px-0 lg:pb-0 lg:pt-0" :class="finished ? 'items-center' : 'items-start'">
        <div
          class="flex max-h-full min-h-0 min-w-0 flex-1 flex-col rounded-[18px] bg-surface-card shadow-[0_6px_20px_rgba(8,24,18,0.28)]"
        >
          <!-- 釘頂 header：頭像 + Neve + 步數，捲動時永遠可見（完成頁不需要，收起） -->
          <div v-if="!finished" class="flex shrink-0 items-center justify-between gap-2 px-4 pb-2.5 pt-3.5 font-sans text-xs font-medium text-ink-muted">
            <span class="flex items-center gap-2">
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-num text-[11px] leading-none text-primary-fg"
                aria-hidden="true"
              ><span class="block translate-y-px">{{ COACH.name.charAt(0) }}</span></span>
              <span class="text-sm text-ink">{{ COACH.name }}</span>
            </span>
            <span class="shrink-0 font-num text-ink-faint">{{ stepIndex + 1 }} / {{ lesson.steps.length }}</span>
          </div>
          <!-- 可捲教練內容（捲軸隱藏，靠 footer 上緣漸層暗示） -->
          <div ref="coachScroll" class="coach-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4" :class="{ 'flex flex-col justify-center': finished }">
            <!-- Scenario (step 0 only) -->
            <p
              v-if="stepIndex === 0 && lesson.scenario && !finished"
              class="mb-3 border-l-2 border-primary/40 pl-3 font-lesson text-[15px] leading-relaxed text-ink-muted"
            >{{ lesson.scenario }}</p>

            <!-- Step narration：打字機逐字出現，點擊立即完成。完成後棋盤與敘述都收起，只留收尾卡。 -->
            <p
              v-if="!finished"
              class="cursor-default font-sans text-base leading-loose text-ink"
              @click="skipTypewriter"
            >{{ displayedText }}</p>

            <!-- Wrong-move feedback (按鈕在下方釘底動作列) -->
            <Alert v-if="wrongMove" variant="danger" class="mt-3">
              <AlertTitle class="text-danger">這一步不是答案</AlertTitle>
              <AlertDescription v-if="currentStep?.hint" class="text-ink">{{ currentStep.hint }}</AlertDescription>
              <p v-if="answerRevealed" class="mt-2 text-sm text-hint">
                答案箭頭已畫在棋盤上——點「重試」後照著走。
              </p>
            </Alert>

            <!-- Hint text -->
            <div v-else-if="isInteractive && !solved" class="mt-3">
              <p class="mb-2 font-sans text-sm text-ink-muted">輪到你了——在棋盤上走一步。</p>
              <Alert v-if="hintShown" variant="hint">
                <AlertDescription class="text-hint-fg">{{ currentStep?.hint }}</AlertDescription>
                <p v-if="answerRevealed" class="mt-2 text-sm text-hint">答案已畫在棋盤上——照著箭頭走走看。</p>
              </Alert>
            </div>

            <!-- Success（完成後由收尾卡接手，不再並存） -->
            <Alert v-if="solved && currentStep?.successText && !finished" variant="success" class="mt-3">
              <AlertDescription class="text-success">{{ currentStep.successText }}</AlertDescription>
            </Alert>

            <!-- 課末收尾：證書感設計——章節勳章 + 金線框 + 課程名稱 + 重點摘要 + 練習邀請 -->
            <div
              v-if="finished"
              data-testid="lesson-completion"
              class="lesson-complete flex flex-col items-center py-5 text-center"
            >
              <!-- M2: 章節脈絡小標 -->
              <p class="mb-4 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                第{{ TIER_NUM[lesson.tier] }}章 · {{ LESSON_TIER_LABELS[lesson.tier] }}
              </p>

              <!-- H3: 金線分隔（上） -->
              <div class="mb-5 flex w-full items-center gap-2 px-1" aria-hidden="true">
                <div class="h-px flex-1 bg-linear-to-r from-transparent to-gold/40" />
                <span class="h-[5px] w-[5px] rotate-45 bg-gold/55" />
                <div class="h-px flex-1 bg-linear-to-l from-transparent to-gold/40" />
              </div>

              <!-- H1: 金邊勳章（章節棋子 + 綠色完成角標） -->
              <div class="relative">
                <div class="rounded-full shadow-[0_0_0_5px_rgba(248,181,0,0.18),0_0_28px_rgba(248,181,0,0.2)]">
                  <ChapterBadge :piece="TIER_PIECE[lesson.tier]" :size="96" />
                </div>
                <span
                  class="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-success text-success-fg shadow-[0_2px_8px_rgba(0,0,0,0.18)] ring-2 ring-surface-card"
                  aria-hidden="true"
                ><Check :size="15" :stroke-width="2.5" /></span>
              </div>

              <!-- H2: 認定標語 + 課程名稱 -->
              <p class="mt-3 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-gold-dark">
                · 課程完成 ·
              </p>
              <p class="mt-1 font-display text-xl font-bold text-ink">{{ lesson.title }}</p>

              <!-- H3: 金線分隔（下） -->
              <div class="my-4 flex w-full items-center gap-2 px-1" aria-hidden="true">
                <div class="h-px flex-1 bg-linear-to-r from-transparent to-gold/40" />
                <span class="h-[5px] w-[5px] rotate-45 bg-gold/55" />
                <div class="h-px flex-1 bg-linear-to-l from-transparent to-gold/40" />
              </div>

              <!-- L1: 本課重點（置中純文字，不加框） -->
              <p v-if="lesson.summary" class="w-full px-2 text-center font-lesson text-[15px] leading-relaxed text-ink-muted">{{ lesson.summary }}</p>

            </div>
          </div>

          <!-- 動作列：釘在氣泡底，永遠可見。上緣分隔線 + 漸層（暗示上方教練文字可捲）。 -->
          <div class="relative shrink-0 border-t border-line-subtle px-4 py-3 before:pointer-events-none before:absolute before:inset-x-0 before:-top-5 before:h-5 before:bg-linear-to-t before:from-surface-card before:to-transparent">
            <div class="flex items-center gap-2">
              <!-- 課末收尾：金色主按鈕獨佔一行，次要動作改 ghost 文字連結 -->
              <template v-if="finished">
                <div class="flex w-full gap-2">
                  <Button
                    v-if="nextLesson"
                    variant="secondary"
                    class="flex-1 justify-center text-sm"
                    data-testid="lesson-completion-return"
                    @click="router.push(backTo)"
                  >{{ fromConcept ? '回概念地圖' : '回課程列表' }}</Button>
                  <Button
                    variant="gold"
                    class="flex-1 justify-center text-sm"
                    data-testid="lesson-completion-next"
                    @click="nextLesson ? goToNextLesson() : router.push(backTo)"
                  >{{ nextLesson ? '繼續下一課' : (fromConcept ? '回概念地圖' : '回課程列表') }} <ArrowRight :size="16" :stroke-width="1.8" /></Button>
                </div>
              </template>

              <!-- 走錯：只留 揭曉答案 + 重試（重試靠右為主行動），不顯示上一步／下一步 -->
              <template v-else-if="wrongMove">
                <div class="flex-1" />
                <Button v-if="!answerRevealed" variant="secondary" size="sm" class="text-sm" @click="answerRevealed = true">揭曉答案</Button>
                <Button variant="danger" size="sm" class="text-sm" @click="retry"><RotateCw :size="15" :stroke-width="1.8" /> 重試</Button>
              </template>

              <template v-else>
                <!-- 互動提示狀態：提示按下後「替換」成揭曉答案（非並存） -->
                <template v-if="isInteractive && !solved">
                  <Button
                    v-if="!hintShown"
                    variant="outline"
                    size="sm"
                    class="border-hint-ring bg-hint-light text-sm text-hint-fg hover:bg-hint-ring"
                    :class="{ 'lightbulb-glow': lightbulbGlowing }"
                    @click="hintShown = true"
                  >
                    <Lightbulb :size="15" :stroke-width="1.8" /> 提示
                  </Button>
                  <Button
                    v-else-if="!answerRevealed"
                    size="sm"
                    class="bg-hint-ring text-sm text-hint-fg hover:bg-hint"
                    @click="answerRevealed = true"
                  >揭曉答案</Button>
                </template>

                <div class="flex-1" />

                <!-- prev / next（最後一步走完即進收尾分支，這裡不再有「完成課程」） -->
                <Button
                  v-if="stepIndex > 0"
                  variant="secondary"
                  size="sm" class="text-sm"
                  @click="prev"
                ><ArrowLeft :size="15" :stroke-width="1.8" /> 上一步</Button>
                <Button
                  v-if="!isLastStep"
                  size="sm" class="text-sm"
                  variant="default"
                  :disabled="!canAdvance"
                  @click="next"
                >下一步 <ArrowRight :size="16" :stroke-width="1.8" /></Button>
                <Button
                  v-else
                  size="sm" class="text-sm"
                  variant="gold"
                  :disabled="!canAdvance"
                  @click="complete"
                ><Check :size="16" :stroke-width="1.8" /> 完成課程</Button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* vue3-chessboard 的 .main-wrap 被釘死 700px（撐爆容器、桌機棋盤過大溢出）。強制它跟著外層寬度走，
   底下的 main-board(aspect)→cg-board 才會一起 follow 成正方（桌機棋盤過大修正）。 */
.board-fit :deep(.main-wrap) {
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
}
/* Coach bubble scrolls when narration is long; hide the scrollbar — the gradient fade is the cue. */
.coach-scroll {
  scrollbar-width: none;
}
.coach-scroll::-webkit-scrollbar {
  display: none;
}
/* 完成收尾卡入場：opacity + translateY + scale 彈出（spring 曲線，勳章有「落定感」）。 */
@keyframes lesson-complete-in {
  from { opacity: 0; transform: translateY(14px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.lesson-complete {
  animation: lesson-complete-in 0.38s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@media (prefers-reduced-motion: reduce) {
  .lesson-complete {
    animation: none;
  }
}
@keyframes lightbulb-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(201, 135, 46, 0.0); }
  50%      { box-shadow: 0 0 0 4px rgba(201, 135, 46, 0.45); }
}
.lightbulb-glow {
  animation: lightbulb-glow 1.1s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .lightbulb-glow {
    animation: none;
    box-shadow: 0 0 0 3px rgba(201, 135, 46, 0.5);
  }
}
</style>
