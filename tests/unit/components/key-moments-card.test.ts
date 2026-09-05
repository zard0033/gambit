// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, computed, ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import KeyMomentsCard from '@/components/memory/KeyMomentsCard.vue'
import { MEMORY_CONTEXT, type MemoryContext } from '@/components/memory/memory-context'
import { useRecognitionSourceStore } from '@/stores/recognition-source'
import type { StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'
import type { Moment } from '@/types/memory'

// chessground 在 happy-dom 起不來；這裡驗的是對話框與切換，棋盤只需接得住 props 與 resetPosition
// （深青格走錯時元件會呼叫它把棋子滑回去）。
// `boardRef` 給一個真的 element：KeyMomentsCard 的 `v-if="boardEl"` 靠它，回 null 的話
// MoveAnnotationDisplay 永不渲染，「盤面零標記」那條斷言就會恆真而驗不到東西。
const resetPosition = vi.fn()
vi.mock('@/components/chess-board.vue', () => ({
  default: defineComponent({
    name: 'ChessBoard',
    props: ['fen', 'playerColor', 'disabled', 'coordinates', 'lastMove'],
    emits: ['move-made'],
    setup: (_p, { expose }) => {
      expose({
        boardRef: document.createElement('div'),
        squareToRect: () => ({ left: 0, top: 0, width: 40, height: 40 }),
        resetPosition,
      })
      return () => null
    },
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
    game: computed(() => ({ moves, playerColor, completedAt: GAME_ID })) as unknown as MemoryContext['game'],
    moments: computed(() => [moment(0), moment(2)]),
    opening: computed(() => null),
  }
  return mount(KeyMomentsCard, { global: { provide: { [MEMORY_CONTEXT as symbol]: ctx } } })
}

/**
 * 深青互動格的題目：底線將殺。黑王 g8 被自己的 f7/g7/h7 三兵封死，白后 e1→e8 將死。
 * chess.js 窮舉驗過是**唯一解**（`e1e8`），符合「只有唯一解局面能做成互動格」的鐵則。
 */
const MATE_FEN = '6k1/5ppp/8/8/8/8/5PPP/4Q1K1 w - - 0 1'
const MATE_UCI = 'e1e8'
const GAME_ID = 1700000000000
const OTHER_GAME_ID = '1699999999999'

/** 讓 store 有一題待解的將殺（預設掛在另一局，與本局的 moment 不重疊）。 */
function seedPendingMate(gameId = OTHER_GAME_ID, ply = 8): void {
  useRecognitionSourceStore().captureMate(gameId, 'white', [
    { ply, fen: MATE_FEN, mateMoveUci: MATE_UCI },
  ])
}

const nextBtn = (w: VueWrapper) => w.get('[aria-label="下一格"]')
const prevBtn = (w: VueWrapper) => w.get('[aria-label="上一格"]')
const stepBtn = (w: VueWrapper) => w.get('[data-testid="moment-step"]')
const board = (w: VueWrapper) => w.findComponent({ name: 'ChessBoard' })

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  resetPosition.mockClear()
})

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

  it('吃子的一手不會被說成單純的移動，且卡片與 Neve 那句用同一組字', async () => {
    // Arrange — ply0 玩家走的就是最佳手（own）；ply2 白兵 e4 吃掉 d5 的黑兵，引擎要 g1f3。
    // 卡片曾經自己硬編「把{piece}移到 {to}」，於是同一手在卡片上是「把兵移到 d5」、
    // 在 Neve 的句子裡是「用兵吃掉 d5 的兵」——兩種說法。現在兩邊都走 movePhrase。
    const w = mountCard(['e2e4', 'd7d5', 'e4d5'], ['e2e4', 'd7d5', 'g1f3'])

    // Act
    await nextBtn(w).trigger('click')

    // Assert
    expect(w.get('[data-testid="moment-played"]').text()).toBe('你走了 用兵吃掉 d5 的兵')
    expect(w.get('[data-testid="moment-best"]').text()).toBe('更好的是 把騎士移到 f3')
    expect(w.get('[data-testid="moment-reason"]').text()).toContain('用兵吃掉 d5 的兵')
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
      game: computed(() => ({ moves: ['a2a3', 'e7e5', 'g1f3'], playerColor: 'white', completedAt: GAME_ID })) as unknown as MemoryContext['game'],
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

describe('KeyMomentsCard — 深青互動格（wave 2）', () => {
  it('有待解的將殺時，第一格是可動的深青格且盤面零標記', async () => {
    // Arrange
    seedPendingMate()

    // Act — flushPromises 等 overlay 掛上；少了它「零標記」會恆真（見上面那條的對照組）
    const w = mountCard()
    await flushPromises()

    // Assert — 深青格排在兩個說明格之前，共三格
    expect(w.get('[data-testid="moment-dots"]').findAll('span')).toHaveLength(3)
    expect(w.find('[data-testid="deep-prompt"]').exists()).toBe(true)
    expect(board(w).props('fen')).toBe(MATE_FEN)
    expect(board(w).props('disabled')).toBe(false)
    expect(board(w).props('lastMove')).toBeNull() // 連對手上一手的原生高亮也關掉
    expect(w.findComponent({ name: 'MoveAnnotationDisplay' }).props('annotations')).toHaveLength(0)
  })

  it('沒有待解的將殺時，格子與 wave 1 完全一樣（棋盤唯讀）', async () => {
    // Arrange / Act — overlay 掛在 onMounted 之後的 geomTick 上，要等它才看得到標註
    const w = mountCard()
    await flushPromises()

    // Assert — 說明格**有**標註（這條是上面「深青格零標記」的對照組：沒有它，那條斷言恆真）
    expect(w.get('[data-testid="moment-dots"]').findAll('span')).toHaveLength(2)
    expect(w.find('[data-testid="deep-prompt"]').exists()).toBe(false)
    expect(board(w).props('disabled')).toBe(true)
    expect(w.findComponent({ name: 'MoveAnnotationDisplay' }).props('annotations')).not.toHaveLength(0)
  })

  it('深青格用該局面自己的執子色，不用本局的', () => {
    // Arrange — pending 是白方的題目，本局玩家執黑
    seedPendingMate()

    // Act
    const w = mountCard(['a2a3', 'e7e5', 'g1f3'], ['e2e4', 'd2d4', 'g1f3'], 'black')

    // Assert
    expect(board(w).props('playerColor')).toBe('white')
  })

  it('走出那一手就通關，並把局面退休掉不再冒出來', async () => {
    // Arrange
    seedPendingMate()
    const w = mountCard()

    // Act
    await board(w).vm.$emit('move-made', { from: 'e1', to: 'e8' })

    // Assert
    expect(w.find('[data-testid="deep-solved"]').exists()).toBe(true)
    expect(resetPosition).not.toHaveBeenCalled()
    expect(useRecognitionSourceStore().pendingFor('mate')).toHaveLength(0)
  })

  it('走錯的手棋子靜默滑回，不通關也不退休', async () => {
    // Arrange
    seedPendingMate()
    const w = mountCard()

    // Act
    await board(w).vm.$emit('move-made', { from: 'g2', to: 'g3' })

    // Assert
    expect(resetPosition).toHaveBeenCalledTimes(1)
    expect(w.find('[data-testid="deep-solved"]').exists()).toBe(false)
    expect(useRecognitionSourceStore().pendingFor('mate')).toHaveLength(1)
  })

  it('看答案同樣把局面退休掉——找不到的人不該每次進來都撞同一題', async () => {
    // Arrange
    seedPendingMate()
    const w = mountCard()

    // Act
    await w.get('[data-testid="deep-reveal"]').trigger('click')

    // Assert
    expect(w.find('[data-testid="deep-solved"]').exists()).toBe(true)
    expect(useRecognitionSourceStore().pendingFor('mate')).toHaveLength(0)
    expect(board(w).props('fen')).not.toBe(MATE_FEN) // 已經走出那一手
  })

  it('本局漏看的將殺只出現一次——深青格講過就不再有說明格', () => {
    // Arrange — pending 掛在本局的 ply 0，與第一個 moment 同一手
    seedPendingMate(String(GAME_ID), 0)

    // Act
    const w = mountCard()

    // Assert — 原本兩格說明，ply0 被深青格吸收，總數仍是 2（1 深青 + 1 說明）
    expect(w.get('[data-testid="moment-dots"]').findAll('span')).toHaveLength(2)
    expect(w.find('[data-testid="deep-prompt"]').exists()).toBe(true)
  })

  it('通關後切走再切回，盤面停在走完那一手，不退回走子前', async () => {
    // Arrange — 通關（此時盤面＝將殺後）
    seedPendingMate()
    const w = mountCard()
    await board(w).vm.$emit('move-made', { from: 'e1', to: 'e8' })
    const solvedFen = board(w).props('fen')
    expect(solvedFen).not.toBe(MATE_FEN)

    // Act — 切到說明格再切回來
    await nextBtn(w).trigger('click')
    await prevBtn(w).trigger('click')

    // Assert — 對話框說「就是這一手」，畫面上就必須有那一手；退回 MATE_FEN 等於文圖互相矛盾，
    // 而且通關後盤是鎖的，玩家無法自己重走一次。
    expect(w.find('[data-testid="deep-solved"]').exists()).toBe(true)
    expect(board(w).props('fen')).toBe(solvedFen)
    expect(board(w).props('lastMove')).toEqual(['e1', 'e8'])
  })

  it('切離已通關的深青格時，它的 last-move 高亮不跟著跑到下一格', async () => {
    // Arrange — 通關後 chessground 自己畫的高亮還在盤上（setPosition 不清它）
    seedPendingMate()
    const w = mountCard()
    await board(w).vm.$emit('move-made', { from: 'e1', to: 'e8' })
    expect(board(w).props('lastMove')).toEqual(['e1', 'e8'])

    // Act
    await nextBtn(w).trigger('click')

    // Assert — 明確傳 null 才會清掉；不傳的話那層底色會留在說明格的盤上
    expect(board(w).props('lastMove')).toBeNull()
  })

  it('通關前步進鈕是停用的——步進正解等於直接給答案', async () => {
    // Arrange
    seedPendingMate()
    const w = mountCard()

    // Assert
    expect(stepBtn(w).attributes('disabled')).toBeDefined()

    // Act — 通關後才能回看那一手
    await board(w).vm.$emit('move-made', { from: 'e1', to: 'e8' })

    // Assert
    expect(stepBtn(w).attributes('disabled')).toBeUndefined()
  })
})

describe('KeyMomentsCard — 步進鈕', () => {
  it('說明格循環三個畫面：原局面 → 你走了 → 更好的是 → 回原局面', async () => {
    // Arrange
    const w = mountCard()
    const base = board(w).props('fen')

    // Act / Assert — 每一步的局面都不同，且第三下繞回原局面
    await stepBtn(w).trigger('click')
    const played = board(w).props('fen')
    expect(played).not.toBe(base)

    await stepBtn(w).trigger('click')
    const best = board(w).props('fen')
    expect(best).not.toBe(base)
    expect(best).not.toBe(played)

    await stepBtn(w).trigger('click')
    expect(board(w).props('fen')).toBe(base)
  })

  it('切到別格再切回來時步進位置歸零，不停在上次看到的畫面', async () => {
    // Arrange
    const w = mountCard()
    const base = board(w).props('fen')
    await stepBtn(w).trigger('click')
    expect(board(w).props('fen')).not.toBe(base)

    // Act — 切走再切回
    await nextBtn(w).trigger('click')
    await prevBtn(w).trigger('click')

    // Assert
    expect(board(w).props('fen')).toBe(base)
  })

  it('玩家自己走對的那一格沒有後續畫面，步進鈕停用', async () => {
    // Arrange — ply2 玩家走的就是最佳手（own）
    const w = mountCard()

    // Act
    await nextBtn(w).trigger('click')

    // Assert
    expect(stepBtn(w).attributes('disabled')).toBeDefined()
  })
})
