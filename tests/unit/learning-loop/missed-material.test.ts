import { describe, expect, it } from 'vitest'
import { selectMissedMaterial } from '@/modules/learning-loop/missed-material'
import type { StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'

function entry(partial: Partial<StoredAnalysisEntry>): StoredAnalysisEntry {
  return { bestMove: null, depthReached: 16, pass: 'deep', ...partial } as StoredAnalysisEntry
}

const allPlayer = () => true

// Real, chess.js-validated positions (verified with scratchpad/sample-missed-material.cjs, which
// mirrors this module's rule engine — see that script's header for the batch-review harness it
// provides). All FENs carry both kings.

// White Nc3, Black Ke8, Black Nd5 (undefended). c3d5 is a safe capture: zero black defenders of d5
// before the capture, and no black piece attacks d5 after Nxd5. The white h2 pawn keeps post-capture
// material sufficient (K+N vs K would be an insufficient-material draw, correctly excluded by the
// draw rule — see test_missedMaterial_captureIntoStalemate_notCaptured's family).
const UNDEFENDED_FEN = '4k3/8/8/3n4/8/2N5/7P/4K3 w - - 0 1'
const UNDEFENDED_CAPTURE = 'c3d5'

// Same as above but a black pawn on c6 additionally guards d5 (the queen there is defended).
const DEFENDED_FEN = '4k3/8/2p5/3q4/8/2N5/8/4K3 w - - 0 1'

// White knight c3 with no black piece on d5 or any capturable square at c3a4's destination — a4 is
// a legal, non-capturing knight move.
const NO_CAPTURE_FEN = '4k3/8/8/8/8/2N5/8/4K3 w - - 0 1'
const NO_CAPTURE_MOVE = 'c3a4'

// Two white knights (c3 and f4) can both safely capture the undefended black queen on d5 — two
// distinct, equally-safe ways to win the same piece.
const DOUBLE_SAFE_FEN = '4k3/8/8/3q4/5N2/2N5/8/4K3 w - - 0 1'
const DOUBLE_SAFE_CAPTURE = 'f4d5'

// A pawn promotion-capture (v1 has no promotion field on RecognitionMove — skip regardless of safety).
const PROMOTION_CAPTURE_FEN = '3r1k2/4P3/8/8/8/8/8/4K3 w - - 0 1'
const PROMOTION_CAPTURE = 'e7d8q'

// Regression (2026-07-12 adversarial rule review, finding 2): Qb3xa4 wins the undefended black rook
// but leaves Black stalemated — a winning position thrown into a draw. chess.js verified:
// after b3a4 Black has zero legal moves and is not in check.
const STALEMATE_TRAP_FEN = '7k/5K2/6B1/8/r7/1Q6/8/8 w - - 0 1'
const STALEMATE_TRAP_CAPTURE = 'b3a4'

// Black-to-move mirror of UNDEFENDED_FEN: Black Nf6 safely captures the undefended white Nd5; the
// white h2 pawn keeps post-capture material sufficient. Covers the black-side wiring (incl. the
// side-to-move cpLoss fixture direction) that the white-only fixtures above leave untested.
const BLACK_UNDEFENDED_FEN = '4k3/8/5n2/3N4/8/8/7P/4K3 b - - 0 1'
const BLACK_UNDEFENDED_CAPTURE = 'f6d5'

describe('selectMissedMaterial', () => {
  it('test_missedMaterial_zeroDefendersAndCpLossMet_captured', () => {
    const analysisResults = [
      entry({ bestMove: UNDEFENDED_CAPTURE, evalCp: 400 }),
      entry({ evalCp: 200 }), // cpLoss = 400 + 200 = 600 ≥ 300
    ]
    const result = selectMissedMaterial({
      analysisResults,
      fens: [UNDEFENDED_FEN, 'irrelevant'],
      moves: ['e1d1'], // player did NOT play c3d5
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([{ ply: 0, fen: UNDEFENDED_FEN, captureMoveUci: UNDEFENDED_CAPTURE }])
  })

  it('test_missedMaterial_targetSquareDefended_notCaptured', () => {
    const analysisResults = [
      entry({ bestMove: UNDEFENDED_CAPTURE, evalCp: 400 }),
      entry({ evalCp: 200 }),
    ]
    const result = selectMissedMaterial({
      analysisResults,
      fens: [DEFENDED_FEN, 'irrelevant'],
      moves: ['e1d1'],
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMaterial_bestMoveNotACapture_notCaptured', () => {
    const analysisResults = [
      entry({ bestMove: NO_CAPTURE_MOVE, evalCp: 400 }),
      entry({ evalCp: 200 }),
    ]
    const result = selectMissedMaterial({
      analysisResults,
      fens: [NO_CAPTURE_FEN, 'irrelevant'],
      moves: ['e1d1'],
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMaterial_cpLossBelowThreshold_notCaptured', () => {
    // cpLoss = 50 + 0 = 50 < MISSED_MATERIAL_MIN_CP_GAIN (300).
    const analysisResults = [
      entry({ bestMove: UNDEFENDED_CAPTURE, evalCp: 50 }),
      entry({ evalCp: 0 }),
    ]
    const result = selectMissedMaterial({
      analysisResults,
      fens: [UNDEFENDED_FEN, 'irrelevant'],
      moves: ['e1d1'],
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMaterial_multipleSafeCapturesOfSamePiece_notCaptured', () => {
    const analysisResults = [
      entry({ bestMove: DOUBLE_SAFE_CAPTURE, evalCp: 400 }),
      entry({ evalCp: 200 }),
    ]
    const result = selectMissedMaterial({
      analysisResults,
      fens: [DOUBLE_SAFE_FEN, 'irrelevant'],
      moves: ['e1d1'],
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMaterial_promotionCapture_skipped', () => {
    // RecognitionMove has no promotion field — conservatively skip a promotion capture (v1).
    const analysisResults = [
      entry({ bestMove: PROMOTION_CAPTURE, evalCp: 900 }),
      entry({ evalCp: 900 }),
    ]
    const result = selectMissedMaterial({
      analysisResults,
      fens: [PROMOTION_CAPTURE_FEN, 'irrelevant'],
      moves: ['e1d1'],
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMaterial_playerPlayedTheCapture_notCaptured', () => {
    const analysisResults = [
      entry({ bestMove: UNDEFENDED_CAPTURE, evalCp: 400 }),
      entry({ evalCp: 200 }),
    ]
    const result = selectMissedMaterial({
      analysisResults,
      fens: [UNDEFENDED_FEN, 'irrelevant'],
      moves: [UNDEFENDED_CAPTURE], // played the winning capture itself
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })

  it('test_missedMaterial_nonPlayerPly_skipped', () => {
    const analysisResults = [
      entry({ bestMove: NO_CAPTURE_MOVE, evalCp: 10 }),
      entry({ bestMove: UNDEFENDED_CAPTURE, evalCp: 400 }), // a missed win, but NOT the player's move
      entry({ evalCp: 200 }),
    ]
    const result = selectMissedMaterial({
      analysisResults,
      fens: ['F0', UNDEFENDED_FEN, 'F2'],
      moves: ['e1e2', 'a7a6'],
      isPlayerMove: (i) => i % 2 === 0,
    })
    expect(result).toEqual([])
  })

  it('test_missedMaterial_sortsByCpLoss_andCapsAtThree', () => {
    // Four candidates at plies 0-3, same undefended-capture geometry but different cpLoss. Cap =
    // RECOGNITION_SOURCE_MAX (3), ordering = biggest cpLoss first.
    const analysisResults = [
      entry({ bestMove: UNDEFENDED_CAPTURE, evalCp: 300 }), // cpLoss 300+100=400
      entry({ evalCp: 100 }),
      entry({ bestMove: UNDEFENDED_CAPTURE, evalCp: 600 }), // cpLoss 600+200=800
      entry({ evalCp: 200 }),
      entry({ bestMove: UNDEFENDED_CAPTURE, evalCp: 500 }), // cpLoss 500+100=600
      entry({ evalCp: 100 }),
      entry({ bestMove: UNDEFENDED_CAPTURE, evalCp: 400 }), // cpLoss 400+50=450
      entry({ evalCp: 50 }),
    ]
    const result = selectMissedMaterial({
      analysisResults,
      fens: [UNDEFENDED_FEN, 'F1', UNDEFENDED_FEN, 'F3', UNDEFENDED_FEN, 'F5', UNDEFENDED_FEN, 'F7'],
      moves: ['e1d1', 'e8e7', 'e1d1', 'e8e7', 'e1d1', 'e8e7', 'e1d1'],
      isPlayerMove: (i) => i % 2 === 0,
    })
    // ply 2 (cpLoss 800) > ply 4 (600) > ply 6 (450) > ply 0 (400, dropped — cap 3)
    expect(result.map((m) => m.ply)).toEqual([2, 4, 6])
  })

  it('test_missedMaterial_captureIntoStalemate_notCaptured', () => {
    // Arrange: six conditions would all pass, but the capture stalemates Black (win → draw).
    const analysisResults = [
      entry({ bestMove: STALEMATE_TRAP_CAPTURE, evalCp: 900 }),
      entry({ evalCp: 200 }),
    ]
    // Act
    const result = selectMissedMaterial({
      analysisResults,
      fens: [STALEMATE_TRAP_FEN, 'irrelevant'],
      moves: ['f7f6'],
      isPlayerMove: allPlayer,
    })
    // Assert: the draw exclusion refuses to teach「吃子送和」as a missed win.
    expect(result).toEqual([])
  })

  it('test_missedMaterial_blackToMove_captured', () => {
    // Arrange: black player misses Nxd5; evals follow the side-to-move convention (curr = black's
    // perspective, next = white's) — cpLoss = 400 + 200 = 600 ≥ 300.
    const analysisResults = [
      entry({ bestMove: BLACK_UNDEFENDED_CAPTURE, evalCp: 400 }),
      entry({ evalCp: 200 }),
    ]
    // Act
    const result = selectMissedMaterial({
      analysisResults,
      fens: [BLACK_UNDEFENDED_FEN, 'irrelevant'],
      moves: ['e8d8'],
      isPlayerMove: allPlayer,
    })
    // Assert
    expect(result).toEqual([
      { ply: 0, fen: BLACK_UNDEFENDED_FEN, captureMoveUci: BLACK_UNDEFENDED_CAPTURE },
    ])
  })

  it('test_missedMaterial_emptyReview_returnsEmpty', () => {
    const result = selectMissedMaterial({
      analysisResults: [],
      fens: [],
      moves: [],
      isPlayerMove: allPlayer,
    })
    expect(result).toEqual([])
  })
})
