<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Check } from 'lucide-vue-next'
import LessonPlayer from '@/components/lesson/LessonPlayer.vue'
import { Button } from '@/components/ui/button'
import { getLessonById, lessons } from '@/data/lessons'
import { LESSON_TIER_LABELS, LESSON_TIER_PIECES as TIER_PIECE, LESSON_TIER_NUMERALS as TIER_NUM } from '@/types/lesson'
import { ChapterBadge, InkBrush, InkSplatter } from '@/components/ui/gambit'
import { useLessonProgressStore } from '@/stores/lesson-progress'

const route = useRoute()
const router = useRouter()
const progress = useLessonProgressStore()

const lesson = getLessonById(route.params.lessonId as string)

// Guard: unknown or still-locked lesson → back to the catalog.
if (!lesson || !progress.isUnlocked(lesson)) {
  router.replace('/learn')
}

function onComplete(): void {
  if (lesson) progress.markComplete(lesson.id)
}

// 繼續下一課（線性下一課）
const nextLesson = computed(() => {
  if (!lesson) return null
  const idx = lessons.findIndex((l) => l.id === lesson!.id)
  return idx >= 0 ? (lessons[idx + 1] ?? null) : null
})

function goToNextLesson(): void {
  if (nextLesson.value) router.push(`/learn/${nextLesson.value.id}`)
}
</script>

<template>
  <LessonPlayer
    v-if="lesson"
    :steps="lesson.steps"
    :title="lesson.title"
    :player-color="lesson.playerColor"
    :scenario="lesson.scenario"
    back-to="/learn"
    back-label="返回課程清單"
    @complete="onComplete"
  >
    <!-- 課末收尾：證書感設計——章節勳章 + 金線框 + 課程名稱 + 重點摘要 -->
    <template #completion-card>
      <div data-testid="lesson-completion" class="relative isolate flex w-full flex-col items-center">
        <!-- 金墨飛濺：reward 時刻慶祝襯底（環狀避中心、-z-10 不搶勳章與文字）-->
        <InkSplatter class="-z-10" :count="26" :seed="4" />
        <!-- M2: 章節脈絡小標 -->
        <p class="mb-4 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          第{{ TIER_NUM[lesson.tier] }}章 · {{ LESSON_TIER_LABELS[lesson.tier] }}
        </p>

        <!-- H3: 金線分隔（上） -->
        <div class="mb-5 flex w-full items-center gap-2 px-1" aria-hidden="true">
          <div class="h-px flex-1 bg-linear-to-r from-transparent to-gold/40" />
          <span class="h-[5px] w-[5px] rotate-45 bg-gold/55" />
          <div class="h-px flex-1 bg-linear-to-l from-transparent to-gold/40" />
        </div>

        <!-- H1: 金邊勳章（章節棋子 + 綠色完成角標） -->
        <div class="relative">
          <div class="rounded-full shadow-[0_0_0_5px_rgba(248,181,0,0.18),0_0_28px_rgba(248,181,0,0.2)]">
            <ChapterBadge :piece="TIER_PIECE[lesson.tier]" :size="96" />
          </div>
          <span
            class="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-success text-success-fg shadow-[0_2px_8px_rgba(0,0,0,0.18)] ring-2 ring-surface-card"
            aria-hidden="true"
          ><Check :size="15" :stroke-width="2.5" /></span>
        </div>

        <!-- H2: 認定標語 + 課程名稱 -->
        <p class="mt-3 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          · 課程完成 ·
        </p>
        <p class="mt-1 font-display text-xl font-bold text-ink">{{ lesson.title }}</p>
        <!-- 墨筆底線：課程名的手寫確認感（reward 時刻）-->
        <div class="mt-1 flex justify-center" aria-hidden="true">
          <InkBrush :width="168" :height="12" :seed="5" />
        </div>

        <!-- H3: 金線分隔（下） -->
        <div class="my-4 flex w-full items-center gap-2 px-1" aria-hidden="true">
          <div class="h-px flex-1 bg-linear-to-r from-transparent to-gold/40" />
          <span class="h-[5px] w-[5px] rotate-45 bg-gold/55" />
          <div class="h-px flex-1 bg-linear-to-l from-transparent to-gold/40" />
        </div>

        <!-- L1: 本課重點（置中純文字，不加框） -->
        <p v-if="lesson.summary" class="w-full px-2 text-center font-lesson text-[15px] leading-relaxed text-ink-muted">{{ lesson.summary }}</p>
      </div>
    </template>

    <!-- 課末收尾：金色主按鈕獨佔一行，次要動作改 secondary -->
    <template #completion-actions>
      <div class="flex w-full gap-2">
        <Button
          v-if="nextLesson"
          variant="secondary"
          class="flex-1 justify-center text-sm"
          data-testid="lesson-completion-return"
          @click="router.push('/learn')"
        >回課程列表</Button>
        <Button
          variant="gold"
          class="flex-1 justify-center text-sm"
          data-testid="lesson-completion-next"
          @click="nextLesson ? goToNextLesson() : router.push('/learn')"
        >{{ nextLesson ? '繼續下一課' : '回課程列表' }} <ArrowRight :size="16" :stroke-width="1.8" /></Button>
      </div>
    </template>
  </LessonPlayer>
</template>
