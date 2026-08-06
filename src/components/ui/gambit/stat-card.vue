<script setup lang="ts">
import type { Component } from 'vue'
import { Lock } from 'lucide-vue-next'

defineProps<{ icon: Component; label?: string; value: string; locked?: boolean }>()
</script>

<template>
  <!-- 總覽統計卡：立體墨氣柔化（見 .gambit-surface-card）。一般卡 icon/數字/文字三段；
       locked 灰階 + 角落鎖頭，只留 icon + 「即將推出」並垂直置中對齊一般卡的數字+文字區。 -->
  <div
    class="relative flex flex-col text-center rounded-card gambit-surface-card
           border border-line px-2.5 py-3"
    :class="locked && 'opacity-55'"
  >
    <Lock
      v-if="locked"
      :size="12"
      :stroke-width="2.2"
      class="absolute top-2 right-2 text-ink-faint"
    />
    <div class="flex justify-center mb-1.5" :class="locked ? 'text-ink-faint' : 'text-primary'">
      <component :is="icon" :size="20" :stroke-width="1.8" />
    </div>
    <template v-if="!locked">
      <div class="font-num text-lg text-ink font-bold tabular-nums">{{ value }}</div>
      <div class="font-sans text-[11px] text-ink-muted mt-0.5">{{ label }}</div>
    </template>
    <div v-else class="flex-1 flex items-center justify-center">
      <span class="font-sans text-[13px] font-bold text-ink-faint">{{ value }}</span>
    </div>
  </div>
</template>
