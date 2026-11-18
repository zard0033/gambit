<script setup lang="ts">
/**
 * 全站唯一一種棋盤木框。棋盤（ChessBoard）與標註層（MoveAnnotationDisplay）從預設 slot 傳進來，
 * 父層的 `ref` 照樣綁在自己的 ChessBoard 上。
 *
 * 護欄（technical-preferences「Board / chessground gotchas」）：
 * - 內層是 `relative board-fit`：標註層是 `absolute inset-0`，要貼著這一層；`board-fit` 讓全域
 *   `.board-fit .main-wrap` 覆寫生效，並由 useBoardFit 把寬度壓成 8 的倍數。
 * - 四邊內距 12px（p-3）：座標字畫在這段內距裡（chess-board.vue `.cb-coord`）。
 */
import { ref } from 'vue'
import { useBoardFit } from '@/composables/use-board-fit'

defineProps<{
  /** 木框放在哪種底上：深青（對局頁）或米白（棋憶）。只影響外陰影。 */
  surface: 'deep' | 'cream'
}>()

const SURFACE_CLASS = {
  deep: 'shadow-wood-on-deep',
  cream: 'shadow-wood-on-cream',
} as const

const fitEl = ref<HTMLElement | null>(null)
useBoardFit(fitEl)
</script>

<template>
  <div
    class="w-full rounded-card bg-linear-160/srgb from-wood-light to-wood-dark p-3"
    :class="SURFACE_CLASS[surface]"
    data-testid="wood-frame"
  >
    <div ref="fitEl" class="relative board-fit">
      <slot />
    </div>
  </div>
</template>
