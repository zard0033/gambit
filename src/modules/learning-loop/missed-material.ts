/**
 * Missed-material detector (棋憶 signpost → RecognitionGate, v2 offense branch). A pure function over
 * the data #7's post-game review already produced — it re-uses `analysisResults`, never calls the
 * engine. Structure mirrors `missed-mate.ts` (see that module's doc for the pipeline this feeds).
 *
 * SEMANTICS (deliberately NOT `classify.ts`'s `hungUndefendedMaterial`): that detector fires when the
 * player's OWN move let the opponent hang the player's piece (defense direction, Bridge-3 journal
 * tag). This detector wants the OPPOSITE — a **missed** win: at position i (player to move) the
 * player HAD a safe, undefended enemy piece to capture (`bestMove`, chess.js-verified the ONE safe
 * way to take it) and did not play it, throwing away free material. Eason-approved design (offense
 * only, 2026-07-12 signpost-material-design.md §4/§5 Q1) — `hungUndefendedMaterial` stays untouched
 * in its original (defense) role.
 *
 * PROOF STRENGTH (deliberately weaker than mate's «one step, done»): a capture being locally safe
 * (zero defenders before, zero recapture after, and not an immediate draw) does not prove the whole
 * board is safe — there could be a refutation elsewhere. §4's six-condition gate (zero-defenders
 * geometry + cpLoss threshold + unique-safe-capture enumeration, all decisive chess.js facts, no
 * engine trust) is the strongest proof available without MultiPV; per the design doc this is
 * validated by a ONE-TIME adversarial review of the rule itself (not per-instance, mirroring how
 * mate v1 was validated) — see `scratchpad/sample-missed-material.cjs` for the batch-sampling
 * harness that review uses. 2026-07-12 rule review outcome: stalemate/draw captures are now excluded
 * (see `isUniqueSafeCapture`); the remaining known gap is the discovered-attack class (capture opens
 * a line and loses material ELSEWHERE) — accepted as low real-world risk because the engine's own
 * `bestMove` recommendation already guards it (quiescence search catches immediate recaptures), and
 * it is monitored by the batch-sampling harness rather than blocked here.
 */
import { Chess, type Square } from 'chess.js'
import type { StoredAnalysisEntry } from '../post-game-review/use-post-game-review'
import { computeCpLoss } from '../post-game-review/use-post-game-review'
import { RECOGNITION_SOURCE_MAX, MISSED_MATERIAL_MIN_CP_GAIN } from '../../config/learning-loop-tuning'

/** One position where the player had — and missed — a safe, undefended capture. */
export interface MissedMaterial {
  /** Position index i (the player's move under inspection; FEN is the player-to-move position). */
  readonly ply: number
  /** FEN before the player's move i (the judgement-field board). */
  readonly fen: string
  /** The engine's winning capture at i, UCI (e.g. 'c3d5'). Promotions are excluded upstream. */
  readonly captureMoveUci: string
}

/**
 * A missed-material position lifted out of a reviewed game, awaiting its judgement-field run. Lives
 * in this module (not `stores/recognition-source.ts`) per ADR-0015: modules/ must not import stores/,
 * so this store-facing shape is defined here and the store imports it. Deliberately a PARALLEL type
 * to `MissedMateSource` (Eason-approved, 2026-07-12 §5 Q2) — not a shared/generalized shape, to avoid
 * touching the already-shipped `MissedMateSource`/`captureMate`/`pendingFor` v1 contract.
 */
export interface MissedMaterialSource {
  gameId: string
  ply: number
  fen: string
  captureMoveUci: string
  playerColor: 'white' | 'black'
}

function oppositeColor(c: 'w' | 'b'): 'w' | 'b' {
  return c === 'w' ? 'b' : 'w'
}

/**
 * True iff `captureMoveUci` is the ONE legal move from `fen` that (a) captures on the same square as
 * `captureMoveUci`'s target AND (b) leaves that square safe from immediate recapture (zero opponent
 * attackers on the target square after the trial move) AND (c) does not immediately end the game as
 * a draw — a capture into stalemate or insufficient material turns a win into a dead draw and must
 * never be taught as「你錯過了白吃」. Exhaustively tries every legal move that
 * lands on the target square with chess.js — the same technique as `missed-mate.ts`'s
 * `isUniqueOneMoveMate` — because `RecognitionBoard`'s exact from/to matcher has no "any safe capture"
 * fallback: a second, equally-safe way to win the same piece would wrongly punish a player who finds
 * that other capture (§4 rule 5). En-passant candidates are excluded — the captured pawn is not ON
 * the destination square, so the "same square = same piece" identity this function relies on breaks
 * for them (mirrors `classify.ts::hungUndefendedMaterial`'s en-passant exclusion).
 */
