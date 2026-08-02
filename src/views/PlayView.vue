<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import ChessBoard from '@/components/chess-board.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DarkPanel, NeveAvatar } from '@/components/ui/gambit'
import { COACH } from '@/types/lesson'
import type { MoveMadePayload } from '@/composables/use-chess-board'
import { useGameLifecycle } from '@/modules/game-lifecycle/use-game-lifecycle'
import { usePlayEngine } from '@/modules/chess-engine/play-engine'
import { useGameStore } from '@/stores/game-store'
import { useUiStore } from '@/stores/ui-store'
import { useResumeGameStore } from '@/stores/resume-game'
import { DIFFICULTY_LADDER, rungForSkillLevel, remainingThinkDelayMs } from '@/config/difficulty-tuning'

const router = useRouter()
const gameStore = useGameStore()
const uiStore = useUiStore()
const resumeStore = useResumeGameStore()

// NOTE: router is NOT passed to useGameLifecycle intentionally.
// onGameTerminal() disarms the navigation guard (setGameInProgress(false)) and writes
// completedGame, but does NOT auto-navigate — the GAME_OVER overlay gives the player
// the choice to review or start a new game (ADR-0005 §5).
const lifecycle = useGameLifecycle()
const { phase, playerColor, fen, terminal, moveHistory, lastMove } = lifecycle

// In-game move record — SAN grouped into numbered pairs (white, black) for display.
const movePairs = computed(() => {
  const pairs: { n: number; w: string; b?: string }[] = []
  for (let i = 0; i < moveHistory.value.length; i += 2) {
    pairs.push({ n: i / 2 + 1, w: moveHistory.value[i], b: moveHistory.value[i + 1] })
  }
  return pairs
})
const canUndo = computed(() => phase.value === 'PLAYER_TURN' && moveHistory.value.length >= 2)
const canResign = computed(() => phase.value === 'PLAYER_TURN' || phase.value === 'AI_THINKING')

// Undo / resign both confirm via a popup so a stray tap can't revert or forfeit.
const confirmAction = ref<'undo' | 'resign' | null>(null)
const confirmOverlay = ref<HTMLElement | null>(null)
const CONFIRM_COPY = {
  undo: { title: '確定要悔棋嗎？', body: '這會收回你和對手的上一步。', cta: '確定悔棋', danger: false },
  resign: { title: '確定要投降嗎？', body: '這盤棋會以投降結束，無法復原。', cta: '確定投降', danger: true },
} as const
// Move-record scroll container — auto-scrolled to the latest move.
const moveScroll = ref<HTMLElement | null>(null)

// Player-side identity row — real pawn piece icon (BASE_URL prefix avoids 404 on Pages subpath).
const pieceBase = import.meta.env.BASE_URL
const playerPawnSrc = computed(() => `${pieceBase}pieces/${playerColor.value === 'white' ? 'wP' : 'bP'}.svg`)
const sideLabel = computed(() => (playerColor.value === 'white' ? '你執白' : '你執黑'))

function runConfirm(): void {
  if (confirmAction.value === 'undo') lifecycle.undo()
  else if (confirmAction.value === 'resign') lifecycle.resign()
  confirmAction.value = null
}

// Focus the popup when it opens so Esc / keyboard works.
watch(confirmAction, async (v) => {
  if (v) {
    await nextTick()
    confirmOverlay.value?.focus()
  }
})

watch(
  () => moveHistory.value.length,
  async () => {
    await nextTick()
    if (moveScroll.value) moveScroll.value.scrollTop = moveScroll.value.scrollHeight
  },
)

const engine = usePlayEngine()

// Skill Level chosen for the current game — used for engine.play and win-recording.
// Stays a raw Skill Level (not a rung index) so saved resume snapshots, ui:highestBeatenLevel
// and game_sessions.ai_difficulty all keep working untouched; the ladder is resolved from it
// at request time via rungForSkillLevel.
const chosenLevel = ref(DIFFICULTY_LADDER[0].skillLevel)

// Board is playable only on the player's turn (disabled while AI thinks, game over, or no game).
const boardDisabled = computed(() => phase.value !== 'PLAYER_TURN')

