<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string; accent?: boolean }>()
</script>

<template>
  <!-- Gambit 立體卡：cream＝暖棕柔陰影墨氣柔化；noir（玄夜）＝玄黑亮階材質分層（不柔化，
       見 .gambit-surface-card in main.css，決策樣張 home-ink-fusion-final.html ➊ 拍板）。
       accent 為 jade 左 rule。 -->
  <div
    :class="cn(
      'relative gambit-surface-card text-ink rounded-lg-card border border-line',
      props.accent && 'border-l-4 border-l-primary',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
