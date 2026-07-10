<script lang="ts">
// Pure swipe-direction decision (extracted for unit testing, D2b). Horizontal displacement >48px
// and greater than the vertical component counts as a swipe; dx<0 (finger moves left) → 'next',
// dx>0 → 'prev'. Mirrors onBubbleTouchEnd's threshold exactly.
export function shouldSwipe(dx: number, dy: number): 'prev' | 'next' | null {
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'next' : 'prev'
  return null
}
</script>

<script setup lang="ts">
/**
 * Recognition Gate — the deepening's third step as a judgement field (quick-specs/
 * concept-deepening-page.md §15). A silent carousel of full-size boards: the player decides per
 * board whether the concept's tactic is present (play it) or absent (press「這裡沒有」), with no
 * on-board hint. Trains recognition, not execution.
 *
 * Verdict state machine (§15.4):
 *   real  → play expectedMove = correct | press「沒有」= missed (recorded, never named)
 *   decoy → press「沒有」= correct       | play temptMove = trap (demo refutation, must re-judge)
 * Pass = every board 'correct'. When a round settles with a missed real board, Neve surfaces
 * 「還有一手在等你」(without naming which) and reopens the missed board. `complete(unaided)` fires
 * once all boards are correct; unaided = no miss, no trap, no aid the whole way (drives epiphany).
 */
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, ChevronLeft, ChevronRight, Ban } from 'lucide-vue-next'
import RecognitionBoard from '@/components/lesson/RecognitionBoard.vue'
import { Button } from '@/components/ui/button'
import { COACH } from '@/types/lesson'
import { NeveAvatar } from '@/components/ui/gambit'
import type { RecognitionSet } from '@/types/recognition'

const props = withDefaults(
  defineProps<{
    set: RecognitionSet
    title: string
    backTo: string
    backLabel: string
    playerColor?: 'white' | 'black'
  }>(),
  { playerColor: 'white' },
)

const emit = defineEmits<{ complete: [unaided: boolean] }>()

const router = useRouter()

type Verdict = 'pending' | 'correct' | 'missed' | 'trap'
const boards = computed(() => props.set.boards)
const idx = ref(0)
// Initialised once. Load-bearing invariant: this component is remounted per conceptId (RouterView
// :key=route.fullPath), so props.set never mutates under a live instance — verdicts/idx/everMisjudged
// need no re-sync. A future router refactor dropping that key must add watch(() => props.set, reset).
const verdicts = reactive<Verdict[]>(boards.value.map(() => 'pending'))
// Any miss or trap anywhere → the run wasn't unaided (no epiphany). Sticky once set.
const everMisjudged = ref(false)
const showMissedHint = ref(false)
let _completed = false

const current = computed(() => boards.value[idx.value])
const currentVerdict = computed(() => verdicts[idx.value])

// Neve's per-board feedback, shown once the current board is judged (pending = no feedback).
const feedback = computed<string | null>(() => {
  const b = current.value
  const v = currentVerdict.value
  if (v === 'correct') return b.kind === 'real' ? b.successText : b.emptyText
  if (v === 'trap' && b.kind === 'decoy') return b.trapText
  return null
})

// The board's「這裡沒有」declaration lives in Neve's bubble — the gate forwards it to the active
// board's exposed declareEmpty(). Boards are collected by index via a function ref.
const boardRefs = ref<{ declareEmpty: () => void }[]>([])
function setBoardRef(el: unknown, i: number): void {
  if (el) boardRefs.value[i] = el as { declareEmpty: () => void }
}
function declareCurrentEmpty(): void {
  boardRefs.value[idx.value]?.declareEmpty()
}

// Bubble hierarchy (Eason): Neve's question is narration (folds into the teaching text, not blown
// up); the player's colour is the ACT-ON state — that's the emphasised chip. How-to is the quiet tail.
const turnColor = computed(() => (props.playerColor === 'black' ? '黑方' : '白方'))

function onJudge(i: number, result: 'correct' | 'missed' | 'trap'): void {
  showMissedHint.value = false // clear any prior「還有一手」before re-evaluating the round
  if (result === 'correct') {
    verdicts[i] = 'correct'
  } else if (result === 'missed') {
    verdicts[i] = 'missed'
    everMisjudged.value = true
  } else {
    verdicts[i] = 'trap'
    everMisjudged.value = true
  }
  checkRound()
}

