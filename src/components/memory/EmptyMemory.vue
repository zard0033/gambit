<script setup lang="ts">
/**
 * 棋憶 dashboard — zero-state (GDD EC-1 / AC-3). A steady game surfaces nothing; the moment SECTION
 * is replaced by one calm, non-congratulatory line (寧少勿濫), not a labeled list with an apologetic
 * row.
 */
import { MEMORY_ZERO_STATE_COPY } from '@/config/memory-config'
</script>

<template>
  <p data-testid="memory-zero-state" class="rounded-card bg-surface-card px-5 py-4 text-center font-lesson text-[15px] leading-[1.8] text-ink-muted">
    {{ MEMORY_ZERO_STATE_COPY }}
  </p>
</template>
