<script setup lang="ts">
/**
 * 記譜紙上的棋譜格（對局頁）。三欄：回合序號｜白｜黑；上下兩條墨線，列間 `line` 髮線。
 * 棋譜字與序號用 Cubic 11（font-num），其餘中文交給外層的黑體。
 *
 * - 最新一手後面畫一個小墨點（`highlightLast`）。
 * - `maxRows` 只留最後 N 個回合（完局紙）；`minRows` 不足時補 aria-hidden 的空白列，讓紙面畫滿格線。
 * - 容器本身可捲動；掛上與每走一步時捲到「最新一手剛好露在最下面」，不捲到底下的空白列。
 *   要捲的時候先把高度收成整列（h-9＝36px 一列），頂端才不會露出半列。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const ROW_PX = 36

const props = withDefaults(
  defineProps<{
    /** SAN 序列（從初始局面起，白先）。 */
    moves: readonly string[]
    /** 最新一手後面加小墨點。 */
    highlightLast?: boolean
    /** 只顯示最後 N 個回合；不給就全部顯示。 */
    maxRows?: number
    /** 不足這麼多列時補空白列。 */
    minRows?: number
  }>(),
  { highlightLast: true, maxRows: undefined, minRows: 0 },
)

interface Row {
  n: number
  white: string
  black: string | null
}

const allRows = computed<Row[]>(() => {
  const rows: Row[] = []
  for (let i = 0; i < props.moves.length; i += 2) {
    rows.push({ n: i / 2 + 1, white: props.moves[i], black: props.moves[i + 1] ?? null })
  }
  return rows
})

const rows = computed(() =>
  props.maxRows !== undefined ? allRows.value.slice(-props.maxRows) : allRows.value,
)
const blankCount = computed(() => Math.max(0, props.minRows - rows.value.length))
/** 最新一手是白方（黑格還空著）還是黑方。 */
const lastIsWhite = computed(() => props.moves.length % 2 === 1)

const scroller = ref<HTMLElement | null>(null)

function anchorToLatest(): void {
  const el = scroller.value
  if (!el) return
  el.style.height = ''
  el.style.flex = ''
  const last = el.querySelector<HTMLElement>('[data-last]')
  if (!last) return
  const bottom = last.offsetTop + last.offsetHeight
  if (bottom <= el.clientHeight) {
    el.scrollTop = 0
    return
  }
  const rows = Math.max(2, Math.floor((el.clientHeight + 1) / ROW_PX))
  el.style.flex = 'none'
  el.style.height = `${rows * ROW_PX + 1}px`
  el.scrollTop = Math.max(0, bottom - el.clientHeight)
}

onMounted(() => {
  anchorToLatest()
  window.addEventListener('resize', anchorToLatest)
})
onBeforeUnmount(() => window.removeEventListener('resize', anchorToLatest))
watch(
  () => props.moves.length,
  async () => {
    await nextTick()
    anchorToLatest()
  },
)
</script>

<template>
  <div
    ref="scroller"
    class="relative overflow-y-auto border-y border-ink [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    role="table"
    aria-label="棋譜"
    data-testid="score-sheet"
  >
    <div
      v-for="(r, i) in rows"
      :key="r.n"
      class="grid h-9 grid-cols-[2.125rem_1fr_1fr] border-b border-line last:border-b-0"
      role="row"
      :data-last="i === rows.length - 1 ? '' : undefined"
    >
      <span class="flex items-center pl-0.5 font-num text-xs text-ink-muted tabular-nums" role="rowheader">{{ r.n }}</span>
      <span class="flex items-center gap-2 border-l border-line pl-3 font-num text-title leading-none text-ink" role="cell">
        {{ r.white }}
        <svg
          v-if="highlightLast && i === rows.length - 1 && lastIsWhite"
          class="size-2 shrink-0 fill-ink"
          viewBox="0 0 10 10"
          role="img"
          aria-label="最新一手"
          data-testid="score-latest"
        ><path d="M5.2.6c2.3.1 4.2 1.9 4.2 4.3S7.6 9.5 5 9.4C2.5 9.3.5 7.6.6 5 .7 2.5 2.8.5 5.2.6z" /></svg>
      </span>
      <span class="flex items-center gap-2 border-l border-line pl-3 font-num text-title leading-none text-ink" role="cell">
        {{ r.black ?? '' }}
        <svg
          v-if="highlightLast && i === rows.length - 1 && !lastIsWhite"
          class="size-2 shrink-0 fill-ink"
          viewBox="0 0 10 10"
          role="img"
          aria-label="最新一手"
          data-testid="score-latest"
        ><path d="M5.2.6c2.3.1 4.2 1.9 4.2 4.3S7.6 9.5 5 9.4C2.5 9.3.5 7.6.6 5 .7 2.5 2.8.5 5.2.6z" /></svg>
      </span>
    </div>
    <div
      v-for="b in blankCount"
      :key="`blank-${b}`"
      class="grid h-9 grid-cols-[2.125rem_1fr_1fr] border-b border-line last:border-b-0"
      aria-hidden="true"
      data-testid="score-blank"
    >
      <span />
      <span class="border-l border-line" />
      <span class="border-l border-line" />
    </div>
  </div>
</template>
