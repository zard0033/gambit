import { computed, ref } from 'vue'
import { Chess } from 'chess.js'
import type { Puzzle, PuzzleMove } from '@/types/puzzle'

/**
 * Per-puzzle solving state machine (GDD §3.4/§4.3). Single source of truth for puzzle
 * validation; the view is a thin presenter over it. chess.js is the rules authority and
 * stays non-reactive (ADR-0005).
 *
 * The view owns animation timing: `submitMove` applies only the player's move and, for a
 * multi-move puzzle, returns the scripted opponent reply without playing it. The view
 * shows the player's move, waits `OPPONENT_REPLY_DELAY_MS`, then calls
 * `commitOpponentReply()` to advance.
 */
export type SubmitResult =
  | { kind: 'wrong' }
  | { kind: 'correct-solved'; piece: string; captured?: string }
  | { kind: 'correct-advance'; opponentReply: PuzzleMove; piece: string; captured?: string }

export function usePuzzle(puzzle: Puzzle) {
  const chess = new Chess(puzzle.fen)

  const phase = ref<'solving' | 'solved'>('solving')
  const fen = ref(puzzle.fen)
  const wrong = ref(false)
  const plyIndex = ref(0) // current player ply (even index into solution)
  const awaitingOpponent = ref(false)

  /** The current player ply's move, surfaced as a board arrow for the stage-2 hint. */
  const hintArrow = computed(() => {
    const mv = puzzle.solution[plyIndex.value]
    return mv ? { orig: mv.from, dest: mv.to } : null
  })

  function movesMatch(a: PuzzleMove, b: { from: string; to: string; promotion?: string }): boolean {
    return a.from === b.from && a.to === b.to && (a.promotion ?? undefined) === (b.promotion ?? undefined)
  }

  function isMatingMove(move: { from: string; to: string; promotion?: string }): boolean {
    const probe = new Chess(fen.value)
    try {
      probe.move({ from: move.from, to: move.to, promotion: move.promotion })
    } catch {
      return false
    }
    return probe.isCheckmate()
  }

  /**
   * Submit the player's move for the current ply. On success the player's move is applied
   * to the position; the caller advances opponent replies via `commitOpponentReply`.
   */
  function submitMove(move: { from: string; to: string; promotion?: string }): SubmitResult {
    if (phase.value === 'solved' || awaitingOpponent.value) return { kind: 'wrong' }

    const expected = puzzle.solution[plyIndex.value]
    const correct =
      puzzle.motif === 'mate-in-1' && puzzle.acceptAnyMate
        ? isMatingMove(move)
        : movesMatch(expected, move)

    if (!correct) {
      wrong.value = true
      return { kind: 'wrong' }
    }

    wrong.value = false
    const applied = chess.move({ from: move.from, to: move.to, promotion: move.promotion })
    fen.value = chess.fen()

    const isFinalPly = plyIndex.value >= puzzle.solution.length - 1
    if (isFinalPly) {
      phase.value = 'solved'
      return { kind: 'correct-solved', piece: applied.piece, captured: applied.captured }
    }

    awaitingOpponent.value = true
    return {
      kind: 'correct-advance',
      opponentReply: puzzle.solution[plyIndex.value + 1],
      piece: applied.piece,
      captured: applied.captured,
    }
  }

  /** Apply the scripted opponent reply and advance to the next player ply. */
  function commitOpponentReply(): void {
    if (!awaitingOpponent.value) return
    const reply = puzzle.solution[plyIndex.value + 1]
    chess.move({ from: reply.from, to: reply.to, promotion: reply.promotion })
    fen.value = chess.fen()
    plyIndex.value += 2
    awaitingOpponent.value = false
  }

  return {
    phase,
    fen,
    wrong,
    plyIndex,
    awaitingOpponent,
    hintArrow,
    submitMove,
    commitOpponentReply,
  }
}
