<script setup lang="ts">
/**
 * 棋憶 Dashboard (story-007) — the calm landing view. DOM order (GDD Rule 3 / AC-1):
 * Neve line → shape-of-game eval view (or zero-state). NO verdict/score/"weakest" node is
 * rendered (AC-1 asserts its absence). Progressive pre-COMPLETE (EC-3): selection runs only
 * at COMPLETE, so a card never appears then vanishes.
 * 重點步 list (MomentList) was removed per user feedback; drill-in is now two complementary
 * doors — the eval chart (self-serve: tap any point on the curve to jump replay there) and
 * MomentSlideshowDoor (Neve-guided: single quiet card → mistake slideshow via openMoment(0);
 * 2026-07-11 拍板,取代整排清單而非恢復它).
 */
import { computed } from 'vue'
import { useMemoryStore } from '@/stores/memory'
import { renderNeveLine } from '@/modules/memory/templates'
import { MEMORY_ANALYZING_COPY } from '@/config/memory-config'
import { useMemoryContext } from './memory-context'
import NeveCard from './NeveCard.vue'
import RecognitionSignpost from './RecognitionSignpost.vue'
import EvalShapeChart from './EvalShapeChart.vue'
import MomentSlideshowDoor from './MomentSlideshowDoor.vue'
import EmptyMemory from './EmptyMemory.vue'

const ctx = useMemoryContext()
const memory = useMemoryStore()

const neveText = computed(() => renderNeveLine(memory.neveLine()))
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

    <!-- 1. Neve — opening voice at COMPLETE; present-tense "looking with you" while analyzing.
         One card throughout (it transforms, never vanishes — EC-3). -->
    <NeveCard :text="isComplete ? neveText : MEMORY_ANALYZING_COPY" />

    <!-- COMPLETE: reveal the game-specific surfaces together — nothing tappable-incomplete (EC-3) -->
    <template v-if="isComplete">
      <!-- 2. Shape-of-game eval view — click any point on the curve to jump replay there -->
      <EvalShapeChart
        :series="ctx.series.value"
        :moments="ctx.moments.value"
        :anchor-ply="ctx.anchorPly.value"
        :orientation="ctx.orientation.value"
        @open="(ply) => ctx.openReplay(ply)"
      />
      <!-- 3. Neve 陪看門:有重點步才現身,單一安靜入口進失誤 slideshow -->
      <MomentSlideshowDoor v-if="ctx.moments.value.length > 0" @open="ctx.openMoment(0)" />
      <!-- 4. Zero-state (steady game, no key moments) -->
      <EmptyMemory v-if="ctx.moments.value.length === 0" />
    </template>

    <!-- ANALYZING: Neve's words carry the "still looking" cue above; here just a quiet progress bar
         (she is still, the reading progresses) + a skeleton silhouette of the chart + moments to come.
         Chart/moments stay hidden so the user can't tap into a half-analyzed replay. -->
    <div v-else class="flex flex-col gap-3" aria-live="polite" aria-busy="true">
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
