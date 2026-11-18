<script setup lang="ts">
/**
 * 棋憶 Dashboard (story-007, D4-slimmed) — the calm landing view. NO verdict/score/"weakest" node
 * is rendered (AC-1 asserts its absence). D4 (2026-08) retired the slideshow/replay drill-in and
 * the cross-game Neve line; the only thing on the cognitive-transfer path is the missed-mate deep
 * cell, which lives inside KeyMomentsCard (wave 2, 2026-09).
 *
 * wave 1a（2026-11）：分析中、完成、零狀態都由 KeyMomentsCard 自己畫（同一個版面、同一個棋盤），
 * 這裡只負責把它放上去。**`game` 還是 null 時不掛**（帶 ?gameId 進來、等 fetchHistory 的那段期間），
 * 這樣不會先用空局面建一個棋盤，之後分析中到看完都是同一個 ChessBoard 實例。
 */
import { useMemoryContext } from './memory-context'
import KeyMomentsCard from './KeyMomentsCard.vue'

const ctx = useMemoryContext()
</script>

<template>
  <div class="flex w-full max-w-md flex-col">
    <KeyMomentsCard v-if="ctx.game.value" />
  </div>
</template>
