<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { BookOpen, Target, Library } from 'lucide-vue-next'
import { LESSON_TIER_LABELS } from '@/types/lesson'
import { greetingForNow } from '@/lib/utils'
import { useLessonProgressStore } from '@/stores/lesson-progress'
import { useDungeonProgressStore } from '@/stores/dungeon-progress'
import { puzzles } from '@/data/puzzles'
import { useUiStore } from '@/stores/ui-store'
import { useResumeGameStore } from '@/stores/resume-game'
import { useJournalStore } from '@/stores/journal'
import { HOMEPAGE_PEEK_COUNT } from '@/config/journal-config'
import { getLastSeenAt, isUnread } from '@/modules/journal/unread'
import NeveSceneHeader, { type CtaStation, type PathStation } from '@/components/home/NeveSceneHeader.vue'
import { useReducedMotion } from '@/composables/use-reduced-motion'

const router = useRouter()
const progress = useLessonProgressStore()
const { nextLesson } = storeToRefs(progress)
const dungeon = useDungeonProgressStore()
const uiStore = useUiStore()
const resume = useResumeGameStore()
const journal = useJournalStore()

// 未讀水位：在 mount 前捕捉，使 peek 的未讀點在本次渲染穩定。
const lastSeenAt = getLastSeenAt()
const peekEntries = computed(() => journal.recent(HOMEPAGE_PEEK_COUNT))

const greeting = computed(greetingForNow)
const lessonOrdinal = computed(() => progress.completedCount + 1)

function startGame() {
  // Open the setup modal over the home page; navigation to /play happens after the player confirms.
  uiStore.openPlaySetup()
}
function continueGame() {
  uiStore.requestResume()
  router.push('/play')
}
// 另開新對局：只開設定 modal，不在此清除 resume——真正的清除在 PlayView 確認開局時（startFromPayload）
// 才做。否則使用者只是點開、又關掉 modal 沒開成，進行中對局會被誤刪。

// 「繼續走」站：進行中對局 → 回到棋盤；否則 → 開始新對局。
const ctaStation = computed<CtaStation>(() => {
  const r = resume.current
  if (r) {
    const colorLabel = r.playerColor === 'white' ? '執白' : '執黑'
    return {
      headline: '上一盤還沒下完',
      meta: `第 ${r.moves.length} 手 · ${colorLabel} · Lv.${r.level}`,
      primaryLabel: '回到棋盤',
      onPrimary: continueGame,
      secondaryLabel: '另開新對局',
      onSecondary: startGame,
    }
  }
  return {
    headline: '開一盤新的',
    meta: '自選強度與執子',
    primaryLabel: '開始對局',
    onPrimary: startGame,
  }
})

// 「學習」站：下一課，或全部完成時導回地圖。
const lessonStation = computed<PathStation>(() => {
  const lesson = nextLesson.value
  if (!lesson) {
    return { title: '你已完成所有課程', sub: '回到學習地圖看看還有什麼', to: '/learn' }
  }
  return {
    title: lesson.title,
    sub: `第 ${lessonOrdinal.value} 課 · ${LESSON_TIER_LABELS[lesson.tier]}`,
    to: `/learn/${lesson.id}`,
  }
})

// 「試煉」站：目前解到的題（currentOrder），或全部解開時導回試煉地圖。
const currentPuzzle = computed(() => puzzles.find((p) => p.order === dungeon.currentOrder))
const trialStation = computed<PathStation>(() => {
  const puzzle = currentPuzzle.value
  if (!puzzle) {
    return { title: '你已破解所有試煉', sub: '回到試煉地圖看看還有什麼', to: '/dungeon' }
  }
  return { title: puzzle.title, sub: puzzle.brief, to: `/dungeon/${puzzle.id}` }
})

// Blocks below the scene fade-rise once on mount (≤300ms, small stagger).
// prefers-reduced-motion skips the animation (CSS media query forces the lit state).
const { prefersReducedMotion } = useReducedMotion()
const ready = ref(false)

onMounted(() => {
  // evaluate() 內部自己 await load()，settle 完再 reload 一次——取代單純 load()，
  // 讓首頁成為 onset/arrival/solace 的其中一個結算觸發點。
  void journal.evaluate()

  if (prefersReducedMotion.value) {
    ready.value = true
    return
  }
  requestAnimationFrame(() => requestAnimationFrame(() => (ready.value = true)))
})
</script>

