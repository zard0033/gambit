import { describe, it, expect } from 'vitest'
import { lintNeve, MEMORY_BANNED_TOKENS } from '@/modules/memory/persona-lint'

describe('lintNeve (AC-11b)', () => {
  it('clean 回顧態 text → no violations', () => {
    expect(lintNeve('你把兵推到 d3，奪回主導權。')).toEqual([])
  })

  it('flags each 棋憶 banned token (no intent / shame / reflexive praise)', () => {
    for (const t of MEMORY_BANNED_TOKENS) {
      expect(lintNeve(`句首 ${t} 句尾`)).toContain(`banned:${t}`)
    }
  })

  it('flags xiangqi piece terms (車/馬/象) via the shared house rule', () => {
    expect(lintNeve('你的車守住了底線').length).toBeGreaterThan(0)
    expect(lintNeve('騎士跳出').length).toBe(0) // 騎士 is the correct chess term — clean
  })

  it('flags emoji via the shared house rule', () => {
    expect(lintNeve('守得很好 👍')).toContain('emoji')
  })
})
