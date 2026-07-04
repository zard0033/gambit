<script setup lang="ts">
/**
 * MoveAnnotationDisplay — pointer-events:none SVG overlay for arrows, highlights, and eval bar.
 * ADR-0006: custom SVG overlay (chessground drawable FAILS at arrowhead precision).
 * ADR-0009: squareToRect() is the sole geometry source; no own coordinate computation.
 * TR-move-annotation-001: declarative annotations prop.
 * TR-move-annotation-002: SVG overlay positioned via boardRef + squareToRect.
 * TR-move-annotation-003: neutral role semantics — no emotive labels.
 * TR-move-annotation-004: eval bar Formula 1 fillRatio + sign normalization.
 * TR-move-annotation-005: rAF-coalesced resize throttle (Formula 4).
 */
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Annotation, EvaluationInput } from '../modules/move-annotation/annotation-types'
import {
  normalizeEval,
  computeFillRatio,
  formatEvalDisplay,
} from '../modules/move-annotation/annotation-formulas'
import type { Rect } from '../utils/board-geometry'
import { useReducedMotion } from '../composables/use-reduced-motion'

const { prefersReducedMotion } = useReducedMotion()

const props = defineProps<{
  annotations: Annotation[]
  evaluation: EvaluationInput | null
  /** squareToRect function from ChessBoard — sole geometry source (ADR-0009). */
  squareToRect: (square: string) => Rect | null
  /** Board DOM element — observed by ResizeObserver for geometry recalculation (TR-005). */
  boardRef?: HTMLElement | null
  /** Board pixel width — used to compute arrowhead geometry. */
  boardSizePx?: number
  /** Multiplier on arrow shaft thickness (default 1). Lesson arrows use a thinner shaft. */
  shaftScale?: number
}>()

// ---- Formula 4: rAF-coalesced resize throttle (TR-move-annotation-005) ----
// Increment this counter on each rAF callback to force computed re-evaluation.
const resizeVersion = ref(0)

let rafId: number | null = null

function onBoardResize(): void {
  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    rafId = null
    resizeVersion.value++ // trigger recompute of arrow/highlight geometries
  })
}

let _observer: ResizeObserver | null = null

onMounted(() => {
  if (props.boardRef) {
    _observer = new ResizeObserver(onBoardResize)
    _observer.observe(props.boardRef)
  }
})

onUnmounted(() => {
  _observer?.disconnect()
  _observer = null
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
})

// ---- Eval computation ----

const normalized = computed(() =>
  props.evaluation
    ? normalizeEval(props.evaluation)
    : { evalNormCp: undefined, evalMateNorm: undefined },
)

const fillRatio = computed(() => computeFillRatio(normalized.value))
const evalDisplay = computed(() => formatEvalDisplay(normalized.value))
const isTerminal = computed(() => normalized.value.evalMateNorm === 0)

// ---- Arrow geometry ----

// Shaft thickness from the real cg-board square (squareToRect), not boardSizePx/8 — boardSizePx is
// the cg-wrap width and over-states the square by a few px. Fallback to wrap/8 when no rect (Replay).
const squarePx = computed(() => {
  void resizeVersion.value // recompute when the board resizes
  return props.squareToRect('a1')?.width ?? (props.boardSizePx ?? 400) / 8
})

