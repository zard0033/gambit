<script setup lang="ts">
/**
 * Neve 對話框（全站唯一一種）。tone 是語意不是顏色：light＝她在說明；deep（深青）＝她要你做一件事，
 * 而且就在這一格做（CONTEXT.md「深青」）。
 *
 * Slots：
 * - `nav`：放在名牌右側（例如棋憶的上一格／步進／下一格）。給了這個 slot，頂列會撐到 46px 容下 44px 觸控鈕。
 * - default：她說的話與其餘內容。
 *
 * 整塊是 `aria-live="polite"`：換格只換這一塊的字，讀屏要聽得到。不想被念出來的東西
 * （例如一直跳動的進度百分比）放到元件外面。
 */
import NeveNameTag from './neve-name-tag.vue'

defineProps<{
  tone: 'light' | 'deep'
}>()

const TONE_CLASS = {
  light: 'border-line bg-surface-card text-ink shadow-card',
  deep: 'border-hairline-on-deep bg-surface-deep-2 text-ink-on-deep',
} as const

const NAME_TAG_SURFACE = {
  light: 'cream',
  deep: 'deep',
} as const
</script>

<template>
  <div
    class="rounded-card border p-3.75"
    :class="TONE_CLASS[tone]"
    aria-live="polite"
    data-testid="neve-dialog"
  >
    <div class="flex items-center gap-2.5" :class="$slots.nav ? 'mb-2 min-h-11.5' : 'mb-1.5 min-h-9'">
      <NeveNameTag size="lg" :surface="NAME_TAG_SURFACE[tone]" />
      <div v-if="$slots.nav" class="ml-auto">
        <slot name="nav" />
      </div>
    </div>
    <slot />
  </div>
</template>
