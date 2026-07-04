import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import type { Rect } from '../utils/board-geometry'

export interface RankLabel { label: string; y: number }
export interface FileLabel { label: string; x: number; y: number }

/**
 * Coordinate labels rendered on the wooden frame (chessground's own coords overlay-print inside
 * edge squares and clash with pieces, so `coordinates:false` on the board and we self-draw here):
 * ranks down the left gutter, files along the bottom band.
 *
 * `geomTick` forces the label positions to recompute once the board has a measurable size and
 * again whenever it resizes — squareToRect reads live DOM geometry, which isn't reactive on its own.
 */
export function useBoardCoordinates(deps: {
  boardRef: import('vue').Ref<HTMLElement | null>
  getShowCoordinates: () => boolean
  squareToRect: (square: string) => Rect | null
}): {
  rankLabels: import('vue').ComputedRef<RankLabel[]>
  fileLabels: import('vue').ComputedRef<FileLabel[]>
} {
  const geomTick = ref(0)
  let geomRo: ResizeObserver | null = null

  const rankLabels = computed<RankLabel[]>(() => {
    void geomTick.value
    if (!deps.getShowCoordinates()) return []
    const out: RankLabel[] = []
    for (let r = 1; r <= 8; r++) {
      const rect = deps.squareToRect('a' + r)
      if (rect) out.push({ label: String(r), y: rect.y + rect.height / 2 })
    }
    return out
  })

  const fileLabels = computed<FileLabel[]>(() => {
    void geomTick.value
    if (!deps.getShowCoordinates()) return []
    // Bottom edge = the visually-lowest row (rank 1 for white, rank 8 for black).
    const r1 = deps.squareToRect('a1')
    const r8 = deps.squareToRect('a8')
    if (!r1 || !r8) return []
    // Centre the label in the bottom wood band (tray p-3 = 12px → half-band = 6px below the board edge).
    const bottom = Math.max(r1.y, r8.y) + r1.height + 6
    const out: FileLabel[] = []
    for (const f of 'abcdefgh') {
      const rect = deps.squareToRect(f + '1')
      if (rect) out.push({ label: f, x: rect.x + rect.width / 2, y: bottom })
    }
    return out
  })

  onMounted(() => {
    const el = deps.boardRef.value
    if (el) {
      geomRo = new ResizeObserver(() => { geomTick.value++ })
      geomRo.observe(el)
    }
    geomTick.value++
  })

  onBeforeUnmount(() => {
    geomRo?.disconnect()
    geomRo = null
  })

  return { rankLabels, fileLabels }
}
