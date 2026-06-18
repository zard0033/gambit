import { describe, it, expect, vi } from 'vitest'
import { renderNeveLine, renderMoment, type MomentText } from '@/modules/memory/templates'
import { lintNeve } from '@/lib/memory/persona-lint'

describe('renderNeveLine (F4)', () => {
  it('renders each signal kind, all 回顧態-lint-clean', () => {
    const lines = [
      renderNeveLine({ kind: 'improving', stage: 'endgame', n: 5 }),
      renderNeveLine({ kind: 'recurring', concept: 'material', n: 8 }),
      renderNeveLine({ kind: 'neutral', n: 6 }),
      renderNeveLine({ kind: 'first-or-few', n: 1 }),
    ]
    expect(lines[0]).toContain('殘局')
    expect(lines[0]).toContain('5')
    expect(lines[1]).toContain('子力安全')
    for (const l of lines) expect(lintNeve(l)).toEqual([])
  })
})

describe('renderMoment (F3)', () => {
  const cases: MomentText[] = [
    { kind: 'tactical', concept: 'material', played: { piece: '城堡', to: 'e1' }, best: { piece: '主教', to: 'd2' }, hungPiece: '主教', hungSquare: 'e5' },
    { kind: 'tactical', concept: 'mate', played: { piece: '兵', to: 'h3' }, best: { piece: '兵', to: 'g3' } },
    { kind: 'bright', concept: 'none', played: { piece: '兵', to: 'd3' } },
    { kind: 'plain', concept: 'none', played: { piece: '主教', to: 'g5' }, best: { piece: '騎士', to: 'f3' } },
  ]

  it('renders each kind+concept in plain language (no SAN), all lint-clean', () => {
    for (const c of cases) {
      const text = renderMoment(c)
      expect(text).toContain(c.played.piece)
      expect(text).toContain(c.played.to)
      if (c.best) {
        expect(text).toContain(c.best.piece)
        expect(text).toContain(c.best.to)
      }
      expect(lintNeve(text)).toEqual([])
    }
    // the bright moment names which piece moved where (Eason feedback)
    expect(renderMoment(cases[2])).toContain('把兵移到 d3')
  })

  it('AC-11b: rendering makes no network/API call', () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((() => {
      throw new Error('no network allowed in zero-AI render')
    }) as typeof fetch)
    renderNeveLine({ kind: 'neutral', n: 6 })
    for (const c of cases) renderMoment(c)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
