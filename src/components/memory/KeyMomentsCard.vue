<script setup lang="ts">
/**
 * 棋憶 — 這盤值得回頭看的幾手。F1 選出的 moments 一直算得好好的，D4 之後卻只流向匯出文字；
 * 這是它在畫面上的落點。
 *
 * 形狀（2026-08-06 Eason 從三個樣張中挑定 C）：共用一個棋盤在上、清單在下，點清單切換棋盤，
 * 而不是每項各配一塊縮圖（84px 看不清）或摺疊展開（一次只看得到一個）。
 *
 * 文案守 GDD Rule 11/12 與 Pillar 3：只講「你走的 / 更好的」這種中性事實，不出現任何評價詞
 * （失誤、好棋、blunder）。品牌金只用在 focus ring 與指示點，永不當內文色。
 */
import { computed, ref, watch } from 'vue'
import { buildFenSequence } from '@/modules/post-game-review/use-post-game-review'
import { buildMomentDisplays } from '@/modules/memory/moment-display'
import { useBoardFit } from '@/composables/use-board-fit'
import ChessBoard from '@/components/chess-board.vue'
import { useMemoryContext } from './memory-context'

const ctx = useMemoryContext()

const boardFit = ref<HTMLElement | null>(null)
useBoardFit(boardFit)

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

const selected = ref(0)
// 清單重算（換一盤棋、分析完成補齊）後舊索引可能越界，落回第一項而不是渲染 undefined。
watch(displays, (list) => {
  if (selected.value >= list.length) selected.value = 0
})

const current = computed(() => displays.value[selected.value] ?? null)
const lastMove = computed<readonly [string, string] | null>(() =>
  current.value ? [current.value.from, current.value.to] : null,
)
</script>

<template>
  <section v-if="current" class="flex flex-col gap-3" data-testid="key-moments">
    <h2 class="font-sans text-[13px] font-medium tracking-[0.02em] text-ink-muted">
      這盤值得回頭看的幾手
    </h2>

    <!-- 共用棋盤：與課程／試煉／對局同款木盤 -->
    <div
      class="w-full rounded-[12px] bg-[linear-gradient(160deg,#6f4b30,#523722)] p-3 ring-1 ring-black/30 shadow-[0_12px_32px_rgba(10,30,24,0.45),inset_0_1px_0_rgba(255,228,194,0.20),inset_0_-2px_6px_rgba(0,0,0,0.38)]"
    >
      <div ref="boardFit" class="relative board-fit">
        <ChessBoard
          :fen="current.fen"
          :player-color="orientation"
          :disabled="true"
          :coordinates="true"
          :last-move="lastMove"
        />
      </div>
    </div>

    <!-- 清單：點了切換上方棋盤 -->
    <ul class="flex flex-col gap-1.5">
      <li v-for="(d, i) in displays" :key="d.ply">
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-3 rounded-btn border px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1 focus-visible:ring-offset-surface-base motion-reduce:transition-none"
          :class="
            i === selected
              ? 'border-primary bg-primary-soft'
              : 'border-line bg-surface-card hover:bg-surface-hover'
          "
          :aria-current="i === selected ? 'true' : undefined"
          @click="selected = i"
        >
          <span
            class="size-1.75 shrink-0 rounded-full"
            :class="d.source === 'own' ? 'bg-primary' : 'bg-ink-faint'"
            aria-hidden="true"
          />
          <span class="flex min-w-0 flex-1 items-baseline gap-2.5">
            <span class="font-num text-[13px] tabular-nums text-ink-muted">第 {{ d.moveNumber }} 手</span>
            <span class="font-num text-[15px] tabular-nums text-ink">{{ d.san }}</span>
          </span>
          <span class="shrink-0 font-sans text-xs text-ink-muted">
            {{ d.source === 'own' ? '你走的' : '更好的' }}
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
