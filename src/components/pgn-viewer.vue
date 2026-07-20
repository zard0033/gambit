<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import pgnViewerStart from '@lichess-org/pgn-viewer'
import '@lichess-org/pgn-viewer/dist/lichess-pgn-viewer.css'
import { useBoardGeometry } from '../composables/use-board-geometry'
import { useBoardCoordinates } from '../composables/use-board-coordinates'

interface Props {
  pgn: string
  orientation?: 'white' | 'black'
  /** Let pgn-viewer handle arrow-key navigation. MemoryReplay sets false to own the keyboard. */
  keyboardToMove?: boolean
  /** Show pgn-viewer's built-in control bar. MemoryReplay sets false and supplies its own. */
  showControls?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'white',
  keyboardToMove: true,
  showControls: true,
})

const emit = defineEmits<{
  'move-selected': [move: string]
}>()

const containerRef = ref<HTMLElement | null>(null)
// pgn-viewer mounts via snabbdom's patch(), which treats containerRef as a real-DOM "old vnode":
// it builds its own tree and REPLACES containerRef's element wholesale (remove + insert a fresh
// node with the same classes) rather than writing into it. Vue's ref keeps pointing at the
// discarded original, so every geometry read / CSS :deep() anchor below uses frameRef (the
// outer wrapper, which the library never touches) instead of containerRef.
const frameRef = ref<HTMLElement | null>(null)

// Coordinate labels on the wooden frame — same treatment as chess-board.vue (native chessground
// coords are disabled below via `chessground.coordinates: false`, and we self-draw instead so
// Replay reads consistent with Play/Lesson/Trial rather than lichess's on-square style).
const { squareToRect } = useBoardGeometry(frameRef, () => props.orientation)
// pgn-viewer's own board is inserted asynchronously (see note above) and mountViewer() may run
// again with the same frame size (orientation flip), which the ResizeObserver inside
// useBoardCoordinates can't detect on its own — a MutationObserver on the stable frame forces a
// recompute whenever the library actually writes DOM.
const remountTick = ref(0)
const { rankLabels, fileLabels } = useBoardCoordinates({
  boardRef: frameRef,
  getShowCoordinates: () => true,
  squareToRect,
  extraTick: remountTick,
})
let frameMo: MutationObserver | null = null

let viewer: ReturnType<typeof pgnViewerStart> | null = null
// The viewer's un-intercepted toPath. Programmatic navigation (toPly) calls this
// directly so it does NOT re-emit move-selected; only genuine user navigation
// (clicking a move in the list) goes through the intercepting wrapper below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pgn-viewer's Path type is internal
let originalToPath: ((path: any, focus?: boolean) => void) | null = null

function mountViewer() {
  if (!containerRef.value) return
  containerRef.value.innerHTML = ''
  viewer = null
  originalToPath = null

  if (!props.pgn) return

  try {
    viewer = pgnViewerStart(containerRef.value, {
      pgn: props.pgn,
      orientation: props.orientation,
      keyboardToMove: props.keyboardToMove,
      showMoves: 'auto',
      showControls: props.showControls,
      showPlayers: false,
      drawArrows: false,
      // We self-draw coordinates on the frame instead (see rankLabels / fileLabels above).
      chessground: { coordinates: false },
    })

    // Intercept toPath so internal user navigation fires move-selected.
    // Capture localViewer to avoid reading the module-level `viewer` var
    // after a remount reassigns it (stale-closure guard).
    const localViewer = viewer
    const boundToPath = localViewer.toPath.bind(localViewer)
    originalToPath = boundToPath
    localViewer.toPath = (path, focus) => {
      boundToPath(path, focus)
      const data = localViewer.curData() as unknown as Record<string, unknown> | null | undefined
      if (data && typeof data['uci'] === 'string' && data['uci']) {
        emit('move-selected', data['uci'])
      }
    }
  } catch {
    // Invalid PGN or library init failure — render nothing, no console noise
  }
}

onMounted(() => {
  mountViewer()
  if (frameRef.value) {
    frameMo = new MutationObserver(() => { remountTick.value++ })
    frameMo.observe(frameRef.value, { childList: true, subtree: true })
  }
})

onUnmounted(() => {
  frameMo?.disconnect()
  frameMo = null
  if (containerRef.value) containerRef.value.innerHTML = ''
  viewer = null
  originalToPath = null
})

