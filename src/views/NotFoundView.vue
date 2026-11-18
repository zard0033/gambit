<script setup lang="ts">
import { House } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="flex min-h-[calc(100dvh-49px)] flex-col items-center justify-center px-8 py-12 text-center">
    <!-- 傾倒的國王：「這一盤結束了，找路回去」 -->
    <div
      class="mb-7 flex h-[88px] w-[88px] rotate-90 items-center justify-center rounded-full bg-surface-raised border border-line shadow-card text-[50px] text-ink-faint"
      aria-hidden="true"
    >
      ♚
    </div>
    <div class="mb-2.5 font-num text-[56px] font-bold leading-none text-ink-faint">404</div>
    <h1 class="mb-2 font-display text-xl font-bold text-ink" tabindex="-1">找不到這個頁面</h1>
    <p class="mb-9 max-w-[240px] font-sans text-sm leading-relaxed text-ink-muted">
      看來這一步走到了棋盤之外。
    </p>
    <Button as-child class="gap-2">
      <RouterLink to="/"><House :size="16" /> 返回首頁</RouterLink>
    </Button>
    <Button variant="link" as-child class="mt-3.5 text-[13px] font-semibold text-primary">
      <RouterLink to="/learn">繼續學習之路</RouterLink>
    </Button>
  </div>
</template>
