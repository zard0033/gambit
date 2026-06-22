<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight } from 'lucide-vue-next'
import type { GameHistoryEntry } from '@/types/game-history'

const props = defineProps<{
  entry: GameHistoryEntry
  isExpanded: boolean
}>()

const router = useRouter()
let touchStartY = 0

const RESULT = {
  Win: { label: '勝', ink: 'text-success-dark', bg: 'bg-success-light' },
  Loss: { label: '負', ink: 'text-danger-dark', bg: 'bg-danger-light' },
  Draw: { label: '和', ink: 'text-ink-muted', bg: 'bg-surface-raised' },
  Unknown: { label: '?', ink: 'text-ink-faint', bg: 'bg-surface-raised' },
} as const

const result = computed(() => RESULT[props.entry.playerResult])
const colorLabel = computed(() => (props.entry.playerColor === 'white' ? '執白' : '執黑'))

function onRowClick() {
  router.push({ name: 'review', query: { gameId: props.entry.id } })
}

function onTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0].clientY
}

function onTouchEnd(e: TouchEvent) {
  const delta = Math.abs(e.changedTouches[0].clientY - touchStartY)
  if (delta < 4) {
    onRowClick()
  }
}
</script>

<template>
  <div
    class="cursor-pointer select-none rounded-card border border-line border-t-white/70 border-b-line-subtle bg-surface-card shadow-card transition-colors hover:bg-surface-hover"
    data-testid="history-row"
    role="listitem"
    :aria-expanded="props.isExpanded"
    @click="onRowClick"
    @touchstart.passive="onTouchStart"
    @touchend.prevent="onTouchEnd"
  >
    <!-- Collapsed row -->
    <div class="flex min-h-[56px] items-center gap-3 px-3.5 py-3">
      <!-- 結果徽章 -->
      <div
        class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]"
        :class="result.bg"
      >
        <span class="font-num text-base font-bold" :class="result.ink">{{ result.label }}</span>
      </div>

      <!-- 開局 + 手數 -->
      <div class="min-w-0 flex-1">
        <p class="truncate font-sans text-sm font-bold text-ink">
          {{ props.entry.openingDisplay }}
        </p>
        <p class="mt-0.5 font-sans text-xs text-ink-muted">
          {{ colorLabel }} · {{ props.entry.moveCount }} 手
        </p>
      </div>

      <!-- 日期 + 箭頭 -->
      <div class="flex shrink-0 flex-col items-end gap-1">
        <span class="font-sans text-[11px] text-ink-faint">{{ props.entry.displayDate }}</span>
        <ChevronRight :size="14" class="text-ink-faint" :stroke-width="1.8" />
      </div>
    </div>

    <!-- 展開面板 (AC-12) -->
    <div
      v-if="props.isExpanded"
      class="space-y-1 border-t border-line-subtle px-3.5 py-3 text-sm text-ink-muted"
    >
      <div><span class="text-ink-faint">手數：</span>{{ props.entry.moveCount }}</div>
      <div><span class="text-ink-faint">結果：</span>{{ props.entry.endReasonDisplay }}</div>
      <div><span class="text-ink-faint">難度：</span>{{ props.entry.difficultyLabel }}</div>
      <div><span class="text-ink-faint">執子：</span>{{ props.entry.playerColor }}</div>
    </div>
  </div>
</template>
