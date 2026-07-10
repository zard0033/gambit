import { describe, expect, it } from 'vitest'
import { selectMissedMates } from '@/modules/learning-loop/missed-mate'
import type { StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'

function entry(partial: Partial<StoredAnalysisEntry>): StoredAnalysisEntry {
  return { bestMove: null, depthReached: 16, pass: 'deep', ...partial } as StoredAnalysisEntry
}

const allPlayer = () => true

// Real, chess.js-validated positions (verified with a one-off node script using chess.js's own
// isCheckmate() over every legal move — see missed-mate.ts's isUniqueOneMoveMate for the same
// technique the production code runs).

// White Ra1, Rh1, Kg6; Black Kg8. The ONLY mate-in-1 is Ra1-a8 (back-rank mate).
const UNIQUE_MATE_FEN_1 = '6k1/8/6K1/8/8/8/8/R6R w - - 0 1'
const UNIQUE_MATE_1 = 'a1a8'

// White Kb6, Rh1; Black Ka8. The ONLY mate-in-1 is Rh1-h8.
const UNIQUE_MATE_FEN_2 = 'k7/8/1K6/8/8/8/8/7R w - - 0 1'
const UNIQUE_MATE_2 = 'h1h8'

// White Kb6, Rc6; Black Ka8. The ONLY mate-in-1 is Rc6-c8.
const UNIQUE_MATE_FEN_3 = 'k7/8/1KR5/8/8/8/8/8 w - - 0 1'
const UNIQUE_MATE_3 = 'c6c8'

// White Qa1, Qg1, Kh1; Black Kh8. THREE distinct mate-in-1 moves exist here: Qa1-g7, Qg1-g6,
// Qg1-g7 — verified by enumerating every legal move and checking isCheckmate() on each. Any single
// one of these looks like "a mate-in-1" from evalMate alone, but RecognitionBoard only accepts an
// exact from/to — a player who finds a DIFFERENT one of the three would be wrongly marked as having
// missed it. This is exactly the case the uniqueness gate must reject.
const MULTI_MATE_FEN = '7k/8/8/8/8/8/8/Q5QK w - - 0 1'
const MULTI_MATE_ENGINE_PICK = 'a1g7'

describe('selectMissedMates', () => {
  it('test_missedMate_playerHadForcedMateButPlayedElse_captured', () => {
    // Arrange: player to move at i=0 has a unique forced mate-in-1 (Ra1-a8), plays a2a3 instead.
    const analysisResults = [
      entry({ bestMove: UNIQUE_MATE_1, evalMate: 1 }),
      entry({ evalMate: undefined }),
    ]
    const fens = [UNIQUE_MATE_FEN_1, 'irrelevant']
    const moves = ['a1a2']

    // Act
    const result = selectMissedMates({ analysisResults, fens, moves, isPlayerMove: allPlayer })

    // Assert
    expect(result).toEqual([{ ply: 0, fen: UNIQUE_MATE_FEN_1, mateMoveUci: UNIQUE_MATE_1 }])
  })

  it('test_missedMate_playerPlayedTheMatingMove_notCaptured', () => {
    const analysisResults = [entry({ bestMove: UNIQUE_MATE_1, evalMate: 1 }), null]
    const result = selectMissedMates({
      analysisResults,
      fens: [UNIQUE_MATE_FEN_1, 'irrelevant'],
      moves: [UNIQUE_MATE_1], // played the mate itself
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMate_noForcedMateAvailable_notCaptured', () => {
    // evalMate undefined AND evalMate <= 0 both mean no player forced mate.
    const analysisResults = [
      entry({ bestMove: 'a1a2', evalCp: 300 }), // no evalMate
      entry({ bestMove: 'b1b2', evalMate: 0 }), // non-positive
      entry({ bestMove: 'c1c2', evalMate: -2 }), // opponent has the mate, not the player
    ]
    const result = selectMissedMates({
      analysisResults,
      fens: ['F0', 'F1', 'F2', 'F3'],
      moves: ['h2h3', 'h7h6', 'h3h4'],
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMate_mateInTwoOrMore_notCaptured', () => {
    // evalMate === 2 means bestMove is only the FIRST move of a forced mate-in-2, not itself a
    // checkmating move — v1 collects mate-in-1 only (the strict evalMate === 1 filter).
    const analysisResults = [entry({ bestMove: UNIQUE_MATE_1, evalMate: 2 }), entry({ evalMate: -1 })]
    const result = selectMissedMates({
      analysisResults,
      fens: [UNIQUE_MATE_FEN_1, 'irrelevant'],
      moves: ['a1a2'],
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMate_multipleMatingMoves_notCaptured', () => {
    // The position genuinely has evalMate === 1 and a matching bestMove, but chess.js proves a
    // SECOND legal move also delivers immediate mate — RecognitionBoard's exact matcher can't
    // tolerate that, so the uniqueness gate must discard this source entirely.
    const analysisResults = [
      entry({ bestMove: MULTI_MATE_ENGINE_PICK, evalMate: 1 }),
      entry({ evalMate: undefined }),
    ]
    const result = selectMissedMates({
      analysisResults,
      fens: [MULTI_MATE_FEN, 'irrelevant'],
      moves: ['h1h2'], // some non-mating move
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMate_engineMoveNotTheUniqueMate_notCaptured', () => {
    // Defensive case: evalMate === 1 and a bestMove are present, but bestMove does NOT match the
    // position's actual (chess.js-verified) unique mating move — e.g. stale/corrupted analysis data.
    // The uniqueness gate must reject rather than trust the recorded bestMove blindly.
    const analysisResults = [entry({ bestMove: 'a1a2', evalMate: 1 }), entry({ evalMate: undefined })]
    const result = selectMissedMates({
      analysisResults,
      fens: [UNIQUE_MATE_FEN_1, 'irrelevant'],
      moves: ['a1a3'], // did not play the recorded "bestMove" either
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMate_mateSurvivesActualMove_notCaptured', () => {
    // Player had a unique mate-in-1, played a different move, but the mate is STILL forced
    // (next.evalMate < 0 — the opponent, to move, is still being force-mated).
    const analysisResults = [entry({ bestMove: UNIQUE_MATE_1, evalMate: 1 }), entry({ evalMate: -2 })]
    const result = selectMissedMates({
      analysisResults,
      fens: ['F0', 'F1'],
      moves: ['a2a3'],
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMate_promotionMatingMove_skipped', () => {
    // RecognitionMove has no promotion field — conservatively skip a promotion mate (v1).
    const analysisResults = [entry({ bestMove: 'e7e8q', evalMate: 1 }), null]
    const result = selectMissedMates({
      analysisResults,
      fens: ['F0', 'F1'],
      moves: ['a2a3'],
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMate_nonPlayerPly_skipped', () => {
    // Only even indices are the player's; the odd-index miss must be ignored.
    const analysisResults = [
      entry({ bestMove: 'a1a2', evalCp: 10 }),
      entry({ bestMove: UNIQUE_MATE_1, evalMate: 1 }), // a missed mate, but NOT the player's move
      null,
    ]
    const result = selectMissedMates({
      analysisResults,
      fens: ['F0', UNIQUE_MATE_FEN_1, 'F2'],
      moves: ['a1a3', 'b8c6'],
      isPlayerMove: (i) => i % 2 === 0,
    })
    expect(result).toEqual([])
  })

  it('test_missedMate_sortsByPly_andCapsAtThree', () => {
    // Four unique mate-in-1 candidates at plies 0-3; since v1 only ever collects evalMate === 1,
    // mateDist is always 1 post-filter and ply-ascending is the effective (and only) ordering.
    // Cap = RECOGNITION_SOURCE_MAX (3) → plies [0, 1, 2].
    const analysisResults = [
      entry({ bestMove: UNIQUE_MATE_1, evalMate: 1 }),
      entry({ bestMove: UNIQUE_MATE_2, evalMate: 1 }),
      entry({ bestMove: UNIQUE_MATE_3, evalMate: 1 }),
      entry({ bestMove: UNIQUE_MATE_1, evalMate: 1 }),
      entry({ evalMate: undefined }),
    ]
    const result = selectMissedMates({
      analysisResults,
      fens: [UNIQUE_MATE_FEN_1, UNIQUE_MATE_FEN_2, UNIQUE_MATE_FEN_3, UNIQUE_MATE_FEN_1, 'F4'],
      moves: ['a1a2', 'h1h2', 'b6b5', 'a1a2'],
      isPlayerMove: allPlayer,
    })
    expect(result.map((m) => m.ply)).toEqual([0, 1, 2])
  })

  it('test_missedMate_emptyReview_returnsEmpty', () => {
    const result = selectMissedMates({
      analysisResults: [],
      fens: [],
      moves: [],
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })
})