/** Start a game from a confirmed setup payload (from the global modal via the ui store). */
function startFromPayload(payload: { color: 'white' | 'black'; level: number }): void {
  void resumeStore.clear() // a fresh game replaces any saved in-progress one (含「另開新對局」)
  chosenLevel.value = payload.level
  lifecycle.startGame(payload.color, payload.level)
  // Player chose black → engine moves first.
  if (lifecycle.phase.value === 'AI_THINKING') void requestAiMove()
}

/** Restore the saved in-progress game (from the home "繼續對局" card). Returns false if it failed. */
function resumeSavedGame(): boolean {
  const snap = resumeStore.current
  if (!snap || !lifecycle.restoreGame(snap)) return false
  chosenLevel.value = snap.level
  gameStore.setGameInProgress(true)
  if (lifecycle.phase.value === 'AI_THINKING') void requestAiMove()
  return true
}

// Persist after every move so a refresh / tab-close / crash can still resume. Threshold: at least one
// move played (an untouched board is not worth a "繼續對局" card). Skipped once the game is over.
watch(
  () => moveHistory.value.length,
  (len) => {
    if (len >= 1 && (phase.value === 'PLAYER_TURN' || phase.value === 'AI_THINKING')) {
      resumeStore.saveLocal(lifecycle.getResumeSnapshot())
    }
  },
)

// Game finished → it is no longer resumable; drop the saved snapshot (local + cloud).
watch(terminal, (t) => {
  if (t) void resumeStore.clear()
})

// Leaving the board → push the latest local snapshot to the cloud (best-effort; no-op logged out),
// then dispose the engine so its Stockfish Worker + visibilitychange listener don't leak per visit.
onBeforeUnmount(() => {
  if (resumeStore.hasResume) void resumeStore.syncToCloud()
  engine.dispose()
})

/** Consume a pending setup (set by the global modal) and start the game. */
function consumePending(): void {
  const g = uiStore.consumePendingGame()
  if (g) startFromPayload(g)
}

// Fires for new games requested while already on /play (e.g. 再來一局, or the 對局 nav tab).
watch(() => uiStore.pendingGame, (g) => { if (g) consumePending() })

// If the modal is dismissed with no game started, leave the empty board → back home.
// Guard on phase === 'SETUP'（本次 visit 從未開局）：直接進 /play 按「開始對局」時，
// pendingGame watch（上方，註冊較早）已同步 startGame 把 phase 推離 SETUP，這裡才不會把
// 「已開局」誤判成「取消」彈回首頁（isGameInProgress 要到玩家第一步才 true，靠它會誤判）。
watch(() => uiStore.showPlaySetup, (open) => {
  if (!open && !uiStore.pendingGame && phase.value === 'SETUP') {
    router.push('/')
  }
})

onMounted(async () => {
  // Resume intent (home "繼續對局") → restore the saved game; else a setup confirmation → start;
  // else open the setup modal. A failed restore falls back to setup so the player is never stuck.
  // Runs BEFORE awaiting engine.init() below — startGame/restoreGame only need the setup payload,
  // not the engine, so `phase` leaves SETUP (and the side panel's v-if flips) on the same tick the
  // board mounts. Previously this block ran after the engine handshake, so the panel popped in
  // with no transition well after the board — a jarring delayed flicker (2026-07-20 fix).
  if (uiStore.consumeResume()) {
    if (!resumeSavedGame()) uiStore.openPlaySetup()
  } else if (uiStore.pendingGame) consumePending()
  else if (!gameStore.isGameInProgress) uiStore.openPlaySetup()

  try {
    await engine.init()
  } catch {
    console.warn('Stockfish unavailable — playing without AI')
  }
  // requestAiMove() no-ops silently if called while the engine isn't IDLE yet (see its guard below) —
  // the calls above may have fired while the engine was still handshaking. Re-arm here now that
  // engine.init() has resolved, in case it's still the AI's turn (執黑 game, or a resumed AI-turn).
  if (phase.value === 'AI_THINKING') void requestAiMove()
})

