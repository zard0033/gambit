<script setup lang="ts">
/**
 * 棋憶 Replay — self-drawn eval chart (story-009). Same White-normalized series as the dashboard
 * shape chart, but here it is a passive read-out with a GOLD cursor at the current ply (gold =
 * focus/reward indicator, the sanctioned use). Not interactive — the move list + board drive
 * navigation. Anchor ply marked with a small gold tick (matches #7's "biggest swing" marker).
 */
import { computed } from 'vue'
import { EVAL_CHART_CLAMP_CP } from '@/config/memory-config'

const props = defineProps<{
  series: Array<number | null>
  cursor: number
  anchorPly: number | null
}>()

const W = 320
const H = 96
const PAD_L = 30
const PAD_Y = 6
const MID = H / 2
const plotW = W - PAD_L - 6

const n = computed(() => props.series.length)
function xAt(i: number): number {
  if (n.value <= 1) return PAD_L + plotW / 2
  return PAD_L + (i / (n.value - 1)) * plotW
}
function yAt(cp: number): number {
  const t = Math.max(-1, Math.min(1, cp / EVAL_CHART_CLAMP_CP))
  return MID - t * (MID - PAD_Y)
}

const segments = computed<string[]>(() => {
  const segs: string[] = []
  let cur: string[] = []
  props.series.forEach((cp, i) => {
    if (cp === null) {
      if (cur.length > 1) segs.push(cur.join(' '))
      cur = []
    } else {
      cur.push(`${xAt(i).toFixed(1)},${yAt(cp).toFixed(1)}`)
    }
  })
  if (cur.length > 1) segs.push(cur.join(' '))
  return segs
})

const cursorX = computed(() => xAt(Math.min(props.cursor, Math.max(0, n.value - 1))))
const anchorX = computed(() => (props.anchorPly !== null ? xAt(props.anchorPly) : null))
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="block" role="img" aria-label="這盤的走勢" preserveAspectRatio="none">
    <line :x1="PAD_L" :y1="MID" :x2="W - 6" :y2="MID" stroke="var(--color-line)" stroke-width="1" stroke-dasharray="3 3" />
    <polyline
      v-for="(seg, i) in segments"
      :key="i"
      :points="seg"
      fill="none"
      stroke="var(--color-ink-muted)"
      stroke-width="2"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <!-- anchor tick (gold, matches #7 biggest-swing marker) -->
    <line v-if="anchorX !== null" :x1="anchorX" y1="2" :x2="anchorX" :y2="H - 2" stroke="var(--color-accent)" stroke-width="1" opacity="0.45" />
    <!-- gold cursor at the current ply (focus/reward indicator) -->
    <line :x1="cursorX" y1="0" :x2="cursorX" :y2="H" stroke="var(--color-accent)" stroke-width="2" />
    <g>
      <rect x="0" y="2" width="28" height="14" rx="3" fill="var(--color-surface-card)" opacity="0.92" />
      <text x="3" y="13" font-size="9" fill="var(--color-ink-muted)">白優</text>
      <rect x="0" :y="H - 16" width="28" height="14" rx="3" fill="var(--color-surface-card)" opacity="0.92" />
      <text x="3" :y="H - 5" font-size="9" fill="var(--color-ink-muted)">黑優</text>
    </g>
  </svg>
</template>
