import { describe, it, expect } from 'vitest'
import { lintNeve, MEMORY_BANNED_TOKENS } from '@/modules/memory/persona-lint'
import { renderMoment } from '@/modules/memory/templates'
import { momentShortName, type MomentTone } from '@/modules/memory/describe'
import type { Moment } from '@/types/memory'

describe('lintNeve (AC-11b)', () => {
  it('clean 回顧態 text → no violations', () => {
    expect(lintNeve('你把兵推到 d3，奪回主導權。')).toEqual([])
  })

  it('flags each 棋憶 banned token (no intent / shame / reflexive praise)', () => {
    for (const t of MEMORY_BANNED_TOKENS) {
      expect(lintNeve(`句首 ${t} 句尾`)).toContain(`banned:${t}`)
    }
  })

  it('flags xiangqi piece terms (車/馬/象) via the shared house rule', () => {
    expect(lintNeve('你的車守住了底線').length).toBeGreaterThan(0)
    expect(lintNeve('騎士跳出').length).toBe(0) // 騎士 is the correct chess term — clean
  })

  it('flags emoji via the shared house rule', () => {
    expect(lintNeve('守得很好 👍')).toContain('emoji')
  })
})

/**
 * lintNeve 一直只有自己的測試在用，沒有任何產品呼叫點——等於實際渲染給玩家看的句子從來沒過 lint
 * （2026-08-08 發現）。這組把 F3 模板與短名的**每一個分支**的真實輸出都餵進去，讓 lint 至少在
 * 測試層真的把關；日後改文案改壞（誤用象棋術語、混進評判詞）會在這裡紅。
 */
describe('渲染出來的每一句 Neve 文案都要過 lint', () => {
  const played = { piece: '騎士', to: 'd2' }
  const best = { piece: '主教', to: 'g5' }
  const capture = { piece: '后', to: 'f7', captured: '兵' }
  const promotion = { piece: '兵', to: 'e8', promotion: '后' }
  const castle = { piece: '國王', to: 'g1', castle: 'short' } as const
  const enPassant = { piece: '兵', to: 'f6', captured: '兵', enPassant: true }

  const SENTENCES = {
    'tactical/material（接上 hanging-piece 判定後）': renderMoment({
      tone: 'tactical', concept: 'material', played, best, hungPiece: '后', hungSquare: 'f7',
    }),
    'tactical/material（子是玩家自己送過去的，落點＝被吃格）': renderMoment({
      tone: 'tactical', concept: 'material', played: capture, best, hungPiece: '后', hungSquare: 'f7',
    }),
    'tactical/material（判定未接，首句省略）': renderMoment({
      tone: 'tactical', concept: 'material', played, best,
    }),
    '吃子的走法片語': renderMoment({ tone: 'plain', played: capture, best }),
    '升變的走法片語': renderMoment({ tone: 'plain', played: promotion, best }),
    '易位的走法片語': renderMoment({ tone: 'bright', played: castle }),
    '吃過路兵的走法片語': renderMoment({ tone: 'plain', played: enPassant, best }),
    'tactical/mate': renderMoment({ tone: 'tactical', concept: 'mate', played, best }),
    'tactical/none（分類器沒給概念）': renderMoment({
      tone: 'tactical', concept: 'none', played, best,
    }),
    bright: renderMoment({ tone: 'bright', played }),
    'best-anyway（玩家走了最佳手）': renderMoment({ tone: 'best-anyway', played }),
    'turning-point': renderMoment({ tone: 'turning-point', played, best }),
    plain: renderMoment({ tone: 'plain', played, best }),
  }

  for (const [name, text] of Object.entries(SENTENCES)) {
    it(`renderMoment — ${name}`, () => {
      expect(lintNeve(text)).toEqual([])
    })
  }

  const SHORT_NAMES: Array<[MomentTone, Moment['concept']]> = [
    ['tactical', 'mate'],
    ['tactical', 'material'],
    ['bright', 'none'],
    ['turning-point', 'none'],
    ['best-anyway', 'none'],
    ['plain', 'none'],
  ]

  for (const [tone, concept] of SHORT_NAMES) {
    it(`momentShortName — ${tone}/${concept}`, () => {
      expect(lintNeve(momentShortName(tone, concept))).toEqual([])
    })
  }

  // 點名子力的短名也要過 lint：象棋術語（車/馬/象）最容易從這裡漏出去。
  for (const piece of ['后', '城堡', '騎士', '主教', '兵']) {
    it(`momentShortName — tactical/material 點名「${piece}」`, () => {
      expect(lintNeve(momentShortName('tactical', 'material', piece))).toEqual([])
    })
  }
})
