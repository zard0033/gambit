<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LessonPlayer from '@/components/lesson/LessonPlayer.vue'
import DeepeningWrapUp from '@/components/lesson/DeepeningWrapUp.vue'
import { getConceptDeepening } from '@/data/concept-deepening'
import { getRecognitionSet } from '@/data/concept-deepening/recognition'
import { useConceptProgressStore } from '@/stores/concept-progress'

const route = useRoute()
const router = useRouter()
const conceptProgress = useConceptProgressStore()

const deepening = getConceptDeepening(route.params.conceptId as string)
// fork's third step is a Recognition Gate (spec §15, now its own route/view — RecognitionFieldView,
// 2026-08-03 遷移); concepts without one keep the single-board silent gate inside LessonPlayer (their
// variant still carries all 3 steps).
const hasJudgementField = deepening ? !!getRecognitionSet(deepening.conceptId) : false

// Unknown concept → back to the map. No lock to bypass: deepening is always open (Calm rule).
if (!deepening) router.replace('/learn/concepts')

// Wrap-up popup (A3, lesson-only concepts only — concepts with a judgement field wrap up over there
// instead): the board stays behind; this overlay crystallizes the essence and — only when the player
// got through without any aid — Neve quietly acknowledges that they saw it themselves.
const showWrapUp = ref(false)

function onLessonDone(unaided: boolean): void {
  if (!deepening) return
  if (hasJudgementField) {
    // lessonUnaided rides the URL — no in-memory state survives this navigation (2026-08-03 判斷場
    // 搬遷). replace, not push: pre-migration this was an in-place phase switch with no new history
    // entry — Back left the whole deepening flow rather than restarting the lesson from step 0.
    const query: Record<string, string> = { unaided: unaided ? '1' : '0' }
    router.replace({ name: 'concept-judge', params: { conceptId: deepening.conceptId }, query })
    return
  }
  finishDeepening(unaided)
}

function finishDeepening(unaided: boolean): void {
  if (deepening) {
    conceptProgress.markDeepened(deepening.conceptId)
    // 無求助通關的事實仍然記著（`deepenedUnaided`）。棋誌下架後暫時沒有消費端——
    // 它落在「認知遷移」軸上，留給日後的訊號用，不隨棋誌一起刪。
    if (unaided) conceptProgress.markDeepenedUnaided(deepening.conceptId)
  }
  showWrapUp.value = true
}

function closeWrapUp(): void {
  router.push('/learn/concepts')
}
</script>

<template>
  <div>
    <LessonPlayer
      v-if="deepening"
      :steps="deepening.variants[0]"
      :title="deepening.title"
      player-color="white"
      :scenario="deepening.intro"
      back-to="/learn/concepts"
      back-label="返回概念"
      completion-mode="overlay"
      @complete="onLessonDone"
    />

    <!-- 只有無判斷場的概念才在這裡收尾——有判斷場的概念改在 RecognitionFieldView 收尾。 -->
    <DeepeningWrapUp
      v-if="showWrapUp && deepening"
      :title="deepening.title"
      :essence="deepening.essence"
      @close="closeWrapUp"
    />
  </div>
</template>
