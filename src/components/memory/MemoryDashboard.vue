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
</script>

<template>
  <div class="flex w-full max-w-md flex-col gap-4">
    <!-- 1. Neve line (opening voice) -->
    <NeveCard :text="neveText" />

    <!-- 2. Shape-of-game eval view (→ replay) -->
    <EvalShapeChart
      :series="ctx.series.value"
      :moments="ctx.moments.value"
      :anchor-ply="ctx.anchorPly.value"
      @open="(ply) => ctx.openReplay(ply)"
    />

    <!-- 3. Moment list / zero-state / progressive cue -->
    <template v-if="isComplete">
      <MomentList
        v-if="ctx.moments.value.length > 0"
        :moments="ctx.moments.value"
        :fens="ctx.fens.value"
        :moves="moves"
        @open="(i) => ctx.openMoment(i)"
      />
      <EmptyMemory v-else />
    </template>
    <p v-else class="text-center font-sans text-sm text-ink-muted" aria-live="polite">
      還在細看這盤…
    </p>
  </div>
</template>
