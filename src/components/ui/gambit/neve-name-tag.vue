<script setup lang="ts">
/**
 * Neve 名牌：頭像＋黑體 13px「Neve」。全站只有這一種名牌（2026-11-18 拍板 D1）。
 * size 跟著 NeveAvatar：md=32px（完局紙那一行）、lg=36px（Neve 對話框）。
 * 給了預設 slot（她說的那句話）時，名字與 slot 疊成一欄排在頭像右側（完局紙）。
 */
import { COACH } from '@/types/lesson'
import NeveAvatar from './neve-avatar.vue'

withDefaults(
  defineProps<{
    size?: 'md' | 'lg'
    /** 名牌放在哪種底上，決定頭像框與字色。 */
    surface?: 'cream' | 'deep'
  }>(),
  { size: 'lg', surface: 'cream' },
)

const NAME_CLASS = {
  cream: 'text-ink-muted',
  deep: 'text-ink-on-deep-dim',
} as const
</script>

<template>
  <span class="flex items-center gap-2.5">
    <NeveAvatar :size="size" :surface="surface" />
    <span v-if="$slots.default" class="min-w-0">
      <span
        class="mb-0.75 block font-sans text-label leading-none tracking-[0.04em]"
        :class="NAME_CLASS[surface]"
        data-testid="neve-name"
      >{{ COACH.name }}</span>
      <slot />
    </span>
    <span
      v-else
      class="font-sans text-label leading-none tracking-[0.04em]"
      :class="NAME_CLASS[surface]"
      data-testid="neve-name"
    >{{ COACH.name }}</span>
  </span>
</template>
