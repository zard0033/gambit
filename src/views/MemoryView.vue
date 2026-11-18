<script setup lang="ts">
/**
 * 棋憶 (Memory, #22) — the /review shell (story-007, D4-slimmed). Owns the SINGLE
 * usePostGameReview instance (AC-14), loads the cross-game window, derives the shared view data,
 * and provides MemoryContext to the dashboard. D4 (2026-08) retired the slideshow/replay
 * drill-in, so this is a single flat screen now — no shallow stack, no `?ply=` deep-link.
 */
import { ref, computed, onMounted, onUnmounted, provide, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
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
import { buildGameSummary } from '@/modules/memory/summary'
import { classifyStage } from '@/modules/memory/stage'
import { MEMORY_SUMMARY_SCHEMA_VERSION } from '@/config/memory-config'
import { MEMORY_CONTEXT, type MemoryContext } from '@/components/memory/memory-context'
import MemoryDashboard from '@/components/memory/MemoryDashboard.vue'
import GameExportCard from '@/components/memory/GameExportCard.vue'
import { TaskTopRow } from '@/components/ui/gambit'
import { formatGameDay } from '@/utils/game-day'
import { rungForSkillLevel } from '@/config/difficulty-tuning'

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
// 深青互動格 seed. Both colors: black orientation (board flip + tap geometry) was
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

// ---- Header back: return to the entry origin (Game Over / 對局紀錄) — GDD Rule 1 ----
// 用來源判斷，不用 history.back()：這頁裝成 PWA 後跑在 standalone，**空堆疊時 history.back()
// 是靜默 no-op**（不報錯、不觸發事件、畫面就是不動），冷啟動直接落在這頁就失靈。
// 兩個入口剛好分得開：帶 ?gameId 一定是從對局紀錄點進來的，沒有就是下完棋自動導來的。
// replace 而非 push：返回是「離開這頁」，不該再疊一筆紀錄——否則 history → review → 返回 →
// review → 返回… 每來回一次就長一層，PWA 的左緣滑動返回會走回一連串舊的 review 頁。
function onHeaderBack(): void {
  router.replace(route.query.gameId ? '/history' : '/')
}

/** 匯出鈕只在分析跑完後出現（EC-3：不給半成品的可點物）。 */
const isComplete = computed(() => review.phase.value === 'COMPLETE')

/** 頂列副標：是哪一盤。`game` 還沒載到（等 fetchHistory）時不顯示，只留標題。 */
const topSubtitle = computed(() => {
  const g = game.value
  if (!g) return undefined
  const side = g.playerColor === 'white' ? '執白' : '執黑'
  return `${formatGameDay(g.completedAt)} · ${side} · 對 ${rungForSkillLevel(g.aiSkillLevel).name}`
})

/** Export/PGN-tag shape of the identified opening. Null unless BOTH name and ECO are known —
 *  a half-filled `Opening "…" ECO ""` tag pair is worse than omitting them (GDD §3 omission rule). */
const opening = computed<{ openingName: string; eco: string } | null>(() => {
  const o = openingResult.value
  if (!o || o.isUnknown || !o.name || !o.eco) return null
  return { openingName: o.name, eco: o.eco }
})

const ctx: MemoryContext = { review, game, moments, opening }
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
  review.init(g, ({ fen, targetDepth, movetimeMs, signal }) =>
    engine.analyze({ fen, targetDepth, movetimeMs, signal }),
  ).catch(() => { /* aborted / engine error — review stays partially usable */ })
})
onUnmounted(() => {
  review.abort()
  engine.dispose()
})
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-surface-base pb-[calc(1rem+env(safe-area-inset-bottom))]">
    <!-- fullBleed：這頁自畫頂列，全站 app bar 與底部 tab 都不在。背景與底部 safe-area 因此
         由這裡自己負責（App.vue 只在非 fullBleed 時補）。註解放在根 div 裡：放在外面 dev 會把
         它算成第二個根節點，多根元件離場時整頁空白。 -->
    <TaskTopRow title="棋憶" :subtitle="topSubtitle" @back="onHeaderBack">
      <!-- 帶走整盤棋譜。分析中先 invisible 佔住位置（不給半成品的可點物、頂列也不跳）；完成時
           換 key 重掛，匯出內容才讀得到最終的 moments（它在 setup 只讀一次）。 -->
      <template v-if="game" #action>
        <GameExportCard
          :key="`${game.completedAt}:${isComplete}`"
          :class="{ invisible: !isComplete }"
          tone="deep"
          :game="game"
          :moments="moments"
          :opening="opening"
        />
      </template>
    </TaskTopRow>

    <div class="mx-auto flex w-full max-w-md flex-col px-4 pt-3">
      <MemoryDashboard />
    </div>
  </div>
</template>
