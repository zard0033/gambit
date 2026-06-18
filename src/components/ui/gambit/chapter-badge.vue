<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Gioco Wood piece code (e.g. 'bK', 'wN') — renders the same SVG the board uses. */
    piece?: string
    size?: number
  }>(),
  { size: 60 },
)

// Vite serves under a base path on GitHub Pages (/my-first-chess-game/). url() in JS/inline-style is
// NOT base-rewritten the way it is in .css files, so prefix BASE_URL or the asset 404s in production.
const base = import.meta.env.BASE_URL

// 金邊翡翠錢幣：白底 + 金外環 + 四方位刻點 + 中央棋子剪影
const dotSize = computed(() => Math.round(props.size * 0.065))
const center = computed(() => props.size / 2 - dotSize.value / 2)
const dots = computed(() => [
  { left: center.value, top: 1 },
  { left: props.size - dotSize.value - 2, top: center.value },
  { left: center.value, top: props.size - dotSize.value - 2 },
  { left: 1, top: center.value },
])
// Each piece's silhouette fills a different share of its 50×50 SVG viewBox (measured, Gioco Wood
// set): a king is 0.81 tall, a pawn only 0.64. With mask-size:contain that makes a pawn badge look
// ~20% smaller than a king. Normalise so every silhouette renders at the same optical height.
const PIECE_CONTENT_FRAC: Record<string, number> = { K: 0.807, Q: 0.762, R: 0.676, B: 0.732, N: 0.71, P: 0.638 }
const glyphSize = computed(() => {
  const intrinsic = PIECE_CONTENT_FRAC[props.piece?.slice(-1).toUpperCase() ?? ''] ?? 0.74
  return Math.round(props.size * Math.min(0.7, 0.4 / intrinsic))
})
</script>

<template>
  <div
    class="relative shrink-0 rounded-full bg-surface-card
           shadow-[0_0_0_2.5px_#f8b500,0_4px_14px_rgba(61,34,16,0.16),inset_0_1px_0_rgba(255,255,255,0.9)]"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <div
      v-for="(dot, i) in dots"
      :key="i"
      class="absolute rounded-full bg-primary/50"
      :style="{ left: `${dot.left}px`, top: `${dot.top}px`, width: `${dotSize}px`, height: `${dotSize}px` }"
    />
    <div class="absolute inset-0 flex items-center justify-center">
      <!-- Flat jade silhouette of the real board piece (CSS mask), so the badge shares the
           board piece's shape/identity while staying on-brand flat chrome. -->
      <span
        v-if="piece"
        class="block bg-primary"
        aria-hidden="true"
        :style="{
          width: `${glyphSize}px`,
          height: `${glyphSize}px`,
          WebkitMaskImage: `url(${base}pieces/silhouette/${piece}.svg)`,
          maskImage: `url(${base}pieces/silhouette/${piece}.svg)`,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
        }"
      />
    </div>
  </div>
</template>