/** Ask the engine for a move from the current position and apply it. */
async function requestAiMove(): Promise<void> {
  // Authoritative phase guard: only move when it is genuinely the AI's turn. Guards against a stale
  // call landing after the phase changed during the move animation window.
  if (phase.value !== 'AI_THINKING') return
  // Engine dead (e.g. init/handshake failed) but we owe a move → concede so the board never
  // dead-locks in AI_THINKING with no playable side. Mirrors the catch-block fallback below.
  if (engine.state.value === 'CRASHED') {
    lifecycle.handleAiMove('0000')
    return
  }
  if (engine.state.value !== 'IDLE') return // busy/handshaking — a play is already in flight
  try {
    // Resolve the ladder rung here rather than storing one: a snapshot saved before the ladder
    // existed holds an arbitrary 0–20 Skill Level, and this maps it onto the nearest rung.
    const rung = rungForSkillLevel(chosenLevel.value)
    const startedAt = Date.now()
    const engineResult = await engine.play({
      fen: fen.value,
      skillLevel: rung.skillLevel,
      depth: rung.depth,
      movetimeMs: rung.movetimeMs,
      fallible: rung.fallible,
    })
    if (!engineResult.bestMove || engineResult.bestMove === '(none)' || engineResult.bestMove === '0000') {
      lifecycle.handleAiMove('0000')
      return
    }
    // Hold the move back to a human-looking pace. A wide search still finishes well inside the
    // floor, so without this the opponent answers near-instantly — it reads as blitz and pressures
    // the player into rushing.
    const pause = remainingThinkDelayMs(Date.now() - startedAt)
    if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause))
    // The board can have moved on while we waited (resign, new game, navigation) — drop a stale move.
    if (phase.value !== 'AI_THINKING') return
    lifecycle.handleAiMove(engineResult.bestMove)
  } catch {
    // Engine error — treat as AI resignation so the board doesn't stay permanently disabled
    lifecycle.handleAiMove('0000')
  }
}

async function handleMoveMade(payload: MoveMadePayload): Promise<void> {
  gameStore.setGameInProgress(true)
  const result = lifecycle.handlePlayerMove(payload.from, payload.to, payload.promotion)
  if (result === false) return   // illegal or wrong phase
  if (result !== null) return    // terminal — overlay shows via phase reactivity

  // Non-terminal: wait for piece animation, then get AI move
  await payload.animationDoneAt
  void requestAiMove()
}

function handleNewGame(): void {
  lifecycle.resetToSetup()
  gameStore.clearCompletedGame()
  confirmAction.value = null
  uiStore.openPlaySetup()   // re-open the global setup modal (over /play)
}

function handleReview(): void {
  // isGameInProgress is already false (onGameTerminal set it before showing the overlay)
  // completedGame is already set (onGameTerminal set it)
  router.push('/review')
}

function goHome(): void {
  router.push('/')
}

// ---- Result display helpers ----

const playerWon = computed(() => {
  const r = terminal.value?.result
  if (!r || r === '1/2-1/2') return false
  return (r === '1-0' && playerColor.value === 'white') || (r === '0-1' && playerColor.value === 'black')
})

const isDraw = computed(() => terminal.value?.result === '1/2-1/2')

const resultLabel = computed(() => {
  if (!terminal.value) return ''
  return isDraw.value ? '和局' : playerWon.value ? '你贏了！' : '你輸了'
})

// 完局一句話講評（Gambit 平靜語氣，稱呼你；不長）。依結果＋結束原因給不同句子。
const outcomeBlurb = computed(() => {
  const reason = terminal.value?.endReason
  if (isDraw.value) return '勢均力敵的一盤，各有所守。'
  if (playerWon.value) {
    if (reason === 'checkmate') return '將殺成立了。'
    if (reason === 'resignation') return '對手投降了，這盤你掌握得很好。'
    return '穩穩拿下這一盤。'
  }
  // 落敗三句不再指向「再來一盤」——主按鈕已改成賽後檢討，文案催下一局會跟版面打架。
  if (reason === 'checkmate') return '被將死了。我們回去看看它是從哪裡開始的。'
  if (reason === 'resignation') return '這盤先投降了。輸贏都是練習的一部分。'
  return '這盤輸了。'
})

// Record a win at the chosen Skill Level so the setup modal can nudge to the next rung.
watch(terminal, (t) => {
  if (t && playerWon.value) uiStore.recordWin(chosenLevel.value)
})