function checkRound(): void {
  // Explicit `: boolean` opts out of TS 5.5 inferred type predicates — otherwise `every` narrows
  // `verdicts` to ('correct'|'missed')[] and the reopen-as-pending write below fails to typecheck.
  if (verdicts.every((v): boolean => v === 'correct')) {
    finish()
    return
  }
  // Round "settles" only when nothing is pending or mid-trap. A missed real board then surfaces
  // 「還有一手」and reopens — without naming which (Eason: choice A).
  const settled = verdicts.every((v): boolean => v === 'correct' || v === 'missed')
  if (settled && verdicts.some((v) => v === 'missed')) {
    showMissedHint.value = true
    verdicts.forEach((v, k) => { if (v === 'missed') verdicts[k] = 'pending' })
    // Slide the player back to the first reopened board so the retry path is obvious.
    const first = verdicts.findIndex((v) => v === 'pending')
    if (first >= 0) idx.value = first
  }
}

function finish(): void {
  if (_completed) return
  _completed = true
  emit('complete', !everMisjudged.value)
}

function go(delta: number): void {
  const next = idx.value + delta
  if (next >= 0 && next < boards.value.length) idx.value = next
}

// 氣泡卡上的左右滑切盤（M2）：手勢區放氣泡、不放棋盤——棋盤的 pointer 事件歸 chessground
// （tap-to-move / drag）。水平位移 >48px 且大於垂直分量才算滑，按鈕點擊不受影響；chevron 保留。
let touchX = 0
let touchY = 0
function onBubbleTouchStart(e: TouchEvent): void {
  touchX = e.touches[0].clientX
  touchY = e.touches[0].clientY
}
function onBubbleTouchEnd(e: TouchEvent): void {
  const dx = e.changedTouches[0].clientX - touchX
  const dy = e.changedTouches[0].clientY - touchY
  const dir = shouldSwipe(dx, dy)
  if (dir === 'next') go(1)
  else if (dir === 'prev') go(-1)
}

// intro is a one-time entrance card (redesign H2): it carries the "this time it's different"
// context once, so the bubble stays lean — just the current question + the action region.
const showIntro = ref(true)
</script>

