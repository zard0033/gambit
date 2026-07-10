/**
 * Missed-mate detector (棋憶 signpost → RecognitionGate, v1). A pure function over the data #7's
 * post-game review already produced — it re-uses `analysisResults`, never calls the engine.
 *
 * SEMANTICS (deliberately NOT `classify()`'s mate branch): `classify` fires on `allowedForcedMate`
 * ＝「放任被將死」(the player let the opponent mate). This detector wants the OPPOSITE — a **missed**
 * mate: at position i (player to move) the player HAD a unique forced mate-in-1 (`evalMate === 1`,
 * chess.js-verified unique — see `isUniqueOneMoveMate`) and did not play the mating move, throwing it
 * away. See ADR-0007 §6 (Missed vs Allowed forced mate).
 *
 * North star: the position the player passed over becomes a judgement-field question in their own game.
 */
import { Chess } from 'chess.js'
import type { StoredAnalysisEntry } from '../post-game-review/use-post-game-review'
import { RECOGNITION_SOURCE_MAX } from '../../config/learning-loop-tuning'

/** One position where the player had — and missed — a forced mate. */
export interface MissedMate {
  /** Position index i (the player's move under inspection; FEN is the player-to-move position). */
  readonly ply: number
  /** FEN before the player's move i (the judgement-field board). */
  readonly fen: string
  /** The engine's mating move at i, UCI (e.g. 'g5f7'). Promotions are excluded upstream. */
  readonly mateMoveUci: string
}

/**
 * A missed-mate position lifted out of a reviewed game, awaiting its judgement-field run. Lives in
 * this module (not `stores/recognition-source.ts`) per ADR-0015: modules/ must not import stores/,
 * so this store-facing shape is defined here and the store imports it.
 */
export interface MissedMateSource {
  gameId: string
  ply: number
  fen: string
  mateMoveUci: string
  playerColor: 'white' | 'black'
}

/**
 * True iff `mateMoveUci` is the ONE legal move from `fen` that delivers immediate checkmate.
 * Exhaustively tries every legal move with chess.js and calls `isCheckmate()` on the result — the
 * only way to be sure the position doesn't also have a second, different mating move that
 * `RecognitionBoard`'s exact from/to matcher would reject (see module doc: RecognitionBoard has no
 * "any legal mate" fallback, so a second mating move would silently punish the player for finding a
 * real checkmate that just isn't THE one this source recorded).
 */
function isUniqueOneMoveMate(fen: string, mateMoveUci: string): boolean {
  const chess = new Chess(fen)
  const mates = chess
    .moves({ verbose: true })
    .filter((m) => {
      const trial = new Chess(fen)
      trial.move({ from: m.from, to: m.to, promotion: m.promotion })
      return trial.isCheckmate()
    })
  if (mates.length !== 1) return false
  const only = mates[0]
  return !only.promotion && `${only.from}${only.to}` === mateMoveUci
}

/**
 * Select the missed forced mates in a reviewed game. A ply i is a missed mate iff ALL hold:
 *   - i is a player move,
 *   - `analysisResults[i].evalMate === 1` (UCI「score mate N」convention: N is the mating side's own
 *     move count to deliver mate — mate-in-1 means `bestMove` itself is the checkmating move. Any
 *     other N (including 2, 3…) means `bestMove` is only the FIRST move of a forced sequence, not a
 *     checkmate itself, and would be objectively wrong chess to hand the player as「一步將死」),
 *   - `bestMove` exists and is not a promotion (len 5 — `RecognitionMove` has no promotion field, v1),
 *   - `isUniqueOneMoveMate(fen, bestMove)` — chess.js confirms `bestMove` is the ONLY legal mate-in-1
 *     from this position (a second mating move would make `RecognitionBoard`'s exact matcher reject a
 *     player who finds it, misrecording a real solve as a miss),
 *   - the player's ACTUAL move ≠ `bestMove` (they did not play the mate),
 *   - the mate is gone after the actual move: `analysisResults[i+1].evalMate` is NOT < 0 (a value < 0
 *     would mean the opponent, to move at i+1, is still being force-mated ⇒ the mate survived ⇒ no miss).
 *
 * Deterministic ordering: shortest mate first (`|evalMate|` ascending — this is always 1 post-filter,
 * so ply ascending is the effective tie-break), capped at `RECOGNITION_SOURCE_MAX`.
 */
export function selectMissedMates(input: {
  analysisResults: ReadonlyArray<StoredAnalysisEntry | null>
  fens: ReadonlyArray<string>
  /** UCI of the moves actually played (position i = state after move i). */
  moves: ReadonlyArray<string>
  isPlayerMove: (i: number) => boolean
}): MissedMate[] {
  const { analysisResults, fens, moves, isPlayerMove } = input
  const found: { mate: MissedMate; mateDist: number }[] = []

  for (let i = 0; i < moves.length; i++) {
    if (!isPlayerMove(i)) continue
    const curr = analysisResults[i]
    if (!curr || curr.evalMate === undefined || curr.evalMate !== 1) continue
    const best = curr.bestMove
    if (!best || best.length === 5) continue // no mate move / promotion mate (v1 skip)
    if (moves[i] === best) continue // player found the mate — nothing missed
    const next = analysisResults[i + 1]
    if (next && next.evalMate !== undefined && next.evalMate < 0) continue // mate survived → not missed
    const fen = fens[i]
    if (!fen) continue
    if (!isUniqueOneMoveMate(fen, best)) continue // multiple mates → exact-match board would misfire
    found.push({ mate: { ply: i, fen, mateMoveUci: best }, mateDist: Math.abs(curr.evalMate) })
  }

  found.sort((a, b) => a.mateDist - b.mateDist || a.mate.ply - b.mate.ply)
  return found.slice(0, RECOGNITION_SOURCE_MAX).map((f) => f.mate)
}
