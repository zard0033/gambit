<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Target, BookOpen, Library, Swords } from 'lucide-vue-next'
import { lessons } from '@/data/lessons'
import { LESSON_TIER_LABELS } from '@/types/lesson'
import type { LessonTier } from '@/types/lesson'
import { useLessonProgressStore } from '@/stores/lesson-progress'
import { useDungeonProgressStore } from '@/stores/dungeon-progress'
import { useUiStore } from '@/stores/ui-store'
import { useResumeGameStore } from '@/stores/resume-game'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DarkPanel, ChapterBadge, StatCard, SectionLabel, ProgressBar } from '@/components/ui/gambit'

const router = useRouter()
const progress = useLessonProgressStore()
const dungeon = useDungeonProgressStore()
const uiStore = useUiStore()
const resume = useResumeGameStore()

// 續玩對局（續玩對局）：有進行中對局時，hero 卡換成「繼續對局」。
const resumeInfo = computed(() => {
  const r = resume.current
  if (!r) return null
  return {
    moveCount: r.moves.length,
    colorLabel: r.playerColor === 'white' ? '白' : '黑',
    piece: r.playerColor === 'white' ? 'wP' : 'bP',
    level: r.level,
  }
})

// 棋子徽章：用棋盤同一套 Gioco Wood 棋子（依課程 tier 變化），與盤面風格統一。
const TIER_PIECE: Record<LessonTier, string> = { 1: 'bP', 2: 'bN', 3: 'bR', 4: 'bK' }

// 時間感問候
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早安'
  if (h < 18) return '午安'
  return '晚安'
})

// 要續學的課：第一個已解鎖、未完成
const nextLesson = computed(
  () => [...lessons].find((l) => progress.isUnlocked(l) && !progress.isCompleted(l.id)) ?? null,
)
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
function continueLearning() {
  router.push(nextLesson.value ? `/learn/${nextLesson.value.id}` : '/learn')
}
</script>

