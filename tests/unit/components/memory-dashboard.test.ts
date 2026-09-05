// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, computed, nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import MemoryDashboard from '@/components/memory/MemoryDashboard.vue'
import { MEMORY_CONTEXT, type MemoryContext } from '@/components/memory/memory-context'
import { useRecognitionSourceStore } from '@/stores/recognition-source'
import type { Moment } from '@/types/memory'

// 這裡驗的是「哪張卡該出現」，不是卡的內容——棋盤那一層由 key-moments-card.test.ts 守。
vi.mock('@/components/memory/KeyMomentsCard.vue', () => ({
  default: defineComponent({ name: 'KeyMomentsCard', setup: () => () => null }),
}))

const MATE_FEN = '6k1/5ppp/8/8/8/8/5PPP/4Q1K1 w - - 0 1'

function mountDashboard(moments: Moment[]) {
  const ctx: MemoryContext = {
    review: { phase: computed(() => 'COMPLETE') } as unknown as MemoryContext['review'],
    game: computed(() => null) as unknown as MemoryContext['game'],
    moments: computed(() => moments),
    opening: computed(() => null),
  }
  return mount(MemoryDashboard, { global: { provide: { [MEMORY_CONTEXT as symbol]: ctx } } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('MemoryDashboard — 該出哪張卡', () => {
  it('沒有 moment 也沒有待解的將殺 → 空狀態', () => {
    // Arrange / Act
    const w = mountDashboard([])

    // Assert
    expect(w.findComponent({ name: 'EmptyMemory' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'KeyMomentsCard' }).exists()).toBe(false)
  })

  it('沒有 moment 但有待解的將殺 → 仍要出卡（那一格是 KeyMomentsCard 畫的）', () => {
    // Arrange
    useRecognitionSourceStore().captureMate('g1', 'white', [
      { ply: 8, fen: MATE_FEN, mateMoveUci: 'e1e8' },
    ])

    // Act
    const w = mountDashboard([])

    // Assert
    expect(w.findComponent({ name: 'KeyMomentsCard' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'EmptyMemory' }).exists()).toBe(false)
  })

  it('通關把題目消費掉之後，卡不會在成功的當下被空狀態換掉', async () => {
    // Arrange — steady game（零 moment），卡完全靠那題將殺撐著
    const source = useRecognitionSourceStore()
    source.captureMate('g1', 'white', [{ ply: 8, fen: MATE_FEN, mateMoveUci: 'e1e8' }])
    const w = mountDashboard([])

    // Act — 深青格通關時 KeyMomentsCard 會這樣做
    source.markConsumed(['g1:8'])
    await nextTick()

    // Assert — 亮出來就不收回，否則玩家走對的瞬間整張卡消失，通關那句話永遠來不及顯示
    expect(w.findComponent({ name: 'KeyMomentsCard' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'EmptyMemory' }).exists()).toBe(false)
  })
})