// ---- DEV: FEN injection tool (hidden by default; toggle with Ctrl+Shift+F in dev) ----

const isDev = import.meta.env.DEV
const devToolsOpen = ref(false)
const devFenInput = ref('')

function injectFen(): void {
  const trimmed = devFenInput.value.trim()
  if (!trimmed) return
  lifecycle.setDevFen(trimmed)
  // If the injected FEN is the AI's turn, kick off its move (setDevFen only sets the phase).
  if (phase.value === 'AI_THINKING') void requestAiMove()
}

function handleDevToggle(e: KeyboardEvent): void {
  if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
    e.preventDefault()
    devToolsOpen.value = !devToolsOpen.value
  }
}

if (isDev) {
  onMounted(() => window.addEventListener('keydown', handleDevToggle))
  onBeforeUnmount(() => window.removeEventListener('keydown', handleDevToggle))
}
</script>

<template>
  <div class="flex min-h-full flex-col items-center overflow-x-hidden bg-surface-deep p-4">
    <h1 class="sr-only" tabindex="-1">對局</h1>

    <!-- Desktop: board + panel as a centred two-column group; board scales with viewport height,
         panel stays adjacent to its right (no floating gap). Stacked + centred on mobile. -->
    <div
      class="flex w-full flex-col items-center gap-4 md:flex-row md:items-start md:justify-center md:gap-6"
    >
      <!-- framed board (wooden tray) + GAME_OVER overlay; scales by viewport height, capped so the
           adjacent panel still fits (no overlap / overflow). -->
      <div
        class="relative w-full shrink-0 max-w-[min(92vw,28rem)] rounded-[12px] bg-[linear-gradient(160deg,#6f4b30,#523722)] p-3 ring-1 ring-black/30 shadow-[0_12px_32px_rgba(10,30,24,0.45),inset_0_1px_0_rgba(255,228,194,0.20),inset_0_-2px_6px_rgba(0,0,0,0.38)] md:w-[min(74vh,calc(100vw-26rem),56rem)] md:max-w-none"
      >
        <ChessBoard
          :fen="fen"
          :playerColor="playerColor"
          :disabled="boardDisabled"
          :coordinates="true"
          :last-move="lastMove"
          @move-made="handleMoveMade"
        />
      </div>

      <!-- Right column: info panel (結果／對手 + 棋譜 + 悔棋/投降), below the board on mobile,
           adjacent on desktop. Shown during play AND game-over (完局結果 inline，不蓋棋盤彈窗). -->
      <div
        v-if="phase !== 'SETUP'"
        class="w-full max-w-[min(92vw,28rem)] md:w-[20rem] md:max-w-none"
      >
        <DarkPanel>
          <!-- 側板文字統一 Cubic 11（font-num），與 eval 一致 -->
          <div class="font-num">
          <!-- 完局結果（inline，取代蓋棋盤彈窗）：結果 + 原因 + 再來一局／複盤 -->
          <div
            v-if="phase === 'GAME_OVER'"
            class="mb-3 rounded-[10px] border border-white/10 bg-white/5 p-3.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <p class="font-display text-xl font-bold" :class="playerWon ? 'text-gold' : 'text-ink-on-deep'">{{ resultLabel }}</p>
            <!-- 講評歸屬給 Neve（頭像＋署名＋font-lesson＝persona-neve「視覺嗓音」），
                 否則這句會被讀成系統訊息而不是教練在跟你說話。 -->
            <div class="mt-3 flex items-center justify-center gap-2">
              <NeveAvatar size="md" surface="deep" />
              <span class="font-num text-[11px] tracking-[0.08em] text-ink-on-deep-dim">{{ COACH.name.toUpperCase() }}</span>
            </div>
            <p class="mt-1.5 font-lesson text-[15px] leading-[1.9] text-ink-on-deep">{{ outcomeBlurb }}</p>
            <!-- 主按鈕＝賽後檢討：完局那幾秒是學習遷移最可能發生的時刻，版面權重跟著走。
                 深青底上 secondary（米白實心）才是最高對比，jade 的 default 反而糊在底色裡。 -->
            <Button variant="secondary" size="sm" class="mt-3.5 w-full" @click="handleReview">我陪你看看剛剛那一步</Button>
            <button
              type="button"
              class="mt-2 min-h-[44px] w-full rounded-btn border border-white/10 bg-white/6 text-sm font-semibold text-ink-on-deep transition-colors hover:bg-white/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
              @click="handleNewGame"
            >再來一局</button>
            <button
              type="button"
              class="mt-2 min-h-[44px] px-2 font-sans text-xs text-ink-on-deep-dim underline-offset-2 transition-colors hover:text-ink-on-deep hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
              @click="goHome"
            >返回首頁</button>
          </div>

          <!-- 密度列：回合狀態 ｜ 身分（執子 + 對手等級）合併成一條，省垂直空間，手機一屏可見。
               輪到你以金色 indicator 強調（Gambit 金＝focus/reward）；AI 思考時左段換成呼吸點。 -->
          <div
            v-if="phase !== 'GAME_OVER'"
            class="mb-3 flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-[14px] tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <template v-if="phase === 'PLAYER_TURN'">
              <span
                class="turn-dot h-2.5 w-2.5 shrink-0 rounded-full bg-gold shadow-[0_0_8px_rgba(248,181,0,0.85)]"
                aria-hidden="true"
              />
              <span class="id-text shrink-0 font-bold text-ink-on-deep">輪到你</span>
            </template>
            <template v-else>
              <span class="id-text ai-breathe shrink-0 text-ink-on-deep-dim">思考中</span>
              <span class="thinking-dots shrink-0 tracking-[2px] text-ink-on-deep-dim" aria-hidden="true">●●●</span>
            </template>

            <span class="mx-0.5 h-3.5 w-px shrink-0 bg-white/15" aria-hidden="true" />

            <span
              class="inline-block h-5 w-5 shrink-0 bg-contain bg-center bg-no-repeat"
              :style="{
                backgroundImage: `url(${playerPawnSrc})`,
                ...(playerColor === 'black' ? { filter: 'brightness(var(--piece-dark-brightness))' } : {}),
              }"
              aria-hidden="true"
            />
            <span class="id-text shrink-0 font-bold text-ink-on-deep">{{ sideLabel }}</span>
            <span class="id-text min-w-0 shrink-0 truncate text-ink-on-deep-dim">· Lv.{{ chosenLevel }}</span>
          </div>

          <!-- 棋譜表：標題列收進框內（代碼區塊感）；下方序號 | 白 | 黑。
               面板貼合內容高度；棋譜捲動區加上限（手機 9rem、桌機 12rem），超出內捲、不撐大側板。 -->
          <div class="rounded-lg border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p class="border-b border-white/10 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-on-deep-dim">棋譜</p>
            <div
              ref="moveScroll"
              class="max-h-36 overflow-y-auto p-2.5 font-num text-[14px] leading-relaxed tabular-nums text-ink-on-deep md:max-h-48"
            >
              <p v-if="!movePairs.length" class="text-ink-on-deep-dim">尚無棋步</p>
              <div
                v-for="p in movePairs"
                :key="p.n"
                class="grid grid-cols-[2.5rem_1fr_1fr] gap-1 px-1 py-0.5"
              >
                <span class="text-ink-on-deep-dim">{{ p.n }}.</span>
                <span>{{ p.w }}</span>
                <span>{{ p.b }}</span>
              </div>
            </div>
          </div>

          <!-- 控制：悔棋（中性）/ 投降（紅色 destructive）；兩者皆彈窗二次確認，防誤觸。完局後隱藏。 -->
          <div v-if="phase !== 'GAME_OVER'" class="mt-3 flex gap-2">
            <button
              type="button"
              class="min-h-[44px] flex-1 rounded-btn border border-white/10 bg-white/6 text-sm font-semibold text-ink-on-deep transition-colors hover:bg-white/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold disabled:pointer-events-none disabled:opacity-40"
              :disabled="!canUndo"
              @click="confirmAction = 'undo'"
            >悔棋</button>
            <button
              type="button"
              class="min-h-[44px] flex-1 rounded-btn border border-danger/50 bg-danger/15 text-sm font-semibold text-[#EC9C84] transition-colors hover:bg-danger/25 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold disabled:pointer-events-none disabled:opacity-40"
              :disabled="!canResign"
              @click="confirmAction = 'resign'"
            >投降</button>
          </div>
          </div>
        </DarkPanel>
      </div>
    </div>

    <!-- 悔棋 / 投降 確認彈窗（置中、全螢幕 dim；Esc 或點背景可取消） -->
    <div
      v-if="confirmAction"
      ref="confirmOverlay"
      class="game-over-overlay fixed inset-0 z-60 flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      @keydown.esc="confirmAction = null"
      @click.self="confirmAction = null"
    >
      <!-- 深色卡，與課程完成卡同一全站 modal 語彙（對局畫面是深色，cream 卡會跳） -->
      <div class="go-card game-over-panel w-full max-w-[320px] rounded-[20px] border border-white/[0.14] p-6 text-center shadow-[0_16px_40px_rgba(8,24,18,0.5)]">
        <p class="mb-1.5 font-display text-lg font-bold text-ink-on-deep">{{ CONFIRM_COPY[confirmAction].title }}</p>
        <p class="mb-5 font-sans text-sm text-ink-on-deep-dim">{{ CONFIRM_COPY[confirmAction].body }}</p>
        <div class="flex justify-center gap-3">
          <Button variant="secondary" class="flex-1" @click="confirmAction = null">取消</Button>
          <Button
            :variant="CONFIRM_COPY[confirmAction].danger ? 'danger' : 'default'"
            class="flex-1"
            @click="runConfirm"
          >{{ CONFIRM_COPY[confirmAction].cta }}</Button>
        </div>
      </div>
    </div>

    <!-- DEV ONLY: FEN injection tool — hidden by default, toggle with Ctrl+Shift+F -->
    <div
      v-if="isDev && devToolsOpen"
      class="mt-4 flex w-full max-w-[min(92vw,28rem)] flex-wrap items-center gap-2 rounded border border-yellow-400 bg-yellow-100 p-3 text-sm"
    >
      <span class="font-mono font-bold text-yellow-800">DEV</span>
      <Input
        v-model="devFenInput"
        class="min-h-0 w-full min-w-0 flex-1 border-yellow-400 bg-white py-1 font-mono text-xs"
        placeholder="Paste FEN to inject board position…"
        @keyup.enter="injectFen"
      />
      <Button
        size="sm"
        class="bg-yellow-400 text-yellow-900 shadow-none hover:bg-yellow-500"
        @click="injectFen"
      >
        Set FEN
      </Button>
    </div>
  </div>
