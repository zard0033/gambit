<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { RotateCw } from 'lucide-vue-next'
import { useGameHistoryStore } from '@/stores/game-history'
import { useAuthStore } from '@/stores/auth'
import HistoryRow from '@/components/history-row.vue'
import { HISTORY_SKELETON_ROWS } from '@/config/history-config'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DarkPanel } from '@/components/ui/gambit'

const store = useGameHistoryStore()
const authStore = useAuthStore()

const isGuest = computed(() => !authStore.userId)

const loadMoreError = ref<string | null>(null)
const loadMoreAnnouncement = ref('')

const showRefresh = computed(() =>
  !store.isLoading && (store.entries.length > 0 || store.error !== null),
)

const summary = computed(() => {
  let wins = 0
  let draws = 0
  let losses = 0
  for (const e of store.entries) {
    if (e.playerResult === 'Win') wins++
    else if (e.playerResult === 'Draw') draws++
    else if (e.playerResult === 'Loss') losses++
  }
  return [
    { label: '勝', val: wins, col: 'text-success-on-deep' },
    { label: '和', val: draws, col: 'text-ink-on-deep-dim' },
    { label: '負', val: losses, col: 'text-danger-on-deep' },
  ]
})

const errorMessage = computed(() => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return '沒有網路連線，請檢查連線後再試。'
  }
  return '無法載入對局紀錄，請再試一次。'
})

function onRefresh() {
  store.invalidate()
  store.fetchHistory()
}

function onRetry() {
  store.fetchHistory()
}

async function onLoadMore() {
  loadMoreError.value = null
  try {
    await store.loadMore()
    loadMoreAnnouncement.value = `已載入 ${store.entries.length} 局`
  } catch {
    loadMoreError.value = '無法載入更多對局，請再試一次。'
  }
}

onMounted(() => {
  if (store.cacheState !== 'valid') {
    store.fetchHistory()
  }
})
</script>

<template>
  <div class="max-w-2xl mx-auto pb-7">
    <!-- 標頭 -->
    <header class="flex items-center justify-between px-[18px] pb-2 pt-5">
      <h1 class="font-display text-2xl font-bold text-ink" tabindex="-1">對局紀錄</h1>
      <Button
        v-if="showRefresh"
        variant="ghost"
        size="icon"
        aria-label="重新整理對局紀錄"
        @click="onRefresh"
      ><RotateCw :size="18" :stroke-width="1.8" /></Button>
    </header>

    <!-- 訪客資料定位：存此裝置，登入即雲端備份 -->
    <p
      v-if="isGuest && !store.isLoading && store.entries.length > 0"
      class="px-[18px] pb-1 font-sans text-xs text-ink-muted"
    >
      訪客資料存於此裝置 ·
      <RouterLink to="/sign-in" class="font-medium text-primary underline-offset-2 hover:underline">登入即雲端備份</RouterLink>
    </p>

    <!-- 戰績摘要 — 深青瓷 -->
    <div v-if="store.entries.length > 0" class="px-[18px] pb-1 pt-1">
      <DarkPanel>
        <div class="flex">
          <div v-for="s in summary" :key="s.label" class="flex-1 py-1 text-center">
            <div class="font-num text-[28px] font-bold leading-none" :class="s.col">{{ s.val }}</div>
            <div class="mt-1.5 font-sans text-[11px] text-ink-on-deep-dim">{{ s.label }}</div>
          </div>
        </div>
      </DarkPanel>
    </div>

    <div class="px-[18px] pt-3.5">
      <!-- Loading -->
      <div v-if="store.isLoading" role="list" aria-busy="true" class="space-y-2.5">
        <Skeleton
          v-for="n in HISTORY_SKELETON_ROWS"
          :key="n"
          class="h-[56px] rounded-card"
          aria-hidden="true"
          style="pointer-events: none"
        />
        <p role="status" class="sr-only">載入對局紀錄中</p>
      </div>

      <!-- Error (initial load, no cached data) -->
      <div v-else-if="store.error && store.entries.length === 0" class="py-12 text-center">
        <p class="mb-4 text-ink">{{ errorMessage }}</p>
        <Button @click="onRetry">再試一次</Button>
      </div>

      <!-- Empty -->
      <div v-else-if="store.entries.length === 0" class="py-12 text-center">
        <p class="mb-4 text-ink-muted">還沒有對局紀錄</p>
        <Button as-child><RouterLink to="/play">開始一盤 →</RouterLink></Button>
      </div>

      <!-- List -->
      <template v-else>
        <!-- Error banner above cached list (refresh failure) -->
        <Alert
          v-if="store.error"
          variant="danger"
          class="mb-3 flex items-center justify-between py-2.5"
        >
          <AlertDescription class="text-danger">{{ errorMessage }}</AlertDescription>
          <Button variant="link" class="ml-3 text-danger" @click="onRetry">再試一次</Button>
        </Alert>

        <div role="list" class="space-y-2.5">
          <HistoryRow
            v-for="entry in store.entries"
            :key="entry.id"
            :entry="entry"
          />
        </div>

        <div v-if="store.hasMore || store.isLoadingMore" class="mt-4 text-center">
          <Button
            v-if="!store.isLoadingMore"
            data-testid="load-more-button"
            variant="secondary"
            class="text-sm"
            @click="onLoadMore"
          >載入更多</Button>
          <div
            v-else
            role="status"
            aria-label="載入更多對局中"
            class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-line border-t-primary"
          />
        </div>

        <div
          v-if="loadMoreError"
          class="mt-2 text-center text-sm text-danger"
          role="alert"
        >{{ loadMoreError }}</div>

        <div role="status" class="sr-only" aria-live="polite">{{ loadMoreAnnouncement }}</div>
      </template>
    </div>
  </div>
</template>
