<script setup lang="ts">
/**
 * 棋憶 — 值得回頭看的幾手。棋盤在上、Neve 對話框在下，一次一手，靠 ‹ › 左右切換。
 *
 * 形態（2026-08-08 Eason 逐版比對後拍板，取代原本的「共用棋盤＋五列清單」）：清單那五列的高度
 * 換成一個對話框，切換時只有對話框的字在換。**規則：Neve 說的話統一用對話框；淺卡＝她在說明，
 * 深青＝她要你做一件事，而且就在這一格做**。
 *
 * wave 2（2026-09）：深青互動格併進來。你漏看的將殺不再是另一張卡＋跳頁，而是這串格子的最前面
 * 幾格——棋盤可動、**盤面零標記**（預先標＝幫他縮小範圍，等於送分），走出那一手就通關。
 * 兩種格子共用同一個 ChessBoard 實例（換 fen／朝向／可動與否），所以不吃 carousel 那套
 * 「建立時不在最終位置」的 stale-bounds 修法（那是多盤 translateX 才有的問題）。
 *
 * 文案守 GDD Rule 11/12 與 Pillar 3：只講「你走了 / 更好的是」這種中性事實，不出現任何評價詞
 * （失誤、好棋、blunder）。走法一律白話文，不用 SAN——目標讀者看不懂棋譜記號。
 * 品牌金只用在 focus ring 與 indicator，永不當內文色（`text-gold-dark` 才是可當文字的金）。
 *
 * 幾何沿用舊 MemorySlideshow 的做法：chessground 的 bounds 要從真實 cg-board 讀，且盤面尺寸變動
 * 時 overlay 要跟著重算（geomTick + ResizeObserver），詳見 technical-preferences 的 board gotchas。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Play } from 'lucide-vue-next'
import { buildFenSequence } from '@/modules/post-game-review/use-post-game-review'
import { buildMomentDisplays, type MomentDisplay } from '@/modules/memory/moment-display'
import { applyUci } from '@/modules/memory/choreography'
import { useBoardFit } from '@/composables/use-board-fit'
import { useRecognitionSourceStore } from '@/stores/recognition-source'
import type { MissedMateSource } from '@/modules/learning-loop/missed-mate'
import type { Rect } from '@/utils/board-geometry'
import { NeveAvatar } from '@/components/ui/gambit'
import { COACH } from '@/types/lesson'
import ChessBoard from '@/components/chess-board.vue'
import MoveAnnotationDisplay from '@/components/move-annotation-display.vue'
import { useMemoryContext } from './memory-context'

const ctx = useMemoryContext()
const recognitionSource = useRecognitionSourceStore()

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

// ---- 格子清單：深青互動格（你漏看的將殺）排在最前，其後才是說明格 ----
type Cell =
  | { kind: 'deep'; id: string; src: MissedMateSource }
  | { kind: 'explain'; id: string; display: MomentDisplay }

const idOf = (gameId: string, ply: number): string => `${gameId}:${ply}`
const gameId = computed(() => ctx.game.value?.completedAt.toString() ?? '')

// **開場快照，不是 reactive 讀取**：通關會 markConsumed，若跟著 store 走，玩家走對的那一刻格子
// 就從腳下消失。這一輪看到的格子固定，消失發生在下次進頁。
const deepSources = ref<MissedMateSource[]>(recognitionSource.pendingFor('mate'))

const cells = computed<Cell[]>(() => {
  const deep = deepSources.value.map(
    (src): Cell => ({ kind: 'deep', id: idOf(src.gameId, src.ply), src }),
  )
  const covered = new Set(deep.map((c) => c.id))
  const explain = displays.value
    // 本局漏看的將殺同時是 pending 也是 moment；深青格已經在講它，說明格再講一次等於先問後答。
    .filter((d) => !covered.has(idOf(gameId.value, d.ply)))
    .map((d): Cell => ({ kind: 'explain', id: idOf(gameId.value, d.ply), display: d }))
  return [...deep, ...explain]
})

const index = ref(0)
// 清單重算後回到第一格：越界會渲染 undefined，而換了一盤棋（第一格換人）卻停在原位，等於在看
// 「另一盤棋的第 3 格」。用複合 id 比對，光比 ply 在跨局的深青格會撞號。
watch(cells, (list, prev) => {
  if (index.value >= list.length || prev?.[0]?.id !== list[0]?.id) index.value = 0
})

const current = computed<Cell | null>(() => cells.value[index.value] ?? null)
const atFirst = computed(() => index.value <= 0)
const atLast = computed(() => index.value >= cells.value.length - 1)

// ---- 深青格的通關狀態 ----
const solved = ref<Set<string>>(new Set())
const isSolved = computed(() => (current.value ? solved.value.has(current.value.id) : false))

/**
 * 通關（走對，或看過答案）：退休這個局面，讓它不會下次再冒出來，並把盤面留在走完那一手的樣子。
 * step 停在 1 不是 0——0 是走子前，玩家剛把棋子推上去卻看到它彈回原位，會以為自己走錯了。
 */
