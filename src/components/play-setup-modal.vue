<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Check, ArrowRight } from 'lucide-vue-next'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Side = 'white' | 'black' | 'random'

const props = defineProps<{
  /** Highest Skill Level the player has previously beaten, or null if none yet. */
  beatenLevel: number | null
}>()

const emit = defineEmits<{
  start: [payload: { color: 'white' | 'black'; level: number }]
  close: []
}>()

// Dialog owns overlay click / Esc / × close. Any close gesture flips open → emit('close').
const open = ref(true)
watch(open, (v) => {
  if (!v) emit('close')
})

// Stockfish 18 "Skill Level" UCI option: 0–20 (21 levels). Passed straight through as skillLevel.
const LEVELS = Array.from({ length: 21 }, (_, i) => i)

// Suggest the next rung above what they last beat, capped at 20.
const suggestedLevel = computed(() =>
  props.beatenLevel === null ? 3 : Math.min(props.beatenLevel + 1, 20),
)
const selectedLevel = ref<number>(suggestedLevel.value)
const selectedSide = ref<Side>('random')

// url() in inline-style is not base-rewritten like .css is, so prefix BASE_URL or it 404s on Pages.
const base = import.meta.env.BASE_URL

const SIDES: { value: Side; label: string; piece: string }[] = [
  { value: 'black', label: '執黑', piece: 'bK' },
  { value: 'random', label: '隨機', piece: 'wK' },
  { value: 'white', label: '執白', piece: 'wK' },
]

function start(): void {
  const color: 'white' | 'black' =
    selectedSide.value === 'random'
      ? Math.random() < 0.5
        ? 'white'
        : 'black'
      : selectedSide.value
  emit('start', { color, level: selectedLevel.value })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <div class="text-center">
        <DialogTitle class="text-xl">對局設定</DialogTitle>
        <DialogDescription class="mt-1">與引擎對弈 · 無限思考時間</DialogDescription>
      </div>

      <!-- Strength — Stockfish Skill Level 0–20 -->
      <fieldset>
        <div class="mb-2 flex items-baseline justify-between">
          <legend class="text-xs font-medium uppercase tracking-wider text-ink-faint">電腦強度</legend>
          <span class="text-xs text-ink-faint">Skill Level {{ selectedLevel }} / 20</span>
        </div>
        <div class="grid grid-cols-7 gap-1.5">
          <button
            v-for="lvl in LEVELS"
            :key="lvl"
            type="button"
            class="relative h-10 rounded-btn text-sm font-semibold tabular-nums transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
            :class="
              selectedLevel === lvl
                ? 'bg-primary text-primary-fg shadow-button'
                : beatenLevel !== null && lvl <= beatenLevel
                  ? 'bg-success/15 text-success-dark hover:bg-success/25'
                  : 'bg-surface-raised text-ink-muted hover:bg-surface-hover'
            "
            :aria-pressed="selectedLevel === lvl"
            :aria-label="beatenLevel !== null && lvl <= beatenLevel ? `等級 ${lvl}（已戰勝）` : `等級 ${lvl}`"
            @click="selectedLevel = lvl"
          >
            {{ lvl }}
            <span
              v-if="beatenLevel !== null && lvl <= beatenLevel"
              class="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success text-success-fg"
              aria-hidden="true"
            ><Check :size="9" :stroke-width="3.5" /></span>
          </button>
        </div>
        <p v-if="beatenLevel !== null" class="mt-2 text-xs text-ink-muted">
          上次戰勝 Lv {{ beatenLevel }}<template v-if="beatenLevel < 20">，挑戰 Lv {{ beatenLevel + 1 }} 看看？</template>
        </p>
      </fieldset>

      <!-- Side -->
      <fieldset>
        <legend class="mb-2 text-xs font-medium uppercase tracking-wider text-ink-faint">執子方</legend>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="side in SIDES"
            :key="side.value"
            type="button"
            class="flex flex-col items-center gap-1.5 rounded-card border py-3 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
            :class="
              selectedSide === side.value
                ? 'border-primary bg-primary/10 text-ink'
                : 'border-line bg-surface-raised text-ink-muted hover:bg-surface-hover'
            "
            :aria-pressed="selectedSide === side.value"
            @click="selectedSide = side.value"
          >
<!-- Pieces render via background-image (matches the board). 隨機 = 左白右黑各半的王，
                 用兩層 clip-path 各取一半疊出來。BASE_URL 前綴避免部署在子路徑時 404。 -->
            <div v-if="side.value === 'random'" aria-hidden="true" class="relative h-7 w-7">
              <span
                class="absolute inset-0 bg-contain bg-center bg-no-repeat [clip-path:inset(0_50%_0_0)]"
                :style="{ backgroundImage: `url(${base}pieces/wK.svg)` }"
              />
              <span
                class="absolute inset-0 bg-contain bg-center bg-no-repeat [clip-path:inset(0_0_0_50%)]"
                :style="{ backgroundImage: `url(${base}pieces/bK.svg)`, filter: 'brightness(var(--piece-dark-brightness))' }"
              />
            </div>
            <div
              v-else
              aria-hidden="true"
              class="h-7 w-7 bg-contain bg-center bg-no-repeat"
              :style="{
                backgroundImage: `url(${base}pieces/${side.piece}.svg)`,
                ...(side.piece.startsWith('b') ? { filter: 'brightness(var(--piece-dark-brightness))' } : {}),
              }"
            />
            <span class="text-sm font-medium">{{ side.label }}</span>
          </button>
        </div>
      </fieldset>

      <Button variant="gold" size="lg" class="w-full" @click="start">
        開始對局 <ArrowRight :size="16" :stroke-width="1.8" />
      </Button>
    </DialogContent>
  </Dialog>
</template>
