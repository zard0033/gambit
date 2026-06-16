<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Lock, ChevronRight } from 'lucide-vue-next'
import { lessons } from '@/data/lessons'
import { LESSON_TIER_LABELS } from '@/types/lesson'
import type { Lesson, LessonTier } from '@/types/lesson'
import { useLessonProgressStore } from '@/stores/lesson-progress'
import { ChapterBadge } from '@/components/ui/gambit'

const router = useRouter()
const progress = useLessonProgressStore()

// 棋子徽章：用棋盤同一套 Gioco Wood 棋子（扁平 jade 剪影），與 Home 一致。
const base = import.meta.env.BASE_URL
const TIER_PIECE: Record<LessonTier, string> = { 1: 'bP', 2: 'bN', 3: 'bR', 4: 'bK' }
const TIER_NUM: Record<LessonTier, string> = { 1: '一', 2: '二', 3: '三', 4: '四' }
const TIER_SUB: Record<LessonTier, string> = {
  1: '棋子走法 · 基本規則',
  2: '戰術組合 · 棋子配合',
  3: '控制中心 · 快速發展',
  4: '殘局技巧 · 王兵協同',
}

const nextLesson = computed(
  () => [...lessons].find((l) => progress.isUnlocked(l) && !progress.isCompleted(l.id)) ?? null,
)

interface Chapter {
  tier: LessonTier
  lessons: Lesson[]
  done: number
  total: number
}

const chapters = computed<Chapter[]>(() => {
  const map = new Map<LessonTier, Lesson[]>()
  for (const l of lessons) {
    const arr = map.get(l.tier) ?? []
    arr.push(l)
    map.set(l.tier, arr)
  }
  return [...map.entries()].map(([tier, ls]) => ({
    tier,
    lessons: ls,
    done: ls.filter((l) => progress.isCompleted(l.id)).length,
    total: ls.length,
  }))
})

// 作用中章節 = 含「下一課」的章節；全部完成時取最後一章
const activeTier = computed<LessonTier>(
  () => nextLesson.value?.tier ?? chapters.value[chapters.value.length - 1].tier,
)

function chapterStatus(c: Chapter): 'active' | 'done' | 'locked' {
  if (c.tier === activeTier.value) return 'active'
  return c.tier < activeTier.value ? 'done' : 'locked'
}

function lessonState(l: Lesson): 'done' | 'current' | 'locked' {
  if (progress.isCompleted(l.id)) return 'done'
  if (l.id === nextLesson.value?.id) return 'current'
  return 'locked'
}

function openLesson(l: Lesson): void {
  if (lessonState(l) !== 'locked') router.push(`/learn/${l.id}`)
}

// 章節展開/收合（active 預設展開；done 回顧、locked 預覽）
const expandedTier = ref<LessonTier | null>(activeTier.value)

function toggleChapter(c: Chapter): void {
  expandedTier.value = expandedTier.value === c.tier ? null : c.tier
}
</script>