function isUniqueSafeCapture(fen: string, captureMoveUci: string): boolean {
  const chess = new Chess(fen)
  const toSquare = captureMoveUci.slice(2, 4) as Square
  const opponentColor = oppositeColor(chess.turn())

  const safeCaptures = chess
    .moves({ verbose: true })
    .filter((m) => m.to === toSquare && m.captured && !m.flags.includes('e'))
    .filter((m) => {
      const trial = new Chess(fen)
      trial.move({ from: m.from, to: m.to, promotion: m.promotion })
      // Draw exclusion (2026-07-12 adversarial rule review, finding 2): capturing the free piece
      // into stalemate — the same failure family as the mate brick's Qg3 lesson — or into
      // insufficient material is a win thrown away, not a win. A fresh Chess(fen) has no move
      // history and a capture resets the halfmove clock, so isDraw() here ≡ stalemate ∨
      // insufficient material; both are decisive chess.js facts, same proof class as the rest.
      return trial.attackers(toSquare, opponentColor).length === 0 && !trial.isDraw()
    })

  if (safeCaptures.length !== 1) return false
  const only = safeCaptures[0]
  return !only.promotion && `${only.from}${only.to}` === captureMoveUci
}

/**
 * Select the missed safe captures in a reviewed game. A ply i is missed material iff ALL hold
 * (§4 of the design doc):
 *   - i is a player move, `analysisResults[i].bestMove` exists and is not a promotion (len 5 —
 *     `RecognitionMove` has no promotion field, mirrors mate v1),
 *   - `bestMove` is a capture on `fen` (chess.js `move.captured` non-null) and not en-passant (the
 *     target-square identity this whole detector relies on breaks for en-passant; conservative skip,
 *     mirrors `hungUndefendedMaterial`),
 *   - the captured piece had ZERO defenders on `fen` BEFORE the capture (`chess.attackers(square,
 *     opponentColor)` — a decisive geometric fact, not an engine guess),
 *   - `computeCpLoss(i, …)` (the same side-to-move-aware F2 formula #7 already uses — see
 *     `use-post-game-review.ts`, correctly handles the evalCp sign flip between i and i+1) is at
 *     least `MISSED_MATERIAL_MIN_CP_GAIN`,
 *   - `isUniqueSafeCapture(fen, bestMove)` — chess.js confirms `bestMove` is the ONE legal move that
 *     both captures the same piece and is itself safe from immediate recapture (a second safe way to
 *     win the same piece would make `RecognitionBoard`'s exact matcher unfairly reject a player who
 *     finds that other capture),
 *   - the player's ACTUAL move ≠ `bestMove` (they did not play the winning capture).
 *
 * Deterministic ordering: biggest cpLoss first (tie-break: lower ply), capped at
 * `RECOGNITION_SOURCE_MAX` (mirrors `selectMistakeSignposts`' ordering in classify.ts).
 */
export function selectMissedMaterial(input: {
  analysisResults: ReadonlyArray<StoredAnalysisEntry | null>
  fens: ReadonlyArray<string>
  /** UCI of the moves actually played (position i = state after move i). */
  moves: ReadonlyArray<string>
  isPlayerMove: (i: number) => boolean
}): MissedMaterial[] {
  const { analysisResults, fens, moves, isPlayerMove } = input
  const found: { material: MissedMaterial; cpLoss: number }[] = []

  for (let i = 0; i < moves.length; i++) {
    if (!isPlayerMove(i)) continue
    const curr = analysisResults[i]
    if (!curr) continue
    const best = curr.bestMove
    if (!best || best.length === 5) continue // no move / promotion (v1 skip, no promotion field)
    if (moves[i] === best) continue // player found the win — nothing missed

    const fen = fens[i]
    if (!fen) continue

    let pre: Chess
    try {
      pre = new Chess(fen)
    } catch {
      continue
    }
    const opponentColor = oppositeColor(pre.turn())
    const targetSquare = best.slice(2, 4) as Square

    // rule 3: captured piece had zero defenders BEFORE the capture (checked before mutating `pre`)
    if (pre.attackers(targetSquare, opponentColor).length > 0) continue

    // rule 2: bestMove is actually a capture, and not en-passant (target-square identity breaks)
    const applied = new Chess(fen)
    let mv
    try {
      mv = applied.move({ from: best.slice(0, 2), to: best.slice(2, 4) })
    } catch {
      continue
    }
    if (!mv.captured || mv.flags.includes('e')) continue

    // rule 4: cpLoss threshold (reuses #7's side-to-move-aware formula — do not reinvent eval signs)
    const cpLoss = computeCpLoss(i, analysisResults, isPlayerMove)
    if (cpLoss === null || cpLoss < MISSED_MATERIAL_MIN_CP_GAIN) continue

    // rule 5: unique safe capture — dominant proof that no second, equally-safe way to win exists
    if (!isUniqueSafeCapture(fen, best)) continue

    found.push({ material: { ply: i, fen, captureMoveUci: best }, cpLoss })
  }

  found.sort((a, b) => b.cpLoss - a.cpLoss || a.material.ply - b.material.ply)
  return found.slice(0, RECOGNITION_SOURCE_MAX).map((f) => f.material)
}
