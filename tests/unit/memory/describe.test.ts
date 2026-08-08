import { describe, it, expect } from 'vitest'
import { describeMove, momentTone, momentShortName } from '@/modules/memory/describe'
import type { Moment } from '@/types/memory'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function moment(p: Partial<Moment>): Moment {
  return { ply: 0, kind: 'plain', anchor: false, concept: 'none', cp: 0, fav: Number.NEGATIVE_INFINITY, ...p }
}

describe('describeMove — UCI → plain-language 中文 move', () => {
  it('test_describe_pawnPush_namesPieceAndSquare', () => {
    expect(describeMove(START, 'e2e4')).toEqual({ piece: '兵', to: 'e4' })
  })
  it('test_describe_knight_usesChessVocabulary_not象棋', () => {
    // 西洋棋 knight = 騎士 (CLAUDE.md hard rule: never 馬)
    expect(describeMove(START, 'g1f3')).toEqual({ piece: '騎士', to: 'f3' })
  })
  it('test_describe_malformedUci_returnsNull', () => {
    expect(describeMove(START, 'zz')).toBeNull()
    expect(describeMove(START, null)).toBeNull()
  })
})

describe('momentTone — OQ-R1: bare anchor in a loss is a neutral turning point, not a star', () => {
  it('test_tone_tactical', () => {
    expect(momentTone(moment({ kind: 'tactical', concept: 'material', cp: 290 }), false)).toBe('tactical')
  })
  it('test_tone_genuineBright_isStarSuccess', () => {
    // fav >= MEMORY_BRIGHT_GATE (120) → a real recovery → celebratory bright
    expect(momentTone(moment({ kind: 'bright', fav: 200, anchor: false }), true)).toBe('bright')
  })
  it('test_tone_bareAnchorSwingAgainstPlayer_isTurningPoint_notStar', () => {
    // selection collapses the anchor into kind='bright', but a swing AGAINST the player has low/neg
    // fav → OQ-R1 neutral turning point, NOT the star/success of a genuine recovery.
    expect(momentTone(moment({ kind: 'bright', anchor: true, cp: 300, fav: Number.NEGATIVE_INFINITY }), false))
      .toBe('turning-point')
  })
  it('test_tone_plain', () => {
    expect(momentTone(moment({ kind: 'plain', cp: 70 }), false)).toBe('plain')
  })
})

describe('momentTone — 玩家走了最佳手時不得套用失誤語氣', () => {
  it('test_tone_own_tactical_isBestAnyway_notTactical', () => {
    // 被迫的局面：最佳手仍然失分，但那不是這一手的問題——不能拿失誤標題指控一手正確的走法
    expect(momentTone(moment({ kind: 'tactical', concept: 'material', cp: 290 }), true)).toBe('best-anyway')
  })
  it('test_tone_own_plain_isBestAnyway', () => {
    expect(momentTone(moment({ kind: 'plain', cp: 70 }), true)).toBe('best-anyway')
  })
  it('test_tone_own_favBelowGate_isBestAnyway_notBright', () => {
    expect(momentTone(moment({ kind: 'bright', fav: 10 }), true)).toBe('best-anyway')
  })
  it('test_tone_notOwn_favAboveGate_isBright_notDowngraded', () => {
    // 走得好、但不是引擎最佳手：仍是真正的好轉，標題與內文都該一致地稱讚
    expect(momentTone(moment({ kind: 'bright', fav: 200 }), false)).toBe('bright')
  })
})

describe('momentShortName — plain headline per tone (no engine-taxonomy label)', () => {
  it('test_shortName_perTone', () => {
    expect(momentShortName('tactical', 'material')).toBe('漏掉一個子')
    expect(momentShortName('tactical', 'mate')).toBe('差點被將死')
    expect(momentShortName('bright', 'none')).toBe('你穩住了自己')
    expect(momentShortName('turning-point', 'none')).toBe('這盤的轉折')
    expect(momentShortName('best-anyway', 'none')).toBe('已經是最好的一手')
    expect(momentShortName('plain', 'none')).toBe('被推著走的一段')
  })
})
