<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RecognitionGate from '@/components/lesson/RecognitionGate.vue'
import DeepeningWrapUp from '@/components/lesson/DeepeningWrapUp.vue'
import { getConceptDeepening } from '@/data/concept-deepening'
import { getRecognitionSet } from '@/data/concept-deepening/recognition'
import { buildRecognitionSetFromSources } from '@/modules/learning-loop/recognition-runtime'
import { useConceptProgressStore } from '@/stores/concept-progress'
import { useRecognitionSourceStore } from '@/stores/recognition-source'
import { useJournalStore } from '@/stores/journal'

const route = useRoute()
const router = useRouter()
const conceptProgress = useConceptProgressStore()
const recognitionSource = useRecognitionSourceStore()
const journal = useJournalStore()

const conceptId = route.params.conceptId as string
const deepening = getConceptDeepening(conceptId)

// Whether the lesson phase (ConceptDeepenView) was completed with no aid — the ONE value that must
// cross the route boundary, since no in-memory state survives navigating here (2026-08-03 遷移，
// positioning-v2 前置). Missing/malformed query → treated as aided, never as unaided (silent-miss
// side is the safe default: it can only under-fire the epiphany pen, never phantom-fire it).
// Trust boundary note: this app is single-player, localStorage-backed progress with no cross-user
// stakes — a hand-edited URL can only falsify the player's own training record, same as editing
// localStorage directly already could pre-migration. Not worth a signed/opaque token for that.
const lessonUnaided = route.query.unaided === '1'

// 棋憶 signpost path (?source=recognition): seed the judgement field with the player's OWN missed-mate
// positions instead of the canned set. Same fallback rules as the pre-migration ConceptDeepenView.
const fromRecognitionSource = route.query.source === 'recognition'
const pendingSources = deepening && fromRecognitionSource ? recognitionSource.pendingFor(deepening.conceptId) : []
const runtimeSet = deepening ? buildRecognitionSetFromSources(deepening.conceptId, pendingSources) : undefined
const recognitionSet = runtimeSet ?? (deepening ? getRecognitionSet(deepening.conceptId) : undefined)
// Real-board runs carry the player's colour; canned sets are all white-to-move.
const recognitionPlayerColor = runtimeSet ? pendingSources[0].playerColor : 'white'

// Unknown concept, or this concept has no judgement field at all (deep link / stale link) → back to
// the map. No lock to bypass: deepening is always open (Calm rule).
if (!deepening || !recognitionSet) router.replace('/learn/concepts')

const showWrapUp = ref(false)

function onRecognitionDone(gateUnaided: boolean): void {
  // Real-board run: retire the consumed positions so a solved missed-mate never resurfaces.
  if (runtimeSet) {
    recognitionSource.markConsumed(pendingSources.map((s) => `${s.gameId}:${s.ply}`))
  }
  if (deepening) {
    conceptProgress.markDeepened(deepening.conceptId)
    // unaided requires BOTH phases clean — no aid in the lesson, no miss/trap in the gate — to fire
    // the epiphany pen.
    const unaided = lessonUnaided && gateUnaided
    if (unaided) {
      conceptProgress.markDeepenedUnaided(deepening.conceptId)
      void journal.evaluate()
    }
  }
  showWrapUp.value = true
}

function closeWrapUp(): void {
  // replace, not push: judge is a one-shot terminal page for this concept — leaving it should not
  // leave a history entry a Back-button can return to (the recognitionSource may already be
  // consumed by then, so re-entering would silently show different content than what was judged).
  router.replace('/learn/concepts')
}
</script>

<template>
  <div>
    <!-- 判斷場：前兩步（LessonPlayer）放手後，沉默判斷有沒有捉雙／將殺（spec §15）。棋盤留在後面
         （非整頁切換），故收尾卡出現時本元件仍掛著。 -->
    <RecognitionGate
      v-if="deepening && recognitionSet"
      :set="recognitionSet"
      :title="deepening.title"
      :player-color="recognitionPlayerColor"
      back-to="/learn/concepts"
      back-label="返回概念"
      @complete="onRecognitionDone"
    />

    <DeepeningWrapUp
      v-if="showWrapUp && deepening"
      :title="deepening.title"
      :essence="deepening.essence"
      @close="closeWrapUp"
    />
  </div>
</template>
