// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EvalShapeChart from '@/components/memory/EvalShapeChart.vue'
import ReplayEvalChart from '@/components/memory/ReplayEvalChart.vue'
import type { Moment } from '@/types/memory'

function moment(p: Partial<Moment>): Moment {
  return { ply: 0, kind: 'plain', anchor: false, concept: 'none', cp: 0, fav: Number.NEGATIVE_INFINITY, ...p }
}

describe('EvalShapeChart (story-007) — self-drawn SVG, dots, drift-guard (EC-12 / AC-7)', () => {
  const series = [10, -20, 50, null, 100]
  const moments = [moment({ ply: 2, kind: 'tactical', concept: 'material', cp: 200 })]

  it('test_chart_isAButton_withTwoDoorLabel', () => {
    const w = mount(EvalShapeChart, { props: { series, moments, anchorPly: 2 } })
    const btn = w.find('button')
    expect(btn.exists()).toBe(true)
    // the destination is signalled before the tap (EC-13 two doors) + AT label
    expect(btn.attributes('aria-label')).toContain('逐手覆盤')
    // a moment dot is drawn (redundant color cue), and it is NOT a tap target
    const dot = w.find('circle')
    expect(dot.exists()).toBe(true)
    expect(dot.attributes('style') ?? '').toContain('pointer-events: none')
  })

  it('test_chart_keyboardOrCleanTap_opensReplayAtAnchorPly', async () => {
    const w = mount(EvalShapeChart, { props: { series, moments, anchorPly: 2 } })
    const btn = w.find('button')
    // a clean tap (no drift) opens replay at the anchor ply
    await btn.trigger('pointerdown', { clientX: 0, clientY: 0 })
    await btn.trigger('click')
    expect(w.emitted('open')?.[0]).toEqual([2])
  })

  it('test_chart_driftBeyondThreshold_isScrollNotTap_noNav', async () => {
    const w = mount(EvalShapeChart, { props: { series, moments, anchorPly: 2 } })
    const btn = w.find('button')
    await btn.trigger('pointerdown', { clientX: 0, clientY: 0 })
    await btn.trigger('pointermove', { clientX: 50, clientY: 0 }) // > 10px drift = scroll
    await btn.trigger('click')
    expect(w.emitted('open')).toBeUndefined()
  })
})

describe('ReplayEvalChart (story-009) — gold cursor + anchor tick, gaps break the line', () => {
  it('test_replayChart_drawsCursorAndAnchor_andBreaksOnNull', () => {
    // two runs of ≥2 points either side of the null gap → two polyline segments
    const w = mount(ReplayEvalChart, { props: { series: [10, -20, 50, null, 100, 80], cursor: 2, anchorPly: 2 } })
    const accentLines = w.findAll('line').filter((l) => (l.attributes('stroke') ?? '').includes('--color-accent'))
    // a gold cursor line + a gold anchor tick (both use var(--accent))
    expect(accentLines.length).toBeGreaterThanOrEqual(2)
    // the null at index 3 splits the curve into two polyline segments
    expect(w.findAll('polyline').length).toBe(2)
  })
})
