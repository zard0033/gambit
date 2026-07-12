// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MomentSlideshowDoor from '@/components/memory/MomentSlideshowDoor.vue'

describe('MomentSlideshowDoor (失誤 slideshow 唯一入口)', () => {
  it('test_slideshowDoor_click_emitsOpen', () => {
    // Arrange
    const wrapper = mount(MomentSlideshowDoor)

    // Act
    wrapper.get('[data-testid="slideshow-door"]').trigger('click')

    // Assert
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('test_slideshowDoor_copy_isSecondPersonCalmWithoutForbiddenGlyphs', () => {
    // Arrange
    const wrapper = mount(MomentSlideshowDoor)

    // Act
    const text = wrapper.text()

    // Assert — 回顧態鐵則:無第一人稱主詞「我」、無 emoji、無象棋用字(車/馬/象)
    expect(text).toContain('值得再看一次')
    expect(text).not.toMatch(/我/)
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    expect(text).not.toMatch(/[車馬象]/)
  })
})
