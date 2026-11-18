// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ScoreSheet from '@/components/play/score-sheet.vue'
import ResultSeal from '@/components/play/result-seal.vue'
import NeveNameTag from '@/components/ui/gambit/neve-name-tag.vue'

const rowsOf = (w: ReturnType<typeof mount>) => w.findAll('[role="row"]')

describe('ScoreSheet', () => {
  it('test_scoreSheet_pairsMovesIntoNumberedRows', () => {
    const w = mount(ScoreSheet, { props: { moves: ['e4', 'e5', 'Nf3'] } })
    const rows = rowsOf(w)
    expect(rows).toHaveLength(2)
    expect(rows[0].findAll('span').map((s) => s.text())).toEqual(['1', 'e4', 'e5'])
    expect(rows[1].findAll('span').map((s) => s.text())).toEqual(['2', 'Nf3', ''])
  })

  it('test_scoreSheet_latestMarker_followsWhiteOrBlack', () => {
    const afterWhite = mount(ScoreSheet, { props: { moves: ['e4', 'e5', 'Nf3'] } })
    const markW = afterWhite.findAll('[data-testid="score-latest"]')
    expect(markW).toHaveLength(1)
    expect(markW[0].element.parentElement?.textContent?.trim()).toBe('Nf3')

    const afterBlack = mount(ScoreSheet, { props: { moves: ['e4', 'e5'] } })
    const markB = afterBlack.findAll('[data-testid="score-latest"]')
    expect(markB).toHaveLength(1)
    expect(markB[0].element.parentElement?.textContent?.trim()).toBe('e5')
    expect(markB[0].attributes('aria-label')).toBe('最新一手')
  })

  it('test_scoreSheet_highlightLastFalse_hasNoMarker', () => {
    const w = mount(ScoreSheet, { props: { moves: ['e4'], highlightLast: false } })
    expect(w.find('[data-testid="score-latest"]').exists()).toBe(false)
  })

  it('test_scoreSheet_maxRows_keepsOnlyLastRounds', () => {
    const moves = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? 'Nf3' : 'Nf6'))
    const w = mount(ScoreSheet, { props: { moves, maxRows: 4 } })
    expect(rowsOf(w).map((r) => r.find('[role="rowheader"]').text())).toEqual(['3', '4', '5', '6'])
  })

  it('test_scoreSheet_minRows_padsWithAriaHiddenBlanks', () => {
    const w = mount(ScoreSheet, { props: { moves: ['e4', 'e5', 'Nf3'], minRows: 6 } })
    const blanks = w.findAll('[data-testid="score-blank"]')
    expect(blanks).toHaveLength(4)
    expect(blanks.every((b) => b.attributes('aria-hidden') === 'true')).toBe(true)
  })

  it('test_scoreSheet_minRows_noBlanksWhenRowsExceed', () => {
    const moves = Array.from({ length: 20 }, () => 'Kh1')
    const w = mount(ScoreSheet, { props: { moves, minRows: 6 } })
    expect(w.findAll('[data-testid="score-blank"]')).toHaveLength(0)
  })

  it('test_scoreSheet_isLabelledTable', () => {
    const w = mount(ScoreSheet, { props: { moves: [] } })
    const t = w.get('[data-testid="score-sheet"]')
    expect(t.attributes('role')).toBe('table')
    expect(t.attributes('aria-label')).toBe('棋譜')
    expect(rowsOf(w)).toHaveLength(0)
  })
})

describe('ResultSeal', () => {
  it('test_resultSeal_win_usesGoldRingOnly', () => {
    const w = mount(ResultSeal, { props: { outcome: 'win', playerColor: 'black' } })
    expect(w.attributes('role')).toBe('img')
    expect(w.attributes('aria-label')).toBe('這一盤：你執黑，贏了')
    const [ring, , , king] = w.findAll('path')
    expect(ring.classes()).toContain('fill-gold')
    expect(king.classes()).toContain('fill-surface-deep')
  })

  it.each([
    ['loss', '這一盤：你執白，輸了'],
    ['draw', '這一盤：你執白，和局'],
  ] as const)('test_resultSeal_%s_usesInkRing', (outcome, label) => {
    const w = mount(ResultSeal, { props: { outcome, playerColor: 'white' } })
    expect(w.attributes('aria-label')).toBe(label)
    const [ring, , , king] = w.findAll('path')
    expect(ring.classes()).toContain('fill-ink')
    expect(ring.classes()).not.toContain('fill-gold')
    expect(king.classes()).toContain('fill-surface-raised')
  })
})

describe('NeveNameTag default slot', () => {
  it('test_neveNameTag_slot_stacksLineUnderName', () => {
    const w = mount(NeveNameTag, { props: { size: 'md' }, slots: { default: '<p>將殺成立了。</p>' } })
    expect(w.get('[data-testid="neve-name"]').text()).toBe('Neve')
    expect(w.text()).toContain('將殺成立了。')
    expect(w.get('[data-testid="neve-name"]').element.nextElementSibling?.textContent).toBe('將殺成立了。')
  })
})
