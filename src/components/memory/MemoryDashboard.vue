<script setup lang="ts">
/**
 * 棋憶 Dashboard (story-007) — the calm landing view. DOM order (GDD Rule 3 / AC-1):
 * Neve line → shape-of-game eval view → moment list (or zero-state). NO verdict/score/"weakest"
 * node is rendered (AC-1 asserts its absence). Progressive pre-COMPLETE (EC-3): selection runs
 * only at COMPLETE, so a card never appears then vanishes.
 */
import { computed } from 'vue'
import { useMemoryStore } from '@/stores/memory'
import { renderNeveLine } from '@/modules/memory/templates'
import { MEMORY_ANALYZING_COPY } from '@/config/memory-config'
import { useMemoryContext } from './memory-context'
import NeveCard from './NeveCard.vue'
import EvalShapeChart from './EvalShapeChart.vue'
import MomentList from './MomentList.vue'
import EmptyMemory from './EmptyMemory.vue'

const ctx = useMemoryContext()
const memory = useMemoryStore()

const neveText = computed(() => renderNeveLine(memory.neveLine()))
const isComplete = computed(() => ctx.review.phase.value === 'COMPLETE')
const moves = computed(() => ctx.game.value?.moves ?? [])
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
    <!-- 1. Neve — opening voice at COMPLETE; present-tense "looking with you" while analyzing.
         One card throughout (it transforms, never vanishes — EC-3). -->
    <NeveCard :text="isComplete ? neveText : MEMORY_ANALYZING_COPY" />

    <!-- COMPLETE: reveal the game-specific surfaces together — nothing tappable-incomplete (EC-3) -->
    <template v-if="isComplete">
      <!-- 2. Shape-of-game eval view (→ replay) -->
      <EvalShapeChart
        :series="ctx.series.value"
        :moments="ctx.moments.value"
        :anchor-ply="ctx.anchorPly.value"
        @open="(ply) => ctx.openReplay(ply)"
      />
      <!-- 3. Moment list / zero-state -->
      <MomentList
        v-if="ctx.moments.value.length > 0"
        :moments="ctx.moments.value"
        :fens="ctx.fens.value"
        :moves="moves"
        @open="(i) => ctx.openMoment(i)"
      />
      <EmptyMemory v-else />
    </template>

    <!-- ANALYZING: Neve's words carry the "still looking" cue above; here just a quiet progress bar
         (she is still, the reading progresses) + a skeleton silhouette of the chart + moments to come.
         Chart/moments stay hidden so the user can't tap into a half-analyzed replay. -->
    <div v-else class="flex flex-col gap-3" aria-live="polite" aria-busy="true">
      <div class="flex items-center gap-3">
        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
          <div
            class="h-full rounded-full bg-primary transition-all duration-300"
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