<template>
  <div>
    <!-- 氛圍首屏：星夜天色場景＋蜿蜒小徑（三站＝今天可做的事）。留在 max-w 容器之外＝full-bleed。 -->
    <NeveSceneHeader :greeting="greeting" :cta="ctaStation" :lesson="lessonStation" :trial="trialStation" />

    <div class="max-w-2xl md:max-w-4xl mx-auto px-[18px] pb-6">
      <!-- 棋誌 peek（有新筆才顯示；cream 卡，落在場景下方的「地面」） -->
      <div v-if="peekEntries.length > 0" class="fade-rise ground-card" :class="{ 'is-in': ready }">
        <p class="ground-eyebrow">棋誌・最近所記</p>
        <div class="space-y-2">
          <RouterLink
            v-for="entry in peekEntries"
            :key="entry.id"
            to="/journal"
            class="flex min-h-[44px] items-center gap-2.5 rounded-card px-1 py-1 hover:opacity-80 transition-opacity"
            data-testid="journal-peek-entry"
          >
            <span
              v-if="isUnread(entry, lastSeenAt)"
              class="h-1.5 w-1.5 flex-shrink-0 self-start mt-[7px] rounded-full bg-[#7EBEA5]/60"
              data-testid="unread-dot"
              aria-hidden="true"
            />
            <p class="flex-1 font-lesson text-[14px] leading-[1.7] text-ink line-clamp-2">{{ entry.body }}</p>
          </RouterLink>
        </div>
      </div>

      <!-- 底部三數字：課程／試煉／棋誌 -->
      <div class="fade-rise glance" :class="{ 'is-in': ready }" style="transition-delay: 60ms">
        <RouterLink to="/learn" class="glance-item" aria-label="學習進度">
          <BookOpen :size="16" :stroke-width="1.8" class="glance-icon" aria-hidden="true" />
          <span class="glance-num">{{ progress.completedCount }}/{{ progress.totalCount }}</span>
          <span class="glance-label">課程</span>
        </RouterLink>
        <RouterLink to="/dungeon" class="glance-item" aria-label="試煉">
          <Target :size="16" :stroke-width="1.8" class="glance-icon" aria-hidden="true" />
          <span class="glance-num">{{ dungeon.solvedCount }}/{{ dungeon.totalCount }}</span>
          <span class="glance-label">試煉</span>
        </RouterLink>
        <RouterLink to="/journal" class="glance-item" aria-label="棋誌">
          <Library :size="16" :stroke-width="1.8" class="glance-icon" aria-hidden="true" />
          <span class="glance-num">{{ journal.entries.length > 0 ? journal.entries.length : '—' }}</span>
          <span class="glance-label">棋誌</span>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Below-scene blocks: single fade-rise on mount (≤300ms), small stagger via
   inline transition-delay. transform/opacity only. */
.fade-rise {
  opacity: 0;
  transform: translateY(10px);
  transition:
    opacity 280ms cubic-bezier(0, 0, 0.2, 1),
    transform 280ms cubic-bezier(0, 0, 0.2, 1);
}
.fade-rise.is-in {
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  .fade-rise {
    opacity: 1;
    transform: none;
    transition: none;
  }
}

.ground-card {
  margin-top: -56px;
  position: relative;
  z-index: 3;
  background: var(--color-surface-card);
  border: 1px solid var(--color-line-subtle);
  border-radius: 1.125rem;
  padding: 20px;
  box-shadow: 0 8px 24px rgba(61, 34, 16, 0.08);
}
.ground-eyebrow {
  font-size: 12px;
  color: var(--color-ink-muted);
  margin-bottom: 10px;
}

.glance {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.glance-item {
  flex: 1;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 14px 8px;
  border-radius: 0.75rem;
  text-decoration: none;
}
.glance-item:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 2px;
}
.glance-icon {
  color: var(--color-primary);
  margin-bottom: 4px;
}
.glance-num {
  font-family: var(--font-num);
  font-size: 18px;
  color: var(--color-primary-dark);
  font-weight: 700;
}
.glance-label {
  font-size: 12px;
  color: var(--color-ink-muted);
  margin-top: 2px;
}
</style>
