<script setup lang="ts">
/**
 * 匯出這盤棋 (Game Export, ADR-0010 / design/gdd/game-export-share.md) — the UI that was never
 * wired up. The whole delivery chain (Web Share → Clipboard → textarea) already existed in
 * `useGameExport`; this is its one mount point.
 *
 * It lives in 棋憶 rather than the game-over screen because `/review?gameId=…` serves BOTH the
 * just-finished game and any past game opened from 對局紀錄 — one mount covers both, and
 * "export the game I played last night" only works from the history side.
 *
 * GDD scope guard: only ever rendered inside the dashboard's `isComplete` branch, so an
 * unfinished game has no export affordance.
 */
import { computed } from 'vue'
import { Copy, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useGameExport } from '@/modules/game-export/use-game-export'
import type { CompletedGame } from '@/stores/game-store'
import type { Moment } from '@/types/memory'

const props = defineProps<{
  game: CompletedGame
  moments: readonly Moment[]
  opening: { openingName: string; eco: string } | null
}>()

/** Ply index → the move number a player reads off a board (1-based pairs). */
function plyToMoveNumber(ply: number): number {
  return Math.floor(ply / 2) + 1
}

const exportContext = computed(() => ({
  opening: props.opening ?? undefined,
  review: props.moments.length
    ? { keyMoveNumbers: [...new Set(props.moments.map((m) => plyToMoveNumber(m.ply)))] }
    : undefined,
}))

/**
 * ADR-0010 puts Web Share first, which is right on a phone — the iOS share sheet reaches Claude,
 * Notes, Messages in one tap. Desktop Chrome/Edge also implement `navigator.share` now, where it
 * opens the *Windows* share sheet instead: wrong affordance for a button that says 複製, and it
 * cannot do the one thing the player wants (put the text on the clipboard).
 *
 * So: touch devices keep the full tier chain; pointer devices get a navigator surface with `share`
 * withheld, which drops them to Tier 2 (clipboard) without touching the shared tier logic.
 */
const isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false
const navDeps = isTouch ? undefined : { clipboard: navigator.clipboard }

// Config is read once at setup: `game` is fixed for this mount (the dashboard remounts the card
// when a different game is loaded), so there is nothing reactive to track here.
const { state, fallbackText, onExportTap, dismissFallback } = useGameExport(
  props.game,
  {
    playerName: '你',
    aiSkillLevel: props.game.aiSkillLevel ?? 0,
    includeAnnotations: false,
  },
  navDeps,
  exportContext.value,
)

const busy = computed(() => state.value === 'SHARING' || state.value === 'COPYING')
const done = computed(() => state.value === 'SUCCESS')
</script>

<template>
  <div class="flex flex-col gap-2">
    <Button
      variant="secondary"
      size="sm"
      class="w-full"
      :disabled="busy"
      :aria-label="done ? '已複製這盤棋' : '複製這盤棋，貼給 AI 一起看'"
      @click="onExportTap"
    >
      <component :is="done ? Check : Copy" :size="16" :stroke-width="1.8" />
      {{ done ? '已複製' : '複製這盤棋' }}
    </Button>
    <p class="text-center font-sans text-xs text-ink-muted">貼給 AI，就能一起看這盤怎麼走的。</p>

    <!-- Tier 3: neither Web Share nor Clipboard available (or both refused) — show the text so the
         player can select it by hand. Never a dead end. -->
    <div v-if="state === 'FALLBACK'" class="flex flex-col gap-2">
      <textarea
        :value="fallbackText"
        readonly
        rows="6"
        class="w-full rounded-card border border-line bg-surface-card p-3 font-sans text-sm text-ink"
        aria-label="這盤棋的內容，請自行選取複製"
        @focus="(e) => (e.target as HTMLTextAreaElement).select()"
      />
      <Button variant="ghost" size="sm" class="w-full" @click="dismissFallback">關閉</Button>
    </div>
  </div>
</template>
