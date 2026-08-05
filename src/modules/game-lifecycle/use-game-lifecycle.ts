/**
 * Game Lifecycle composable.
 * ADR-0005 §3: chess.js lives as a non-reactive const inside this composable.
 * ADR-0005 §6: terminal detection runs in the fixed 5-priority order after every move.
 * TR-game-lifecycle-001: chess.js is sole authoritative state — board is renderer only.
 * TR-game-lifecycle-002: 5-priority terminal detection (checkmate → 50-move, priority order).
 * TR-game-lifecycle-003: CompletedGame written to Pinia gameStore as canonical transport.
 * TR-game-lifecycle-004: isGameInProgress set false BEFORE router.push('/review').
 * TR-game-lifecycle-005: playerMoveTimes[] indexed against player moves only.
 */
import { ref, readonly } from 'vue'
import { Chess } from 'chess.js'
import { useGameStore } from '../../stores/game-store'
import type { CompletedGame } from '../../stores/game-store'
import { useDataSyncStore } from '../../stores/data-sync'
import type { ResumePayload } from '../../types/resume'

// ---- Types ----

export type GamePhase = 'SETUP' | 'PLAYER_TURN' | 'AI_THINKING' | 'GAME_OVER'

export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'threefold'
  | 'insufficient-material'
  | 'fifty-move'
  | 'resignation'

export type GameResult = '1-0' | '0-1' | '1/2-1/2'

export interface TerminalState {
  readonly endReason: EndReason
  readonly result: GameResult
}

/** Minimal router interface — only push() is needed here. Injectable for unit testing. */
export interface MinimalRouter {
  push(path: string): Promise<unknown>
}

/** Minimal store interface — injectable for unit testing. */
export interface GameLifecycleStore {
  setCompletedGame(game: CompletedGame): void
  setGameInProgress(value: boolean): void
}

/** Injectable deps for unit testing. If omitted, production defaults are used. */
export interface GameLifecycleDeps {
  store?: GameLifecycleStore
  router?: MinimalRouter
}

// ---- Pure terminal detection (exported for unit testing) ----

/**
 * Evaluates terminal conditions in the 5-priority order from ADR-0005 §6.
 * Priority order is fixed — never reorder. See EC-14 for the isDraw() fallthrough assumption.
 * Returns TerminalState if the position is terminal, null otherwise.
 */
export function detectTerminal(chess: Chess): TerminalState | null {
  if (chess.isCheckmate()) {
    // chess.turn() is the side that has no legal moves (checkmated side)
    const losingTurn = chess.turn()
    return {
      endReason: 'checkmate',
      result: losingTurn === 'b' ? '1-0' : '0-1',
    }
  }
  if (chess.isStalemate()) return { endReason: 'stalemate', result: '1/2-1/2' }
  if (chess.isThreefoldRepetition()) return { endReason: 'threefold', result: '1/2-1/2' }
  if (chess.isInsufficientMaterial()) return { endReason: 'insufficient-material', result: '1/2-1/2' }
  // Priority 5 fallthrough — valid only because priorities 2–4 handle all other chess.js draw types.
  // If chess.js adds a new draw condition, this label will be wrong. Re-verify on chess.js upgrade.
  if (chess.isDraw()) return { endReason: 'fifty-move', result: '1/2-1/2' }
  return null
}

// ---- Composable ----

/**
 * Game Lifecycle state machine.
 * chess.js instance is a plain, non-reactive const — NEVER wrap in ref/reactive/Pinia (ADR-0005 §3).
 * Phase transitions drive ChessBoard props (fen, disabled) and PlayEngine calls.
 *
 * @param deps - Optional injectable deps (store, router) for unit testing.
 */
