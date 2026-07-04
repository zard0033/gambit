// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MoveAnnotationDisplay from '@/components/move-annotation-display.vue'
import type { Annotation } from '@/modules/move-annotation/annotation-types'
import type { Rect } from '@/utils/board-geometry'

// D2e: the keySquare highlight path was previously zero-tested. Covers the highlight render
// surface: roles → coloured overlay rects, keySquare additionally → opaque inset ring
// (.key-square-ring), arrows emit no highlight rects. The only <rect> nodes the SVG emits are
// highlights (defs → <marker>/<path>, arrows → <line>, eval bar only when evaluation !== null),
// so findAll('rect') isolates highlights.

const fakeSquareToRect = (): Rect => ({ x: 0, y: 0, width: 64, height: 64 })

function mountWithAnnotations(annotations: Annotation[]) {
  return mount(MoveAnnotationDisplay, {
    props: {
      annotations,
      evaluation: null,
      squareToRect: fakeSquareToRect,
      boardRef: null,
      boardSizePx: 512,
    },
  })
}

describe('MoveAnnotationDisplay — highlight rendering', () => {
  it('test_keySquareHighlight_rendersAmberOverlayRect', () => {
    const wrapper = mountWithAnnotations([
      { kind: 'highlight', role: 'keySquare', square: 'e4' },
    ])
    const rects = wrapper.findAll('rect')
    expect(rects.length).toBeGreaterThan(0)
    expect(rects.some(r => r.attributes('fill') === '#c4882a')).toBe(true)
  })

  it('test_playedMoveHighlight_usesNeutralGrayColor', () => {
    const wrapper = mountWithAnnotations([
      { kind: 'highlight', role: 'playedMove', square: 'e4' },
    ])
    const rects = wrapper.findAll('rect')
    expect(rects.length).toBeGreaterThan(0)
    expect(rects.some(r => r.attributes('fill') === '#888888')).toBe(true)
  })

  it('test_keySquareHighlight_rendersInsetRing', () => {
    const wrapper = mountWithAnnotations([
      { kind: 'highlight', role: 'keySquare', square: 'e4' },
    ])
    const ring = wrapper.find('rect.key-square-ring')
    expect(ring.exists()).toBe(true)
    expect(ring.attributes('fill')).toBe('none')
    expect(ring.attributes('stroke')).toBe('#c4882a')
    expect(Number(ring.attributes('stroke-width'))).toBeGreaterThanOrEqual(2)
  })

  it('test_playedMoveHighlight_rendersNoRing', () => {
    const wrapper = mountWithAnnotations([
      { kind: 'highlight', role: 'playedMove', square: 'e4' },
    ])
    expect(wrapper.find('rect.key-square-ring').exists()).toBe(false)
  })

  it('test_arrowAnnotation_emitsNoHighlightRect', () => {
    const wrapper = mountWithAnnotations([
      { kind: 'arrow', role: 'keySquare', from: 'e4', to: 'e5' },
    ])
    expect(wrapper.findAll('rect').length).toBe(0)
  })

  it('test_noAnnotations_emitsNoHighlightRect', () => {
    const wrapper = mountWithAnnotations([])
    expect(wrapper.findAll('rect').length).toBe(0)
  })
})
