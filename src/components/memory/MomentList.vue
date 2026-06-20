<script setup lang="ts">
/**
 * 棋憶 dashboard — the moment list (GDD Rules 11–13). Each card is **Door 2** (→ slideshow,
 * "看這一手"): a real <button> with a leading kind-icon SHAPE + plain short name + the played move
 * (白話) + swing value + trailing chevron. Color-blind safety (EC-14): the icon shape + the words
 * carry the meaning; color is redundant. Chronological order (Rule 13), never severity-ranked.
 */
import { computed } from 'vue'
import { AlertTriangle, Star, CircleSlash, Signpost, ChevronRight } from 'lucide-vue-next'
import type { Moment } from '@/types/memory'
import { momentVisualKind, momentShortName, describeMove, type MomentVisualKind } from '@/modules/memory/describe'

const props = defineProps<{
  moments: Moment[]
  /** FEN per position (buildFenSequence) — for the played-move 白話 description. */
  fens: string[]
  /** the game's UCI moves — moves[ply] is the move made at position ply. */
  moves: readonly string[]
}>()
const emit = defineEmits<{ (e: 'open', index: number): void }>()

const ICON: Record<MomentVisualKind, typeof AlertTriangle> = {
  tactical: AlertTriangle,
  bright: Star,
  plain: CircleSlash,
  'turning-point': Signpost,
}
const COLOR: Record<MomentVisualKind, string> = {
  tactical: 'var(--color-danger)',
  bright: 'var(--color-success)',
  plain: 'var(--color-ink-muted)',
  'turning-point': 'var(--color-accent)',
}

interface CardVM {
  index: number
  visualKind: MomentVisualKind
  shortName: string
  playedText: string
  swingText: string
  isTurningPoint: boolean
}

const cards = computed<CardVM[]>(() =>
  props.moments.map((m, index) => {
    const vk = momentVisualKind(m)
    const played = describeMove(props.fens[m.ply], props.moves[m.ply])
    // bright = favorable swing (+); everything else surfaces the cpLoss (−).
    const swing = vk === 'bright' ? m.fav : -m.cp
    const pawns = (Math.abs(swing) / 100).toFixed(1)
    return {
      index,
      visualKind: vk,
      shortName: momentShortName(m),
      playedText: played ? `把${played.piece}移到 ${played.to}` : '',
      swingText: `${swing >= 0 ? '+' : '−'}${pawns}`,
      isTurningPoint: vk === 'turning-point',
    }
  }),
)
</script>

<template>
  <ul class="flex flex-col gap-2" aria-label="這盤的重點時刻">
    <li v-for="c in cards" :key="c.index">
      <button
        type="button"
        class="flex min-h-[44px] w-full items-center gap-3 rounded-card border border-line bg-surface-card px-3.5 py-2.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        :class="{ 'border-l-[3px] border-l-accent': c.isTurningPoint }"
        :aria-label="`${c.shortName}，${c.playedText}，看這一手`"
        @click="emit('open', c.index)"
      >
        <component
          :is="ICON[c.visualKind]"
          :size="20"
          :stroke-width="1.9"
          :style="{ color: COLOR[c.visualKind] }"
          class="shrink-0"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1">
          <span class="block truncate font-sans text-[15px] text-ink">{{ c.shortName }}</span>
          <span v-if="c.playedText" class="block truncate font-sans text-xs text-ink-muted">{{ c.playedText }}</span>
        </span>
        <span class="shrink-0 font-num text-sm tabular-nums text-ink-muted">{{ c.swingText }}</span>
        <ChevronRight :size="16" :stroke-width="1.8" class="shrink-0 text-ink-faint" aria-hidden="true" />
      </button>
    </li>
  </ul>
</template>