export function useGameLifecycle(deps?: GameLifecycleDeps) {
  // ADR-0005 §3: non-reactive chess.js. Re-assigned on startGame() / resetToSetup().
  let chess = new Chess()

  const phase = ref<GamePhase>('SETUP')
  const playerColor = ref<'white' | 'black'>('white')
  const aiSkillLevel = ref<number>(10)
  const fen = ref<string>(chess.fen())
  const terminal = ref<TerminalState | null>(null)
  // Reactive SAN history for the in-game move record (城堡=O-O etc.). Mirrors _moves but in SAN.
  const moveHistory = ref<string[]>([])
  // Last move squares [from, to] for the board's last-move highlight. The board tracks the player's
  // own drag natively, but the opponent's move arrives via setPosition(fen) which does NOT update the
  // highlight — so we drive it explicitly here (對手走子後綠標停在自己上一步的修正).
  const lastMove = ref<[string, string] | null>(null)

  // ADR-0005 §7: internal move history (UCI strings) — cloned into CompletedGame on terminal.
  let _moves: string[] = []
  // ADR-0005 §7: player thinking times — indexed against player moves only (not global ply).
  let _playerMoveTimes: number[] = []
  // Timer for Formula 2: turnStartedAt = performance.now() when PLAYER_TURN is entered.
  let _turnStartedAt: number = 0

  // ---- Dependency resolution ----
  // In production: pass { store: useGameStore(), router: useRouter() } from the calling component.
  // In unit tests: pass mock implementations.

  const _store: GameLifecycleStore = deps?.store ?? useGameStore()
  const _router: MinimalRouter | null = deps?.router ?? null

  // ---- Helpers ----

  function enterPlayerTurn(): void {
    phase.value = 'PLAYER_TURN'
    _turnStartedAt = Date.now()
  }

  /**
   * Assemble CompletedGame from current game state.
   * ADR-0005 §4: moves[] is a cloned snapshot, not a reference to the live internal array.
   */
  function assembleCompletedGame(t: TerminalState): CompletedGame {
    return {
      moves: Object.freeze([..._moves]) as readonly string[],
      playerColor: playerColor.value,
      result: t.result,
      endReason: t.endReason,
      completedAt: Date.now(),
      aiSkillLevel: aiSkillLevel.value,
      playerMoveTimes: Object.freeze([..._playerMoveTimes]) as readonly number[],
      isTerminal: true,
    }
  }

  /**
   * Disarm-before-navigate sequence (ADR-0005 §5).
   * Order is mandatory: setCompletedGame → setGameInProgress(false) → router.push('/review')
   * No sync gap between the first two calls.
   */
  async function onGameTerminal(t: TerminalState): Promise<void> {
    const game = assembleCompletedGame(t)
    _store.setCompletedGame(game)        // 1. write completed game to store
    _store.setGameInProgress(false)      // 2. disarm navigation guard (no await between 1 and 2)
    // 3. sync（fire-and-forget，不擋導航）
    void useDataSyncStore().syncGame(game)
    if (_router) await _router.push('/review') // 4. navigate
  }

  // ---- Actions ----

  /**
   * Initialise a new game. Transitions SETUP → PLAYER_TURN (white) or AI_THINKING (black).
   * Idempotent guard: no-op if not in SETUP (EC-05: rapid double-click on "Start Game").
   */
  function startGame(color: 'white' | 'black', skillLevel: number): void {
    if (phase.value !== 'SETUP') return
    chess = new Chess()
    playerColor.value = color
    aiSkillLevel.value = skillLevel
    fen.value = chess.fen()
    terminal.value = null
    _moves = []
    _playerMoveTimes = []
    moveHistory.value = []
    lastMove.value = null
    if (color === 'white') {
      enterPlayerTurn()
    } else {
      phase.value = 'AI_THINKING'
    }
  }

  /**
   * Apply a player move, record thinking time, run terminal detection, advance phase.
   * Returns TerminalState if game ended, null if non-terminal, false if illegal or wrong phase.
   * EC-01: ignored (returns false) when phase !== 'PLAYER_TURN'.
   */
  function handlePlayerMove(from: string, to: string, promotion?: string): TerminalState | null | false {
    if (phase.value !== 'PLAYER_TURN') return false
    let move: ReturnType<typeof chess.move> | null = null
    try {
      move = chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined })
    } catch {
      // chess.js throws on illegal moves — treat as rejected (AC-5)
    }
    if (!move) return false // AC-5: illegal move rejected; state unchanged

    // Record player thinking time (Formula 2) and the UCI move string
    _playerMoveTimes.push(Date.now() - _turnStartedAt)
    _moves.push(from + to + (promotion ?? ''))
    moveHistory.value.push(move.san)
    lastMove.value = [from, to]

    fen.value = chess.fen()
    const t = detectTerminal(chess)
    if (t) {
      terminal.value = t
      phase.value = 'GAME_OVER'
      void onGameTerminal(t) // fire-and-forget; callers observe phase/terminal reactively
      return t
    }
    phase.value = 'AI_THINKING'
    return null
  }

  /**
   * Apply an AI move (UCI long-algebraic, e.g. "e7e5", "e7e8q").
   * bestMove "0000" or "(none)": treated as AI resignation (EC-08).
   * Illegal UCI string: treated as AI resignation (EC-07).
   * Returns TerminalState if game ended, null if non-terminal, false if wrong phase.
   */
  function handleAiMove(bestMove: string): TerminalState | null | false {
    if (phase.value !== 'AI_THINKING') return false

    // EC-08: bestmove 0000 / (none) → AI resigns
    if (bestMove === '0000' || bestMove === '(none)') {
      const result: GameResult = playerColor.value === 'white' ? '1-0' : '0-1'
      const t: TerminalState = { endReason: 'resignation', result }
      terminal.value = t
      phase.value = 'GAME_OVER'
      void onGameTerminal(t)
      return t
    }

    const from = bestMove.slice(0, 2)
    const to = bestMove.slice(2, 4)
    const promo = bestMove.length === 5 ? (bestMove[4] as 'q' | 'r' | 'b' | 'n') : undefined
    let move: ReturnType<typeof chess.move> | null = null
    try {
      move = chess.move({ from, to, promotion: promo })
    } catch {
      // chess.js throws on illegal moves (EC-07)
    }

    if (!move) {
      // EC-07: syntactically valid but illegal UCI → treat as AI resignation
      const result: GameResult = playerColor.value === 'white' ? '1-0' : '0-1'
      const t: TerminalState = { endReason: 'resignation', result }
      terminal.value = t
      phase.value = 'GAME_OVER'
      void onGameTerminal(t)
      return t
    }

    _moves.push(from + to + (promo ?? ''))
    moveHistory.value.push(move.san)
    lastMove.value = [from, to]
    fen.value = chess.fen()
    const t = detectTerminal(chess)
    if (t) {
      terminal.value = t
      phase.value = 'GAME_OVER'
      void onGameTerminal(t)
      return t
    }
    enterPlayerTurn()
    return null
  }

  /**
   * Take back the player's last move and the AI's reply, returning to PLAYER_TURN at the same
   * position the player faced before that move. Valid only during PLAYER_TURN with at least one
   * completed player move (so ≥2 plies — player move + AI reply — exist to undo).
   */
  function undo(): void {
    if (phase.value !== 'PLAYER_TURN' || moveHistory.value.length < 2) return
    chess.undo()
    chess.undo()
    _moves.splice(-2)
    moveHistory.value.splice(-2)
    _playerMoveTimes.pop()
    const prev = _moves[_moves.length - 1]
    lastMove.value = prev ? [prev.slice(0, 2), prev.slice(2, 4)] : null
    fen.value = chess.fen()
    _turnStartedAt = Date.now()
  }

  /**
   * Player resigns. Valid during PLAYER_TURN and AI_THINKING.
   * Result: player (white) resigns → '0-1'; player (black) resigns → '1-0'.
   */
  function resign(): void {
    if (phase.value !== 'PLAYER_TURN' && phase.value !== 'AI_THINKING') return
    const result: GameResult = playerColor.value === 'white' ? '0-1' : '1-0'
    const t: TerminalState = { endReason: 'resignation', result }
    terminal.value = t
    phase.value = 'GAME_OVER'
    void onGameTerminal(t)
  }

  /** Reset to SETUP state for starting a new game. Clears all game state. */
  function resetToSetup(): void {
    chess = new Chess()
    phase.value = 'SETUP'
    fen.value = chess.fen()
    terminal.value = null
    _moves = []
    _playerMoveTimes = []
    moveHistory.value = []
    lastMove.value = null
  }

  /**
   * DEV-ONLY: inject a FEN position into the chess instance and fen ref.
   * Phase follows whose turn the FEN says it is (so a "Black to move" position isn't frozen in
   * PLAYER_TURN with a white-only board). When it lands on AI_THINKING the DEV caller must fire
   * the AI move (PlayView.injectFen), mirroring startFromPayload. Does nothing in production.
   */
  function setDevFen(newFen: string): void {
    try {
      chess = new Chess(newFen)
      fen.value = chess.fen()
      _moves = []
      _playerMoveTimes = []
      moveHistory.value = []
      lastMove.value = null
      terminal.value = null
      const turn = chess.turn() === 'w' ? 'white' : 'black'
      if (turn === playerColor.value) enterPlayerTurn()
      else phase.value = 'AI_THINKING'
    } catch {
      // Invalid FEN — ignore silently
    }
  }

  /**
   * Restore an in-progress game from a saved snapshot (續玩對局). Replays the UCI move list into a
   * fresh chess.js so the full internal state — undo stack, threefold history, SAN record — is rebuilt
   * (storing only the FEN would lose all three). Phase is derived from whose turn it is. Returns false
   * (state untouched) on a corrupt move list or an already-terminal position, so a bad snapshot can
   * never strand the player on a dead board.
   */
  function restoreGame(snapshot: ResumePayload): boolean {
    const next = new Chess()
    const sans: string[] = []
    try {
      for (const uci of snapshot.moves) {
        const move = next.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length === 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined,
        })
        sans.push(move.san)
      }
    } catch {
      return false
    }
    if (detectTerminal(next)) return false

    chess = next
    playerColor.value = snapshot.playerColor
    aiSkillLevel.value = snapshot.level
    fen.value = next.fen()
    terminal.value = null
    _moves = [...snapshot.moves]
    _playerMoveTimes = [...snapshot.playerMoveTimes]
    moveHistory.value = sans
    const last = snapshot.moves[snapshot.moves.length - 1]
    lastMove.value = last ? [last.slice(0, 2), last.slice(2, 4)] : null
    const turn = next.turn() === 'w' ? 'white' : 'black'
    if (turn === snapshot.playerColor) enterPlayerTurn()
    else phase.value = 'AI_THINKING'
    return true
  }

  /** Snapshot the live game for the resume store. Caller stamps updatedAt. */
  function getResumeSnapshot(): ResumePayload {
    return {
      moves: [..._moves],
      playerColor: playerColor.value,
      level: aiSkillLevel.value,
      playerMoveTimes: [..._playerMoveTimes],
    }
  }

  return {
    phase: readonly(phase),
    playerColor: readonly(playerColor),
    aiSkillLevel: readonly(aiSkillLevel),
    fen: readonly(fen),
    terminal: readonly(terminal),
    moveHistory: readonly(moveHistory),
    lastMove: readonly(lastMove),
    startGame,
    handlePlayerMove,
    handleAiMove,
    resign,
    undo,
    resetToSetup,
    setDevFen,
    restoreGame,
    getResumeSnapshot,
    /** Internal chess instance accessor — exposed only for unit tests (non-reactivity assertion). */
    _getChess: (): Chess => chess,
    /** Internal moves array accessor — exposed only for unit tests. */
    _getMoves: (): readonly string[] => _moves,
    /** Internal playerMoveTimes accessor — exposed only for unit tests. */
    _getPlayerMoveTimes: (): readonly number[] => _playerMoveTimes,
  }
}
