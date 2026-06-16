<script setup lang="ts">
/**
 * Learn-section segmented control. Controlled by the parent pager: the parent supplies the active
 * index and the live pan position (`progress`, 0..1, fractional during a swipe) so the indicator
 * tracks the finger, and `select` is emitted on tap. Route handling lives in the pager (single
 * source of truth) — this component is presentational only.
 */
import { computed } from 'vue'
import { GraduationCap, Compass } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ activeIndex: number; progress?: number }>(), {
  progress: undefined,
})
const emit = defineEmits<{ select: [index: number] }>()

const tabs = [
  { label: '課程', icon: GraduationCap },
  { label: '概念', icon: Compass },
] as const

// Indicator position: live pan progress while swiping (follows the finger), else the active index.
const indicatorPos = computed(() => props.progress ?? props.activeIndex)
</script>

<template>
  <div class="relative flex rounded-full bg-surface-mid p-1">
    <!-- Sliding card indicator: one tab wide, translateX tracks the pan position. -->
    <div
      class="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/2)]"
      :style="{ transform: `translateX(${Math.min(1, Math.max(0, indicatorPos)) * 100}%)` }"
    >
      <div class="h-full rounded-full bg-surface-card shadow-[0_2px_6px_rgba(61,34,16,0.2)] ring-1 ring-black/4" />
    </div>
    <button
      v-for="(t, i) in tabs"
      :key="t.label"
      type="button"
      class="relative z-10 flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full py-2 font-sans text-sm font-bold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
      :class="i === activeIndex ? 'text-primary-dark' : 'text-ink-muted'"
      :aria-current="i === activeIndex ? 'page' : undefined"
      @click="emit('select', i)"
    ><component :is="t.icon" :size="16" :stroke-width="2" aria-hidden="true" />{{ t.label }}</button>
  </div>
</template>
