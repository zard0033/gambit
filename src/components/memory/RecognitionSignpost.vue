<script setup lang="ts">
/**
 * 棋憶 signpost — Neve invites the player back to a position in their own game where a tactical
 * opportunity was there and passed over (mate or material). Renders ONLY when the recognition-source
 * store has a pending source for one of the two concepts; otherwise nothing (no zero-state, no
 * residue). Tapping opens that concept's deepening judgement field seeded with the real position
 * (?source=recognition).
 *
 * mate takes priority over material when both are pending (Eason-approved minimal choice,
 * signpost-material-design.md follow-up: single card, not two) — mate is the larger error (mirrors
 * `classify.ts`'s "mate precedes material" EC-5 ordering), and showing two signpost cards at once
 * would be a UI concern the design never asked for.
 *
 * Visual: deep-jade anchor, warm Neve voice (font-lesson), brand gold used ONLY for the icon
 * indicator + CTA focus ring (never as body colour or background). The whole card is one 44px+
 * tap target. Copy is calm, second-person, no blame; 西洋棋用語「將殺」「子」.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Milestone, ArrowRight } from 'lucide-vue-next'
import { NeveAvatar } from '@/components/ui/gambit'
import { COACH } from '@/types/lesson'
import { useRecognitionSourceStore } from '@/stores/recognition-source'

const router = useRouter()
const source = useRecognitionSourceStore()

const matePending = computed(() => source.pendingFor('mate'))
const materialPending = computed(() => source.pendingFor('material'))
const activeConcept = computed<'mate' | 'material' | null>(() => {
  if (matePending.value.length > 0) return 'mate'
  if (materialPending.value.length > 0) return 'material'
  return null
})
const visible = computed(() => activeConcept.value !== null)

// Deterministic 2-variant copy per concept (no random/LLM): parity of the game's id keeps it stable
// per game.
const MATE_COPY = [
  '那盤棋裡，有一手將殺，你當時沒看見。不急著檢討——這次換個方式，你自己再看一眼。',
  '你剛下完的那盤，藏著一步將殺。那個局面還留著——回到它面前，這次你來認。',
] as const
const MATERIAL_COPY = [
  '那盤棋裡，有顆子沒人守著，你當時沒拿下。不急著檢討——這次換個方式，你自己再看一眼。',
  '你剛下完的那盤，藏著一顆沒人守著的子。那個局面還留著——回到它面前，這次你來拿。',
] as const
const copy = computed(() => {
  const concept = activeConcept.value
  if (!concept) return ''
  const pool = concept === 'mate' ? MATE_COPY : MATERIAL_COPY
  const list = concept === 'mate' ? matePending.value : materialPending.value
  const n = Number(list[0]?.gameId)
  return pool[Number.isFinite(n) ? n % pool.length : 0]
})

function go(): void {
  const concept = activeConcept.value
  if (!concept) return
  router.push(`/learn/concept/${concept}?source=recognition`)
}
</script>

<template>
  <button
    v-if="visible"
    type="button"
    data-testid="recognition-signpost"
    class="signpost group w-full rounded-card bg-surface-deep px-5 py-4 text-left shadow-[0_1px_2px_rgba(8,24,20,0.18),0_10px_24px_rgba(8,24,20,0.28)] transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base motion-reduce:transition-none"
    @click="go"
  >
    <div class="mb-2 flex items-center gap-2">
      <NeveAvatar size="lg" surface="deep" />
      <span class="font-num text-[11px] tracking-[0.08em] text-ink-on-deep-dim">{{ COACH.name.toUpperCase() }}</span>
      <Milestone :size="15" :stroke-width="1.8" class="ml-auto text-gold" aria-hidden="true" />
    </div>
    <p class="signpost-line font-lesson text-[17px] leading-[1.9] text-ink-on-deep">{{ copy }}</p>
    <span class="mt-3 inline-flex items-center gap-1.5 font-sans text-[15px] font-bold text-ink-on-deep">
      回到那個局面
      <ArrowRight :size="16" :stroke-width="2" class="text-gold transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
    </span>
  </button>
</template>

<style scoped>
/* CJK 不可斜體（假斜扭曲字形）— 顯式鎖正體。 */
.signpost-line { font-style: normal; }
</style>
