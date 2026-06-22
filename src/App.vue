<script setup lang="ts">
import { onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDataSyncStore } from '@/stores/data-sync'
import { useLessonProgressStore } from '@/stores/lesson-progress'
import { useDungeonProgressStore } from '@/stores/dungeon-progress'
import { useResumeGameStore } from '@/stores/resume-game'
import { useConceptProgressStore } from '@/stores/concept-progress'
import { useJournalStore } from '@/stores/journal'
import { useUiStore } from '@/stores/ui-store'
import type { PendingGame } from '@/stores/ui-store'
import AppNav from '@/components/app-nav.vue'
import PlaySetupModal from '@/components/play-setup-modal.vue'

const authStore = useAuthStore()
const dataSyncStore = useDataSyncStore()
const lessonProgressStore = useLessonProgressStore()
const dungeonProgressStore = useDungeonProgressStore()
const resumeGameStore = useResumeGameStore()
const conceptProgressStore = useConceptProgressStore()
const journalStore = useJournalStore()
const uiStore = useUiStore()
const route = useRoute()
const router = useRouter()

// Global play-setup modal: opens over the current page; confirming navigates to /play with the
// chosen settings (PlayView starts the game directly — no modal on the board screen).
function onSetupStart(payload: PendingGame): void {
  uiStore.requestGame(payload)
  if (route.name !== 'play') router.push('/play')
}
function onSetupClose(): void {
  uiStore.closePlaySetup()
}

// 沉浸式全屏頁（登入）不套 app chrome：無頂部品牌列、無底部 tab。
const fullBleed = computed(() => route.meta.fullBleed === true)

// 學習 pager（/learn、/learn/concepts）自管高度與內部捲動，main 不可再加底部 nav padding，否則高度溢位。
const isLearnPager = computed(() => route.path === '/learn' || route.path === '/learn/concepts')

// RouterView key：param/query 路由（puzzle/lesson/concept-deepen/review-by-gameId）的 setup 只讀一次，
// 換 param/query 時 vue-router 會重用同一 component instance、setup 不重跑（試煉「下一題」換題無反應的主因）。
// 用 fullPath 當 key 強制 remount。learn/concepts 共用同一 LearnPager 實例（分頁滑動不可重繪），固定同一 key。
const routeKey = computed(() => {
  const n = route.name as string
  if (n === 'puzzle' || n === 'lesson' || n === 'review' || n === 'concept-deepen') return route.fullPath
  if (n === 'learn' || n === 'concepts') return 'learn-pager'
  return n
})

// 頁面底色套在 <main> 上：深色頁（試煉/對局）的底部 nav 留白區若無底色會露出 body 的 cream
// （試煉底部未填色 bug）。套在 main 讓 padding 區與內容同色。
const pageBg = computed(() => {
  switch (route.name) {
    case 'dungeon':
      return 'bg-surface-dungeon'
    case 'play':
      return 'bg-surface-deep'
    default:
      return 'bg-surface-base'
  }
})

// Flush offline queue + reconcile lesson progress when player logs in (SUPA-AC-08).
// immediate: on routes that pass the landing gate the router awaits isAuthLoading before mount
// (main.ts), so a restored session already has userId set when this watcher registers — immediate
// catches it. On /sign-in the guard returns early without waiting, so userId may still be null at
// mount; there the later reactive change drives the reconcile. The userId guard makes guest a no-op.
watch(() => authStore.userId, (userId) => {
  if (userId) {
    dataSyncStore.flushUnsyncedQueue()
    lessonProgressStore.reconcileOnLogin()
    dungeonProgressStore.reconcileOnLogin()
    resumeGameStore.reconcileOnLogin()
    conceptProgressStore.reconcileOnLogin()
    journalStore.reconcileOnLogin()
  }
}, { immediate: true })

onMounted(() => {
  // Warm the primary tab route chunks during idle so tab taps swap instantly on mobile
  // (first visit otherwise blocks on downloading/parsing each view's lazy chunk). Importing
  // only loads the module — PlayView's Stockfish init still waits for the view to actually mount.
  const prefetch = (): void => {
    void import('@/views/PlayView.vue')
    void import('@/views/LearnPager.vue')
    void import('@/views/DungeonMapView.vue')
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(prefetch)
  else setTimeout(prefetch, 1500)
})
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <AppNav v-if="!fullBleed" />
    <main class="flex-1" :class="[fullBleed || isLearnPager ? '' : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0', pageBg]">
      <RouterView :key="routeKey" />
    </main>

    <!-- Global play-setup modal — opens over the current page (Dialog portals above everything). -->
    <PlaySetupModal
      v-if="uiStore.showPlaySetup"
      :beaten-level="uiStore.highestBeatenLevel"
      @start="onSetupStart"
      @close="onSetupClose"
    />
  </div>
</template>
