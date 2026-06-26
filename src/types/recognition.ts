/**
 * Recognition Gate (quick-specs/concept-deepening-page.md §15). The deepening's third step for a
 * concept is replaced by a "judgement field": a carousel of full-size boards where the player must
 * decide, with NO on-board hint, whether the concept's tactic is present — including recognising
 * when it is NOT (the decoy). This trains *recognition* (spotting the moment unaided), which the
 * single-board silent gate never did — it only trained *execution* (playing a known tactic).
 *
 * Static, front-end-only data. Every board is clean-room and passes the three content gates:
 * chess.js legality → Stockfish (real: unique best move; decoy: tempt move is NOT best AND its
 * refutation aligns with the engine PV) → adversarial review. See §15.7.
 */

import type { ChessConcept } from './concept'

/** A move on a recognition board (no promotion — fork/skewer targets are never promotions). */
export interface RecognitionMove {
  from: string
  to: string
}

/**
 * A board that genuinely contains the concept's tactic. The player must play `expectedMove`;
 * pressing「這裡沒有」on it is a *miss* (not named, surfaced as「還有一手在等你」, see §15.4).
 */
export interface RecognitionRealBoard {
  kind: 'real'
  fen: string
  /** The tactic the player must find (Stockfish-verified unique best, gap ≥ 200cp). */
  expectedMove: RecognitionMove
  /** Neve after the correct tactic is played. */
  successText: string
}

/**
 * A board that *looks* like it has the tactic but is refuted — the player must press「這裡沒有」.
 * Playing `temptMove` is the trap (piece slides back). Either outcome plays the refutation demo
 * (§15.5): `[temptMove, refutation]` for a correct「沒有」, `[refutation]` after the trap.
 */
export interface RecognitionDecoyBoard {
  kind: 'decoy'
  fen: string
  /** The move that looks like the tactic but loses (Stockfish: NOT the best move). */
  temptMove: RecognitionMove
  /** Opponent's refutation — the demo's reply (Stockfish-verified == engine PV1 after temptMove). */
  refutation: RecognitionMove
  /** Neve when the player correctly presses「這裡沒有」(before the refutation demo). */
  emptyText: string
  /** Neve when the player fell for the trap and played `temptMove` (before the demo). */
  trapText: string
}

/** A recognition board is either a genuine tactic or a refuted decoy (discriminated by `kind`). */
export type RecognitionBoard = RecognitionRealBoard | RecognitionDecoyBoard

/** The set of boards for one concept's judgement field. */
export interface RecognitionSet {
  conceptId: ChessConcept
  /** Carousel intro (Neve, the once-before context — "this time it's different, you judge"). */
  intro: string
  /** Per-board action prompt (Neve), shown while a board is unjudged: find the move if the tactic
   *  is there, else press「這裡沒有」. The gate prepends the player's colour (你執白方／黑方). */
  prompt: string
  /** Shown when the player missed a real board — never names which one (Eason: choice A, §15.4). */
  missedHint: string
  /** Boards in presentation order (MINIMAL: fixed; deterministic shuffle is a later brick). */
  boards: RecognitionBoard[]
}
