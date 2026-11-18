<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import ChessBoard from '@/components/chess-board.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TaskTopRow, WoodFrame, NeveNameTag } from '@/components/ui/gambit'
import ScoreSheet from '@/components/play/score-sheet.vue'
import ResultSeal from '@/components/play/result-seal.vue'
import type { MoveMadePayload } from '@/composables/use-chess-board'
import { useGameLifecycle } from '@/modules/game-lifecycle/use-game-lifecycle'
import { gameOverDisplay } from '@/modules/game-lifecycle/game-over-display'
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

const moveCount = computed(() => Math.ceil(moveHistory.value.length / 2))
const canUndo = computed(() => phase.value === 'PLAYER_TURN' && moveHistory.value.length >= 2)
const canResign = computed(() => phase.value === 'PLAYER_TURN' || phase.value === 'AI_THINKING')

// Undo / resign both confirm via a popup so a stray tap can't revert or forfeit.
const confirmAction = ref<'undo' | 'resign' | null>(null)
const confirmOverlay = ref<HTMLElement | null>(null)
const CONFIRM_COPY = {
  undo: { title: '確定要悔棋嗎？', body: '這會收回你和對手的上一步。', cta: '確定悔棋', danger: false },
  resign: { title: '確定要投降嗎？', body: '這盤棋會以投降結束，無法復原。', cta: '確定投降', danger: true },
} as const
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

const engine = usePlayEngine()

// Skill Level chosen for the current game — used for engine.play and win-recording.
// Stays a raw Skill Level (not a rung index) so saved resume snapshots, ui:highestBeatenLevel
// and game_sessions.ai_difficulty all keep working untouched; the ladder is resolved from it
// at request time via rungForSkillLevel.
const chosenLevel = ref(DIFFICULTY_LADDER[0].skillLevel)

