<script setup lang="ts">
/**
 * 失誤 slideshow 的唯一入口 — a quiet cream door below the eval chart (2026-07-11 拍板:
 * 「重點步」list 拆除後改為單一安靜入口,取代恢復整排清單). The chart is the self-serve
 * drill-in tool (tap → replay at ply); this door is the Neve-guided walkthrough — the two
 * complement rather than duplicate. Renders only when the parent has key moments (parent
 * owns the v-if); dumb component: no store, emits 'open' and the dashboard routes it to
 * MemoryContext.openMoment(0).
 *
 * Visual: cream surface (NOT deep-jade — the signpost card owns that weight and both can
 * co-exist on screen), whole card = one 44px+ tap target, gold only on the arrow indicator
 * + focus ring. 回顧態 copy: second-person, calm, no blame.
 */
import { ArrowRight, Film } from 'lucide-vue-next'
import { NeveAvatar } from '@/components/ui/gambit'
import { COACH } from '@/types/lesson'

defineEmits<{ open: [] }>()
</script>

<template>
  <button
    type="button"
    data-testid="slideshow-door"
    class="door group w-full rounded-card border border-line bg-surface-card px-5 py-4 text-left shadow-[0_1px_2px_rgba(74,55,40,0.08)] transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base motion-reduce:transition-none"
    @click="$emit('open')"
  >
    <div class="mb-2 flex items-center gap-2">
      <NeveAvatar size="md" surface="cream" />
      <span class="font-num text-[11px] tracking-[0.08em] text-ink-muted">{{ COACH.name.toUpperCase() }}</span>
      <Film :size="15" :stroke-width="1.8" class="ml-auto text-ink-faint" aria-hidden="true" />
    </div>
    <p class="door-line font-lesson text-[17px] leading-[1.9] text-ink">這盤有幾手，值得再看一次。</p>
    <span class="mt-3 inline-flex items-center gap-1.5 font-sans text-[15px] font-bold text-ink">
      一手一手，慢慢重看
      <ArrowRight :size="16" :stroke-width="2" class="text-gold transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
    </span>
  </button>
</template>

<style scoped>
/* CJK 不可斜體（假斜扭曲字形）— 顯式鎖正體。 */
.door-line { font-style: normal; }
</style>
