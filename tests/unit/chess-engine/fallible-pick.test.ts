import { describe, it, expect } from 'vitest'
import {
  pickFallibleMove,
  type MoveCandidate,
} from '../../../src/modules/chess-engine/fallible-pick'
import type { FallibleConfig } from '../../../src/config/difficulty-tuning'

/** Deterministic RNG: yields the given values in order, repeating the last one after that. */
function seq(...values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

const WINDOW: FallibleConfig = { probability: 0.5, minLossCp: 100, maxLossCp: 300 }

/** best 0cp, then losses of 50 / 150 / 250 / 500 centipawns. */
const LADDER: MoveCandidate[] = [
  { move: 'e2e4', cp: 0 },
  { move: 'd2d4', cp: -50 },
  { move: 'g2g4', cp: -150 },
  { move: 'b1a3', cp: -250 },
  { move: 'f2f3', cp: -500 },
]

describe('pickFallibleMove — 何時不犯錯', () => {
  it('test_falliblePick_noConfig_playsEngineBest', () => {
    // 頂階沒有 fallible 設定，必須一律走引擎最佳手
    expect(pickFallibleMove(LADDER, undefined, seq(0))).toBeUndefined()
  })

  it('test_falliblePick_zeroProbability_playsEngineBest', () => {
    const config = { ...WINDOW, probability: 0 }
    expect(pickFallibleMove(LADDER, config, seq(0))).toBeUndefined()
  })

  it('test_falliblePick_rollAboveProbability_playsEngineBest', () => {
    // 人是偶爾犯錯不是每手都爛——機率沒中就走好棋
    expect(pickFallibleMove(LADDER, WINDOW, seq(0.9))).toBeUndefined()
  })

  it('test_falliblePick_singleLegalMove_playsEngineBest', () => {
    // 只有一手合法（被將軍時常見），沒有東西可挑
    expect(pickFallibleMove([{ move: 'e1f1', cp: 0 }], WINDOW, seq(0))).toBeUndefined()
  })

  it('test_falliblePick_forcedMateAvailable_neverDeclinesIt', () => {
    // 放過將死太明顯——玩家會知道是對方讓的，而且會拖長對局
    const mating: MoveCandidate[] = [
      { move: 'd1h5', mate: 1 },
      { move: 'e2e4', cp: 0 },
      { move: 'g2g4', cp: -150 },
    ]
    expect(pickFallibleMove(mating, WINDOW, seq(0))).toBeUndefined()
  })

  it('test_falliblePick_bestLineHasNoScore_playsEngineBest', () => {
    // 沒有 cp 基準就算不出虧損，寧可走好棋也不亂挑
    const scoreless: MoveCandidate[] = [{ move: 'e2e4' }, { move: 'g2g4', cp: -150 }]
    expect(pickFallibleMove(scoreless, WINDOW, seq(0))).toBeUndefined()
  })

  it('test_falliblePick_windowEmpty_playsEngineBest', () => {
    // 殘局常見：合法走法少、彼此分數又接近，窗口內空無一物
    const flat: MoveCandidate[] = [
      { move: 'a1a2', cp: 0 },
      { move: 'a1a3', cp: -5 },
      { move: 'a1a4', cp: -12 },
    ]
    expect(pickFallibleMove(flat, WINDOW, seq(0))).toBeUndefined()
  })
})

describe('pickFallibleMove — 挑出來的手', () => {
  it('test_falliblePick_rollInsideProbability_picksFromWindow', () => {
    // 窗口 100-300cp 只涵蓋 g2g4(-150) 與 b1a3(-250)
    const picked = pickFallibleMove(LADDER, WINDOW, seq(0, 0))
    expect(picked).toBe('g2g4')
  })

  it('test_falliblePick_secondRoll_selectsAcrossTheWholeWindow', () => {
    expect(pickFallibleMove(LADDER, WINDOW, seq(0, 0.99))).toBe('b1a3')
  })

  it('test_falliblePick_neverPicksBelowMinLoss', () => {
    // d2d4 只虧 50cp——初學者看不出來也用不了，挑了等於沒挑
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
      expect(pickFallibleMove(LADDER, WINDOW, seq(0, roll))).not.toBe('d2d4')
    }
  })

  it('test_falliblePick_neverPicksAboveMaxLoss_soItNeverHangsAPiece', () => {
    // 這是與已否決的「隨機送子」的分界線：f2f3 虧 500cp＝掛子，玩家會知道是對方送的
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
      expect(pickFallibleMove(LADDER, WINDOW, seq(0, roll))).not.toBe('f2f3')
    }
  })

  it('test_falliblePick_neverPicksALineThatGetsUsMated', () => {
    // 負 mate ＝走了會被將死。cp 比較看不出這件事，必須靠 mate 欄位擋掉
    const trap: MoveCandidate[] = [
      { move: 'e2e4', cp: 0 },
      { move: 'g2g4', cp: -150 },
      { move: 'f2f3', mate: -2 },
    ]
    for (const roll of [0, 0.5, 0.99]) {
      expect(pickFallibleMove(trap, WINDOW, seq(0, roll))).toBe('g2g4')
    }
  })

  it('test_falliblePick_rollReturnsOne_staysInBounds', () => {
    // Math.floor(1 * n) === n 會越界；沒有夾住的話這裡回 undefined 而不是最後一手
    const picked = pickFallibleMove(LADDER, WINDOW, seq(0, 1))
    expect(picked).toBe('b1a3')
  })

  it('test_falliblePick_alwaysReturnsACandidateMove_neverInventsOne', () => {
    const legal = new Set(LADDER.map((c) => c.move))
    for (const roll of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      const picked = pickFallibleMove(LADDER, WINDOW, seq(0, roll))
      if (picked !== undefined) expect(legal.has(picked)).toBe(true)
    }
  })
})

describe('pickFallibleMove — 窗口寬度對應難度', () => {
  it('test_falliblePick_tighterWindow_picksMilderMistakes', () => {
    // 高階的窗口收窄，挑到的錯誤應該更小；這是階梯之所以有階的原因
    const wide: FallibleConfig = { probability: 1, minLossCp: 100, maxLossCp: 300 }
    const tight: FallibleConfig = { probability: 1, minLossCp: 30, maxLossCp: 80 }
    const mild: MoveCandidate[] = [
      { move: 'e2e4', cp: 0 },
      { move: 'd2d4', cp: -50 },
      { move: 'g2g4', cp: -150 },
    ]
    expect(pickFallibleMove(mild, wide, seq(0, 0))).toBe('g2g4')
    expect(pickFallibleMove(mild, tight, seq(0, 0))).toBe('d2d4')
  })
})
