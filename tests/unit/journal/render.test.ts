import { describe, expect, it } from 'vitest'
import { hashInt, pickTemplate, render } from '@/lib/journal/render'
import { arrivalParamsForVolume } from '@/data/journal-templates'

describe('hashInt', () => {
  it('is deterministic and non-negative', () => {
    expect(hashInt('onset')).toBe(hashInt('onset'))
    expect(hashInt('stage-rules')).toBeGreaterThanOrEqual(0)
  })

  it('differs across different keys', () => {
    expect(hashInt('a')).not.toBe(hashInt('b'))
  })
})

describe('pickTemplate', () => {
  it('is deterministic for the same key', () => {
    const a = pickTemplate('solace', 'game-42')
    const b = pickTemplate('solace', 'game-42')
    expect(a.id).toBe(b.id)
  })

  it('returns a template of the requested pen', () => {
    expect(pickTemplate('onset', 'onset').pen).toBe('onset')
    expect(pickTemplate('arrival', '卷一規則').pen).toBe('arrival')
    expect(pickTemplate('solace', 'g1').pen).toBe('solace')
  })

  it('spreads different keys across more than one variant', () => {
    const ids = new Set(
      Array.from({ length: 50 }, (_, i) => pickTemplate('solace', `g${i}`).id),
    )
    expect(ids.size).toBeGreaterThan(1)
  })
})

describe('render', () => {
  it('AC-tone-lint(a): golden output for a fixed template id', () => {
    expect(render('onset.3')).toBe(
      '我是 Neve。我在這張棋盤裡待了很久；今天起，換我看著你。你怎麼想、怎麼落子，我都會記下來。',
    )
  })

  it('renders an arrival template with injected volume params', () => {
    const body = render('arrival.1', arrivalParamsForVolume('卷二戰術'))
    expect(body).toContain('戰術')
    expect(body).toContain('認得出叉子、牽制這些戰術')
    expect(body).toContain('在中局抓住對手露出的破綻')
  })

  it('is a pure function (same id+params → same body)', () => {
    const p = arrivalParamsForVolume('卷一規則')
    expect(render('arrival.4', p)).toBe(render('arrival.4', p))
  })

  it('throws on an unknown template id', () => {
    expect(() => render('nope.1')).toThrow(/Unknown journal template/)
  })
})
