<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ value: number; total: number }>()
const pct = computed(() =>
  props.total > 0
    ? Math.min(100, Math.max(0, Math.round((props.value / props.total) * 100)))
    : 0,
)
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      class="flex-1 h-1.5 bg-line-subtle rounded-full overflow-hidden"
      role="progressbar"
      :aria-valuenow="pct"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="`進度 ${value}/${total}`"
    >
      <div
        class="h-full w-full origin-left bg-primary rounded-full transition-transform duration-300 motion-reduce:transition-none"
        :style="{ transform: `scaleX(${pct / 100})` }"
      />
    </div>
    <span class="font-num text-xs text-ink-muted tabular-nums">{{ value }}/{{ total }}</span>
  </div>
</template>