function retire(cell: Extract<Cell, { kind: 'deep' }>): void {
  solved.value = new Set(solved.value).add(cell.id)
  recognitionSource.markConsumed([cell.id])
  // 只在真的算得出「走完那一手」的局面時才前進；`applyUci` 回 null（FEN／UCI 壞掉）時留在 0，
  // 否則 step 1 指向不存在的畫面，畫面退回走子前而盤又已鎖上，玩家沒有任何辦法看到答案。
  if (stepFens.value.length > 0) step.value = 1
}

function onMove(payload: { from: string; to: string }): void {
  const cell = current.value
  if (!cell || cell.kind !== 'deep' || solved.value.has(cell.id)) return
  const uci = cell.src.mateMoveUci
  if (payload.from === uci.slice(0, 2) && payload.to === uci.slice(2, 4)) {
    retire(cell)
  } else {
    // 走錯＝棋子靜默滑回（沿用判斷場的作法）。不計次、不出懲罰 UI——她不責備。
    boardCmp.value?.resetPosition()
  }
}

/** 「看答案」也算消費掉：找不到的人若每次進來都撞同一題，才是真的有壓力。 */
function reveal(): void {
  const cell = current.value
  if (cell?.kind === 'deep') retire(cell)
}

// ---- 步進：一顆鈕循環看這一格的後續畫面，看完繞回原局面 ----
// 換格才重來，**但已通關的深青格要落在 1**（走完那一手的畫面）：它的對話框寫著「就是這一手」，
// 落回 0 會顯示走子前的盤面——文字說這一手，畫面上卻沒有那一手，而且通關後盤是鎖的，玩家連
// 重走一次都不行。不可掛 isSolved 當監聽源：通關的那一刻 retire 才剛把 step 設成 1，
// 監聽它會在下一個 flush 覆寫回去。current/isSolved 是 lazy computed，這裡讀到的已是新格的值。
const step = ref(0)
watch(index, () => { step.value = isSolved.value ? 1 : 0 })

const stepFens = computed<readonly string[]>(() => {
  const cell = current.value
  if (!cell) return []
  if (cell.kind === 'explain') return cell.display.stepFens
  // 深青格通關前沒有東西可步進——步進正解等於直接給答案。
  if (!isSolved.value) return []
  const mated = applyUci(cell.src.fen, cell.src.mateMoveUci)
  return mated ? [mated] : []
})
const stepCount = computed(() => stepFens.value.length + 1)
function advanceStep(): void { step.value = (step.value + 1) % stepCount.value }

const boardFen = computed(() => {
  const cell = current.value
  if (!cell) return ''
  const base = cell.kind === 'deep' ? cell.src.fen : cell.display.fen
  return step.value === 0 ? base : stepFens.value[step.value - 1] ?? base
})
const boardColor = computed<'white' | 'black'>(() =>
  current.value?.kind === 'deep' ? current.value.src.playerColor : orientation.value,
)
// 深青格要玩家動手；說明格唯讀。通關後也鎖起來——題目已經結束，再拖只會弄亂畫面。
const boardDisabled = computed(() => !(current.value?.kind === 'deep' && !isSolved.value))
// 零標記：深青格不掛任何箭頭高亮，且步進後的畫面也不掛（棋子已經在那，箭頭是多餘的）。
const annotations = computed(() =>
  current.value?.kind === 'explain' && step.value === 0 ? current.value.display.annotations : [],
)
// chessground 原生的 last-move 底色：**通關後**標出那一手（看答案的人本來就該看到它是哪一手），
// 其餘一律 null。null 不只是「不標」——玩家自己走出正解時 chessground 會留下它自己畫的高亮，
// 而 setPosition 不清高亮，不主動傳 null 的話那層底色會跟著切到下一格去。
const boardLastMove = computed<readonly [string, string] | null>(() => {
  const cell = current.value
  if (cell?.kind !== 'deep' || !isSolved.value) return null
  return [cell.src.mateMoveUci.slice(0, 2), cell.src.mateMoveUci.slice(2, 4)]
})

