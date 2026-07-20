/**
 * Build a runtime RecognitionSet from a player's own missed-mate/missed-material positions (棋憶
 * signpost → judgement field). Pure — no store, no engine. Every board is `kind: 'real'` (no decoy):
 * each is a position from the player's game where the concept's opportunity was there and passed
 * over, and the concept IS present. The judgement field asks them to recognise it this time.
 *
 * No per-board Stockfish gate is needed here because the proof already happened upstream at capture
 * time: `selectMissedMates` (mate) exhaustively enumerates every legal move with chess.js and only
 * keeps a source when `expectedMove` is the ONE move that delivers immediate checkmate;
 * `selectMissedMaterial` (material) only keeps a source when `expectedMove` is the ONE legal move that
 * both captures the piece and is itself safe from immediate recapture. (Eval dominance — an option
 * outscoring every alternative — is NOT the same guarantee: it says nothing about whether a second,
 * different move ALSO qualifies, which is exactly the case `RecognitionBoard`'s exact from/to matcher
 * cannot tolerate.)
 */
import type { ChessConcept } from '../../types/concept'
import type { RecognitionSet, RecognitionBoard } from '../../types/recognition'
import type { MissedMateSource } from './missed-mate'
import type { MissedMaterialSource } from './missed-material'

function buildMaterialSet(
  conceptId: ChessConcept,
  pending: readonly MissedMaterialSource[],
): RecognitionSet {
  const boards: RecognitionBoard[] = pending.map((s) => ({
    kind: 'real',
    fen: s.fen,
    expectedMove: { from: s.captureMoveUci.slice(0, 2), to: s.captureMoveUci.slice(2, 4) },
    successText: '拿下——沒人守著的子，這次你自己看見了。',
  }))

  return {
    conceptId,
    intro:
      '這幾個局面，都來自你剛下完的那盤棋——每一個，都有一顆沒人守著的子，當時沒有拿下。這次，換你把它認出來。',
    prompt: '這一盤，有沒有子可以白拿？',
    missedHint: '還有子在等你。再看一眼這一盤——有顆沒人守著的子，就藏在這裡。',
    boards,
  }
}

function buildMateSet(conceptId: ChessConcept, pending: readonly MissedMateSource[]): RecognitionSet {
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

export function buildRecognitionSetFromSources(
  conceptId: ChessConcept,
  pending: ReadonlyArray<MissedMateSource | MissedMaterialSource>,
): RecognitionSet | undefined {
  if (pending.length === 0) return undefined
  if (conceptId === 'material') return buildMaterialSet(conceptId, pending as MissedMaterialSource[])
  return buildMateSet(conceptId, pending as MissedMateSource[])
}
