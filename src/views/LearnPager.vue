<script setup lang="ts">
/**
 * Learn section pager (IG-style swipe). The 課程 + 概念 panes sit side by side in a native
 * horizontal scroll-snap track: swiping pans between them with the content following the finger and
 * snapping on release, while the tab indicator tracks the pan. Tapping a tab jumps instantly (no
 * slide). The route (/learn ↔ /learn/concepts) stays in sync for deep-linking — BOTH paths render
 * this component, so the pager instance persists across the sub-tab switch (the tabs never remount).
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LearnTabs from '@/components/learn-tabs.vue'
import LearnView from '@/views/LearnView.vue'
import ConceptMapView from '@/views/ConceptMapView.vue'

const route = useRoute()
const router = useRouter()

const PATHS = ['/learn', '/learn/concepts'] as const
const indexOf = (path: string): number => (path === '/learn/concepts' ? 1 : 0)

const activeIndex = ref(indexOf(route.path))
const progress = ref(activeIndex.value) // 0..1 live pan position, drives the indicator

const trackEl = ref<HTMLElement | null>(null)

function scrollToIndex(i: number, smooth: boolean): void {
  const el = trackEl.value
  if (!el) return
  el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' })
}

function setActive(i: number): void {
  if (i === activeIndex.value) {
    progress.value = i
    return
  }
  activeIndex.value = i
  progress.value = i
  if (route.path !== PATHS[i]) void router.replace(PATHS[i])
}

// Tap a tab → smooth slide (mirrors the swipe feel); activeIndex + route update immediately
// so the tab highlight changes right away, while progress animates via onScroll.
function onSelect(i: number): void {
  if (i === activeIndex.value) return
  activeIndex.value = i
  if (route.path !== PATHS[i]) void router.replace(PATHS[i])
  scrollToIndex(i, true)
}

// Native scroll drives the indicator live; debounce the settle to sync the active tab + route.
let settleTimer: ReturnType<typeof setTimeout> | null = null
function onScroll(): void {
  const el = trackEl.value
  if (!el || !el.clientWidth) return
  progress.value = el.scrollLeft / el.clientWidth
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => setActive(Math.round(el.scrollLeft / el.clientWidth)), 90)
}

// External navigation (browser back, re-entering /learn from the bottom nav) → move to that pane.
watch(
  () => route.path,
  (p) => {
    const i = indexOf(p)
    if (i !== activeIndex.value) {
      activeIndex.value = i
      progress.value = i
      scrollToIndex(i, false)
    }
  },
)

// Viewport resize / rotate changes clientWidth → the snapped scrollLeft no longer aligns to a pane
// (track stalls between panes). Re-align to the active pane, rAF-coalesced.
let _resizeRaf: number | null = null
function onResize(): void {
  if (_resizeRaf !== null) cancelAnimationFrame(_resizeRaf)
  _resizeRaf = requestAnimationFrame(() => {
    _resizeRaf = null
    progress.value = activeIndex.value
    scrollToIndex(activeIndex.value, false)
  })
}

onMounted(() => {
  // Place the initial pane without animation once the track has measurable width.
  nextTick(() => scrollToIndex(activeIndex.value, false))
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (_resizeRaf !== null) cancelAnimationFrame(_resizeRaf)
})
</script>

<template>
  <div class="flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-x-hidden">
    <div class="mx-auto w-full max-w-md shrink-0 px-[18px] pb-1.5 pt-4 lg:max-w-sm">
      <h1 class="sr-only" tabindex="-1">學習</h1>
      <LearnTabs :active-index="activeIndex" :progress="progress" @select="onSelect" />
    </div>

    <div
      ref="trackEl"
      class="learn-track relative flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
      @scroll="onScroll"
    >
      <section
        class="h-full w-full shrink-0 snap-start overflow-y-auto overscroll-y-contain pb-[calc(4rem+env(safe-area-inset-bottom))]"
      >
        <LearnView />
      </section>
      <section
        class="h-full w-full shrink-0 snap-start overflow-y-auto overscroll-y-contain pb-[calc(4rem+env(safe-area-inset-bottom))]"
      >
        <ConceptMapView />
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Hide the horizontal scrollbar — the tabs are the affordance. */
.learn-track {
  scrollbar-width: none;
}
.learn-track::-webkit-scrollbar {
  display: none;
}
</style>
