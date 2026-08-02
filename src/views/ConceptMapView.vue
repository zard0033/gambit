<script setup lang="ts">
/**
 * Concept Map (Learning Loop #20). Two jobs, additive (GDD §3.5 + quick-spec concept-deepening-page):
 *  1. A calm REFLECTION of which tactics you've met (已學) and drilled (已練) — no score, no ranking,
 *     un-started tactics kept visually quiet, never「未達成」.
 *  2. A door to GO DEEPER: tapping any tactic opens its deepening page (`/learn/concept/:id`) — a
 *     transfer-focused mini-course. Deepening completion is a quiet text state (深入 ›/重溫 ›), never a
 *     third coloured dot. (Replaces the old `?from=concept` lesson side-door, now decommissioned.)
 *
 * No practice (試煉) entry lives here on purpose: one tactic maps to many puzzles, so there is no single
 * right target. Practice stays in the lesson-completion Bridge-1 invitation and the Dungeon.
 */
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, ChevronRight } from 'lucide-vue-next'
import { concepts } from '@/data/concepts'
import type { ChessConcept } from '@/types/concept'
import { learned, practiced } from '@/modules/learning-loop/mastery'
import { puzzles } from '@/data/puzzles'
import { useLessonProgressStore } from '@/stores/lesson-progress'
import { useDungeonProgressStore } from '@/stores/dungeon-progress'
import { useConceptProgressStore } from '@/stores/concept-progress'

