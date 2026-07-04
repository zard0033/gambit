import { describe, it, expect } from 'vitest'
import { shouldSwipe } from '@/components/lesson/RecognitionGate.vue'

// D2b: pure extraction of onBubbleTouchEnd's swipe-direction decision. dx<0 (finger moves left) →
// 'next' (advance the carousel); dx>0 → 'prev'. Threshold: |dx| must exceed 48px AND exceed |dy|.

describe('RecognitionGate shouldSwipe', () => {
  it('test_shouldSwipe_atThreshold48_doesNotTrigger', () => {
    expect(shouldSwipe(48, 0)).toBeNull()
    expect(shouldSwipe(-48, 0)).toBeNull()
  })

  it('test_shouldSwipe_justOverThreshold49_triggers', () => {
    expect(shouldSwipe(49, 0)).toBe('prev')
    expect(shouldSwipe(-49, 0)).toBe('next')
  })

  it('test_shouldSwipe_verticalDominant_doesNotTrigger', () => {
    expect(shouldSwipe(60, 61)).toBeNull()
    expect(shouldSwipe(-60, -61)).toBeNull()
  })

  it('test_shouldSwipe_positiveDx_isPrev', () => {
    expect(shouldSwipe(100, 0)).toBe('prev')
  })

  it('test_shouldSwipe_negativeDx_isNext', () => {
    expect(shouldSwipe(-100, 0)).toBe('next')
  })
})