<template>
  <div class="max-w-2xl md:max-w-4xl mx-auto px-[18px] pt-[18px] pb-6">
    <!-- 問候 -->
    <p class="font-sans text-base font-medium text-ink-muted">{{ greeting }}</p>
    <h1 class="font-display font-bold text-[26px] md:text-[30px] leading-tight text-ink mt-0.5" tabindex="-1">
      棋盤未曾離開，你來了。
    </h1>

    <!-- 主區：桌機 hero | 繼續學習 雙欄等高；手機堆疊 -->
    <div class="mt-4 md:mt-6 md:grid md:grid-cols-2 md:gap-5 md:items-stretch">
      <!-- 進行中對局 → 繼續對局卡；否則 開始新對局卡（深青瓷焦點卡，桌機填滿欄高、內容垂直置中） -->
      <DarkPanel
        v-if="resumeInfo"
        accent-left
        class="cursor-pointer md:h-full md:flex md:flex-col md:justify-center"
        @click="continueGame"
      >
        <div class="flex items-center gap-3.5">
          <div class="flex-1 min-w-0">
            <!-- 進行中狀態 pill（取代 NEW GAME 的金色 eyebrow，一眼區隔出「存著的對局」；靜態點守平靜鐵則） -->
            <span class="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-2.5 py-1 font-sans text-[11px] font-medium text-ink-on-deep-dim">
              <span class="h-1.5 w-1.5 rounded-full bg-[#7EBEA5]" aria-hidden="true" />進行中
            </span>
            <p class="font-display font-bold text-[22px] text-ink-on-deep mt-2">繼續對局</p>
            <!-- 重點資訊改成可掃讀的 stat chips：手數 / 執色 / 強度 -->
            <div class="mt-2 flex flex-wrap gap-1.5">
              <span class="inline-flex items-center rounded-md border border-white/10 bg-white/6 px-2 py-0.5 font-num text-[12px] tabular-nums text-ink-on-deep">第 {{ resumeInfo.moveCount }} 手</span>
              <span class="inline-flex items-center rounded-md border border-white/10 bg-white/6 px-2 py-0.5 font-num text-[12px] text-ink-on-deep">執{{ resumeInfo.colorLabel }}</span>
              <span class="inline-flex items-center rounded-md border border-white/10 bg-white/6 px-2 py-0.5 font-num text-[12px] tabular-nums text-ink-on-deep">Lv.{{ resumeInfo.level }}</span>
            </div>
            <div class="mt-3.5 flex items-center gap-3">
              <Button variant="gold" size="sm" @click.stop="continueGame">
                繼續 <ArrowRight :size="18" />
              </Button>
              <button
                type="button"
                class="inline-flex items-center min-h-[44px] px-1 -mx-1 font-sans text-[13px] text-ink-on-deep-dim underline-offset-2 transition-colors hover:text-ink-on-deep hover:underline"
                @click.stop="startGame"
              >另開新對局</button>
            </div>
          </div>
          <ChapterBadge :piece="resumeInfo.piece" :size="62" />
        </div>
      </DarkPanel>
      <DarkPanel v-else class="relative cursor-pointer overflow-hidden md:h-full md:flex md:flex-col md:justify-center" @click="startGame">
        <div class="relative z-10 flex-1 min-w-0">
          <p class="font-sans text-[11px] font-bold tracking-[0.12em] text-gold">NEW GAME</p>
          <p class="font-display font-bold text-[22px] text-ink-on-deep mt-1.5">開始新對局</p>
          <p class="font-sans text-[13px] text-ink-on-deep-dim mt-1">自選強度與執子</p>
          <Button variant="gold" size="sm" class="mt-3.5" @click.stop="startGame">
            開始對局 <ArrowRight :size="18" />
          </Button>
        </div>
        <Swords
          :size="110"
          class="pointer-events-none absolute -right-4 -bottom-4 text-white/[0.07]"
          :stroke-width="1.2"
          aria-hidden="true"
        />
      </DarkPanel>

      <!-- 繼續學習 — cream accent 卡。桌機隱藏外部小標，讓本卡與左 hero 頂底等高對齊
           （兩卡都靠卡內小標：NEW GAME / 基礎規則）；手機保留小標分段。 -->
      <SectionLabel class="mt-5 md:hidden">繼續學習</SectionLabel>
      <Card
        accent
        class="p-4 cursor-pointer md:h-full md:flex md:flex-col md:justify-center"
        @click="continueLearning"
      >
        <template v-if="nextLesson">
          <div class="flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="font-sans text-xs font-bold text-primary-dark">
                {{ LESSON_TIER_LABELS[nextLesson.tier] }}
              </p>
              <p class="font-display font-bold text-xl text-ink mt-1">{{ nextLesson.title }}</p>
              <Button size="sm" class="mt-3" @click.stop="continueLearning">
                繼續 · 第 {{ lessonOrdinal }} 課 <ArrowRight :size="16" />
              </Button>
            </div>
            <ChapterBadge :piece="TIER_PIECE[nextLesson.tier]" :size="52" />
          </div>
          <div class="mt-3.5">
            <ProgressBar :value="progress.completedCount" :total="progress.totalCount" />
          </div>
        </template>
        <template v-else>
          <div class="flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="font-sans text-xs font-bold text-primary-dark">學習地圖</p>
              <p class="font-display font-bold text-xl text-ink mt-1">你已完成所有課程</p>
              <Button size="sm" class="mt-3" @click.stop="continueLearning">
                回到地圖 <ArrowRight :size="16" />
              </Button>
            </div>
            <ChapterBadge piece="bK" :size="52" />
          </div>
        </template>
      </Card>
    </div>

    <!-- 總覽（全寬） -->
    <SectionLabel>總覽</SectionLabel>
    <div class="grid grid-cols-3 gap-2.5">
      <RouterLink to="/learn" class="block rounded-card focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold" aria-label="學習進度">
        <StatCard
          :icon="BookOpen"
          label="學習進度"
          :value="`${progress.completedCount}/${progress.totalCount}`"
        />
      </RouterLink>
      <RouterLink to="/dungeon" class="block rounded-card focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold" aria-label="試煉">
        <StatCard
          :icon="Target"
          label="試煉"
          :value="`${dungeon.solvedCount}/${dungeon.totalCount}`"
        />
      </RouterLink>
      <StatCard :icon="Library" value="即將推出" locked />
    </div>
  </div>
</template>
