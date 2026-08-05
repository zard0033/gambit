<script setup lang="ts">
/**
 * 棋憶 (Memory, #22) — the /review shell (story-007). Owns the SINGLE usePostGameReview instance so
 * analysis runs once for the whole 棋憶 stack (AC-14), loads the cross-game window, derives the
 * shared view data, and provides MemoryContext to the three sub-views. The shallow stack
 * (dashboard ⇄ slideshow/replay) is history-backed so the OS/browser back gesture pops to the
 * dashboard (GDD Rule 2). Back from the dashboard returns to the entry origin (Rule 1).
 */
import { ref, computed, onMounted, onUnmounted, provide, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useGameStore, type CompletedGame } from '@/stores/game-store'
import { useGameHistoryStore } from '@/stores/game-history'
import { historyEntryToCompletedGame } from '@/modules/memory/history-game'
import { useMemoryStore } from '@/stores/memory'
import { usePostGameReview, buildFenSequence, type StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'
import { useReviewEngine } from '@/modules/chess-engine/review-engine'
import { classify, type ClassifyResult } from '@/modules/learning-loop/classify'
import { selectMissedMates } from '@/modules/learning-loop/missed-mate'
import { useRecognitionSourceStore } from '@/stores/recognition-source'
import { RECOGNITION_MISSED_MATE_ENABLED } from '@/config/learning-loop-tuning'
import { identifyOpening, type OpeningResult } from '@/modules/opening-id/opening-index'
import { selectMoments, gatedCandidates } from '@/modules/memory/selection'
import { evalWhiteSeries } from '@/modules/memory/derive'
import { buildGameSummary } from '@/modules/memory/summary'
import { classifyStage } from '@/modules/memory/stage'
import { buildPgn } from '@/modules/game-export/assembler'
import { MEMORY_SUMMARY_SCHEMA_VERSION } from '@/config/memory-config'
import { MEMORY_CONTEXT, type MemoryContext } from '@/components/memory/memory-context'
import MemoryDashboard from '@/components/memory/MemoryDashboard.vue'
import MemoryReplay from '@/components/memory/MemoryReplay.vue'
import MemorySlideshow from '@/components/memory/MemorySlideshow.vue'

const router = useRouter()
const route = useRoute()
const gameStore = useGameStore()
const memory = useMemoryStore()
const recognitionSource = useRecognitionSourceStore()
const review = usePostGameReview()
const engine = useReviewEngine()

const openingResult = ref<OpeningResult | null>(null)

// Game under review: a past game loaded by ?gameId (對局紀錄 / 棋誌 entry tap), else the just-finished
// game in the store (post-game flow). Both feed the same 棋憶.
const loadedGame = ref<CompletedGame | null>(null)
const game = computed(() => loadedGame.value ?? gameStore.completedGame)
const orientation = computed<'white' | 'black'>(() => game.value?.playerColor ?? 'white')
const pgn = computed<string>(() => {
  if (!game.value) return ''
  try { return buildPgn(game.value) } catch { return '' }
})
const fens = computed<string[]>(() => (game.value ? buildFenSequence(game.value.moves) : []))

/** #7 F2b reused: did the player's move i allow a forced mate? (drives classify's mate signal). */
function allowedForcedMate(i: number): boolean {
  const curr = review.analysisResults.value[i]
  const next = review.analysisResults.value[i + 1]
  if (!curr || !next) return false
  const hadMate = curr.evalMate !== undefined && curr.evalMate > 0
  const nowMated = next.evalMate !== undefined && next.evalMate > 0
  return !hadMate && nowMated
}

/** classify() per position i ('none' where not a player move / unclassified). Feeds F1 + F3. */
const concepts = computed<ClassifyResult[]>(() => {
  const g = game.value
  if (!g) return []
  const f = fens.value
  return g.moves.map((uci, i) => {
    if (!review.isPlayerMove(i) || i >= g.moves.length - 1) return 'none'
    return classify({
      fen: f[i],
      playerMoveUci: uci,
      opponentReplyUci: g.moves[i + 1],
      signals: { allowedForcedMate: allowedForcedMate(i) },
    })
  })
})

const anchorPly = computed(() => review.biggestSwingCursor.value)

// review exposes analysisResults via Vue's readonly() (DeepReadonly makes nested pv readonly);
// the pure memory modules take ReadonlyArray<StoredAnalysisEntry|null> (mutable pv) and never read
// pv — cast away the deep-readonly. ponytail: a cast, not a type change to the shared engine result.
const results = computed(
  () => review.analysisResults.value as unknown as ReadonlyArray<StoredAnalysisEntry | null>,
)

const moments = computed(() => {
  if (review.phase.value !== 'COMPLETE') return []
  return selectMoments({
    analysisResults: results.value,
    isPlayerMove: review.isPlayerMove,
    concepts: concepts.value,
    biggestSwingCursor: review.biggestSwingCursor.value,
  })
})

const series = computed(() => evalWhiteSeries(results.value))

// ---- recordGame once at COMPLETE (write-once; idempotent per gameId in the store) ----
let recorded = false
function recordSummary(): void {
  const g = game.value
  if (!g) return
  const gated = gatedCandidates({
    analysisResults: results.value,
    isPlayerMove: review.isPlayerMove,
    concepts: concepts.value,
    biggestSwingCursor: review.biggestSwingCursor.value,
  })
  const summary = buildGameSummary({
    gameId: g.completedAt.toString(),
    createdAt: g.completedAt,
    gated,
    stageOf: (ply) => classifyStage(ply, fens.value[ply] ?? '', openingResult.value?.bookExitPly ?? null),
    anchorPly: review.biggestSwingCursor.value,
    schemaVersion: MEMORY_SUMMARY_SCHEMA_VERSION,
  })
  void memory.recordGame(summary).catch(() => { /* persistence best-effort; gated by story-011 live DB */ })
}

// Forward-only capture (ADR-0014 rationale): analysisResults holds bestMove/evalMate only during THIS
// review session, so lift the missed forced mates into the recognition-source store at COMPLETE — the
// signpost/judgement-field seed. Both colors: black orientation (board flip + tap geometry) was
// Playwright-verified 2026-07-11, and evalMate is side-to-move convention (ADR-0007) so the
// evalMate === 1 filter holds for black games unchanged.
function captureMissedMates(): void {
  if (!RECOGNITION_MISSED_MATE_ENABLED) return
  const g = game.value
  if (!g) return
  const mates = selectMissedMates({
    analysisResults: results.value,
    fens: fens.value,
    moves: g.moves,
    isPlayerMove: review.isPlayerMove,
  })
  if (mates.length > 0) recognitionSource.captureMate(g.completedAt.toString(), orientation.value, mates)
}

watch(() => review.phase.value, (p) => {
  if (p === 'COMPLETE' && !recorded) { recorded = true; recordSummary(); captureMissedMates() }
})

// ---- Shallow-stack navigation (history-backed; GDD Rule 2) ----
type Mode = 'dashboard' | 'slideshow' | 'replay'
const mode = ref<Mode>('dashboard')
const momentIndex = ref(0)
const replayPly = ref(0)

// ponytail: one-level stack (dashboard ⇄ a subview); a slideshow→replay cross-link REPLACES the
// subview rather than nesting, so back always pops to the dashboard. Upgrade path: a real stack if
// deeper nesting is ever wanted.
function go(target: Mode): void {
  if (mode.value === 'dashboard') history.pushState({ memSub: true }, '')
  else history.replaceState({ memSub: true }, '')
  mode.value = target
}
function openMoment(index: number): void { momentIndex.value = index; go('slideshow') }
function openReplay(ply: number): void { replayPly.value = ply; go('replay') }
function backToDashboard(): void { if (mode.value !== 'dashboard') history.back() }
function onPopState(): void { mode.value = 'dashboard' }

function onHeaderBack(): void {
  if (mode.value !== 'dashboard') backToDashboard()
  else if (window.history.length > 1) router.back() // Rule 1: return to entry origin (Game Over / 棋誌)
  else router.push('/')
}

/** Export/PGN-tag shape of the identified opening. Null unless BOTH name and ECO are known —
 *  a half-filled `Opening "…" ECO ""` tag pair is worse than omitting them (GDD §3 omission rule). */
const opening = computed<{ openingName: string; eco: string } | null>(() => {
  const o = openingResult.value
  if (!o || o.isUnknown || !o.name || !o.eco) return null
  return { openingName: o.name, eco: o.eco }
})

const ctx: MemoryContext = {
  review,
  game,
  orientation,
  pgn,
  fens,
  concepts,
  moments,
  opening,
  series,
  anchorPly,
  openMoment,
  openReplay,
  backToDashboard,
}
provide(MEMORY_CONTEXT, ctx)

// ---- Lifecycle ----
onMounted(async () => {
  // ?gameId (對局紀錄 / 棋誌 entry tap) → load + review that past game; else the just-finished game.
  const idQ = route.query.gameId
  if (idQ !== undefined && idQ !== null) {
    const id = Array.isArray(idQ) ? idQ[0] : idQ
    const historyStore = useGameHistoryStore()
    if (historyStore.cacheState !== 'valid') await historyStore.fetchHistory().catch(() => {})
    // Taps from 對局紀錄 always hit a loaded entry; only a cold deep-link to a game past the first
    // page (HISTORY_LOAD_LIMIT) or a deleted one misses → loadedGame stays null → redirect below.
    const entry = historyStore.entries.find((e) => e.id === id)
    loadedGame.value = entry ? historyEntryToCompletedGame(entry) : null
  }

  const g = game.value
  if (!g) { router.push(idQ ? '/history' : '/'); return }
  openingResult.value = identifyOpening([...g.moves])
  void memory.load().catch(() => { /* cross-game window best-effort */ })
  window.addEventListener('popstate', onPopState)
  review.init(g, ({ fen, targetDepth, movetimeMs, signal }) =>
    engine.analyze({ fen, targetDepth, movetimeMs, signal }),
  ).catch(() => { /* aborted / engine error — review stays partially usable */ })

  // Deep-link (story-010): /review?ply=N opens replay at ply N over the dashboard root.
  const plyQ = route.query.ply
  if (plyQ !== undefined && plyQ !== null) {
    const ply = Number(Array.isArray(plyQ) ? plyQ[0] : plyQ)
    if (Number.isFinite(ply)) openReplay(ply)
  }
})
onUnmounted(() => {
  review.abort()
  engine.dispose()
  window.removeEventListener('popstate', onPopState)
})
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center p-4">
    <div class="mb-3 flex w-full max-w-md items-center justify-between">
      <Button variant="secondary" size="sm" @click="onHeaderBack">
        <ArrowLeft :size="16" :stroke-width="1.8" /> {{ mode === 'dashboard' ? '返回' : '回棋憶' }}
      </Button>
      <h1 class="font-display text-xl font-bold text-ink" tabindex="-1">棋憶</h1>
      <div class="w-16" />
    </div>

    <MemoryDashboard v-show="mode === 'dashboard'" />
    <MemorySlideshow v-if="mode === 'slideshow'" :index="momentIndex" />
    <MemoryReplay v-if="mode === 'replay'" :ply="replayPly" />
  </div>
</template>
