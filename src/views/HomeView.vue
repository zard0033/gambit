<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ArrowRight, Swords } from 'lucide-vue-next'
import { LESSON_TIER_LABELS, LESSON_TIER_PIECES as TIER_PIECE } from '@/types/lesson'
import { greetingForNow } from '@/lib/utils'
import { useLessonProgressStore } from '@/stores/lesson-progress'
import { useUiStore } from '@/stores/ui-store'
import { useResumeGameStore } from '@/stores/resume-game'
import { rungForSkillLevel } from '@/config/difficulty-tuning'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DarkPanel, ChapterBadge, SectionLabel, ProgressBar, InkBrush } from '@/components/ui/gambit'
import NeveSceneHeader from '@/components/home/NeveSceneHeader.vue'
import { useReducedMotion } from '@/composables/use-reduced-motion'

const router = useRouter()
const progress = useLessonProgressStore()
const { nextLesson } = storeToRefs(progress)
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
    rungName: rungForSkillLevel(r.level).name,
  }
})

const greeting = computed(greetingForNow)
const lessonOrdinal = computed(() => progress.completedCount + 1)

// Blocks below the scene fade-rise once on mount (≤300ms, small stagger).
// prefers-reduced-motion skips the animation (CSS media query forces the lit state).
const { prefersReducedMotion } = useReducedMotion()
const ready = ref(false)

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

onMounted(() => {
  if (prefersReducedMotion.value) {
    ready.value = true
    return
  }
  requestAnimationFrame(() => requestAnimationFrame(() => (ready.value = true)))
})
</script>

<template>
  <div>
    <!-- 氛圍首屏：Neve 在場的時段場景帶（取代舊問候區，保留既有標題 h1[tabindex=-1]）。
         留在 max-w 容器之外＝full-bleed：此 div 不設寬度限制，NeveSceneHeader 因此天然貼齊
         viewport 左右與 AppNav 底部（main 對 home 無 padding-top）。內容寬度改由
         NeveSceneHeader 內部自己的 max-w 容器對齊，見該元件。 -->
    <NeveSceneHeader :greeting="greeting" />

  <div class="max-w-2xl md:max-w-4xl mx-auto px-[18px] pb-6">
    <!-- 主區：桌機 hero | 繼續學習 雙欄等高；手機堆疊 -->
    <div class="fade-rise mt-4 md:mt-6 md:grid md:grid-cols-2 md:gap-5 md:items-stretch" :class="{ 'is-in': ready }">
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
            <span class="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-2.5 py-1 font-sans text-[11px] font-medium text-ink-on-deep">
              <span class="h-1.5 w-1.5 rounded-full bg-[#7EBEA5]" aria-hidden="true" />進行中
            </span>
            <p class="font-display font-bold text-[22px] text-ink-on-deep mt-2">繼續對局</p>
            <!-- 重點資訊改成可掃讀的 stat chips：手數 / 執色 / 強度 -->
            <div class="mt-2 flex flex-wrap gap-1.5">
              <span class="inline-flex items-center rounded-md border border-white/10 bg-white/6 px-2 py-0.5 font-num text-[12px] tabular-nums text-ink-on-deep">第 {{ resumeInfo.moveCount }} 手</span>
              <span class="inline-flex items-center rounded-md border border-white/10 bg-white/6 px-2 py-0.5 font-num text-[12px] text-ink-on-deep">執{{ resumeInfo.colorLabel }}</span>
              <span class="inline-flex items-center rounded-md border border-white/10 bg-white/6 px-2 py-0.5 font-num text-[12px] text-ink-on-deep">{{ resumeInfo.rungName }}</span>
            </div>
            <div class="mt-3.5 flex items-center gap-3">
              <Button variant="gold" size="sm" @click.stop="continueGame">
                繼續 <ArrowRight :size="18" />
              </Button>
              <button
                type="button"
                class="inline-flex items-center min-h-[44px] px-1 -mx-1 font-sans text-[13px] text-ink-on-deep underline-offset-2 transition-colors hover:text-ink-on-deep hover:underline"
                @click.stop="startGame"
              >另開新對局</button>
            </div>
          </div>
          <ChapterBadge :piece="resumeInfo.piece" :size="62" />
        </div>
      </DarkPanel>
      <DarkPanel v-else class="relative cursor-pointer overflow-hidden md:h-full md:flex md:flex-col md:justify-center" @click="startGame">
        <div class="relative z-10 flex-1 min-w-0">
          <!-- 墨記眉標：短筆畫 + 明朝金字，取代 NEW GAME（乙做法，決策樣張規格5） -->
          <span class="inline-flex items-center gap-1.5">
            <!-- 深玉表面：墨色跟表面走，兩主題皆暖白墨（同招呼語 scoped 覆寫模式） -->
            <InkBrush :width="24" :height="6" :seed="11" :thickness="0.5" style="--color-ink-brush: rgba(236, 230, 218, 0.72)" />
            <span class="font-display font-bold text-[13px] text-ink-on-deep tracking-[0.04em]">今日</span>
          </span>
          <p class="font-display font-bold text-[22px] text-ink-on-deep mt-1.5">開始新對局</p>
          <p class="font-sans text-[13px] text-ink-on-deep mt-1">自選強度與執子</p>
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
      <div class="mt-5 md:hidden">
        <SectionLabel as="h2">繼續學習</SectionLabel>
        <!-- 段落乾筆：寬扁、克制，標籤與內容間的柔性分隔（墨韻母題，鋪量克制） -->
        <InkBrush :width="200" :height="8" :seed="3" :thickness="0.18" aria-hidden="true" />
      </div>
      <Card
        accent
        class="p-4 cursor-pointer md:h-full md:flex md:flex-col md:justify-center"
        @click="continueLearning"
      >
        <template v-if="nextLesson">
          <div class="flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <!-- 印框 tag：四角 L 框 + 微 rotate（甲做法，決策樣張規格6） -->
              <span class="lesson-tag-ink font-sans text-xs font-bold text-primary-dark">
                <span class="corner tl" aria-hidden="true" />
                <span class="corner tr" aria-hidden="true" />
                <span class="corner bl" aria-hidden="true" />
                <span class="corner br" aria-hidden="true" />
                {{ LESSON_TIER_LABELS[nextLesson.tier] }}
              </span>
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
</style>
