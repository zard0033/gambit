<script setup lang="ts">
/**
 * 棋憶 dashboard — shape-of-game eval view (GDD Rules 8–10). A self-drawn SVG line chart of the
 * White-normalized eval series (no chart library — "整包框架不裝" guardrail). White-advantage up /
 * Black-advantage down, clamped to ±4 pawns. This is **Door 1** (→ replay, "逐手覆盤"): a
 * drift-guarded, keyboard-focusable <button> (EC-12). Selected-moment dots are a redundant color
 * cue only — NOT tap targets (AC-7 / EC-14).
 */
import { computed } from 'vue'
import { LayoutGrid } from 'lucide-vue-next'
import type { Moment } from '@/types/memory'
import { momentVisualKind } from '@/modules/memory/describe'
import { EVAL_CHART_CLAMP_CP } from '@/config/memory-config'

const props = withDefaults(
  defineProps<{
    series: Array<number | null>
    moments: Moment[]
    anchorPly: number | null
    /** The side the player had — names it so the 白優/黑優 axis isn't ambiguous (你看不出白黑). */
    orientation?: 'white' | 'black'
  }>(),
  { orientation: 'white' },
)
const emit = defineEmits<{ (e: 'open', ply: number): void }>()

// SVG plot geometry (viewBox units). Left pad leaves room for the 白優/黑優 label plate.
const W = 320
const H = 120
const PAD_L = 34
const PAD_Y = 8
const MID = H / 2
const plotW = W - PAD_L - 6

const n = computed(() => props.series.length)

function xAt(i: number): number {
  if (n.value <= 1) return PAD_L + plotW / 2
  return PAD_L + (i / (n.value - 1)) * plotW
}
function yAt(cp: number): number {
  // White-advantage positive → higher on screen (smaller y). Clamp already applied in derive.
  const t = Math.max(-1, Math.min(1, cp / EVAL_CHART_CLAMP_CP))
  return MID - t * (MID - PAD_Y)
}

/** Polyline segments over consecutive non-null points (a null breaks the line — progressive gaps). */
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

const DOT_COLOR: Record<string, string> = {
  tactical: 'var(--color-danger)',
  bright: 'var(--color-success)',
  plain: 'var(--color-ink-muted)',
  'turning-point': 'var(--color-accent)',
}

const dots = computed(() =>
  props.moments
    .filter((m) => props.series[m.ply] !== null && props.series[m.ply] !== undefined)
    .map((m) => ({
      x: xAt(m.ply),
      y: yAt(props.series[m.ply] as number),
      color: DOT_COLOR[momentVisualKind(m)] ?? 'var(--color-ink-muted)',
    })),
)

// ---- Drift-guard (EC-12): a touch that drifts > 10px before release is a scroll, not a tap. ----
const DRIFT_THRESHOLD = 10
let startX = 0
let startY = 0
let moved = false

function onPointerDown(e: PointerEvent): void {
  startX = e.clientX
  startY = e.clientY
  moved = false
}
function onPointerMove(e: PointerEvent): void {
  if (Math.hypot(e.clientX - startX, e.clientY - startY) > DRIFT_THRESHOLD) moved = true
}
function onActivate(): void {
  // click fires for both pointer tap and keyboard Enter/Space. A keyboard activation has no
  // preceding pointermove → moved stays false → opens. A scroll-drag sets moved → ignored.
  if (moved) {
    moved = false
    return
  }
  emit('open', props.anchorPly ?? 0)
}
</script>

<template>
  <button
    type="button"
    class="group block w-full rounded-card border border-line bg-surface-card px-3 pb-2.5 pt-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    :aria-label="`這盤的走勢，你執${orientation === 'white' ? '白' : '黑'}方，逐手覆盤`"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @click="onActivate"
  >
    <div class="mb-1 flex items-center justify-between">
      <span class="flex items-center gap-2">
        <span class="font-display text-sm text-ink">這盤的走勢</span>
        <!-- 你執白/黑：標出使用者這盤的方，讓上方白優/黑優軸有所本（你看不出白黑） -->
        <span class="flex items-center gap-1 font-sans text-[11px] text-ink-muted">
          <span
            class="h-2 w-2 shrink-0 rounded-full border"
            :class="orientation === 'white' ? 'border-black/20 bg-[#fbfbf6]' : 'border-white/20 bg-[#2a2a2a]'"
            aria-hidden="true"
          />
          你執{{ orientation === 'white' ? '白' : '黑' }}
        </span>
      </span>
      <span class="flex items-center gap-1 font-sans text-xs text-ink-muted">
        <LayoutGrid :size="13" :stroke-width="1.8" aria-hidden="true" /> 逐手覆盤
      </span>
    </div>

    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full"
      role="img"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <!-- zero line -->
      <line :x1="PAD_L" :y1="MID" :x2="W - 6" :y2="MID" stroke="var(--color-line)" stroke-width="1" stroke-dasharray="3 3" />
      <!-- eval curve -->
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
      <!-- selected-moment dots (redundant color cue; not interactive) -->
      <circle
        v-for="(d, i) in dots"
        :key="`d${i}`"
        :cx="d.x"
        :cy="d.y"
        r="4"
        :fill="d.color"
        stroke="var(--color-surface-card)"
        stroke-width="1.5"
        style="pointer-events: none"
      />
      <!-- left-edge labels with a backing plate so the curve never overlaps them (Rule 10) -->
      <g>
        <rect x="0" y="2" width="30" height="16" rx="3" fill="var(--color-surface-card)" opacity="0.92" />
        <text x="4" y="14" font-size="10" fill="var(--color-ink-muted)">白優</text>
        <rect x="0" :y="H - 18" width="30" height="16" rx="3" fill="var(--color-surface-card)" opacity="0.92" />
        <text x="4" :y="H - 6" font-size="10" fill="var(--color-ink-muted)">黑優</text>
      </g>
    </svg>
  </button>
</template>
