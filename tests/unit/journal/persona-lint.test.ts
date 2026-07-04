import { describe, expect, it } from 'vitest'
import { lintBody } from '@/lib/persona-lint'
import { lintEntryBody } from '@/modules/journal/persona-lint'

describe('lintBody — always-on rules', () => {
  it('passes clean Neve text', () => {
    expect(lintBody('你來了。我把這一刻記下來。')).toEqual([])
  })

  it('flags emoji', () => {
    expect(lintBody('你來了 🎉')).toContain('emoji')
  })

  it('flags xiangqi piece terms (車/馬/象)', () => {
    expect(lintBody('走車')).toContain('xiangqi:車')
    expect(lintBody('跳馬')).toContain('xiangqi:馬')
    expect(lintBody('飛象')).toContain('xiangqi:象')
  })

  it('does NOT flag chess piece terms (后/城堡/騎士/主教/國王/兵)', () => {
    expect(lintBody('騎士跳到了主教旁邊，后看著國王。')).toEqual([])
  })
})

describe('lintBody — solace-only rules', () => {
  it('flags blame/error tokens only in solace mode', () => {
    expect(lintBody('你走錯了', { solace: true })).toContain('blame:錯')
    expect(lintBody('你走錯了', { solace: false })).not.toContain('blame:錯')
  })

  it('flags digits only in solace mode', () => {
    expect(lintBody('你輸了 3 盤', { solace: true })).toContain('digit')
    expect(lintBody('開局的前 10 步', { solace: false })).not.toContain('digit')
  })

  it('passes a gentle solace line', () => {
    expect(lintBody('慢慢來，等你想回來，我都在。', { solace: true })).toEqual([])
  })
})

describe('lintEntryBody — pen-aware wrapper', () => {
  it('applies solace rules for solace pen', () => {
    expect(lintEntryBody('可惜', 'solace')).toContain('blame:可惜')
  })

  it('does not apply solace rules for non-solace pens', () => {
    expect(lintEntryBody('可惜', 'arrival')).not.toContain('blame:可惜')
  })
})
