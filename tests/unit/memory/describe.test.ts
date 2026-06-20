import { describe, it, expect } from 'vitest'
import { describeMove, momentVisualKind, momentShortName } from '@/modules/memory/describe'
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

describe('momentVisualKind — OQ-R1: bare anchor in a loss is a neutral turning point, not a star', () => {
  it('test_visualKind_tactical', () => {
    expect(momentVisualKind(moment({ kind: 'tactical', concept: 'material', cp: 290 }))).toBe('tactical')
  })
  it('test_visualKind_genuineBright_isStarSuccess', () => {
    // fav >= MEMORY_BRIGHT_GATE (120) → a real recovery → celebratory bright
    expect(momentVisualKind(moment({ kind: 'bright', fav: 200, anchor: false }))).toBe('bright')
  })
  it('test_visualKind_bareAnchorSwingAgainstPlayer_isTurningPoint_notStar', () => {
    // selection collapses the anchor into kind='bright', but a swing AGAINST the player has low/neg
    // fav → OQ-R1 neutral turning point, NOT the star/success of a genuine recovery.
    expect(momentVisualKind(moment({ kind: 'bright', anchor: true, cp: 300, fav: Number.NEGATIVE_INFINITY })))
      .toBe('turning-point')
  })
  it('test_visualKind_plain', () => {
    expect(momentVisualKind(moment({ kind: 'plain', cp: 70 }))).toBe('plain')
  })
})

describe('momentShortName — plain headline per kind (no engine-taxonomy label)', () => {
  it('test_shortName_perKind', () => {
    expect(momentShortName(moment({ kind: 'tactical', concept: 'material' }))).toBe('漏掉一個子')
    expect(momentShortName(moment({ kind: 'tactical', concept: 'mate' }))).toBe('差點被將死')
    expect(momentShortName(moment({ kind: 'bright', fav: 200 }))).toBe('你穩住了自己')
    expect(momentShortName(moment({ kind: 'bright', anchor: true, fav: Number.NEGATIVE_INFINITY }))).toBe('這盤的轉折')
    expect(momentShortName(moment({ kind: 'plain', cp: 70 }))).toBe('被推著走的一段')
  })
})
