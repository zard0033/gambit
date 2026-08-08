<script setup lang="ts">
/**
 * 棋憶 — 這盤值得回頭看的幾手。棋盤在上、Neve 對話框在下，一次一手，靠 ‹ › 左右切換。
 *
 * 形態（2026-08-08 Eason 逐版比對後拍板，取代原本的「共用棋盤＋五列清單」）：清單那五列的高度
 * 換成一個對話框，切換時只有對話框的字在換。**規則：Neve 說的話統一用對話框；淺卡＝她在說明，
 * 深青＝她要你做一件事**（深青互動格是 wave 2，這一版只有說明格）。
 *
 * 文案守 GDD Rule 11/12 與 Pillar 3：只講「你走了 / 更好的是」這種中性事實，不出現任何評價詞
 * （失誤、好棋、blunder）。走法一律白話文，不用 SAN——目標讀者看不懂棋譜記號。
 * 品牌金只用在 focus ring 與 indicator，永不當內文色（`text-gold-dark` 才是可當文字的金）。
 *
 * 幾何沿用舊 MemorySlideshow 的做法：chessground 的 bounds 要從真實 cg-board 讀，且盤面尺寸變動
 * 時 overlay 要跟著重算（geomTick + ResizeObserver），詳見 technical-preferences 的 board gotchas。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { buildFenSequence } from '@/modules/post-game-review/use-post-game-review'
import { buildMomentDisplays } from '@/modules/memory/moment-display'
import { useBoardFit } from '@/composables/use-board-fit'
import type { Rect } from '@/utils/board-geometry'
import { NeveAvatar } from '@/components/ui/gambit'
import { COACH } from '@/types/lesson'
import ChessBoard from '@/components/chess-board.vue'
import MoveAnnotationDisplay from '@/components/move-annotation-display.vue'
import { useMemoryContext } from './memory-context'

const ctx = useMemoryContext()

const orientation = computed<'white' | 'black'>(() => ctx.game.value?.playerColor ?? 'white')

// 只跟著棋局本身重建：整局 FEN replay 不該掛在 analysisResults 上，否則分析每回寫一格就重跑一次。
const fens = computed(() => (ctx.game.value ? buildFenSequence(ctx.game.value.moves) : []))

const displays = computed(() => {
  const game = ctx.game.value
  if (!game) return []
  return buildMomentDisplays({
    moments: ctx.moments.value,
    // review 用 Vue readonly() 包過（DeepReadonly 讓巢狀 pv 變唯讀）；純模組收的是可變 pv 的
    // 版本且從不讀 pv，比照 MemoryView 的既有作法轉型，不動共用引擎結果的型別。
    analysisResults: ctx.review.analysisResults.value as unknown as Parameters<
      typeof buildMomentDisplays
    >[0]['analysisResults'],
    fens: fens.value,
    moves: game.moves,
  })
})

const index = ref(0)
// 清單重算後回到第一格：越界會渲染 undefined，而換了一盤棋（第一格的 ply 換人）卻停在原位，
// 等於在看「另一盤棋的第 3 格」。moments 只在分析 COMPLETE 時算一次，不會把人從中途拉回。
watch(displays, (list, prev) => {
  if (index.value >= list.length || prev?.[0]?.ply !== list[0]?.ply) index.value = 0
})

const current = computed(() => displays.value[index.value] ?? null)
const atFirst = computed(() => index.value <= 0)
const atLast = computed(() => index.value >= displays.value.length - 1)

// ---- 標註 overlay 的幾何：從真實 cg-board 讀，尺寸變動時 tick 一次逼所有 computed 重算 ----
const board = ref<{ boardRef: HTMLElement | null; squareToRect: (s: string) => Rect | null } | null>(null)
const boardFit = ref<HTMLElement | null>(null)
useBoardFit(boardFit)

const geomTick = ref(0)
const boardEl = computed<HTMLElement | null>(() => {
  void geomTick.value
  return board.value?.boardRef ?? null
})
const boardSizePx = computed(() => {
  void geomTick.value
  return boardEl.value?.offsetWidth ?? 0
})
function squareToRect(square: string): Rect | null {
  void geomTick.value
  return board.value?.squareToRect?.(square) ?? null
}

let boardRO: ResizeObserver | null = null
onMounted(async () => {
  await nextTick()
  geomTick.value++
  const el = board.value?.boardRef
  if (el) {
    boardRO = new ResizeObserver(() => geomTick.value++)
    boardRO.observe(el)
  }
})
onBeforeUnmount(() => {
  boardRO?.disconnect()
  boardRO = null
})
</script>

<template>
  <section v-if="current" class="flex flex-col" data-testid="key-moments">
    <h2 class="mb-2.5 font-sans text-[13px] font-medium tracking-[0.02em] text-ink-muted">
      這盤值得回頭看的幾手
    </h2>

    <!-- 共用棋盤：與課程／試煉／對局同款木盤 -->
    <div
      class="w-full rounded-[12px] bg-[linear-gradient(160deg,#6f4b30,#523722)] p-3 ring-1 ring-black/30 shadow-[0_12px_32px_rgba(10,30,24,0.45),inset_0_1px_0_rgba(255,228,194,0.20),inset_0_-2px_6px_rgba(0,0,0,0.38)]"
    >
      <div ref="boardFit" class="relative board-fit">
        <ChessBoard
          ref="board"
          :fen="current.fen"
          :player-color="orientation"
          :disabled="true"
          :coordinates="true"
        />
        <MoveAnnotationDisplay
          v-if="boardEl"
          :annotations="current.annotations"
          :evaluation="null"
          :square-to-rect="squareToRect"
          :board-ref="boardEl"
          :board-size-px="boardSizePx"
          :shaft-scale="0.5"
        />
      </div>
    </div>

    <!-- 段點條：走到第幾格。純指示，讀屏靠對話框裡的 sr-only 交代。 -->
    <div class="flex items-center justify-center gap-1.5 py-3" aria-hidden="true" data-testid="moment-dots">
      <span
        v-for="(d, i) in displays"
        :key="d.ply"
        class="h-1.5 rounded-full transition-[width,background-color] duration-150 motion-reduce:transition-none"
        :class="i === index ? 'w-4.5 bg-primary' : 'w-1.5 bg-line'"
      />
    </div>

    <!-- Neve 對話框（說明格）。她在說明 → 淺卡。
         aria-live：切換格子只換這一塊的字，沒有它讀屏使用者按了 ‹ › 不會知道內容變了。 -->
    <div class="rounded-card border border-line bg-surface-card px-4 py-3.5" aria-live="polite">
      <div class="mb-2.5 flex items-center gap-2">
        <NeveAvatar size="lg" />
        <span class="font-num text-[11px] tracking-[0.08em] text-ink-muted">
          {{ COACH.name.toUpperCase() }}
        </span>
        <span class="sr-only">第 {{ index + 1 }} 格，共 {{ displays.length }} 格</span>
        <span class="ml-auto flex gap-0.5">
          <button
            type="button"
            class="flex size-11 items-center justify-center rounded-btn border border-line bg-surface-base text-ink transition-colors duration-150 hover:bg-surface-hover disabled:opacity-35 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold motion-reduce:transition-none"
            :disabled="atFirst"
            aria-label="上一手"
            @click="index--"
          >
            <ChevronLeft :size="18" :stroke-width="1.8" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="flex size-11 items-center justify-center rounded-btn border border-line bg-surface-base text-ink transition-colors duration-150 hover:bg-surface-hover disabled:opacity-35 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold motion-reduce:transition-none"
            :disabled="atLast"
            aria-label="下一手"
            @click="index++"
          >
            <ChevronRight :size="18" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </span>
      </div>

      <p class="mb-2 font-sans text-[15px] text-ink">
        第 {{ current.moveNumber }} 手 · {{ current.shortName }}
      </p>

      <!-- 兩手同字級，靠明度＋粗細＋領頭詞區分。**不用金色**：`text-gold-dark` 是設計系統
           明文的 large-copy-only（在 15px 上對比不足），金一律留給 focus / reward。 -->
      <p class="font-sans text-[15px] text-ink-muted" data-testid="moment-played">
        你走了 把{{ current.played.piece }}移到 {{ current.played.to }}
      </p>
      <p
        v-if="current.best"
        class="font-sans text-[15px] font-bold text-ink"
        data-testid="moment-best"
      >
        更好的是 把{{ current.best.piece }}移到 {{ current.best.to }}
      </p>

      <!-- Neve 的解釋（回顧態，文楷）。CJK 不可斜體——假斜會扭曲字形。 -->
      <p class="mt-3 font-lesson text-[15px] leading-[1.85] not-italic text-ink" data-testid="moment-reason">
        {{ current.reason }}
      </p>
    </div>
  </section>
</template>