</template>

<style scoped>
@keyframes thinking-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}
.thinking-dots {
  animation: thinking-pulse 1.2s ease-in-out infinite;
}

@keyframes turn-dot-breathe {
  0%, 100% { opacity: 0.6; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
}
.turn-dot {
  animation: turn-dot-breathe 2s ease-in-out infinite;
}

@keyframes ai-breathe {
  0%, 100% { opacity: 0.72; }
  50% { opacity: 1; }
}
.ai-breathe {
  animation: ai-breathe 2s ease-in-out infinite;
}

/* vue3-chessboard 預設用 70vh（視窗高）決定棋盤大小、無視容器寬，在固定寬的木框內會橫向溢出
   蓋住側板。覆寫成填滿木框寬、用 aspect-ratio 維持正方，讓棋盤跟著木框寬度走。 */
:deep(.main-wrap),
:deep(.main-board) {
  width: 100% !important;
  height: auto !important;
  max-width: none !important;
}
:deep(.cg-wrap) {
  width: 100% !important;
  height: auto !important;
  aspect-ratio: 1 / 1;
}

/* Cubic 11 像素字 glyph 在字框內偏上，與棋子圖示並排時看起來偏高；微幅下推對齊棋子視覺中心。 */
.id-text {
  transform: translateY(1.5px);
}

@keyframes game-over-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.game-over-overlay {
  animation: game-over-in 200ms ease-out;
}
@keyframes go-card-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.go-card {
  animation: go-card-in 220ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .thinking-dots,
  .turn-dot,
  .ai-breathe,
  .game-over-overlay,
  .go-card {
    animation: none;
  }
}
</style>
