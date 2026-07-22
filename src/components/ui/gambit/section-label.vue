<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ class?: string; as?: string }>(), {
  as: 'div',
})
</script>

<template>
  <!-- 區塊標籤：uppercase、ink-muted、字距。as="h2" 供頁面區塊標題走語意標籤，供 SR 導航。 -->
  <component
    :is="props.as"
    :class="cn(
      'font-sans text-xs font-bold text-ink-muted tracking-[0.06em] uppercase mx-0.5 mt-5 mb-2.5',
      props.class,
    )"
  >
    <slot />
  </component>
</template>
