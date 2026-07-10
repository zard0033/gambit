<script setup lang="ts">
/**
 * Neve 頭像共用元件（persona-neve「固定容器」— 同一張圖到處出現＝辨識機制，見
 * design/gambit-design-system/persona-neve.md「視覺嗓音」）。size：md=32px（課程/試煉頂列）、
 * lg=36px（棋憶深青卡）。surface：cream 用細 line ring；deep 用白 ring + 微提亮，補深青底辨識度。
 */
import { COACH_AVATAR } from '@/types/lesson'

withDefaults(
  defineProps<{
    size?: 'md' | 'lg'
    surface?: 'cream' | 'deep'
  }>(),
  { size: 'md', surface: 'cream' },
)
</script>

<template>
  <img
    class="neve-avatar shrink-0 rounded-full object-cover ring-1"
    :class="[
      size === 'lg' ? 'h-9 w-9' : 'h-8 w-8',
      surface === 'deep' ? 'ring-white/25 brightness-110' : 'ring-line',
    ]"
    :src="COACH_AVATAR"
    alt=""
    aria-hidden="true"
  >
</template>

<style scoped>
/* 單次進場：fade + scale，只動 transform/opacity；尊重 prefers-reduced-motion。 */
.neve-avatar {
  opacity: 0;
  transform: scale(0.96);
  animation: neve-avatar-in 220ms ease-out forwards;
}
@keyframes neve-avatar-in { to { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .neve-avatar { animation: none; opacity: 1; transform: scale(1); }
}
</style>