<template>
  <div class="mx-auto max-w-md lg:max-w-2xl pb-8">
    <h1 class="sr-only" tabindex="-1">棋藝課程</h1>
    <div class="flex flex-col gap-2.5 px-[14px] pt-3">
      <template v-for="c in chapters" :key="c.tier">
        <div class="overflow-hidden rounded-[14px] border border-line">
          <!-- 統一 header button：active=jade底、done/locked=cream底 -->
          <button
            type="button"
            class="flex w-full items-center gap-2.5 px-3.5 pb-3 pt-3.5 text-left transition-colors"
            :class="chapterStatus(c) === 'active'
              ? 'bg-surface-deep-2'
              : 'bg-surface-raised hover:bg-surface-hover'"
            @click="toggleChapter(c)"
          >
            <ChapterBadge
              v-if="chapterStatus(c) !== 'locked'"
              :piece="TIER_PIECE[c.tier]"
              :size="40"
            />
            <span v-else class="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full">
              <span
                class="block h-[22px] w-[22px] bg-ink-faint"
                aria-hidden="true"
                :style="{
                  WebkitMaskImage: `url(${base}pieces/silhouette/${TIER_PIECE[c.tier]}.svg)`,
                  maskImage: `url(${base}pieces/silhouette/${TIER_PIECE[c.tier]}.svg)`,
                  WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center', maskPosition: 'center',
                  WebkitMaskSize: 'contain', maskSize: 'contain',
                }"
              />
            </span>
            <div class="min-w-0 flex-1">
              <p class="mb-0.5 font-sans text-[10px] font-bold uppercase tracking-widest"
                :class="chapterStatus(c) === 'active' ? 'text-gold' : 'text-ink-faint'"
              >第{{ TIER_NUM[c.tier] }}章</p>
              <p class="font-display text-[15px] font-bold leading-tight"
                :class="{
                  'text-ink-on-deep': chapterStatus(c) === 'active',
                  'text-ink': chapterStatus(c) === 'done',
                  'text-ink-muted': chapterStatus(c) === 'locked',
                }"
              >{{ LESSON_TIER_LABELS[c.tier] }}</p>
              <p class="mt-0.5 font-sans text-[10px]"
                :class="chapterStatus(c) === 'active' ? 'text-ink-on-deep-dim' : 'text-ink-faint'"
              >{{ TIER_SUB[c.tier] }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <span class="font-num text-[11px]"
                :class="chapterStatus(c) === 'active' ? 'text-ink-on-deep-dim' : 'text-ink-faint'"
              >{{ c.done }}/{{ c.total }}</span>
              <ChevronRight
                :size="16"
                class="transition-transform duration-200 motion-reduce:transition-none"
                :class="[
                  expandedTier === c.tier ? 'rotate-90' : '',
                  chapterStatus(c) === 'active' ? 'text-ink-on-deep-dim' : 'text-ink-faint',
                ]"
                :stroke-width="1.8"
              />
            </div>
          </button>

          <!-- 進度條（active 限定，永遠可見） -->
          <div v-if="chapterStatus(c) === 'active'" class="h-[3px] overflow-hidden bg-surface-deep-2">
            <div
              class="h-full bg-[linear-gradient(90deg,#3AB894,#F8B500)] transition-[width] duration-300 motion-reduce:transition-none"
              :style="{ width: `${(c.done / c.total) * 100}%` }"
            />
          </div>

          <!-- 課程列：CSS grid 滑展動畫 -->
          <div class="chapter-collapse" :class="{ expanded: expandedTier === c.tier }">
          <div class="chapter-collapse-inner border-t border-line bg-surface-card">
            <!-- active：done / current / locked 三態 -->
            <template v-if="chapterStatus(c) === 'active'">
              <button
                v-for="(l, i) in c.lessons"
                :key="l.id"
                type="button"
                class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
                :class="[
                  i < c.lessons.length - 1 && 'border-b border-black/4',
                  lessonState(l) === 'current' && 'bg-[linear-gradient(90deg,#FAF2DC,#FDF9EE)]',
                  lessonState(l) === 'locked' ? 'cursor-default' : 'hover:bg-surface-hover',
                ]"
                :disabled="lessonState(l) === 'locked'"
                @click="openLesson(l)"
              >
                <span
                  class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                  :class="{
                    'bg-primary-soft': lessonState(l) === 'done',
                    'bg-[linear-gradient(150deg,#ffc94d,#f8b500)] shadow-[0_0_6px_rgba(248,181,0,0.4)]': lessonState(l) === 'current',
                    'bg-surface-raised': lessonState(l) === 'locked',
                  }"
                >
                  <Check v-if="lessonState(l) === 'done'" :size="10" class="text-primary" :stroke-width="3.5" />
                  <span v-else-if="lessonState(l) === 'current'" class="font-sans text-[9px] font-bold text-gold-ink">{{ i + 1 }}</span>
                  <Lock v-else :size="9" class="text-ink-faint" :stroke-width="2.5" />
                </span>
                <span
                  class="flex-1 line-clamp-2 font-sans text-xs"
                  :class="{
                    'font-bold text-ink': lessonState(l) === 'current',
                    'text-ink-muted': lessonState(l) === 'done',
                    'text-ink-faint': lessonState(l) === 'locked',
                  }"
                >{{ l.title }}</span>
                <span v-if="lessonState(l) === 'current'" class="shrink-0 rounded-full bg-[linear-gradient(180deg,#ffc94d,#f8b500)] px-2.5 py-1 font-sans text-[11px] font-bold text-gold-ink">繼續</span>
                <span v-else-if="lessonState(l) === 'done'" class="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 font-sans text-[11px] font-bold text-primary">複習</span>
              </button>
            </template>
            <!-- done：可點擊複習 -->
            <template v-else-if="chapterStatus(c) === 'done'">
              <button
                v-for="(l, i) in c.lessons"
                :key="l.id"
                type="button"
                class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
                :class="i < c.lessons.length - 1 && 'border-b border-black/4'"
                @click="openLesson(l)"
              >
                <span class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary-soft">
                  <Check :size="10" class="text-primary" :stroke-width="3.5" />
                </span>
                <span class="flex-1 line-clamp-2 font-sans text-xs text-ink-muted">{{ l.title }}</span>
                <span class="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 font-sans text-[11px] font-bold text-primary">複習</span>
              </button>
            </template>
            <!-- locked：純預覽，不可進入 -->
            <template v-else>
              <div
                v-for="(l, i) in c.lessons"
                :key="l.id"
                class="flex items-center gap-2.5 px-3.5 py-2.5"
                :class="i < c.lessons.length - 1 && 'border-b border-black/4'"
              >
                <span class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-surface-raised">
                  <Lock :size="9" class="text-ink-faint" :stroke-width="2.5" />
                </span>
                <span class="flex-1 line-clamp-2 font-sans text-xs text-ink-faint">{{ l.title }}</span>
              </div>
            </template>
          </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 已完成章節展開收合：CSS grid 高度滑展動畫（不用 max-height 避免 easing 失真）。 */
.chapter-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1);
}
.chapter-collapse.expanded {
  grid-template-rows: 1fr;
}
.chapter-collapse-inner {
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .chapter-collapse {
    transition: none;
  }
}
</style>
