<script setup lang="ts">
/**
 * 棋憶 slideshow — the moment card (GDD Rules 14–15). Kind icon + plain short name + swing, the
 * move comparison (Rule 15 / AC-10), and Neve's per-moment explanation (F3, 文楷). The comparison
 * renders both halves at the SAME font-size, role differentiated by color + weight + a leading word
 * (color never the sole channel — EC-14): mistake「你走了 …」(muted)│「更好的是 …」(gold), good
 * 「你走了 … · 這手很好」(green).
 */
import { computed } from 'vue'
import { AlertTriangle, Star, CircleSlash, Signpost } from 'lucide-vue-next'
import type { MoveDesc } from '@/modules/memory/templates'
import type { MomentVisualKind } from '@/modules/memory/describe'

const props = defineProps<{
  visualKind: MomentVisualKind
  shortName: string
  swingText: string
  played: MoveDesc | null
  best: MoveDesc | null
  neveText: string
}>()

const ICON = { tactical: AlertTriangle, bright: Star, plain: CircleSlash, 'turning-point': Signpost }
const COLOR: Record<MomentVisualKind, string> = {
  tactical: 'var(--color-danger)',
  bright: 'var(--color-success)',
  plain: 'var(--color-ink-muted)',
  'turning-point': 'var(--color-accent)',
}
function phrase(d: MoveDesc | null): string { return d ? `把${d.piece}移到 ${d.to}` : '' }
const isGood = computed(() => props.visualKind === 'bright')
</script>

<template>
  <div class="rounded-card border border-line bg-surface-card px-4 py-3.5">
    <div class="mb-2.5 flex items-center gap-2">
      <component :is="ICON[visualKind]" :size="20" :stroke-width="1.9" :style="{ color: COLOR[visualKind] }" aria-hidden="true" />
      <span class="flex-1 font-sans text-[15px] text-ink">{{ shortName }}</span>
      <span class="font-num text-sm tabular-nums text-ink-muted">{{ swingText }}</span>
    </div>

    <!-- Move comparison (one font-size; color + weight + leading word) -->
    <div class="mb-3 flex flex-col gap-1 text-[15px]">
      <template v-if="isGood">
        <span data-testid="cmp-good" :style="{ color: 'var(--color-success-dark)', fontWeight: 600 }">
          你走了 {{ phrase(played) }} · 這手很好
        </span>
      </template>
      <template v-else>
        <span data-testid="cmp-played" :style="{ color: 'var(--color-ink-muted)', fontWeight: 400 }">
          你走了 {{ phrase(played) }}
        </span>
        <span data-testid="cmp-better" :style="{ color: 'var(--color-hint-dark)', fontWeight: 600 }">
          更好的是 {{ phrase(best) }}
        </span>
      </template>
    </div>

    <!-- Neve explanation (回顧態, 文楷) -->
    <p class="neve-line font-lesson text-[15px] leading-[1.85] text-ink">{{ neveText }}</p>
  </div>
</template>

<style scoped>
.neve-line { font-style: normal; }
</style>
