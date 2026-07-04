// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressBar from '@/components/ui/gambit/progress-bar.vue'

describe('ProgressBar', () => {
  it('test_pct_clamps_to_100_when_value_exceeds_total', () => {
    const wrapper = mount(ProgressBar, { props: { value: 20, total: 18 } })
    const track = wrapper.find('[role="progressbar"]')
    expect(track.attributes('aria-valuenow')).toBe('100')
    expect(track.attributes('aria-valuemin')).toBe('0')
    expect(track.attributes('aria-valuemax')).toBe('100')

    const fill = wrapper.find('.bg-primary')
    expect(fill.attributes('style')).toContain('scaleX(1)')
  })
})
