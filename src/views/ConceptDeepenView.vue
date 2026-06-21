<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import LessonPlayer from '@/components/lesson/LessonPlayer.vue'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-vue-next'
import { getConceptDeepening } from '@/data/concept-deepening'
import { useConceptProgressStore } from '@/stores/concept-progress'

const route = useRoute()
const router = useRouter()
const conceptProgress = useConceptProgressStore()

const deepening = getConceptDeepening(route.params.conceptId as string)

// Unknown concept → back to the map. No lock to bypass: deepening is always open (Calm rule).
if (!deepening) router.replace('/learn/concepts')

function onComplete(): void {
  if (deepening) conceptProgress.markDeepened(deepening.conceptId)
}
</script>

<template>
  <LessonPlayer
    v-if="deepening"
    :steps="deepening.steps"
    :title="deepening.title"
    player-color="white"
    :scenario="deepening.intro"
    back-to="/learn/concepts"
    back-label="返回概念"
    @complete="onComplete"
  >
    <!-- 深化收尾：不發勳章證書（那是入門課專屬），改 Neve 一句平靜回望 -->
    <template #completion-card>
      <div data-testid="concept-deepen-completion" class="flex w-full flex-col items-center">
        <p class="mb-3 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-gold-dark">
          · 深化完成 ·
        </p>
        <p class="font-display text-xl font-bold text-ink">{{ deepening.title }}</p>

        <div class="my-4 flex w-full items-center gap-2 px-1" aria-hidden="true">
          <div class="h-px flex-1 bg-linear-to-r from-transparent to-gold/40" />
          <span class="h-[5px] w-[5px] rotate-45 bg-gold/55" />
          <div class="h-px flex-1 bg-linear-to-l from-transparent to-gold/40" />
        </div>

        <p class="w-full px-2 text-center font-lesson text-[15px] leading-relaxed text-ink-muted">
          你開始用眼睛看棋，不是背招了。下次對局，這個圖案會自己跳出來。
        </p>
      </div>
    </template>

    <template #completion-actions>
      <div class="flex w-full">
        <Button
          variant="gold"
          class="flex-1 justify-center text-sm"
          data-testid="concept-deepen-return"
          @click="router.push('/learn/concepts')"
        >回概念地圖 <ArrowRight :size="16" :stroke-width="1.8" /></Button>
      </div>
    </template>
  </LessonPlayer>
</template>
