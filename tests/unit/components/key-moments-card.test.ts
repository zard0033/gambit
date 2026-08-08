// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, computed, ref } from 'vue'
import KeyMomentsCard from '@/components/memory/KeyMomentsCard.vue'
import { MEMORY_CONTEXT, type MemoryContext } from '@/components/memory/memory-context'
import type { StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'
import type { Moment } from '@/types/memory'

// chessground 在 happy-dom 起不來；這裡驗的是對話框與切換，棋盤只需接得住 props。
vi.mock('@/components/chess-board.vue', () => ({
  default: defineComponent({
    name: 'ChessBoard',
    props: ['fen', 'playerColor', 'disabled', 'coordinates'],
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
function mountCard(
  moves = ['a2a3', 'e7e5', 'g1f3'],
  bests = ['e2e4', 'd2d4', 'g1f3'],
  playerColor: 'white' | 'black' = 'white',
): VueWrapper {
  const ctx: MemoryContext = {
    review: {
      analysisResults: computed(() => bests.map(entry)),
    } as unknown as MemoryContext['review'],
    game: computed(() => ({ moves, playerColor })) as unknown as MemoryContext['game'],
    moments: computed(() => [moment(0), moment(2)]),
    opening: computed(() => null),
  }
  return mount(KeyMomentsCard, { global: { provide: { [MEMORY_CONTEXT as symbol]: ctx } } })
}

const nextBtn = (w: VueWrapper) => w.get('[aria-label="下一手"]')
const prevBtn = (w: VueWrapper) => w.get('[aria-label="上一手"]')

describe('KeyMomentsCard', () => {
  it('一次只顯示一格，段點數量等於 moment 數', () => {
    // Arrange / Act
    const w = mountCard()

    // Assert
    expect(w.get('[data-testid="moment-dots"]').findAll('span')).toHaveLength(2)
    expect(w.text()).toContain('第 1 手')
    expect(w.text()).not.toContain('第 2 手')
  })

  it('走法用白話文並排兩手，不出現 SAN 記號', () => {
    // Arrange / Act — ply0：玩家 a2a3、引擎 e2e4
    const w = mountCard()

    // Assert
    expect(w.get('[data-testid="moment-played"]').text()).toBe('你走了 把兵移到 a3')
    expect(w.get('[data-testid="moment-best"]').text()).toBe('更好的是 把兵移到 e4')
  })

  it('玩家走到最佳手的那一格不顯示「更好的是」', async () => {
    // Arrange — ply2 玩家走的 g1f3 就是最佳手
    const w = mountCard()

    // Act
    await nextBtn(w).trigger('click')

    // Assert
    expect(w.text()).toContain('第 2 手')
    expect(w.find('[data-testid="moment-best"]').exists()).toBe(false)
  })

  it('切換到下一格時棋盤換到該局面', async () => {
    // Arrange
    const w = mountCard()
    const board = w.findComponent({ name: 'ChessBoard' })
    const firstFen = board.props('fen')

    // Act
    await nextBtn(w).trigger('click')

    // Assert
    expect(board.props('fen')).not.toBe(firstFen)
  })

  it('第一格不能再往前、最後一格不能再往後', async () => {
    // Arrange
    const w = mountCard()

    // Assert — 起點
    expect(prevBtn(w).attributes('disabled')).toBeDefined()
    expect(nextBtn(w).attributes('disabled')).toBeUndefined()

    // Act — 走到最後一格
    await nextBtn(w).trigger('click')

    // Assert
    expect(prevBtn(w).attributes('disabled')).toBeUndefined()
    expect(nextBtn(w).attributes('disabled')).toBeDefined()
  })

  it('每一格都有 Neve 的一句解釋', () => {
    // Arrange / Act
    const w = mountCard()

    // Assert
    expect(w.get('[data-testid="moment-reason"]').text().length).toBeGreaterThan(0)
  })

  it('棋盤唯讀，且朝向跟隨玩家執子色', () => {
    // Arrange / Act
    const board = mountCard().findComponent({ name: 'ChessBoard' })

    // Assert
    expect(board.props('disabled')).toBe(true)
    expect(board.props('playerColor')).toBe('white')
  })

  it('執黑對局：棋盤朝向也跟著轉黑（先前只驗過白方，2026-08-07 補黑方回歸）', () => {
    // Arrange / Act
    const board = mountCard(undefined, undefined, 'black').findComponent({ name: 'ChessBoard' })

    // Assert
    expect(board.props('playerColor')).toBe('black')
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

  it('清單縮短後越界的位置落回第一格，不渲染空殼', async () => {
    // Arrange — 先切到第二格
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
    await nextBtn(w).trigger('click')

    // Act — 清單縮到只剩一格
    moments.value = [moment(0)]
    await w.vm.$nextTick()

    // Assert
    expect(w.get('[data-testid="moment-dots"]').findAll('span')).toHaveLength(1)
    expect(w.text()).toContain('第 1 手')
  })
})
