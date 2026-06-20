<script setup lang="ts">
/**
 * 棋憶 slideshow — dot band (GDD Rule 14 / EC-2). One dot per moment, the current one elongated.
 * Hidden when there is exactly one moment (a lone dot reads as "still loading"). Non-interactive
 * position indicator (story-006 spec: dots are not tap targets); aria-hidden — the live region
 * carries position for AT.
 */
defineProps<{ count: number; current: number }>()
</script>

<template>
  <div v-if="count > 1" class="flex items-center justify-center gap-1.5" aria-hidden="true">
    <span
      v-for="i in count"
      :key="i"
      class="h-1.5 rounded-full bg-ink-faint/40 transition-all"
      :class="i - 1 === current ? 'w-5 bg-primary' : 'w-1.5'"
    />
  </div>
</template>
