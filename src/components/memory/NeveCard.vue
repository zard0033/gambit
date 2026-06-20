<script setup lang="ts">
/**
 * 棋憶 dashboard — Neve's one qualitative line (F4), the opening voice (GDD Rule 3/5–7).
 * 深青卡 + 頭像 + font-lesson = Neve 視覺嗓音 (persona-neve §視覺嗓音). Text only: no number bar,
 * no score, no link — not in the tab order (story-006 spec).
 */
import { COACH } from '@/types/lesson'

defineProps<{ text: string }>()
</script>

<template>
  <section
    class="rounded-card bg-surface-deep px-5 py-4 shadow-[0_1px_2px_rgba(8,24,20,0.18),0_10px_24px_rgba(8,24,20,0.28)]"
    aria-label="Neve 的回顧"
  >
    <div class="mb-2 flex items-center gap-2">
      <span
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-num text-[12px] leading-none text-primary-fg"
        aria-hidden="true"
      ><span class="block translate-y-px">{{ COACH.name.charAt(0) }}</span></span>
      <span class="font-num text-[11px] tracking-[0.08em] text-ink-on-deep-dim">{{ COACH.name.toUpperCase() }}</span>
    </div>
    <p class="neve-line font-lesson text-[17px] leading-[1.9] text-ink-on-deep">{{ text }}</p>
  </section>
</template>

<style scoped>
/* CJK 不可斜體（假斜扭曲字形）— 顯式鎖正體。 */
.neve-line { font-style: normal; }
</style>