const router = useRouter()
const route = useRoute()
// 試煉「複習」帶 ?focus=<conceptId> 進來時，highlight 並捲到該概念（concept 1 : 試煉 N 的 hub）。
const focusId = (route.query.focus as string) || ''
onMounted(() => {
  if (!focusId) return
  document.querySelector(`[data-concept="${focusId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
})
const lessonProgress = useLessonProgressStore()
const dungeonProgress = useDungeonProgressStore()
const conceptProgress = useConceptProgressStore()

const CONCEPT_PIECE: Record<ChessConcept, string> = {
  material: 'bQ', fork: 'bN', pin: 'bB', mate: 'bK',
  skewer: 'bR', discovered: 'bB', defense: 'bP', center: 'bN',
}
const CONCEPT_BLURB: Record<ChessConcept, string> = {
  material: '沒被保護的子',
  fork: '一次攻兩個子',
  pin: '釘住對方的子',
  mate: '把國王將死',
  skewer: '前子讓開吃後子',
  discovered: '移開子露出攻擊',
  defense: '讓子互相保護',
  center: '佔住棋盤中央',
}

const CONCEPT_GROUPS: { key: string; label: string; ids: ChessConcept[] }[] = [
  { key: 'core',       label: '核心目標', ids: ['material', 'mate'] },
  { key: 'tactics',   label: '戰術技巧', ids: ['fork', 'pin', 'skewer', 'discovered'] },
  { key: 'principles', label: '棋局概念', ids: ['center', 'defense'] },
]

// A puzzle counts as drilled whether cleared in the dungeon or practised from a lesson (GDD §4.2).
function isSolved(id: string): boolean {
  return dungeonProgress.isSolved(id) || conceptProgress.isPracticeSolved(id)
}

/** Coin progression（三狀態進階感，2026-07-02 redesign）：
 *  none = 未學（淡環）→ partial = 已學或已練（jade 環 = progress）→ full = 已學且已練
 *  （金環 + ✓ 徽章 = reward，練過才配金；✓ 是 shape cue，狀態不只靠顏色）。 */
type CoinStage = 'none' | 'partial' | 'full'

interface ConceptVM {
  id: ChessConcept
  label: string
  blurb: string
  piece: string
  lit: boolean
  stage: CoinStage
  isDeepened: boolean
}

const allVM = computed<ConceptVM[]>(() =>
  concepts.map((c) => {
    // 已學 reads linear lesson completion only (the side-door / sideLearned union was removed).
    const isLearned = learned(c.id, (id) => lessonProgress.isCompleted(id))
    const isPracticed = practiced(c.id, puzzles, isSolved)
    return {
      id: c.id,
      label: c.label,
      blurb: CONCEPT_BLURB[c.id],
      piece: CONCEPT_PIECE[c.id],
      lit: isLearned || isPracticed,
      stage: (isLearned && isPracticed ? 'full' : isLearned || isPracticed ? 'partial' : 'none') as CoinStage,
      isDeepened: conceptProgress.isDeepened(c.id),
    }
  }),
)

const conceptsByGroup = computed(() =>
  CONCEPT_GROUPS.map((g) => ({
    ...g,
    items: g.ids
      .map((id) => allVM.value.find((v) => v.id === id))
      .filter((v): v is ConceptVM => v !== undefined),
  })),
)

// Tap-to-deepen: open the tactic's deepening page (always available; no lock to bypass).
function deepenConcept(v: ConceptVM): void {
  router.push(`/learn/concept/${v.id}`)
}

const base = import.meta.env.BASE_URL
const maskStyle = (piece: string) => ({
  WebkitMaskImage: `url(${base}pieces/silhouette/${piece}.svg)`,
  maskImage: `url(${base}pieces/silhouette/${piece}.svg)`,
})
</script>

<template>
  <div class="mx-auto max-w-md lg:max-w-3xl pb-8">
    <h1 class="sr-only" tabindex="-1">棋理地圖</h1>
    <!-- 圖例：coin 環三階（未學＝淡環不列，安靜預設） -->
    <div class="flex items-center gap-4 px-[14px] pt-4 pb-1.5 font-sans text-[11px] text-ink-faint">
      <span class="inline-flex items-center gap-1.5"><span class="legend-ring legend-ring-partial" aria-hidden="true" />已學或已練</span>
      <span class="inline-flex items-center gap-1.5"><span class="legend-ring legend-ring-full" aria-hidden="true" />已學且已練</span>
    </div>

    <!-- 概念分組：核心目標 / 戰術技巧 / 棋局概念 -->
    <div class="flex flex-col gap-4 px-[14px] pt-1">
      <section v-for="group in conceptsByGroup" :key="group.key">
        <p class="mb-2 font-sans text-[11px] font-bold uppercase tracking-widest text-ink-faint">{{ group.label }}</p>
        <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <button
            v-for="v in group.items"
            :key="v.id"
            type="button"
            :data-testid="v.lit ? 'concept-tile-lit' : 'concept-tile-dormant'"
            :data-concept="v.id"
            class="glass-panel relative flex min-h-[72px] flex-row items-center gap-3 overflow-hidden rounded-2xl p-3 text-left transition-colors hover:bg-white/[0.14] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
            :aria-label="`深入「${v.label}」`"
            @click="deepenConcept(v)"
          >
            <span
              v-if="v.id === focusId"
              class="concept-focus-ring pointer-events-none absolute inset-0 z-10 rounded-2xl border-2 border-gold"
              aria-hidden="true"
            />
            <span :class="['coin', v.stage === 'none' && 'coin-dim', v.stage === 'partial' && 'coin-learned', v.stage === 'full' && 'coin-full']">
              <span
                class="block h-5 w-5"
                :class="v.lit ? 'bg-primary' : 'bg-ink-faint'"
                aria-hidden="true"
                :style="{ ...maskStyle(v.piece), WebkitMaskRepeat:'no-repeat', maskRepeat:'no-repeat', WebkitMaskPosition:'center', maskPosition:'center', WebkitMaskSize:'contain', maskSize:'contain' }"
              />
              <span v-if="v.stage === 'full'" class="coin-check" aria-hidden="true">
                <Check :size="10" :stroke-width="3.5" />
              </span>
            </span>
            <div class="min-w-0 flex-1">
              <span
                class="block line-clamp-2 font-display text-[15px] font-bold leading-tight"
                :class="v.lit ? 'text-ink' : 'text-ink-muted'"
              >{{ v.label }}</span>
              <div class="mt-0.5 font-sans text-[11px] leading-snug text-ink-faint">{{ v.blurb }}</div>
            </div>
            <!-- 深化過的概念不再給行動召喚：每個概念只有一組盤面，「重溫」暗示有新東西是假的
                 （完成狀態由左側的 coin-check 表示）。 -->
            <span
              v-if="!v.isDeepened"
              class="flex shrink-0 items-center gap-0.5 self-center font-sans text-[11px] text-ink-faint"
              data-testid="concept-tile-deepen"
            >
              深入
              <ChevronRight :size="14" :stroke-width="2" aria-hidden="true" />
            </span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* 試煉「複習」進來時，金框在該概念上脈動數次後淡出（只動 opacity，遵守 Gambit 動效鐵則）。 */
.concept-focus-ring {
  animation: conceptFocus 2.4s ease-in-out forwards;
}
@keyframes conceptFocus {
  0% { opacity: 1; }
  12% { opacity: 0.25; }
  25% { opacity: 1; }
  50% { opacity: 0.25; }
  75% { opacity: 1; }
  90% { opacity: 0.25; }
  100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .concept-focus-ring { animation: none; opacity: 1; }
}

/* Coin 三階：dim（未學）→ jade 環（已學或已練＝progress）→ 金環＋✓（已學且已練＝reward）。 */
.coin {
  position: relative; display: flex; height: 38px; width: 38px; flex: none;
  align-items: center; justify-content: center; border-radius: 9999px;
  background: #fcf9f3; box-sizing: border-box;
}
/* 未學＝虛線描邊（拍板見 2026-07-20 coin 三階選項比較）：讀作「輪廓已在、還沒填滿」，
   不加色只加形狀，避免跟 learned/full 的金綠環搶戲。 */
.coin-dim {
  border: 2px dashed #a88c76;
}
.coin-learned {
  box-shadow: 0 0 0 2px #1c7059, 0 3px 10px rgba(61, 34, 16, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
.coin-full {
  box-shadow: 0 0 0 2px #f8b500, 0 3px 10px rgba(61, 34, 16, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
.coin-check {
  position: absolute; right: -4px; bottom: -4px;
  display: flex; align-items: center; justify-content: center;
  height: 16px; width: 16px; border-radius: 9999px;
  background: #f8b500; color: #3a2408;
  box-shadow: 0 1px 3px rgba(61, 34, 16, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.legend-ring { display: inline-block; height: 10px; width: 10px; flex: none; border-radius: 9999px; background: #fcf9f3; }
.legend-ring-partial { box-shadow: 0 0 0 2px #1c7059; }
.legend-ring-full { box-shadow: 0 0 0 2px #f8b500; }
</style>
