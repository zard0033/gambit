// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, computed, ref } from 'vue'
import KeyMomentsCard from '@/components/memory/KeyMomentsCard.vue'
import { MEMORY_CONTEXT, type MemoryContext } from '@/components/memory/memory-context'
import type { StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'
import type { Moment } from '@/types/memory'

// chessground 在 happy-dom 起不來；這裡驗的是清單與選取，棋盤只需接得住 props。
vi.mock('@/components/chess-board.vue', () => ({
  default: defineComponent({
    name: 'ChessBoard',
    props: ['fen', 'playerColor', 'disabled', 'coordinates', 'lastMove'],
    setup: () => () => null,
  }),
}))

// game 的 fixture 只給 moves／playerColor —— 元件讀得到的就這兩個欄位，補齊 CompletedGame 其餘
// 六欄只是替斷言加噪音，所以走 unknown 轉型（同 KeyMomentsCard 對 analysisResults 的作法）。
function entry(bestMove: string): StoredAnalysisEntry {
  return { bestMove, evalCp: 0, depthReached: 16, pv: [], pass: 'deep' }
}
function moment(ply: number): Moment {
  return { ply, kind: 'plain', anchor: false, concept: 'none', cp: 100, fav: -Infinity }
}

/** 白方對局：ply0 玩家走 a2a3 但引擎要 e2e4（engine）；ply2 玩家走的就是最佳手（own）。 */
function mountCard(moves = ['a2a3', 'e7e5', 'g1f3'], bests = ['e2e4', 'd2d4', 'g1f3']): VueWrapper {
  const ctx: MemoryContext = {
    review: {
      analysisResults: computed(() => bests.map(entry)),
    } as unknown as MemoryContext['review'],
    game: computed(() => ({ moves, playerColor: 'white' })) as unknown as MemoryContext['game'],
    moments: computed(() => [moment(0), moment(2)]),
    opening: computed(() => null),
  }
  return mount(KeyMomentsCard, { global: { provide: { [MEMORY_CONTEXT as symbol]: ctx } } })
}

describe('KeyMomentsCard', () => {
  it('每個 moment 渲染一列，帶手數與 SAN 棋譜', () => {
    // Arrange / Act
    const w = mountCard()

    // Assert
    const rows = w.findAll('li button')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('第 1 手')
    expect(rows[0].text()).toContain('e4') // 引擎建議 e2e4 → SAN e4
    expect(rows[1].text()).toContain('第 2 手')
    expect(rows[1].text()).toContain('Nf3') // 玩家走的 g1f3 → SAN Nf3
  })

  it('依玩家有沒有走到最佳手標示來源', () => {
    // Arrange / Act
    const w = mountCard()

    // Assert
    const rows = w.findAll('li button')
    expect(rows[0].text()).toContain('更好的') // a2a3 ≠ e2e4
    expect(rows[1].text()).toContain('你走的') // g1f3 === g1f3
  })

  it('預設選第一項，點另一項後棋盤換到該局面', async () => {
    // Arrange
    const w = mountCard()
    const board = w.findComponent({ name: 'ChessBoard' })
    const firstFen = board.props('fen')

    // Act
    await w.findAll('li button')[1].trigger('click')

    // Assert
    expect(w.findAll('li button')[1].attributes('aria-current')).toBe('true')
    expect(board.props('fen')).not.toBe(firstFen)
    expect(board.props('lastMove')).toEqual(['g1', 'f3'])
  })

  it('棋盤唯讀，且朝向跟隨玩家執子色', () => {
    // Arrange / Act
    const board = mountCard().findComponent({ name: 'ChessBoard' })

    // Assert
    expect(board.props('disabled')).toBe(true)
    expect(board.props('playerColor')).toBe('white')
  })

  it('不出現任何評價性文字（GDD Rule 11/12）', () => {
    // Arrange / Act
    const text = mountCard().text()

    // Assert
    for (const word of ['失誤', '好棋', '錯誤', '恭喜', '做得好', 'blunder']) {
      expect(text).not.toContain(word)
    }
  })

  it('沒有可顯示的項目時整塊不渲染', () => {
    // Arrange — moments 指向缺分析的 ply
    const ctx: MemoryContext = {
      review: { analysisResults: computed(() => [null, null, null]) } as unknown as MemoryContext['review'],
      game: computed(() => ({ moves: ['a2a3'], playerColor: 'white' })) as unknown as MemoryContext['game'],
      moments: computed(() => [moment(0)]),
      opening: computed(() => null),
    }

    // Act
    const w = mount(KeyMomentsCard, { global: { provide: { [MEMORY_CONTEXT as symbol]: ctx } } })

    // Assert
    expect(w.find('[data-testid="key-moments"]').exists()).toBe(false)
  })

  it('清單縮短後越界的選取落回第一項，不渲染空殼', async () => {
    // Arrange — 先選到第二項
    const moments = ref<Moment[]>([moment(0), moment(2)])
    const ctx: MemoryContext = {
      review: {
        analysisResults: computed(() => ['e2e4', 'd2d4', 'g1f3'].map(entry)),
      } as unknown as MemoryContext['review'],
      game: computed(() => ({ moves: ['a2a3', 'e7e5', 'g1f3'], playerColor: 'white' })) as unknown as MemoryContext['game'],
      moments: computed(() => moments.value),
      opening: computed(() => null),
    }
    const w = mount(KeyMomentsCard, { global: { provide: { [MEMORY_CONTEXT as symbol]: ctx } } })
    await w.findAll('li button')[1].trigger('click')

    // Act — 清單縮到只剩一項
    moments.value = [moment(0)]
    await w.vm.$nextTick()

    // Assert
    const rows = w.findAll('li button')
    expect(rows).toHaveLength(1)
    expect(rows[0].attributes('aria-current')).toBe('true')
  })
})
