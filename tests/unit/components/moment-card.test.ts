// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MomentCard from '@/components/memory/MomentCard.vue'

// AC-10: the move comparison renders both halves at the SAME font-size, differentiated by color +
// weight + a leading word (color never the sole channel). Pixel-equal computed size is the e2e half;
// here we pin the structural contract: leading words, per-role colors, no per-span font-size override.

describe('MomentCard — move comparison (AC-10 / EC-14)', () => {
  it('test_card_mistake_bothHalves_leadingWords_andRoleColors', () => {
    const wrapper = mount(MomentCard, {
      props: {
        visualKind: 'tactical',
        shortName: '漏掉一個子',
        swingText: '−2.9',
        played: { piece: '主教', to: 'g5' },
        best: { piece: '主教', to: 'f7' },
        neveText: '…',
      },
    })
    const played = wrapper.find('[data-testid="cmp-played"]')
    const better = wrapper.find('[data-testid="cmp-better"]')
    expect(played.exists()).toBe(true)
    expect(better.exists()).toBe(true)
    // leading words (the non-color channel)
    expect(played.text()).toContain('你走了')
    expect(better.text()).toContain('更好的是')
    // per-role color: played muted, better the sanctioned gold text token (NOT the reward fill)
    expect(played.attributes('style')).toContain('var(--color-ink-muted)')
    expect(better.attributes('style')).toContain('var(--color-gold-dark)')
    // same font-size: neither span overrides it (both inherit the one text-[15px] container)
    expect(played.attributes('style') ?? '').not.toContain('font-size')
    expect(better.attributes('style') ?? '').not.toContain('font-size')
    // the good-move single-line variant is absent for a mistake
    expect(wrapper.find('[data-testid="cmp-good"]').exists()).toBe(false)
  })

  it('test_card_goodMove_singleLine_greenWithThisMoveWasGood', () => {
    const wrapper = mount(MomentCard, {
      props: {
        visualKind: 'bright',
        shortName: '你穩住了自己',
        swingText: '+1.4',
        played: { piece: '兵', to: 'd3' },
        best: null,
        neveText: '…',
      },
    })
    const good = wrapper.find('[data-testid="cmp-good"]')
    expect(good.exists()).toBe(true)
    expect(good.text()).toContain('你走了')
    expect(good.text()).toContain('這手很好')
    expect(good.attributes('style')).toContain('var(--color-success-dark)')
    expect(wrapper.find('[data-testid="cmp-played"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cmp-better"]').exists()).toBe(false)
  })
})
