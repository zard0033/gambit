<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Check, ArrowRight } from 'lucide-vue-next'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DarkPanel } from '@/components/ui/gambit'
import { DIFFICULTY_LADDER, rungAt, rungForSkillLevel } from '@/config/difficulty-tuning'

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

const LAST_RUNG = DIFFICULTY_LADDER[DIFFICULTY_LADDER.length - 1].rung

/**
 * Highest rung already cleared, or 0 if none. `beatenLevel` is a raw Skill Level — it may predate
 * the ladder, so it is mapped onto the nearest rung rather than compared directly.
 */
const beatenRung = computed(() =>
  props.beatenLevel === null ? 0 : rungForSkillLevel(props.beatenLevel).rung,
)

// Open on the rung after the last one cleared — the ladder's whole point is "try the next one".
const suggestedRung = computed(() => Math.min(beatenRung.value + 1, LAST_RUNG))
const selectedRung = ref<number>(suggestedRung.value)
const selected = computed(() => rungAt(selectedRung.value))
const selectedSide = ref<Side>('random')

// Roving tabindex: only the checked radio is tabbable, so Tab lands on the current rung instead of
// always on 初學, and arrow keys move between rungs (WAI-ARIA radiogroup pattern).
const rungButtons = ref<HTMLButtonElement[]>([])

function focusRung(rung: number): void {
  rungButtons.value[rung - 1]?.focus()
}

function onLadderKeydown(event: KeyboardEvent): void {
  let next: number | null = null
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    next = selectedRung.value > 1 ? selectedRung.value - 1 : LAST_RUNG
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    next = selectedRung.value < LAST_RUNG ? selectedRung.value + 1 : 1
  } else if (event.key === 'Home') {
    next = 1
  } else if (event.key === 'End') {
    next = LAST_RUNG
  }
  if (next === null) return
  event.preventDefault()
  selectedRung.value = next
  focusRung(next)
}

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
  // Emits the raw Skill Level, not the rung index: resume snapshots, ui:highestBeatenLevel and
  // game_sessions.ai_difficulty all store Skill Levels, and none of them need to change.
  emit('start', { color, level: selected.value.skillLevel })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <div class="text-center">
        <DialogTitle class="text-xl">對局設定</DialogTitle>
        <!-- 「無限思考時間」已不成立：難度階梯給每一檔都設了 movetime 上限（50–300ms）。 -->
        <DialogDescription class="mt-1">選一個對手</DialogDescription>
      </div>

      <!-- Strength — 五階難度階梯（design/quick-specs/difficulty-ladder-remake.md）。
           包進 DarkPanel：每屏都要 deep-jade 錨，全 cream 的版本讀起來是扁的。 -->
      <fieldset>
        <legend class="sr-only">電腦強度</legend>
        <DarkPanel>
          <!-- 最高紀錄常駐在頂部，不隨你正在看哪一階而變。放進描述段會語意錯位：
               打穿之後點回初學，會同時讀到「初學：常常看不到你的威脅」與「你上次贏過大師」。 -->
          <!-- 面板頂端是漸層最亮處（160deg 由上而下），小字疊在這裡最容易掉出 AA。
               標籤用全亮 ink；成就徽章自帶深色 pill 底，才留得住 success 綠又不失對比。 -->
          <div class="mb-2.5 flex items-baseline justify-between gap-2">
            <span
              class="text-xs font-medium tracking-[0.12em] uppercase text-ink-on-deep"
              aria-hidden="true"
            >電腦強度</span>
            <span
              v-if="beatenRung > 0"
              class="rounded-pill bg-surface-deep/70 px-2 py-0.5 text-xs text-success-on-deep"
            >
              最高 · {{ rungAt(beatenRung).name }}
            </span>
          </div>

          <!-- 分段條：五格連成一條，用面積取代點與線。
               降權用底色深淺而非文字顏色——降文字會壓低對比，降底色反而提高。 -->
          <div
            role="radiogroup"
            aria-label="電腦強度"
            class="flex overflow-hidden rounded-[10px] border border-white/15"
            @keydown="onLadderKeydown"
          >
            <button
              v-for="rung in DIFFICULTY_LADDER"
              :key="rung.rung"
              :ref="(el) => { if (el) rungButtons[rung.rung - 1] = el as HTMLButtonElement }"
              type="button"
              role="radio"
              class="grid min-h-[52px] flex-1 cursor-pointer place-items-center gap-0.5 border-0 border-r border-white/12 px-1 py-1.5 text-xs transition-colors duration-200 last:border-r-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset motion-reduce:transition-none"
              :class="
                selectedRung === rung.rung
                  ? 'bg-ink-on-deep font-bold text-surface-deep shadow-[inset_0_0_0_2px_var(--color-gold)]'
                  : rung.rung <= beatenRung
                    ? 'bg-success-on-deep/20 text-ink-on-deep'
                    : rung.rung > suggestedRung
                      ? 'bg-surface-deep/70 text-ink-on-deep'
                      : 'bg-surface-deep/40 text-ink-on-deep'
              "
              :aria-checked="selectedRung === rung.rung"
              :tabindex="selectedRung === rung.rung ? 0 : -1"
              :aria-label="rung.rung <= beatenRung ? `${rung.name}（已通過）` : rung.name"
              @click="selectedRung = rung.rung"
            >
              <Check
                v-if="rung.rung <= beatenRung"
                :size="11"
                :stroke-width="3.4"
                :class="selectedRung === rung.rung ? 'text-surface-deep' : 'text-success-on-deep'"
                aria-hidden="true"
              />
              <span v-else class="block h-[11px]" aria-hidden="true" />
              <span class="whitespace-nowrap">{{ rung.name }}</span>
            </button>
          </div>

          <!-- 選中的階換人時，名稱與描述整段更新——螢幕閱讀器要靠 aria-live 才會讀到這個變化。 -->
          <div aria-live="polite">
            <!-- 28px = 設計系統 h1 字階。原本的 26px 是從決策樣張直接搬來的、不在字階上。 -->
            <p class="mt-3.5 border-t border-white/10 pt-3 font-display text-[28px] leading-tight text-ink-on-deep">
              {{ selected.name }}
            </p>
            <p class="text-[13px] text-ink-on-deep-dim">{{ selected.blurb }}</p>
          </div>
        </DarkPanel>
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