// 深青態＝這一格還要玩家做事；通關後回到淺卡（她從出題轉成說明）。
const onDeep = computed(() => current.value?.kind === 'deep' && !isSolved.value)
// 三顆鈕共用，只有底色隨深青／淺卡換。
const navBtnClass = computed(() => [
  'flex size-11 items-center justify-center rounded-btn border transition-colors duration-150 disabled:opacity-35 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold motion-reduce:transition-none',
  onDeep.value
    ? 'border-white/15 bg-white/10 text-ink-on-deep hover:bg-white/20'
    : 'border-line bg-surface-base text-ink hover:bg-surface-hover',
])

// ---- 標註 overlay 的幾何：從真實 cg-board 讀，尺寸變動時 tick 一次逼所有 computed 重算 ----
const boardCmp = ref<{
  boardRef: HTMLElement | null
  squareToRect: (s: string) => Rect | null
  resetPosition: () => void
} | null>(null)
const boardFit = ref<HTMLElement | null>(null)
useBoardFit(boardFit)

const geomTick = ref(0)
const boardEl = computed<HTMLElement | null>(() => {
  void geomTick.value
  return boardCmp.value?.boardRef ?? null
})
const boardSizePx = computed(() => {
  void geomTick.value
  return boardEl.value?.offsetWidth ?? 0
})
function squareToRect(square: string): Rect | null {
  void geomTick.value
  return boardCmp.value?.squareToRect?.(square) ?? null
}

