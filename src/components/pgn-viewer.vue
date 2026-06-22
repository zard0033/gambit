<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import pgnViewerStart from '@lichess-org/pgn-viewer'
import '@lichess-org/pgn-viewer/dist/lichess-pgn-viewer.css'

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

onMounted(mountViewer)

onUnmounted(() => {
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
  <div
    ref="containerRef"
    class="pgn-viewer-wrapper"
    :data-orientation="orientation"
    role="region"
    aria-label="PGN viewer with chess board and move list"
  />
</template>

<style scoped>
.pgn-viewer-wrapper {
  width: 100%;
  min-height: 44px;
}

/* lichess-pgn-viewer sizes its board column off 100vh (a desktop "fit the viewport height" assumption).
   On a tall, narrow phone 100vh is far wider than the viewport, so the board overflows the container
   badly. Force the stacked single-column layout (board → controls → move list) with the board capped to
   the wrapper width. :deep reaches the .lpv the library mounts inside our wrapper via JS. */
.pgn-viewer-wrapper :deep(.lpv) {
  grid-template-areas: 'board' 'controls' 'side';
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto var(--controls-height) minmax(0, auto);
}
</style>
