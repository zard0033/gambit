/**
 * Bridge 3 — game-mistake → concept classifier (Learning Loop #20, GDD §3.4, §4.4, Phase C).
 *
 * A pure function over the ACTUAL game line — no engine call beyond what #7 already ran. v1 fires on
 * exactly two reliably-detectable signals; fork/pin are deferred (pv is unreliable, GDD §3.4). The
 * north star is **prefer-silence**: a wrong thematic label is worse than silence (EC-10), so every
 * ambiguous case returns `'none'`.
 */
import { Chess, type Move } from 'chess.js'
import type { ChessConcept } from '../../types/concept'
import { CLASSIFIER_SIGNALS } from '../../config/learning-loop-tuning'

/** Outcome of classification: a concept tag, or `'none'` (the silent, default, correct case). */
export type ClassifyResult = ChessConcept | 'none'

/** Signals the classifier knows how to detect. fork/pin are v1-deferred (GDD §3.4, pv unreliable). */
export type ClassifierSignal = 'mate' | 'material'

/** Signals #7's review already computed for the player's move i (reused, not recomputed). */
export interface MistakeSignals {
  /** #7 F2b: the player's move allowed the opponent a forced mate (the「放任被將死」transition). */
  allowedForcedMate: boolean
}

export interface ClassifyInput {
  /** FEN before the player's move i (player to move). */
  fen: string
  /** The player's move i, UCI (e.g. 'e2e4', 'e7e8q'). */
  playerMoveUci: string
  /** The opponent's ACTUALLY-played reply (move i+1), UCI; `undefined` if the game ended on move i. */
  opponentReplyUci: string | undefined
  signals: MistakeSignals
}

/** Centipawn-free material values (GDD §4.4 value clause). King is uncapturable. */
const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: Infinity }

function applyUci(chess: Chess, uci: string): Move | null {
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.length === 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined
  try {
    return chess.move({ from, to, promotion })
  } catch {
    return null
  }
}

/** Which player piece was hung, and where it stood. `square` is always the captured piece's own
 *  square (en-passant is excluded upstream, so it equals the capturer's destination). */
export interface HungMaterial {
  /** chess.js piece type of the player's lost piece ('q', 'r', …). */
  readonly piece: string
  /** The square it stood on. */
  readonly square: string
}

/**
 * GDD §4.4 predicate, detail form: after the player's move, did the opponent's ACTUAL reply capture an
 * undefended player piece with no compensating recapture — and if so, which piece on which square?
 * Replays the real line with chess.js (same technique as `puzzles.test.ts`); legality-based, one-ply,
 * no static-exchange eval.
 *
 * Returns non-null only when confident the material was hung. Ambiguous cases (a pinned-only defender,
 * en-passant, promotion-captures) return `null` — prefer-silence over a wrong label (GDD EC-10, AC-6).
 *
 * The identity was always computed here and thrown away as a boolean; 棋憶's F3 material template needs
 * it to say「你的后留在 f7，沒人守著」instead of a fallback that names nothing.
 */
export function hungMaterialDetail(
  fen: string,
  playerMoveUci: string,
  opponentReplyUci: string,
): HungMaterial | null {
  const chess = new Chess(fen)
  if (!applyUci(chess, playerMoveUci)) return null

  const reply = applyUci(chess, opponentReplyUci)
  if (!reply || !reply.captured) return null
  // Excluded from v1 (GDD §4.4): en-passant (captured pawn is not on the destination square) and
  // promotion-captures (value accounting differs). Rare; stay silent rather than mislabel.
  if (reply.flags.includes('e') || reply.flags.includes('p')) return null

  const square = reply.to
  const capturedValue = PIECE_VALUE[reply.captured]
  const capturerValue = PIECE_VALUE[reply.piece]
  const playerColor = reply.color === 'w' ? 'b' : 'w'

  const hung: HungMaterial = { piece: reply.captured, square }

  // `attackers` is geometric — it includes a piece that is pinned (the defender that *looks* like it
  // guards the square but cannot legally recapture). Zero attackers ⇒ genuinely undefended (AC-5).
  const defenders = chess.attackers(square, playerColor)
  if (defenders.length === 0) return hung

  // A geometric defender exists. If none can LEGALLY recapture (the only defender is absolutely
  // pinned), stay silent — conservative reading per AC-6(b).
  const legalRecaptures = chess.moves({ verbose: true }).filter((m) => m.to === square && m.captured)
  if (legalRecaptures.length === 0) return null

  // Compensation (one ply, no SEE): every legal recapture lands on `square`, taking the capturer.
  // If that capturer is worth ≥ the lost piece, the player wins the material back — not hung (AC-6a).
  if (capturerValue >= capturedValue) return null

  // Recapture exists but wins back less than was lost (e.g. hung a queen, can only take a knight).
  return hung
}

/** Boolean form of `hungMaterialDetail` — the GDD §4.4 predicate `classify` gates on. */
export function hungUndefendedMaterial(
  fen: string,
  playerMoveUci: string,
  opponentReplyUci: string,
): boolean {
  return hungMaterialDetail(fen, playerMoveUci, opponentReplyUci) !== null
}

/**
 * Classify a player mistake into a concept tag, or `'none'` (GDD §4.4). Mate precedes material
 * (EC-5: the larger error). Everything else — fork/pin (v1-deferred), positional, time — is silence.
 * Which detectors run is data-driven by `CLASSIFIER_SIGNALS`（GDD §7 tuning knob）；injectable for tests.
 */
export function classify(
  input: ClassifyInput,
  signals: readonly ClassifierSignal[] = CLASSIFIER_SIGNALS,
): ClassifyResult {
  if (signals.includes('mate') && input.signals.allowedForcedMate) return 'mate'
  if (
    signals.includes('material') &&
    input.opponentReplyUci &&
    hungUndefendedMaterial(input.fen, input.playerMoveUci, input.opponentReplyUci)
  ) {
    return 'material'
  }
  return 'none'
}
