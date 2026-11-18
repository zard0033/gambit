<script setup lang="ts">
/**
 * 任務頁頂列（對局／棋憶／課程這類全屏、不顯示底部導覽的頁）。深青底帶：左返回鍵、中間標題＋副標、
 * 右邊 `action` slot。返回只 emit `back`，落點由頁面決定——iOS standalone 空堆疊時
 * `history.back()` 是靜默 no-op（technical-preferences「返回鍵一律自畫」），所以元件內不呼叫它。
 */
import { ArrowLeft } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    /** 頁標題，渲染成 h1（tabindex=-1 供路由換頁後程式聚焦）。 */
    title: string
    /** 標題下的一行副標；不給就只有標題。 */
    subtitle?: string
    /** 返回鍵的讀屏名稱。 */
    backLabel?: string
  }>(),
  { subtitle: undefined, backLabel: '返回' },
)

const emit = defineEmits<{
  /** 使用者按了返回鍵。 */
  back: []
}>()
</script>

<template>
  <header class="shrink-0 bg-surface-deep pt-[env(safe-area-inset-top)] text-ink-on-deep">
    <div class="flex h-14 items-center gap-3 px-4">
      <button
        type="button"
        class="grid size-11 shrink-0 place-items-center rounded-lg bg-white/8 text-ink-on-deep transition-transform duration-150 ease-settle hover:bg-white/14 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
        :aria-label="backLabel"
        data-testid="task-top-row-back"
        @click="emit('back')"
      >
        <ArrowLeft :size="20" :stroke-width="1.8" aria-hidden="true" />
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="truncate font-display text-lg leading-tight font-bold" tabindex="-1">{{ title }}</h1>
        <span v-if="subtitle" class="block truncate text-label text-ink-on-deep-dim">{{ subtitle }}</span>
      </div>
      <div v-if="$slots.action" class="flex shrink-0 items-center">
        <slot name="action" />
      </div>
    </div>
  </header>
</template>
