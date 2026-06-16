<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'jade' | 'deep' | 'cream' | 'hint' | 'glass' }>(), { tone: 'cream' })

const TONES = {
  jade: 'bg-primary text-white',
  deep: 'bg-surface-deep text-ink-on-deep-dim',
  cream: 'bg-surface-card text-ink-muted border border-line',
  hint: 'bg-hint-light text-hint',
  glass: 'glass-panel rounded-full! text-ink-on-deep-dim',
} as const
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[13px] font-bold"
    :class="TONES[tone]"
  >
    <slot />
  </span>
</template>
