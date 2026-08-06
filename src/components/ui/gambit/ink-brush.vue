<script setup lang="ts">
/**
 * 墨筆 (InkBrush) — a single variable-width calligraphy brush stroke as a pure-vector SVG path
 * (no raster, no jitter). Shared 墨韻 primitive: use narrow+short as a title underline, or
 * wide+flat as a 乾筆 section divider. Colour comes from `currentColor` (see .ink-brush in
 * main.css) so each surface paints its own ink — deep-jade warm-white, cream dark-umber. The path
 * is deterministic per `seed`, so it never reflows on re-render.
 *
 * SoT: design/gambit-design-system/colors_and_type.css「墨韻母題」。墨筆底線／乾筆分隔可進日常
 * UI（2026-07-22 A/B 拍板），鋪量克制——每屏少數錨點；墨色跟表面走：深色表面（deep-jade 區）用
 * 暖白墨，scoped 覆寫 --color-ink-brush。金墨飛濺（InkSplatter）仍限 reward／特殊時刻。
 */
const props = withDefaults(
  defineProps<{ width?: number; height?: number; seed?: number; thickness?: number }>(),
  { width: 120, height: 13, seed: 1, thickness: 0.42 },
)

function buildPath(w: number, h: number, seed: number, mt: number): string {
  const x0 = 2.5
  const x1 = w - 2.5
  const maxT = h * mt
  const K = 46
  // centre line: gentle undulation + slight downward tilt → looks hand-drawn
  const cy = (u: number) => h / 2 + Math.sin(u * 5.2 + seed) * (h * 0.06) + (u - 0.5) * (h * 0.05)
  // width: gaussian peak (left-of-centre) + dry-brush flicker in the tail + tapered (not vanishing) tip
  const thick = (u: number) => {
    const peak = 0.5 * Math.exp(-Math.pow((u - 0.3) / 0.4, 2)) + 0.18
    const dry = u > 0.5 ? 0.62 + 0.38 * Math.sin(u * 34 + seed * 3) : 1
    const tip = u > 0.82 ? 0.4 + 0.6 * Math.max(0, 1 - (u - 0.82) / 0.18) : 1
    return Math.max(0.6, maxT * peak * dry * tip)
  }
  const r = (v: number) => v.toFixed(1)
  let d = ''
  for (let i = 0; i <= K; i++) {
    const u = i / K
    const x = x0 + (x1 - x0) * u
    const y = cy(u)
    const t = thick(u) / 2
    d += (i ? 'L' : 'M') + r(x) + ',' + r(y - t) + ' '
  }
  for (let i = K; i >= 0; i--) {
    const u = i / K
    const x = x0 + (x1 - x0) * u
    const y = cy(u)
    const t = thick(u) / 2
    d += 'L' + r(x) + ',' + r(y + t) + ' '
  }
  return d + 'Z'
}
</script>

<template>
  <svg
    class="ink-brush"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path :d="buildPath(width, height, seed, thickness)" />
  </svg>
</template>