function squareCenter(square: string): { x: number; y: number } | null {
  const rect = props.squareToRect(square)
  if (!rect) return null
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

// Arrow shaft width and head length scale with board size (Formula 2 of GDD)
const shaftWidthPx = computed(() =>
  Math.max(3, Math.min(20, squarePx.value * 0.16 * (props.shaftScale ?? 1))),
)

interface ArrowGeometry {
  x1: number; y1: number
  x2: number; y2: number
  color: string
}

const ROLE_COLORS: Record<string, string> = {
  bestMove: '#c4882a',   // muted amber — answer/best-move arrow, harmonised with the hint colour (全站統一)
  playedMove: '#888888', // neutral gray
  alternateLine: '#3d7bcf',
  threat: '#c4882a',     // muted amber
  keySquare: '#c4882a',
  from: '#3d7bcf',
  to: '#3d7bcf',
}

const arrowGeometries = computed<ArrowGeometry[]>(() => {
  void resizeVersion.value // track resize dependency so this recomputes on board resize
  // Skip best-move arrows for terminal positions (no forward eval)
  const arrows = props.annotations.filter(a => {
    if (a.kind !== 'arrow') return false
    if (isTerminal.value && a.role === 'bestMove') return false
    return true
  })

  return arrows.flatMap((a) => {
    if (a.kind !== 'arrow') return []
    const from = squareCenter(a.from)
    const to = squareCenter(a.to)
    if (!from || !to) return []
    return [{ x1: from.x, y1: from.y, x2: to.x, y2: to.y, color: ROLE_COLORS[a.role] ?? '#3d7bcf' }]
  })
})

interface HighlightGeometry {
  square: string
  rect: Rect
  color: string
  /** keySquare (「看這裡」) gets an opaque inset ring — a translucent tint alone is
   *  invisible on the wood board (amber-on-brown blends into both square colours). */
  ring: boolean
}

const highlightGeometries = computed<HighlightGeometry[]>(() => {
  void resizeVersion.value // track resize dependency
  return props.annotations.flatMap((a) => {
    if (a.kind !== 'highlight') return []
    const rect = props.squareToRect(a.square)
    if (!rect) return []
    return [{ square: a.square, rect, color: ROLE_COLORS[a.role] ?? '#c4882a', ring: a.role === 'keySquare' }]
  })
})

// Ring stroke scales with the square (inset so it never bleeds onto neighbours).
const ringStrokePx = computed(() => Math.max(2, squarePx.value * 0.06))
</script>

<template>
  <!-- pointer-events: none — zero game state side effects (ADR-0006 control manifest) -->
  <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
    <!-- SVG overlay for arrows and highlights -->
    <svg
      class="absolute inset-0 w-full h-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <marker
          v-for="(arrow, i) in arrowGeometries"
          :id="`arrowhead-${i}`"
          :key="`marker-${i}`"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 z" :fill="arrow.color" opacity="0.85" />
        </marker>
      </defs>

      <!-- Highlights (below arrows per z-order Rule 8) -->
      <!-- Keyed by square (not index): a new step's new square remounts → the ring's entrance
           pulse replays; a resize only patches geometry → no spurious replay. Key also carries the
           role facet (ring/plain): playedMove 與 keySquare 落同一格時（吃同格但用錯子）才不撞 key。 -->
      <g v-for="h in highlightGeometries" :key="`highlight-${h.ring ? 'key' : 'played'}-${h.square}`">
        <rect
          :x="h.rect.x"
          :y="h.rect.y"
          :width="h.rect.width"
          :height="h.rect.height"
          :fill="h.color"
          :opacity="h.ring ? 0.35 : 0.30"
        />
        <rect
          v-if="h.ring"
          class="key-square-ring"
          :x="h.rect.x + ringStrokePx / 2"
          :y="h.rect.y + ringStrokePx / 2"
          :width="h.rect.width - ringStrokePx"
          :height="h.rect.height - ringStrokePx"
          fill="none"
          :stroke="h.color"
          :stroke-width="ringStrokePx"
          opacity="0.9"
        />
      </g>

      <!-- Arrow shafts and heads -->
      <line
        v-for="(arrow, i) in arrowGeometries"
        :key="`arrow-${i}`"
        :x1="arrow.x1"
        :y1="arrow.y1"
        :x2="arrow.x2"
        :y2="arrow.y2"
        :stroke="arrow.color"
        :stroke-width="shaftWidthPx"
        opacity="0.85"
        :marker-end="`url(#arrowhead-${i})`"
        stroke-linecap="round"
      />
    </svg>

    <!-- Eval bar — vertical gauge beside the board (outside the SVG) -->
    <div
      v-if="evaluation !== null"
      class="absolute right-0 top-0 h-full flex items-stretch"
      style="width: 10px; transform: translateX(100%)"
    >
      <div class="relative w-full h-full bg-gray-700 rounded">
        <!-- White fill from bottom -->
        <div
          class="absolute bottom-0 left-0 right-0 h-full origin-bottom bg-white rounded"
          :style="{ transform: `scaleY(${fillRatio})`, transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease' }"
          role="img"
          :aria-label="`評估：${evalDisplay}`"
        />
      </div>
    </div>
  </div>

  <!-- Eval badge — separate DOM node with readable text (not SVG) -->
  <div
    v-if="evaluation !== null"
    class="absolute bottom-0 right-0 text-xs font-mono bg-gray-900 text-white px-1 py-0.5 rounded"
    style="transform: translateY(100%)"
    :aria-label="`評估：${evalDisplay}`"
  >
    {{ evalDisplay }}
  </div>
</template>

<style scoped>
/* 進場單次柔和脈動（兩下、只動 opacity），落定在 0.9；respect reduced-motion。 */
@keyframes key-square-pulse {
  0%, 50%, 100% { opacity: 0.9; }
  25%, 75% { opacity: 0.3; }
}
.key-square-ring {
  animation: key-square-pulse 1.6s ease-in-out 1;
}
@media (prefers-reduced-motion: reduce) {
  .key-square-ring {
    animation: none;
  }
}
</style>
