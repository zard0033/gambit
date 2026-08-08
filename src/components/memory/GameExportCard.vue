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
import { computed, ref, watch } from 'vue'
import { Copy, Check, Share2 } from 'lucide-vue-next'
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

/** Read once at setup, not a computed: nothing re-reads it after the composable is constructed. */
function buildExportContext() {
  return {
    opening: props.opening ?? undefined,
    review: props.moments.length
      ? { keyMoveNumbers: [...new Set(props.moments.map((m) => plyToMoveNumber(m.ply)))] }
      : undefined,
  }
}

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
    // Required by ExportConfig but nothing reads it — buildPgn and the {{AI_SKILL_LEVEL}} slot both
    // take the value off `game` directly. Dead field on the type, not introduced here; left alone
    // rather than widened into a types.ts change that this feature does not need.
    aiSkillLevel: props.game.aiSkillLevel ?? 0,
    includeAnnotations: false,
  },
  navDeps,
  buildExportContext(),
)

const busy = computed(() => state.value === 'SHARING' || state.value === 'COPYING')
const done = computed(() => state.value === 'SUCCESS')

/**
 * Which tier actually ran. The idle label can only predict from `isTouch`, but by the time we show
 * a success message we know for certain — the state machine passes through SHARING or COPYING on
 * the way to SUCCESS. Saying 「已複製」 after a Web Share would be a lie the player acts on: the
 * text never reached the clipboard, so their paste would produce whatever was there before.
 */
const lastTier = ref<'share' | 'copy' | null>(null)
watch(state, (s) => {
  if (s === 'SHARING') lastTier.value = 'share'
  else if (s === 'COPYING') lastTier.value = 'copy'
})

/**
 * 標籤刻意短：這顆鈕住在 header 右上（2026-08-08），旁邊還有「← 棋憶」。原本的
 * 「複製這盤棋」放在對話框正下方，看起來像在複製當下那一手——搬上來就是為了斷掉這個誤讀，
 * 完整說明退到 aria-label。
 */
const label = computed(() => {
  if (done.value) return lastTier.value === 'share' ? '已分享' : '已複製'
  return '棋譜'
})
const icon = computed(() => (isTouch ? Share2 : Copy))
</script>

<template>
  <div>
    <button
      type="button"
      class="flex min-h-11 items-center gap-1.5 rounded-btn px-2.5 font-sans text-sm text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold motion-reduce:transition-none"
      :disabled="busy"
      :aria-label="done ? label : `${isTouch ? '分享' : '複製'}整盤棋譜，貼給 AI 一起看`"
      @click="onExportTap"
    >
      <component :is="done ? Check : icon" :size="17" :stroke-width="1.8" aria-hidden="true" />
      {{ label }}
    </button>

    <!-- Tier 3: neither Web Share nor Clipboard available (or both refused) — show the text so the
         player can select it by hand. Never a dead end. Fixed overlay because the button now lives
         in a one-line header that a 6-row textarea would blow apart. -->
    <div
      v-if="state === 'FALLBACK'"
      class="fixed inset-x-4 top-24 z-40 flex flex-col gap-2 rounded-card border border-line bg-surface-card p-3 shadow-card"
    >
      <textarea
        :value="fallbackText"
        readonly
        rows="6"
        class="w-full rounded-card border border-line bg-surface-base p-3 font-sans text-base text-ink"
        aria-label="這盤棋的內容，請自行選取複製"
        @focus="(e) => (e.target as HTMLTextAreaElement).select()"
      />
      <Button variant="ghost" size="sm" class="w-full" @click="dismissFallback">關閉</Button>
    </div>
  </div>
</template>
