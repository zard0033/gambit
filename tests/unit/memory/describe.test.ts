import { describe, it, expect } from 'vitest'
import { describeMove, movePhrase, momentTone, momentShortName } from '@/modules/memory/describe'
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
  it('test_describe_uppercasePromotionSuffix_stillDescribed', () => {
    // `a7a8Q` === `a7a8q`；chess.js 的 move() 只收小寫，不正規化就會把整格靜默丟掉。
    expect(describeMove('8/P7/8/8/8/8/8/K6k w - - 0 1', 'a7a8Q')).toEqual({
      piece: '兵', to: 'a8', promotion: '后',
    })
  })
  it('test_describe_illegalButWellFormedUci_returnsNull', () => {
    // `.move()` gates on legality now; `.get(from)` used to happily describe a move that can't be made.
    expect(describeMove(START, 'e2e5')).toBeNull()
  })
})

/**
 * 走法白話文原本只講 piece + to，於是吃子的一手被說成「把后移到 f7」——把整手棋的重點（吃掉了
 * f7 的兵）藏起來，2026-08-08 precommit-review 列為最影響理解的一條。
 */
describe('movePhrase — 吃子／升變／易位不能被說成單純的移動', () => {
  const phrase = (fen: string, uci: string) => movePhrase(describeMove(fen, uci)!)

  it('test_phrase_quietMove_saysMovedTo', () => {
    expect(phrase(START, 'e2e4')).toBe('把兵移到 e4')
  })
  it('test_phrase_capture_namesVictimAndSquare', () => {
    const fen = 'rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3'
    expect(phrase(fen, 'f3e5')).toBe('用騎士吃掉 e5 的兵')
  })
  it('test_phrase_castling_neverSaysKingMovedTwoSquares', () => {
    const fen = 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'
    expect(phrase(fen, 'e1g1')).toBe('做短易位')
    const long = 'r3kbnr/pppq1ppp/2np4/4p3/4P1b1/2NP1N2/PPPBQPPP/R3KB1R w KQkq - 6 7'
    expect(phrase(long, 'e1c1')).toBe('做長易位')
  })
  it('test_phrase_promotion_namesTheNewPiece', () => {
    expect(phrase('8/4P3/8/8/8/8/8/K6k w - - 0 1', 'e7e8q')).toBe('把兵移到 e8 升變成后')
    expect(phrase('5r2/4P3/8/8/8/8/8/K6k w - - 0 1', 'e7f8q')).toBe('用兵吃掉 f8 的城堡升變成后')
  })
  it('test_phrase_enPassant_namesNoSquare_becauseVictimIsNotThere', () => {
    // 過路兵被吃時不在落點上；照一般吃子模板講會指到一個空格。
    const fen = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3'
    expect(phrase(fen, 'e5f6')).toBe('用兵吃過路兵')
  })
  it('test_phrase_hasNoComma_soItCanBeEmbeddedMidSentence', () => {
    // 片語會被塞進「與其X，不如先Y。」中間——自帶逗號會把句子斷成兩截。
    const fens: Array<[string, string]> = [
      [START, 'e2e4'],
      ['5r2/4P3/8/8/8/8/8/K6k w - - 0 1', 'e7f8q'],
      ['rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', 'e1g1'],
    ]
    for (const [fen, uci] of fens) expect(phrase(fen, uci)).not.toMatch(/[，,。]/)
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
    // hanging-piece 判定接上後才點得出是哪顆子；給不出來仍退回籠統版（prefer-silence）。
    expect(momentShortName('tactical', 'material', '后')).toBe('后沒人守著')
    expect(momentShortName('tactical', 'mate')).toBe('差點被將死')
    expect(momentShortName('bright', 'none')).toBe('你穩住了自己')
    expect(momentShortName('turning-point', 'none')).toBe('這盤的轉折')
    expect(momentShortName('best-anyway', 'none')).toBe('已經是最好的一手')
    expect(momentShortName('plain', 'none')).toBe('被推著走的一段')
  })
})