let boardRO: ResizeObserver | null = null
onMounted(async () => {
  await nextTick()
  geomTick.value++
  const el = boardCmp.value?.boardRef
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
    <!-- 標題不宣稱局次：`pendingFor` 給的是最近一局的題目，未必是眼前這盤（A 局漏了將殺沒解、
         接著下 B 局，B 局的棋憶第一格就是 A 局的題目）。寫「這盤」會跟第一格自打嘴巴。 -->
    <h2 class="mb-2.5 font-sans text-[13px] font-medium tracking-[0.02em] text-ink-muted">
      值得回頭看的幾手
    </h2>

    <!-- 共用棋盤：與課程／試煉／對局同款木盤 -->
    <div
      class="w-full rounded-[12px] bg-[linear-gradient(160deg,#6f4b30,#523722)] p-3 ring-1 ring-black/30 shadow-[0_12px_32px_rgba(10,30,24,0.45),inset_0_1px_0_rgba(255,228,194,0.20),inset_0_-2px_6px_rgba(0,0,0,0.38)]"
    >
      <div ref="boardFit" class="relative board-fit">
        <ChessBoard
          ref="boardCmp"
          :fen="boardFen"
          :player-color="boardColor"
          :disabled="boardDisabled"
          :coordinates="true"
          :last-move="boardLastMove"
          @move-made="onMove"
        />
        <MoveAnnotationDisplay
          v-if="boardEl"
          :annotations="annotations"
          :evaluation="null"
          :square-to-rect="squareToRect"
          :board-ref="boardEl"
          :board-size-px="boardSizePx"
          :shaft-scale="0.5"
        />
      </div>
    </div>

    <!-- 段點條：走到第幾格。深青格是金點（它要你做一件事）。純指示，讀屏靠對話框裡的 sr-only。 -->
    <div class="flex items-center justify-center gap-1.5 py-3" aria-hidden="true" data-testid="moment-dots">
      <span
        v-for="(c, i) in cells"
        :key="c.id"
        class="h-1.5 rounded-full transition-[width,background-color] duration-150 motion-reduce:transition-none"
        :class="[
          i === index ? 'w-4.5' : 'w-1.5',
          c.kind === 'deep' ? (i === index ? 'bg-gold' : 'bg-gold/40') : (i === index ? 'bg-primary' : 'bg-line'),
        ]"
      />
    </div>

    <!-- Neve 對話框。淺卡＝她在說明；深青＝她要你做一件事，而且就在這一格做。
         aria-live：切換格子只換這一塊的字，沒有它讀屏使用者按了 ‹ › 不會知道內容變了。 -->
    <div
      class="rounded-card px-4 py-3.5"
      :class="onDeep
        ? 'bg-surface-deep shadow-[0_1px_2px_rgba(8,24,20,0.18),0_10px_24px_rgba(8,24,20,0.28)]'
        : 'border border-line bg-surface-card'"
      aria-live="polite"
    >
      <div class="mb-2.5 flex items-center gap-2">
        <NeveAvatar size="lg" :surface="onDeep ? 'deep' : 'cream'" />
        <span
          class="font-num text-[11px] tracking-[0.08em]"
          :class="onDeep ? 'text-ink-on-deep-dim' : 'text-ink-muted'"
        >
          {{ COACH.name.toUpperCase() }}
        </span>
        <span class="sr-only">第 {{ index + 1 }} 格，共 {{ cells.length }} 格</span>
        <span class="ml-auto flex gap-0.5">
          <button
            type="button"
            :class="navBtnClass"
            :disabled="atFirst"
            aria-label="上一格"
            @click="index--"
          >
            <ChevronLeft :size="18" :stroke-width="1.8" aria-hidden="true" />
          </button>
          <!-- 步進：一顆鈕循環「原局面 → 你走了 → 更好的是 → 回原局面」。深青格通關前沒得看，
               所以是 disabled 而不是消失——鈕的位置不該在切格時跳動。 -->
          <button
            type="button"
            :class="navBtnClass"
            :disabled="stepCount === 1"
            :aria-label="stepCount === 1 ? '沒有可看的後續畫面' : `看下一個畫面（第 ${step + 1} / ${stepCount} 個）`"
            data-testid="moment-step"
            @click="advanceStep"
          >
            <Play :size="16" :stroke-width="1.8" aria-hidden="true" />
          </button>
          <button
            type="button"
            :class="navBtnClass"
            :disabled="atLast"
            aria-label="下一格"
            @click="index++"
          >
            <ChevronRight :size="18" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </span>
      </div>

      <!-- 深青互動格：她要你在這個盤上走出那一手。**不給任何提示**——說出在哪一區就等於送分。 -->
      <template v-if="current.kind === 'deep'">
        <!-- 「那盤棋」不是「這一盤」：`pendingFor` 給的是**最近一局**的題目，從 /history 翻舊局
             進來時它未必是眼前這盤。中性講法兩種情況都成立。 -->
        <p
          v-if="!isSolved"
          class="font-lesson text-[17px] leading-[1.9] not-italic text-ink-on-deep"
          data-testid="deep-prompt"
        >
          那盤棋裡有一手將殺，你當時走了別的。局面我留著，你自己找，找到就走出來。
        </p>
        <p v-else class="font-lesson text-[15px] leading-[1.85] not-italic text-ink" data-testid="deep-solved">
          就是這一手。這個形狀記著，它會再出現。
        </p>
        <!-- 觸控目標 ≥44px（CLAUDE.md 鐵則）：底線文字鈕也要撐開，不能只有字高。 -->
        <button
          v-if="!isSolved"
          type="button"
          class="mt-2 inline-flex min-h-11 items-center font-sans text-[15px] text-ink-on-deep-dim underline underline-offset-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
          data-testid="deep-reveal"
          @click="reveal"
        >
          看答案
        </button>
      </template>

      <!-- 說明格：兩手並排的白話文。 -->
      <template v-else>
        <p class="mb-2 font-sans text-[15px] text-ink">
          第 {{ current.display.moveNumber }} 手 · {{ current.display.shortName }}
        </p>

        <!-- 兩手同字級，靠明度＋粗細＋領頭詞區分。**不用金色**：`text-gold-dark` 是設計系統
             明文的 large-copy-only（在 15px 上對比不足），金一律留給 focus / reward。 -->
        <p class="font-sans text-[15px] text-ink-muted" data-testid="moment-played">
          你走了 把{{ current.display.played.piece }}移到 {{ current.display.played.to }}
        </p>
        <p
          v-if="current.display.best"
          class="font-sans text-[15px] font-bold text-ink"
          data-testid="moment-best"
        >
          更好的是 把{{ current.display.best.piece }}移到 {{ current.display.best.to }}
        </p>

        <!-- Neve 的解釋（回顧態，文楷）。CJK 不可斜體——假斜會扭曲字形。 -->
        <p class="mt-3 font-lesson text-[15px] leading-[1.85] not-italic text-ink" data-testid="moment-reason">
          {{ current.display.reason }}
        </p>
      </template>
    </div>
  </section>
</template>
