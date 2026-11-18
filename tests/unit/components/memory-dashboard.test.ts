// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, computed, inject, ref, nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import MemoryDashboard from '@/components/memory/MemoryDashboard.vue'
import { MEMORY_CONTEXT, type MemoryContext } from '@/components/memory/memory-context'
import type { CompletedGame } from '@/stores/game-store'

// 這裡驗的是「卡有沒有掛、拿到的 context 對不對」，不是卡的內容——分析中／完成／零狀態都由
// key-moments-card.test.ts 守。stub 把它注入到的 context 記下來，斷言卡看到的就是 dashboard 收到的那一份。
let seenCtx: MemoryContext | undefined
vi.mock('@/components/memory/KeyMomentsCard.vue', () => ({
  default: defineComponent({
    name: 'KeyMomentsCard',
    setup: () => {
      seenCtx = inject(MEMORY_CONTEXT)
      return () => null
    },
  }),
}))

const GAME = { moves: ['e2e4'], playerColor: 'white', completedAt: 1700000000000 } as unknown as CompletedGame

function makeCtx(game: CompletedGame | null, phase = 'COMPLETE') {
  const gameRef = ref<CompletedGame | null>(game)
  const ctx: MemoryContext = {
    review: { phase: computed(() => phase) } as unknown as MemoryContext['review'],
    game: computed(() => gameRef.value),
    moments: computed(() => []),
    opening: computed(() => null),
  }
  return { ctx, gameRef }
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  seenCtx = undefined
})

describe('MemoryDashboard — 只負責把卡放上去', () => {
  it('game 有值就掛卡，而且分析中也掛（同一個版面從分析中一路用到看完）', () => {
    // Arrange
    const { ctx } = makeCtx(GAME, 'ANALYZING')

    // Act
    const w = mount(MemoryDashboard, { global: { provide: { [MEMORY_CONTEXT as symbol]: ctx } } })

    // Assert
    expect(w.findComponent({ name: 'KeyMomentsCard' }).exists()).toBe(true)
    expect(seenCtx).toBe(ctx)
  })

  it('沒有 moment 的 steady game 一樣掛卡——零狀態由卡自己決定，不再換成 EmptyMemory', () => {
    // Arrange
    const { ctx } = makeCtx(GAME, 'COMPLETE')

    // Act
    const w = mount(MemoryDashboard, { global: { provide: { [MEMORY_CONTEXT as symbol]: ctx } } })

    // Assert
    expect(w.findComponent({ name: 'KeyMomentsCard' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'EmptyMemory' }).exists()).toBe(false)
  })

  it('game 還是 null（等 fetchHistory）時不掛卡，也就不會先建一個棋盤；載到之後才掛', async () => {
    // Arrange
    const { ctx, gameRef } = makeCtx(null, 'LOADING')
    const w = mount(MemoryDashboard, { global: { provide: { [MEMORY_CONTEXT as symbol]: ctx } } })
    expect(w.findComponent({ name: 'KeyMomentsCard' }).exists()).toBe(false)

    // Act
    gameRef.value = GAME
    await nextTick()

    // Assert
    expect(w.findComponent({ name: 'KeyMomentsCard' }).exists()).toBe(true)
  })
})
