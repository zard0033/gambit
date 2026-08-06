<script setup lang="ts">
/**
 * 棋憶 Dashboard (story-007, D4-slimmed) — the calm landing view. NO verdict/score/"weakest" node
 * is rendered (AC-1 asserts its absence). Progressive pre-COMPLETE (EC-3): selection runs only
 * at COMPLETE, so a card never appears then vanishes. D4 (2026-08) retired the slideshow/replay
 * drill-in and the cross-game Neve line — lichess already does the replay-as-narrative job; the
 * only thing on the cognitive-transfer path is the missed-mate signpost below.
 */
import { computed } from 'vue'
import { MEMORY_ANALYZING_COPY } from '@/config/memory-config'
import { useMemoryContext } from './memory-context'
import RecognitionSignpost from './RecognitionSignpost.vue'
import EmptyMemory from './EmptyMemory.vue'
import KeyMomentsCard from './KeyMomentsCard.vue'
import GameExportCard from './GameExportCard.vue'

const ctx = useMemoryContext()

const isComplete = computed(() => ctx.review.phase.value === 'COMPLETE')
// Two-pass progress (preview then deep): preview fills every slot before deep begins, so a non-null
// count would hit 100% after preview and freeze through the longer deep pass. Count both passes.
const analysisProgress = computed(() => {
  const n = ctx.review.totalPositions.value
  if (n === 0) return 0
  const done = (ctx.review.progressPass.value === 'deep' ? n : 0) + ctx.review.progressCount.value
  return Math.round((done / (n * 2)) * 100)
})
</script>

<template>
  <div class="flex w-full max-w-md flex-col gap-4">
    <!-- 0. 判斷場路標：只有存在「你自己漏看的將殺」時才現身，邀你回到那個局面重新認一次。 -->
    <RecognitionSignpost />

    <!-- COMPLETE: reveal the game-specific surfaces together — nothing tappable-incomplete (EC-3) -->
    <template v-if="isComplete">
      <!-- 1. Zero-state (steady game, no key moments) -->
      <EmptyMemory v-if="ctx.moments.value.length === 0" />
      <!-- 2. 這盤值得回頭看的幾手:共用棋盤 + 清單(F1 moments 的畫面落點)。 -->
      <KeyMomentsCard v-else />
      <!-- 3. 帶走這盤:複製成可貼給 AI 的內容(ADR-0010)。 -->
      <GameExportCard
        v-if="ctx.game.value"
        :key="ctx.game.value.completedAt"
        :game="ctx.game.value"
        :moments="ctx.moments.value"
        :opening="ctx.opening.value"
      />
    </template>

    <!-- ANALYZING: quiet progress bar (she is still, the reading progresses) + a skeleton silhouette
         of the surfaces to come. -->
    <div v-else class="flex flex-col gap-3" aria-live="polite" aria-busy="true">
      <p class="font-lesson text-[15px] leading-[1.8] text-ink-muted">{{ MEMORY_ANALYZING_COPY }}</p>
      <div class="flex items-center gap-3">
        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
          <div
            class="h-full rounded-full bg-primary transition-[width] duration-300"
            :style="{ width: `${analysisProgress}%` }"
          />
        </div>
        <span class="font-num text-xs tabular-nums text-ink-muted">{{ analysisProgress }}%</span>
      </div>
      <div class="h-32 animate-pulse rounded-lg bg-surface-hover" />
      <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-lg bg-surface-hover" />
    </div>
  </div>
</template>