// 頂列：開局前只寫「對局」；開局後寫對手是哪一階，副標講你執哪一色（不再顯示 Lv.N）。
const topTitle = computed(() =>
  phase.value === 'SETUP' ? '對局' : `對 ${rungForSkillLevel(chosenLevel.value).name}`,
)
const topSubtitle = computed(() => (phase.value === 'SETUP' ? undefined : sideLabel.value))

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
    const requestedFen = fen.value
    const engineResult = await engine.play({
      fen: requestedFen,
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
    // Phase alone is not enough. A liveness respawn (TR-chess-engine-009) settles this promise with
    // a move computed for the checkpoint FEN, which is the position at the *start* of the terminated
    // search. If the player resigned and started a new game inside the respawn window, phase is
    // AI_THINKING again but the board is a different one — applying that move plays something the
    // engine never analysed, or silently concedes the new game when it is illegal there.
    if (fen.value !== requestedFen) {
      // Re-ask for the live position. The engine is IDLE again by now, so this is the call that
      // actually produces the new game's move — returning without it would deadlock AI_THINKING.
      void requestAiMove()
      return
    }
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

// 返回一律 replace('/')：堆疊變成 [/, /]，瀏覽器上一頁不會再回到已離開的對局，也不依賴
// iOS standalone 空堆疊時靜默失效的 history.back()（同 MemoryView.onHeaderBack）。
// 對局中離開不跳確認——onBeforeUnmount 照原流程把續玩快照推上雲端。
function goBack(): void {
  void router.replace('/')
}

// ---- Result display helpers ----

const playerWon = computed(() => {
  const r = terminal.value?.result
  if (!r || r === '1/2-1/2') return false
  return (r === '1-0' && playerColor.value === 'white') || (r === '0-1' && playerColor.value === 'black')
})

const isDraw = computed(() => terminal.value?.result === '1/2-1/2')

// 完局紙的標題／副標／印（純函式算，元件只負責排版）。
const overDisplay = computed(() =>
  terminal.value ? gameOverDisplay(terminal.value, playerColor.value, moveHistory.value.length) : null,
)

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

const blurbParts = computed(() => outcomeBlurb.value.split(/(?<=。)/))

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
  <div class="flex min-h-dvh flex-col bg-surface-deep pb-[env(safe-area-inset-bottom)]">
    <!-- 任務頁：全屏（router meta.fullBleed）、自畫返回，不顯示底部導覽。
         手機：頂列 → 木盤 → 記譜紙（填滿剩下的高度）；桌機（≥md）：左盤右紙，紙與盤等高。
         這段註解要留在根元素裡面：放在 template 根層會讓元件變成多根節點，離開頁面時 out-in 換頁卡住、整頁空白。 -->
    <TaskTopRow :title="topTitle" :subtitle="topSubtitle" @back="goBack" />

    <div class="flex flex-1 flex-col md:m-auto md:flex-none md:flex-row md:gap-6 md:p-6">
      <!-- 棋盤寬度只用寬度公式設上限：手機另扣掉「頂列＋紙的最小高度」(19.125rem)，矮螢幕盤跟著縮，
           但不小於 15rem——再矮就讓整頁捲動。≥sm 的下限是 23.5rem，因為 chess-board.vue 在 sm 以上
           自帶 min-w 352px（加木框內距 24px），橫放手機走這條。不用 max-w 依高度硬縮（technical-preferences 棋盤護欄）。 -->
      <div
        class="mx-auto w-[max(15rem,min(100vw_-_2rem,28rem,100dvh_-_19.125rem))] shrink-0 sm:w-[max(23.5rem,min(100vw_-_2rem,28rem,100dvh_-_19.125rem))] md:mx-0 md:w-[min(74vh,100vw_-_26rem,56rem)]"
      >
        <WoodFrame surface="deep">
          <ChessBoard
            :fen="fen"
            :playerColor="playerColor"
            :disabled="boardDisabled"
            :coordinates="true"
            :last-move="lastMove"
            @move-made="handleMoveMade"
          />
        </WoodFrame>
      </div>

      <!-- 記譜紙（開局後才出現）。手機：最小高度＝紙頭＋三列棋譜＋按鈕列，放不下就整頁捲動，紙不被壓扁。
           桌機：紙絕對定位在這一欄裡，欄高跟著棋盤，紙就與盤等高、棋譜在紙內捲動。 -->
      <div
        v-if="phase !== 'SETUP'"
        class="relative flex min-h-[15.625rem] flex-1 basis-0 flex-col px-4 py-3 md:min-h-0 md:w-80 md:flex-none md:self-stretch md:p-0 [@media(max-height:720px)]:pb-2"
      >
        <!-- 對局中 -->
        <section
          v-if="phase !== 'GAME_OVER'"
          class="relative flex min-h-0 flex-1 flex-col rounded-btn bg-surface-card px-4 py-3.5 font-sans text-ink shadow-paper md:absolute md:inset-0"
          aria-label="記譜紙"
          data-testid="score-paper"
        >
          <div class="pointer-events-none absolute inset-1 rounded-sm border border-line" aria-hidden="true" />
          <div class="mb-2 flex h-6 shrink-0 items-center justify-between">
            <h2 class="text-label font-bold tracking-[0.06em] text-ink-muted">
              棋譜<span v-if="moveCount > 0" class="ml-1.5 font-num text-xs font-normal tracking-[0.02em]">{{ moveCount }} 回合</span>
            </h2>
            <!-- 固定寬的狀態槽：輪到你／思考中切換時紙頭不跳。循環動畫維持原樣，等 Eason 看完
                 motion-compare.html 再決定（wave-1a 步驟 3b）。 -->
            <div class="flex w-24 shrink-0 items-center justify-end gap-2 text-base leading-none" aria-live="polite" data-testid="turn-status">
              <template v-if="phase === 'PLAYER_TURN'">
                <span class="turn-dot size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span class="font-bold">輪到你</span>
              </template>
              <template v-else>
                <span class="ai-breathe text-ink-muted">思考中</span>
                <span class="thinking-dots text-xs tracking-[2px] text-ink-muted" aria-hidden="true">●●●</span>
              </template>
            </div>
          </div>

          <ScoreSheet :moves="moveHistory" :min-rows="16" class="min-h-[6.875rem] flex-1" />

          <!-- 悔棋 / 投降：兩者皆彈窗二次確認，防誤觸。 -->
          <div class="mt-auto grid shrink-0 grid-cols-2 gap-2.5 pt-3">
            <Button
              variant="secondary"
              size="sm"
              class="border-line-strong text-base font-bold"
              :disabled="!canUndo"
              @click="confirmAction = 'undo'"
            >悔棋</Button>
            <Button
              variant="secondary"
              size="sm"
              class="border-danger-dark/45 text-base font-bold text-danger-dark"
              :disabled="!canResign"
              @click="confirmAction = 'resign'"
            >投降</Button>
          </div>
        </section>

        <!-- 完局：同一張紙換內容，右上角蓋印。標題永遠墨色——金只當印的外環（indicator）。
             可視高 ≤720 時收起棋譜列、印縮成 72px，讓兩顆按鈕留在摺線內。 -->
        <section
          v-else-if="overDisplay"
          class="relative flex min-h-0 flex-1 flex-col rounded-btn bg-surface-card px-4 py-3.5 font-sans text-ink shadow-paper animate-paper-in motion-reduce:animate-none md:absolute md:inset-0 [@media(max-height:720px)]:pb-2.5"
          aria-labelledby="game-over-title"
          data-testid="game-over-paper"
        >
          <div class="pointer-events-none absolute inset-1 rounded-sm border border-line" aria-hidden="true" />
          <div class="relative h-24 shrink-0 pt-2.5 [@media(max-height:720px)]:h-[4.625rem] [@media(max-height:720px)]:pt-1">
            <h2 id="game-over-title" class="font-display text-[1.75rem] leading-9 font-bold tracking-[0.06em] text-ink">{{ overDisplay.title }}</h2>
            <span class="mt-1 block text-label tracking-[0.02em] text-ink-muted">{{ overDisplay.subtitle }}</span>
            <ResultSeal
              :outcome="overDisplay.outcome"
              :player-color="playerColor"
              class="absolute -top-0.5 -right-1 size-24 [transform:rotate(-5deg)] animate-seal-in motion-reduce:animate-none [@media(max-height:720px)]:-top-1 [@media(max-height:720px)]:right-0 [@media(max-height:720px)]:size-18"
            />
          </div>
          <!-- 講評歸屬給 Neve（名牌＋文楷＝persona-neve「視覺嗓音」），否則會被讀成系統訊息。 -->
          <div class="mt-1.5 shrink-0 border-t border-line pt-2.5 [@media(max-height:720px)]:mt-1 [@media(max-height:720px)]:pt-1.5">
            <NeveNameTag size="md">
              <!-- 一句一段 inline-block：窄螢幕換行落在句號後，不會把「一部／分。」拆開 -->
              <p class="font-lesson text-base leading-normal text-ink">
                <span v-for="(part, i) in blurbParts" :key="i" class="inline-block">{{ part }}</span>
              </p>
            </NeveNameTag>
          </div>
          <ScoreSheet :moves="moveHistory" :max-rows="4" :min-rows="16" class="mt-3 min-h-0 flex-1 [@media(max-height:720px)]:hidden" />
          <!-- 主按鈕＝賽後檢討：完局那幾秒是學習遷移最可能發生的時刻，版面權重跟著走。 -->
          <div class="mt-auto grid shrink-0 grid-cols-[2fr_1fr] gap-2.5 pt-3 [@media(max-height:720px)]:pt-2">
            <Button class="px-3 text-base font-bold" @click="handleReview">我陪你看看剛剛那一步</Button>
            <Button variant="secondary" class="border-line-strong px-3 text-base font-bold" @click="handleNewGame">再下一盤</Button>
          </div>
        </section>
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

    <!-- DEV ONLY: FEN injection tool — hidden by default, toggle with Ctrl+Shift+F. 浮在底部，不擠版面。 -->
    <div
      v-if="isDev && devToolsOpen"
      class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-wrap items-center gap-2 rounded border border-yellow-400 bg-yellow-100 p-3 text-sm"
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
/* 三組無限循環（輪到你的點、思考中呼吸、思考點）是 decisions.md 列出的超時動效，暫時原樣保留；
   要不要換成 150–300ms 單次版本見 design/demos/visual-redesign-2026-11/motion-compare.html。 */
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
