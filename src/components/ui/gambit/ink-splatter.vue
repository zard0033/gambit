<script setup lang="ts">
/**
 * 金墨飛濺 (InkSplatter) — scattered gold flecks that slowly "breathe", for reward / arrival /
 * celebration moments (brand gold). Shared 墨韻 primitive. Deterministic pseudo-random (stable
 * per seed), edge-biased ring so the centre (medallion / text) stays clear. Absolutely positioned
 * — the parent must be `position: relative` and give foreground content a higher stacking order.
 * Respects prefers-reduced-motion.
 *
 * Both themes show it (reward is a 特殊時刻). Fleck size scales with the theme-level
 * `--fleck-scale` token (cream 亮底加大補存在感、deep-jade 深底維持原尺寸) — see main.css.
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{ count?: number; seed?: number }>(), { count: 20, seed: 1 })

const frac = (k: number): number => {
  const v = Math.abs(Math.sin(k * 12.9898)) * 43758.5453
  return v - Math.floor(v)
}

const flecks = computed(() =>
  Array.from({ length: props.count }, (_, idx) => {
    const i = idx + 1 + props.seed * 7
    const ang = frac(i * 1.7) * Math.PI * 2
    const rad = 34 + frac(i * 2.9) * 18 // % from centre (34–52): a ring, sparse middle
    return {
      x: 50 + Math.cos(ang) * rad,
      y: 50 + Math.sin(ang) * rad,
      size: 1.8 + frac(i * 3.1) * 2.6,
      dur: 4.5 + frac(i * 2.3) * 3.5,
      del: frac(i * 1.13) * 4,
    }
  }),
)
</script>

<template>
  <div class="ink-splatter" aria-hidden="true">
    <span
      v-for="(f, i) in flecks"
      :key="i"
      class="ink-fleck"
      :style="{
        left: f.x + '%',
        top: f.y + '%',
        '--s': f.size.toFixed(1) + 'px',
        animationDuration: f.dur.toFixed(1) + 's',
        animationDelay: f.del.toFixed(1) + 's',
      }"
    />
  </div>
</template>
