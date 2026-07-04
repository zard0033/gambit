import { describe, it, expect } from 'vitest'
import {
  classify,
  hungUndefendedMaterial,
  selectMistakeSignposts,
  type ClassifiedMistake,
} from '../../../src/modules/learning-loop/classify'

// S-Phase-C — Bridge 3 mistake classifier (GDD §3.4, §4.4; AC-5, AC-6, AC-7).
// Fixtures are real chess lines, hand-verified with chess.js replay. The classifier reads the
// ACTUAL game continuation, never the engine pv — these pin that contract.

const noMate = { allowedForcedMate: false }

describe('classify — Signal M (mate, AC-5 / AC-7)', () => {
  it('returns mate when the move allowed a forced mate (reuses #7 F2b)', () => {
    // fen/moves irrelevant for the mate branch — it reads the injected #7 signal.
    expect(
      classify({
        fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
        playerMoveUci: 'e1e2',
        opponentReplyUci: undefined,
        signals: { allowedForcedMate: true },
      }),
    ).toBe('mate')
  })

  it('mate takes precedence over material on a move that does both (EC-5, AC-7)', () => {
    // Same line as the material-positive fixture, but the move also allowed mate → mate wins.
    expect(
      classify({
        fen: '4k3/8/8/8/3p4/8/8/1N2K3 w - - 0 1',
        playerMoveUci: 'b1c3',
        opponentReplyUci: 'd4c3',
        signals: { allowedForcedMate: true },
      }),
    ).toBe('mate')
  })
})

describe('classify — CLASSIFIER_SIGNALS gating (GDD §7 tuning knob)', () => {
  // A line that trips BOTH detectors — which one fires must follow the injected signal list.
  const both = {
    fen: '4k3/8/8/8/3p4/8/8/1N2K3 w - - 0 1',
    playerMoveUci: 'b1c3',
    opponentReplyUci: 'd4c3',
    signals: { allowedForcedMate: true },
  }

  it('test_classify_mateSignalDisabled_fallsThroughToMaterial', () => {
    expect(classify(both, ['material'])).toBe('material')
  })

  it('test_classify_materialSignalDisabled_hungPieceIsSilence', () => {
    expect(classify({ ...both, signals: noMate }, ['mate'])).toBe('none')
  })

  it('test_classify_emptySignalList_alwaysSilence', () => {
    expect(classify(both, [])).toBe('none')
  })

  it('test_classify_defaultSignals_matchConfigBehavior', () => {
    // No explicit list → CLASSIFIER_SIGNALS（mate+material）；行為與接線前逐一相同。
    expect(classify(both)).toBe('mate')
    expect(classify({ ...both, signals: noMate })).toBe('material')
  })
})

describe('classify — Signal H (material, AC-5)', () => {
  it('returns material when the player hangs an undefended piece the opponent then captures', () => {
    // White Nb1-c3?? into a pawn on d4; ...dxc3 takes the knight, no white recapture, no defender.
    expect(
      classify({
        fen: '4k3/8/8/8/3p4/8/8/1N2K3 w - - 0 1',
        playerMoveUci: 'b1c3',
        opponentReplyUci: 'd4c3',
        signals: noMate,
      }),
    ).toBe('material')
  })
})

describe('hungUndefendedMaterial — negative cases (AC-6, false-positive suppression / EC-10)', () => {
  it('(a) legal recapture of value ≥ the lost piece → not hung (compensated)', () => {
    // White Nc3 defended by pawn b2; ...Bxc3 captures the knight, bxc3 wins the bishop back (3 ≥ 3).
    expect(
      hungUndefendedMaterial('4k3/8/8/b7/8/8/1P6/1N2K3 w - - 0 1', 'b1c3', 'a5c3'),
    ).toBe(false)
  })

  it('(b) only defender is absolutely pinned → no legal recapture → conservative silence', () => {
    // White bishop e2 is pinned to the king by the rook on e8; it geometrically guards d3 but cannot
    // legally recapture there. Knight on d3 is taken; predicate stays silent (AC-6b).
    expect(
      hungUndefendedMaterial('4r1k1/8/8/4n3/8/3N4/4B2P/4K3 w - - 0 1', 'h2h3', 'e5d3'),
    ).toBe(false)
  })

  it('(c) en-passant capture is excluded from v1 classification', () => {
    // ...d4 then e2-e4; ...dxe3 e.p. — captured pawn is not on the destination square (GDD §4.4).
    expect(
      hungUndefendedMaterial('4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1', 'e2e4', 'd4e3'),
    ).toBe(false)
  })

  it('(c) promotion-capture is excluded from v1 classification', () => {
    // ...b2 takes the rook on a1 and promotes — value accounting differs (GDD §4.4).
    expect(
      hungUndefendedMaterial('4k3/8/8/8/8/8/1p5P/R3K3 w - - 0 1', 'h2h3', 'b2a1q'),
    ).toBe(false)
  })

  it('(d) a non-capturing reply (fork/pin situation, v1-deferred) → not hung', () => {
    expect(
      hungUndefendedMaterial(
        'rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 2',
        'g1f3',
        'b8c6',
      ),
    ).toBe(false)
  })

  it('classify routes all AC-6 negatives to none (no mate signal)', () => {
    const cases: Array<[string, string, string]> = [
      ['4k3/8/8/b7/8/8/1P6/1N2K3 w - - 0 1', 'b1c3', 'a5c3'],
      ['4r1k1/8/8/4n3/8/3N4/4B2P/4K3 w - - 0 1', 'h2h3', 'e5d3'],
      ['4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1', 'e2e4', 'd4e3'],
      ['4k3/8/8/8/8/8/1p5P/R3K3 w - - 0 1', 'h2h3', 'b2a1q'],
    ]
    for (const [fen, pm, or] of cases) {
      expect(classify({ fen, playerMoveUci: pm, opponentReplyUci: or, signals: noMate })).toBe('none')
    }
  })

  it('returns none when the game ended (no opponent reply) and no mate signal', () => {
    expect(
      classify({
        fen: '4k3/8/8/8/3p4/8/8/1N2K3 w - - 0 1',
        playerMoveUci: 'b1c3',
        opponentReplyUci: undefined,
        signals: noMate,
      }),
    ).toBe('none')
  })
})

describe('selectMistakeSignposts — link selection (GDD §4.4)', () => {
  const mistakes: ClassifiedMistake[] = [
    { index: 2, concept: 'material', cpLoss: 120 },
    { index: 8, concept: 'mate', cpLoss: 900 },
    { index: 5, concept: 'material', cpLoss: 120 },
  ]

  it('keeps the biggest cpLoss, capped at maxLinks (default 1)', () => {
    expect(selectMistakeSignposts(mistakes, 1)).toEqual([{ index: 8, concept: 'mate', cpLoss: 900 }])
  })

  it('breaks cpLoss ties by lower index (deterministic)', () => {
    expect(selectMistakeSignposts(mistakes, 2)).toEqual([
      { index: 8, concept: 'mate', cpLoss: 900 },
      { index: 2, concept: 'material', cpLoss: 120 },
    ])
  })

  it('maxLinks 0 shows nothing (excluded knob value)', () => {
    expect(selectMistakeSignposts(mistakes, 0)).toEqual([])
  })
})
