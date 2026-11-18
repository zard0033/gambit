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

  it('test_count_mode_is_default_and_shows_value_over_total', () => {
    const wrapper = mount(ProgressBar, { props: { value: 3, total: 12 } })
    expect(wrapper.get('[data-testid="progress-readout"]').text()).toBe('3/12')
  })

  it('test_percent_mode_shows_rounded_percentage', () => {
    const wrapper = mount(ProgressBar, { props: { value: 2, total: 3, mode: 'percent' } })
    expect(wrapper.get('[data-testid="progress-readout"]').text()).toBe('67%')
    expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toBe('進度 67%')
    expect(wrapper.get('.bg-primary').attributes('style')).toContain('scaleX(0.67)')
  })
})
