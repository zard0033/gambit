// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import TaskTopRow from '@/components/ui/gambit/task-top-row.vue'
import WoodFrame from '@/components/ui/gambit/wood-frame.vue'
import NeveNameTag from '@/components/ui/gambit/neve-name-tag.vue'
import NeveDialog from '@/components/ui/gambit/neve-dialog.vue'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TaskTopRow', () => {
  it('test_title_renders_as_focusable_h1_with_subtitle', () => {
    const w = mount(TaskTopRow, { props: { title: '棋憶', subtitle: '11 月 16 日 · 執白 · 對 初學' } })
    const h1 = w.get('h1')
    expect(h1.text()).toBe('棋憶')
    expect(h1.attributes('tabindex')).toBe('-1')
    expect(w.text()).toContain('11 月 16 日 · 執白 · 對 初學')
  })

  it('test_no_subtitle_renders_title_only', () => {
    const w = mount(TaskTopRow, { props: { title: '對局' } })
    expect(w.find('h1 + span').exists()).toBe(false)
  })

  it('test_back_emits_and_never_calls_history_back', async () => {
    const back = vi.spyOn(window.history, 'back')
    const w = mount(TaskTopRow, { props: { title: '對局' } })
    const btn = w.get('[data-testid="task-top-row-back"]')
    expect(btn.attributes('aria-label')).toBe('返回')
    expect(btn.classes()).toContain('size-11') // 44×44 觸控目標
    await btn.trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
    expect(back).not.toHaveBeenCalled()
  })

  it('test_action_slot_renders_only_when_given', () => {
    const without = mount(TaskTopRow, { props: { title: '棋憶' } })
    expect(without.find('[data-testid="act"]').exists()).toBe(false)
    const withAction = mount(TaskTopRow, {
      props: { title: '棋憶' },
      slots: { action: () => h('button', { 'data-testid': 'act' }, '棋譜') },
    })
    expect(withAction.get('[data-testid="act"]').text()).toBe('棋譜')
  })
})

describe('WoodFrame', () => {
  it('test_slot_sits_in_relative_board_fit_container', () => {
    const w = mount(WoodFrame, {
      props: { surface: 'deep' },
      slots: { default: () => h('div', { 'data-testid': 'board' }) },
    })
    const fit = w.get('.board-fit')
    expect(fit.classes()).toContain('relative')
    expect(fit.find('[data-testid="board"]').exists()).toBe(true)
    // 座標字畫在木框內距裡：四邊 ≥12px
    expect(w.get('[data-testid="wood-frame"]').classes()).toContain('p-3')
  })

  it.each([
    ['deep', 'shadow-wood-on-deep', 'shadow-wood-on-cream'],
    ['cream', 'shadow-wood-on-cream', 'shadow-wood-on-deep'],
  ] as const)('test_surface_%s_picks_its_shadow', (surface, has, hasNot) => {
    const cls = mount(WoodFrame, { props: { surface } }).get('[data-testid="wood-frame"]').classes()
    expect(cls).toContain(has)
    expect(cls).not.toContain(hasNot)
  })
})

describe('NeveNameTag', () => {
  it('test_shows_neve_with_avatar', () => {
    const w = mount(NeveNameTag)
    expect(w.get('[data-testid="neve-name"]').text()).toBe('Neve')
    expect(w.get('[data-testid="neve-name"]').classes()).toEqual(expect.arrayContaining(['font-sans', 'text-label']))
    expect(w.find('img').exists()).toBe(true)
  })

  it('test_deep_surface_uses_on_deep_ink', () => {
    const w = mount(NeveNameTag, { props: { surface: 'deep' } })
    expect(w.get('[data-testid="neve-name"]').classes()).toContain('text-ink-on-deep-dim')
  })
})

describe('NeveDialog', () => {
  it.each([
    ['light', ['bg-surface-card', 'border-line', 'shadow-card'], 'bg-surface-deep-2'],
    ['deep', ['bg-surface-deep-2', 'border-hairline-on-deep'], 'bg-surface-card'],
  ] as const)('test_tone_%s_classes', (tone, has, hasNot) => {
    const root = mount(NeveDialog, { props: { tone } }).get('[data-testid="neve-dialog"]')
    expect(root.classes()).toEqual(expect.arrayContaining([...has]))
    expect(root.classes()).not.toContain(hasNot)
    expect(root.attributes('aria-live')).toBe('polite')
  })

  it('test_default_slot_and_name_tag', () => {
    const w = mount(NeveDialog, {
      props: { tone: 'light' },
      slots: { default: () => h('p', { 'data-testid': 'say' }, '這一手值得回頭看。') },
    })
    expect(w.get('[data-testid="neve-name"]').text()).toBe('Neve')
    expect(w.get('[data-testid="say"]').text()).toBe('這一手值得回頭看。')
  })

  it('test_nav_slot_renders_only_when_given', () => {
    const without = mount(NeveDialog, { props: { tone: 'deep' } })
    expect(without.find('[data-testid="nav"]').exists()).toBe(false)
    const withNav = mount(NeveDialog, {
      props: { tone: 'deep' },
      slots: { nav: () => h('span', { 'data-testid': 'nav' }) },
    })
    expect(withNav.find('[data-testid="nav"]').exists()).toBe(true)
  })
})