watch(
  () => [props.pgn, props.orientation],
  mountViewer,
  { flush: 'post' },
)

/**
 * Navigate the board to an absolute mainline ply (0 = initial position).
 * Uses the un-intercepted toPath so programmatic navigation does not re-emit
 * move-selected (which would round-trip back through the parent's sync handler).
 */
function toPly(ply: number): void {
  if (!viewer || !originalToPath) return
  try {
    const path = viewer.game.pathAtMainlinePly(ply)
    originalToPath(path)
  } catch {
    // Out-of-range ply — ignore
  }
}

/** Current mainline ply per the viewer (0 when on the initial position). */
function getCurrentPly(): number {
  const data = viewer?.curData() as unknown as { ply?: number } | undefined
  return data?.ply ?? 0
}

/** Draw (or clear) the engine best-move arrow on the board. UCI like "e2e4". */
function setBestArrow(uci: string | null): void {
  const ground = viewer?.ground
  if (!ground) return
  if (!uci || uci.length < 4) {
    ground.setAutoShapes([])
    return
  }
  ground.setAutoShapes([
    { orig: uci.slice(0, 2) as never, dest: uci.slice(2, 4) as never, brush: 'green' },
  ])
}

defineExpose({ getViewer: () => viewer, toPly, getCurrentPly, setBestArrow })
</script>

<template>
  <div ref="frameRef" class="pgn-board-frame">
    <div
      ref="containerRef"
      class="pgn-viewer-wrapper"
      :data-orientation="orientation"
      role="region"
      aria-label="PGN viewer with chess board and move list"
    />
    <!-- Coordinate labels on the wooden frame — mirrors chess-board.vue's ranks-left/files-bottom
         layout so Replay reads consistent with Play/Lesson/Trial. .lpv__board's padding (below)
         reserves the room they land in. -->
    <span
      v-for="r in rankLabels"
      :key="`rank-${r.label}`"
      class="pv-coord pv-coord-rank font-num"
      :style="{ top: `${r.y}px` }"
      aria-hidden="true"
    >{{ r.label }}</span>
    <span
      v-for="f in fileLabels"
      :key="`file-${f.label}`"
      class="pv-coord pv-coord-file font-num"
      :style="{ left: `${f.x}px`, top: `${f.y}px` }"
      aria-hidden="true"
    >{{ f.label }}</span>
  </div>
</template>

<style scoped>
.pgn-board-frame {
  position: relative;
}

.pgn-viewer-wrapper {
  width: 100%;
  min-height: 44px;
}

/* lichess-pgn-viewer sizes its board column off 100vh (a desktop "fit the viewport height" assumption).
   On a tall, narrow phone 100vh is far wider than the viewport, so the board overflows the container
   badly. Force the stacked single-column layout (board → controls → move list) with the board capped to
   the wrapper width. :deep reaches the .lpv the library mounts inside our wrapper via JS.
   Anchored on .pgn-board-frame (not .pgn-viewer-wrapper): pgn-viewer's snabbdom patch() REPLACES the
   .pgn-viewer-wrapper element wholesale on mount, and the replacement never carries Vue's scoped
   data-v-* attribute, so a selector requiring that attribute ON .pgn-viewer-wrapper itself would
   never match post-mount. .pgn-board-frame is Vue-owned and never touched by the library. */
.pgn-board-frame :deep(.lpv) {
  grid-template-areas: 'board' 'controls' 'side';
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto var(--controls-height) minmax(0, auto);
}

/* Reserve the wood-band room the self-drawn coordinate labels land in (native chessground coords
   are off — chessground.coordinates:false above). 12px matches chess-board.vue's tray assumption
   (its coordinate composable centers files 6px below the board edge = half of a 12px band). */
.pgn-board-frame :deep(.lpv__board) {
  padding: 12px;
  box-sizing: border-box;
}

/* Recessive warm-ink label, tuned for the cream chrome around Replay's board (chess-board.vue's
   pale parchment tone assumes a dark wood tray backdrop, which this isn't). */
.pv-coord {
  position: absolute;
  z-index: 5;
  font-size: 11px;
  line-height: 1;
  color: var(--color-ink-faint);
  pointer-events: none;
  user-select: none;
}
.pv-coord-rank {
  left: -6px;
  transform: translate(-50%, -50%);
}
.pv-coord-file {
  transform: translate(-50%, -50%);
}
</style>