<template>
  <div class="flex h-dvh flex-col bg-surface-deep text-ink-on-deep">
    <!-- Header: back + title -->
    <header class="flex shrink-0 items-center gap-3 px-4 pb-2 pt-[calc(0.625rem+env(safe-area-inset-top))]">
      <button
        type="button"
        :aria-label="backLabel"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-white/8 text-ink-on-deep transition-colors hover:bg-white/[0.14] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold active:scale-95"
        @click="router.push(backTo)"
      ><ArrowLeft :size="20" :stroke-width="1.8" /></button>
      <h1 class="flex-1 truncate font-display text-lg font-bold text-ink-on-deep" tabindex="-1">{{ title }}</h1>
    </header>

    <div class="flex min-h-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-5xl">
      <!-- Carousel: 3 full-size boards; only the active takes input. Board size never changes —
           only the track slides (避開醜轉場). -->
      <div class="w-full shrink-0 overflow-hidden pt-1">
        <div
          class="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
          :style="{ transform: `translateX(-${idx * 100}%)` }"
        >
          <div v-for="(b, i) in boards" :key="i" class="flex w-full shrink-0 justify-center" :inert="i !== idx">
            <RecognitionBoard
              :ref="(el) => setBoardRef(el, i)"
              :board="b"
              :player-color="playerColor"
              :active="i === idx"
              :locked="verdicts[i] === 'correct'"
              @judge="onJudge(i, $event)"
            />
          </div>
        </div>
      </div>

      <!-- Neve bubble — 頂列(Neve+導航) + 主問(執色併提問一句) + 小字引導 + 鈕。內容高度、不撐滿
           (Eason: 別拉太大)。intro 在進場過場，不在這裡。 -->
      <div class="shrink-0 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2">
        <div
          class="w-full rounded-[18px] bg-surface-card shadow-[0_6px_20px_rgba(8,24,18,0.28)]"
          @touchstart.passive="onBubbleTouchStart"
          @touchend.passive="onBubbleTouchEnd"
        >
          <!-- 頂列：Neve 頭像+名 ‖ carousel 導航（進度點 + 左右切換）。M4：導航併進頂列。 -->
          <div class="flex items-center justify-between gap-2 px-4 pb-2 pt-3.5">
            <span class="flex items-center gap-2">
              <NeveAvatar size="md" surface="cream" />
              <span class="font-sans text-sm text-ink">{{ COACH.name }}</span>
            </span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                aria-label="上一盤"
                class="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
                :disabled="idx === 0"
                @click="go(-1)"
              ><ChevronLeft :size="18" :stroke-width="1.8" /></button>
              <div class="flex items-center gap-1.5" aria-hidden="true">
                <span
                  v-for="(v, i) in verdicts"
                  :key="i"
                  class="h-2 w-2 rounded-full transition-all"
                  :class="[
                    v === 'pending' ? 'bg-ink/15' : 'bg-primary',
                    i === idx ? 'ring-2 ring-primary/40 ring-offset-1 ring-offset-surface-card' : '',
                  ]"
                />
              </div>
              <button
                type="button"
                aria-label="下一盤"
                class="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
                :disabled="idx === boards.length - 1"
                @click="go(1)"
              ><ChevronRight :size="18" :stroke-width="1.8" /></button>
            </div>
          </div>

          <div class="px-4 pb-4">
            <!-- 常駐 live region：aria-live 只在「既存區域的內容變化」時播報，掛載即帶內容的
                 v-if 元素常被 VoiceOver/NVDA 靜默跳過——所以視覺元素不掛 aria-live，改由這個
                 永在 DOM 的 sr-only 容器換字（同 chess-board 鍵盤播報的 pattern）。 -->
            <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {{ showMissedHint ? set.missedHint : (currentVerdict !== 'pending' ? feedback : '') }}
            </div>
            <!-- 漏看提示（重判時，不點破哪盤）。 -->
            <p
              v-if="showMissedHint"
              data-testid="recognition-missed"
              class="mb-3 rounded-[10px] bg-hint-light px-3 py-2 font-lesson text-[14px] leading-relaxed text-hint-fg"
            >{{ set.missedHint }}</p>

            <!-- 未判定：主問（執色併提問一句）＋小字引導。 -->
            <template v-if="currentVerdict === 'pending'">
              <p data-testid="recognition-prompt" class="font-lesson text-[16px] leading-relaxed text-ink">
                你執<span class="font-bold">{{ turnColor }}</span>，{{ set.prompt }}
              </p>
              <p class="mt-1 font-sans text-[13px] leading-relaxed text-ink-faint">有的話走出來，沒有的話就按「這裡沒有」。</p>
            </template>

            <!-- 已判定：Neve 回饋（trap 仍可重判、見下方鈕）。播報走上方常駐 live region。 -->
            <p
              v-else
              data-testid="recognition-feedback"
              class="font-lesson text-[16px] leading-relaxed text-ink"
            >{{ feedback }}</p>

            <!-- 「這裡沒有」：未判對（pending/trap/missed）才在。 -->
            <Button
              v-if="currentVerdict !== 'correct'"
              variant="outline"
              class="mt-3.5 h-11 w-full justify-center gap-2 text-sm transition active:scale-[0.98]"
              data-testid="recognition-empty"
              @click="declareCurrentEmpty"
            ><Ban :size="16" :stroke-width="1.8" /> 這裡沒有</Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 進場一次性過場（H2）：判斷場開場白，承載「這次不一樣」脈絡，點一下開始；之後氣泡保持精簡。 -->
    <Transition name="intro-fade">
      <div
        v-if="showIntro"
        class="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(8,24,18,0.86)] px-8"
        @click="showIntro = false"
      >
        <div class="max-w-sm text-center">
          <p class="font-lesson text-[17px] leading-loose text-ink-on-deep">{{ set.intro }}</p>
          <Button variant="gold" class="mt-7" @click.stop="showIntro = false">換我判斷 →</Button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 進場過場淡入淡出（只動 opacity）；尊重 reduced-motion。 */
.intro-fade-enter-active,
.intro-fade-leave-active {
  transition: opacity 0.3s ease;
}
.intro-fade-enter-from,
.intro-fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .intro-fade-enter-active,
  .intro-fade-leave-active {
    transition: none;
  }
}
</style>
