<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LessonPlayer from '@/components/lesson/LessonPlayer.vue'
import RecognitionGate from '@/components/lesson/RecognitionGate.vue'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-vue-next'
import { getConceptDeepening } from '@/data/concept-deepening'
import { getRecognitionSet } from '@/data/concept-deepening/recognition'
import { useConceptProgressStore } from '@/stores/concept-progress'
import { useJournalStore } from '@/stores/journal'

const route = useRoute()
const router = useRouter()
const conceptProgress = useConceptProgressStore()
const journal = useJournalStore()

const deepening = getConceptDeepening(route.params.conceptId as string)
// fork's third step is a Recognition Gate (spec §15); concepts without one keep the single-board
// silent gate inside LessonPlayer (their variant still carries all 3 steps).
const recognitionSet = deepening ? getRecognitionSet(deepening.conceptId) : undefined

// Unknown concept → back to the map. No lock to bypass: deepening is always open (Calm rule).
if (!deepening) router.replace('/learn/concepts')

// Two-phase for concepts with a gate: LessonPlayer (step0/1) → RecognitionGate. unaided requires
// BOTH phases clean — no aid in the lesson, no miss/trap in the gate — to fire the epiphany pen.
const phase = ref<'lesson' | 'recognition'>('lesson')
let lessonUnaided = false

// Deterministic variant selection (spec §10 MINIMAL): no random/LLM, only the completion count.
// First visit = variant 0 (clean board); each revisit advances to the next variant (mod pool size).
// deepenedCount is localStorage-only; clearing cache resets to 0 (intentional, affects feel only).
const variantIndex = computed(() => {
  if (!deepening) return 0
  const count = conceptProgress.deepenedCount[deepening.conceptId] ?? 0
  return count % deepening.variants.length
})

// Wrap-up popup (A3): the board stays behind; this overlay crystallizes the essence and — only when
// the player got through without any aid — Neve quietly acknowledges that they saw it themselves.
const showWrapUp = ref(false)
const wrapOverlay = ref<HTMLElement | null>(null)

function onLessonDone(unaided: boolean): void {
  if (recognitionSet) {
    lessonUnaided = unaided
    phase.value = 'recognition'
  } else {
    finishDeepening(unaided)
  }
}

function onRecognitionDone(gateUnaided: boolean): void {
  finishDeepening(lessonUnaided && gateUnaided)
}

function finishDeepening(unaided: boolean): void {
  if (deepening) {
    conceptProgress.markDeepened(deepening.conceptId)
    // Got through unaided → Neve quietly logs "你自己看出來的" in the journal. The recognition lives
    // there, not as an on-screen self-congratulation (Neve stays calm).
    if (unaided) {
      conceptProgress.markDeepenedUnaided(deepening.conceptId)
      void journal.evaluate()
    }
  }
  showWrapUp.value = true
  // a11y: move focus into the dialog (aria-modal needs focus inside; Esc / scrim-click then dismiss).
  nextTick(() => wrapOverlay.value?.focus())
}
</script>

<template>
  <LessonPlayer
    v-if="deepening && phase === 'lesson'"
    :steps="deepening.variants[variantIndex]"
    :title="deepening.title"
    player-color="white"
    :scenario="deepening.intro"
    back-to="/learn/concepts"
    back-label="返回概念"
    completion-mode="overlay"
    @complete="onLessonDone"
  />

  <!-- 第三步＝判斷場（fork）：前兩步放手後，3 盤沉默判斷有沒有捉雙（spec §15）。 -->
  <RecognitionGate
    v-else-if="deepening && phase === 'recognition' && recognitionSet"
    :set="recognitionSet"
    :title="deepening.title"
    back-to="/learn/concepts"
    back-label="返回概念"
    @complete="onRecognitionDone"
  />

  <!-- 深化收尾彈窗：棋盤留在後面，浮一張「回味精髓」的卡（非整頁切換、非慶祝彩帶）。 -->
  <Transition name="wrap-fade">
    <div
      v-if="showWrapUp && deepening"
      ref="wrapOverlay"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,24,18,0.55)] p-6"
      role="dialog"
      aria-modal="true"
      aria-label="深化完成"
      tabindex="-1"
      @keydown.esc="router.push('/learn/concepts')"
      @click.self="router.push('/learn/concepts')"
    >
      <div
        data-testid="concept-deepen-completion"
        class="wrap-card relative flex w-full max-w-sm flex-col items-center rounded-[18px] bg-surface-card px-6 py-7 text-center shadow-[0_12px_40px_rgba(8,24,18,0.4)]"
      >
        <p class="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">· 深化完成 ·</p>
        <p class="font-display text-xl font-bold text-ink">{{ deepening.title }}</p>

        <div class="my-4 flex w-full items-center gap-2 px-1" aria-hidden="true">
          <div class="h-px flex-1 bg-linear-to-r from-transparent to-gold/40" />
          <span class="h-[5px] w-[5px] rotate-45 bg-gold/55" />
          <div class="h-px flex-1 bg-linear-to-l from-transparent to-gold/40" />
        </div>

        <!-- 精髓：這個戰術濃縮成一句，讓人離開前再回味一次 -->
        <p class="w-full font-lesson text-[16px] leading-relaxed text-ink">{{ deepening.essence }}</p>

        <Button
          variant="gold"
          class="mt-6 w-full justify-center text-sm"
          data-testid="concept-deepen-return"
          @click="router.push('/learn/concepts')"
        >回棋理地圖 <ArrowRight :size="16" :stroke-width="1.8" /></Button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 收尾卡入場：fade + 微升 + scale（落定感），尊重 reduced-motion。 */
.wrap-fade-enter-active { transition: opacity 0.25s ease; }
.wrap-fade-enter-from { opacity: 0; }
.wrap-fade-enter-active .wrap-card {
  animation: wrap-card-in 0.34s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes wrap-card-in {
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .wrap-fade-enter-active, .wrap-fade-enter-active .wrap-card { transition: none; animation: none; }
}
</style>
