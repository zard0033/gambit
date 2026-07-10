/**
 * Build a runtime RecognitionSet from a player's own missed-mate positions (棋憶 signpost → judgement
 * field, v1). Pure — no store, no engine. Every board is `kind: 'real'` (no decoy): each is a position
 * from the player's game where a forced mate was there and passed over, and the concept (mate) IS
 * present. The judgement field asks them to recognise it this time.
 *
 * No per-board Stockfish gate is needed here because uniqueness was already proven upstream at
 * capture time: `selectMissedMates` (missed-mate.ts) exhaustively enumerates every legal move with
 * chess.js and only keeps a source when `expectedMove` is the ONE move that delivers immediate
 * checkmate. (Eval dominance — a mate outscoring every non-mating alternative — is NOT the same
 * guarantee: it says nothing about whether a second, different move ALSO mates, which is exactly the
 * case `RecognitionBoard`'s exact from/to matcher cannot tolerate.)
 */
import type { ChessConcept } from '../../types/concept'
import type { RecognitionSet, RecognitionBoard } from '../../types/recognition'
import type { MissedMateSource } from './missed-mate'

export function buildRecognitionSetFromSources(
  conceptId: ChessConcept,
  pending: MissedMateSource[],
): RecognitionSet | undefined {
  if (pending.length === 0) return undefined

  const boards: RecognitionBoard[] = pending.map((s) => ({
    kind: 'real',
    fen: s.fen,
    expectedMove: { from: s.mateMoveUci.slice(0, 2), to: s.mateMoveUci.slice(2, 4) },
    successText: '將死——這一手，這次你自己認出來了。',
  }))

  return {
    conceptId,
    intro:
      '這幾個局面，都來自你剛下完的那盤棋——每一個，都有一步將殺，當時沒有走出來。這次，換你把它認出來。',
    prompt: '這一盤能不能一步將死？',
    missedHint: '還有一手在等你。再看一眼這一盤——一步將殺就藏在這裡。',
    boards,
  }
}
