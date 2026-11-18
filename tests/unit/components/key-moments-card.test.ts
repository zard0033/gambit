// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, computed, ref, type Ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import KeyMomentsCard from '@/components/memory/KeyMomentsCard.vue'
import { MEMORY_CONTEXT, type MemoryContext } from '@/components/memory/memory-context'
import { useRecognitionSourceStore } from '@/stores/recognition-source'
import { useUiStore } from '@/stores/ui-store'
import type { ReviewPhase, StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'
import { MEMORY_ZERO_STATE_COPY } from '@/config/memory-config'
import { lintNeve } from '@/modules/memory/persona-lint'
import { formatGameDay } from '@/utils/game-day'
import type { Moment } from '@/types/memory'
import { rejectAfterMove } from '@/composables/use-board-input'
import type { MoveMadePayload } from '@/composables/use-chess-board'

// chessground 在 happy-dom 起不來；這裡驗的是對話框與切換，棋盤只需接得住 props 與 rejectMove
// （深青格走錯時元件會呼叫它把棋子滑回去）。rejectMove 接的是真的 rejectAfterMove，只有最後那一下
// resetPosition 是 mock——「等走子落地才重設」的時序是元件與 helper 合起來的行為，要一起驗。
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
        rejectMove: (payload: Pick<MoveMadePayload, 'animationDoneAt'>, stillValid: () => boolean) =>
          rejectAfterMove(payload, stillValid, resetPosition),
      })
      return () => null
    },
  }),
}))

// 出口「回首頁」走 router.replace；這裡只驗呼叫，不需要真的路由表。
const routerReplace = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ replace: routerReplace }) }))

// game 的 fixture 只給 moves／playerColor —— 元件讀得到的就這兩個欄位，補齊 CompletedGame 其餘
// 六欄只是替斷言加噪音，所以走 unknown 轉型（同 KeyMomentsCard 對 analysisResults 的作法）。
function entry(bestMove: string): StoredAnalysisEntry {
  return { bestMove, evalCp: 0, depthReached: 16, pv: [], pass: 'deep' }
}
function moment(ply: number): Moment {
  return { ply, kind: 'plain', anchor: false, concept: 'none', cp: 100, fav: -Infinity }
}

/** 目前掛著的卡的 review.phase；測試用它把分析推進到 COMPLETE。 */
let phase: Ref<ReviewPhase>

/** 白方對局：ply0 玩家走 a2a3 但引擎要 e2e4（engine）；ply2 玩家走的就是最佳手（own）。 */
function mountCard(
  moves = ['a2a3', 'e7e5', 'g1f3'],
  bests = ['e2e4', 'd2d4', 'g1f3'],
  playerColor: 'white' | 'black' = 'white',
  opts: { phase?: ReviewPhase; moments?: Moment[] } = {},
): VueWrapper {
  phase = ref<ReviewPhase>(opts.phase ?? 'COMPLETE')
  const moments = opts.moments ?? [moment(0), moment(2)]
  const ctx: MemoryContext = {
    review: {
      phase,
      analysisResults: computed(() => bests.map(entry)),
      totalPositions: computed(() => moves.length),
      progressPass: ref('preview'),
      progressCount: ref(1),
    } as unknown as MemoryContext['review'],
    game: computed(() => ({ moves, playerColor, completedAt: GAME_ID })) as unknown as MemoryContext['game'],
    moments: computed(() => moments),
    opening: computed(() => null),
  }
  return mount(KeyMomentsCard, { global: { provide: { [MEMORY_CONTEXT as symbol]: ctx } } })
}

/**
 * 真實時序：卡從分析中就掛著，MemoryView 到 COMPLETE 才把漏看的將殺寫進 store。所以深青格的測試
 * 一律先在 ANALYZING 掛上，再推到 COMPLETE（`seed` 在兩者之間跑，模擬 captureMissedMates）。
 */
async function mountThenComplete(
  seed: () => void = () => {},
  ...args: Parameters<typeof mountCard>
): Promise<VueWrapper> {
  const [moves, bests, color, opts = {}] = args
  const w = mountCard(moves, bests, color, { ...opts, phase: 'ANALYZING' })
  seed()
  phase.value = 'COMPLETE'
  await flushPromises()
  return w
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

/** 手動 resolve 的 promise，當 `animationDoneAt` 用來控制「走子落地」的時間點。 */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

const nextBtn = (w: VueWrapper) => w.get('[aria-label="下一格"]')
const prevBtn = (w: VueWrapper) => w.get('[aria-label="上一格"]')
const stepBtn = (w: VueWrapper) => w.get('[data-testid="moment-step"]')
const board = (w: VueWrapper) => w.findComponent({ name: 'ChessBoard' })

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  resetPosition.mockClear()
  routerReplace.mockClear()
})

describe('KeyMomentsCard', () => {
  it('一次只顯示一格，段點數量等於 moment 數', () => {
    // Arrange / Act
    const w = mountCard()

    // Assert
    expect(w.get('[data-testid="moment-dots"]').findAll('span')).toHaveLength(2)
    expect(w.text()).toContain('第 1 回合')
    expect(w.text()).not.toContain('第 2 回合')
  })

  it('走法用白話文並排兩手，不出現 SAN 記號', () => {
    // Arrange / Act — ply0：玩家 a2a3、引擎 e2e4
    const w = mountCard()

    // Assert
    expect(w.get('[data-testid="moment-played"]').text()).toBe('把兵移到 a3')
    expect(w.get('[data-testid="moment-best"]').text()).toBe('把兵移到 e4')
  })

  it('吃子的一手不會被說成單純的移動，且卡片與 Neve 那句用同一組字', async () => {
    // Arrange — ply0 玩家走的就是最佳手（own）；ply2 白兵 e4 吃掉 d5 的黑兵，引擎要 g1f3。
    // 卡片曾經自己硬編「把{piece}移到 {to}」，於是同一手在卡片上是「把兵移到 d5」、
    // 在 Neve 的句子裡是「用兵吃掉 d5 的兵」——兩種說法。現在兩邊都走 movePhrase。
    const w = mountCard(['e2e4', 'd7d5', 'e4d5'], ['e2e4', 'd7d5', 'g1f3'])

    // Act
    await nextBtn(w).trigger('click')

    // Assert
    expect(w.get('[data-testid="moment-played"]').text()).toBe('用兵吃掉 d5 的兵')
    expect(w.get('[data-testid="moment-best"]').text()).toBe('把騎士移到 f3')
    expect(w.get('[data-testid="moment-reason"]').text()).toContain('用兵吃掉 d5 的兵')
  })

  it('玩家走到最佳手的那一格不顯示「更好的是」', async () => {
    // Arrange — ply2 玩家走的 g1f3 就是最佳手
    const w = mountCard()

    // Act
    await nextBtn(w).trigger('click')

    // Assert
    expect(w.text()).toContain('第 2 回合')
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

  it('分析完沒有可看的項目時：木盤與對話框都還在，只換成零狀態那句話', () => {
    // Arrange — moments 指向缺分析的 ply（buildMomentDisplays 會把它濾掉）
    const ctx: MemoryContext = {
      review: {
        phase: ref('COMPLETE'),
        analysisResults: computed(() => [null, null, null]),
        totalPositions: computed(() => 1),
        progressPass: ref('deep'),
        progressCount: ref(1),
      } as unknown as MemoryContext['review'],
      game: computed(() => ({ moves: ['a2a3'], playerColor: 'white', completedAt: GAME_ID })) as unknown as MemoryContext['game'],
      moments: computed(() => [moment(0)]),
      opening: computed(() => null),
    }

    // Act
    const w = mount(KeyMomentsCard, { global: { provide: { [MEMORY_CONTEXT as symbol]: ctx } } })

    // Assert
    expect(board(w).exists()).toBe(true)
    expect(w.get('[data-testid="memory-zero-state"]').text()).toBe(MEMORY_ZERO_STATE_COPY)
    expect(w.find('[data-testid="memory-analyzing"]').exists()).toBe(false)
    expect(w.get('[data-testid="moment-nav"]').classes()).toContain('invisible')
    expect(w.find('[data-testid="memory-exits"]').exists()).toBe(true)
  })

  it('清單縮短後越界的位置落回第一格，不渲染空殼', async () => {
    // Arrange — 先切到第二格
    const moments = ref<Moment[]>([moment(0), moment(2)])
    const ctx: MemoryContext = {
      review: {
        phase: ref('COMPLETE'),
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
    expect(w.text()).toContain('第 1 回合')
  })
})

describe('KeyMomentsCard — 深青互動格（wave 2）', () => {
  it('有待解的將殺時，第一格是可動的深青格且盤面零標記', async () => {
    // Arrange
    // Act — mountThenComplete 內含 flushPromises，等 overlay 掛上；少了它「零標記」會恆真（見下一條的對照組）
    const w = await mountThenComplete(seedPendingMate)

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

  it('深青格用該局面自己的執子色，不用本局的', async () => {
    // Arrange — pending 是白方的題目，本局玩家執黑

    // Act
    const w = await mountThenComplete(seedPendingMate, ['a2a3', 'e7e5', 'g1f3'], ['e2e4', 'd2d4', 'g1f3'], 'black')

    // Assert
    expect(board(w).props('playerColor')).toBe('white')
  })

  it('走出那一手就通關，並把局面退休掉不再冒出來', async () => {
    // Arrange
    const w = await mountThenComplete(seedPendingMate)

    // Act
    await board(w).vm.$emit('move-made', { from: 'e1', to: 'e8' })

    // Assert
    expect(w.find('[data-testid="deep-solved"]').exists()).toBe(true)
    expect(resetPosition).not.toHaveBeenCalled()
    expect(useRecognitionSourceStore().pendingFor('mate')).toHaveLength(0)
  })

  it('走錯的手棋子靜默滑回，不通關也不退休', async () => {
    // Arrange
    const w = await mountThenComplete(seedPendingMate)

    // Act
    await board(w).vm.$emit('move-made', { from: 'g2', to: 'g3' })

    // Assert
    expect(resetPosition).toHaveBeenCalledTimes(1)
    expect(w.find('[data-testid="deep-solved"]').exists()).toBe(false)
    expect(useRecognitionSourceStore().pendingFor('mate')).toHaveLength(1)
  })

  it('走錯時等走子落地（animationDoneAt）才重設，不在 move 事件當下同步重設', async () => {
    // Arrange — vue3-chessboard 先 emit move 才 board.move，同步重設會被它蓋掉
    const w = await mountThenComplete(seedPendingMate)
    const landed = deferred()

    // Act
    await board(w).vm.$emit('move-made', { from: 'g2', to: 'g3', animationDoneAt: landed.promise })
    await flushPromises()

    // Assert — 落地前不動，落地後重設一次
    expect(resetPosition).not.toHaveBeenCalled()
    landed.resolve()
    await flushPromises()
    expect(resetPosition).toHaveBeenCalledTimes(1)
  })

  it('等待走子落地期間換了格，就不重設（不把新格的盤拉回舊題）', async () => {
    // Arrange
    const w = await mountThenComplete(seedPendingMate)
    const landed = deferred()
    await board(w).vm.$emit('move-made', { from: 'g2', to: 'g3', animationDoneAt: landed.promise })

    // Act — 落地前切到下一格
    await nextBtn(w).trigger('click')
    landed.resolve()
    await flushPromises()

    // Assert
    expect(resetPosition).not.toHaveBeenCalled()
  })

  it('等待走子落地期間按了看答案，就不重設（盤要停在答案那一手）', async () => {
    // Arrange
    const w = await mountThenComplete(seedPendingMate)
    const landed = deferred()
    await board(w).vm.$emit('move-made', { from: 'g2', to: 'g3', animationDoneAt: landed.promise })

    // Act
    await w.get('[data-testid="deep-reveal"]').trigger('click')
    landed.resolve()
    await flushPromises()

    // Assert
    expect(resetPosition).not.toHaveBeenCalled()
  })

  it('走對時即使走子落地也永遠不重設', async () => {
    // Arrange
    const w = await mountThenComplete(seedPendingMate)
    const landed = deferred()

    // Act
    await board(w).vm.$emit('move-made', { from: 'e1', to: 'e8', animationDoneAt: landed.promise })
    landed.resolve()
    await flushPromises()

    // Assert
    expect(resetPosition).not.toHaveBeenCalled()
  })

  it('看答案同樣把局面退休掉——找不到的人不該每次進來都撞同一題', async () => {
    // Arrange
    const w = await mountThenComplete(seedPendingMate)

    // Act
    await w.get('[data-testid="deep-reveal"]').trigger('click')

    // Assert
    expect(w.find('[data-testid="deep-solved"]').exists()).toBe(true)
    expect(useRecognitionSourceStore().pendingFor('mate')).toHaveLength(0)
    expect(board(w).props('fen')).not.toBe(MATE_FEN) // 已經走出那一手
  })

  it('本局漏看的將殺只出現一次——深青格講過就不再有說明格', async () => {
    // Arrange — pending 掛在本局的 ply 0，與第一個 moment 同一手

    // Act
    const w = await mountThenComplete(() => seedPendingMate(String(GAME_ID), 0))

    // Assert — 原本兩格說明，ply0 被深青格吸收，總數仍是 2（1 深青 + 1 說明）
    expect(w.get('[data-testid="moment-dots"]').findAll('span')).toHaveLength(2)
    expect(w.find('[data-testid="deep-prompt"]').exists()).toBe(true)
  })

  it('通關後切走再切回，盤面停在走完那一手，不退回走子前', async () => {
    // Arrange — 通關（此時盤面＝將殺後）
    const w = await mountThenComplete(seedPendingMate)
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
    const w = await mountThenComplete(seedPendingMate)
    await board(w).vm.$emit('move-made', { from: 'e1', to: 'e8' })
    expect(board(w).props('lastMove')).toEqual(['e1', 'e8'])

    // Act
    await nextBtn(w).trigger('click')

    // Assert — 明確傳 null 才會清掉；不傳的話那層底色會留在說明格的盤上
    expect(board(w).props('lastMove')).toBeNull()
  })

  it('通關前步進鈕是停用的——步進正解等於直接給答案', async () => {
    // Arrange
    const w = await mountThenComplete(seedPendingMate)

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

describe('KeyMomentsCard — 掛載時機與分析中（wave 1a R1）', () => {
  it('分析中掛上、轉成 COMPLETE 時才寫進的本局將殺，仍是第一格', async () => {
    // Arrange / Act — store 在 mount 之後、COMPLETE 之前才有題目（同 MemoryView 的 captureMissedMates）
    const w = await mountThenComplete(() => seedPendingMate(String(GAME_ID), 0))

    // Assert
    expect(w.find('[data-testid="deep-prompt"]').exists()).toBe(true)
    expect(board(w).props('fen')).toBe(MATE_FEN)
  })

  it('掛上時 phase 已經是 COMPLETE（分析快取命中）→ 深青格仍是第一格', async () => {
    // Arrange — 題目先寫好、phase 一開始就是 COMPLETE
    seedPendingMate()

    // Act
    const w = mountCard()
    await flushPromises()

    // Assert
    expect(w.find('[data-testid="deep-prompt"]').exists()).toBe(true)
    expect(w.get('[data-testid="moment-dots"]').findAll('span')).toHaveLength(3)
  })

  it('分析中：盤是這一盤的終局、唯讀、標出最後一手；有棋譜、沒有骨架，也還沒有格子', async () => {
    // Arrange / Act
    const w = mountCard(undefined, undefined, undefined, { phase: 'ANALYZING' })
    await flushPromises()

    // Assert — 終局：a3 e5 Nf3 走完
    expect(board(w).props('fen')).toBe('rnbqkbnr/pppp1ppp/8/4p3/8/P4N2/1PPPPPPP/RNBQKB1R b KQkq - 1 2')
    expect(board(w).props('disabled')).toBe(true)
    expect(board(w).props('lastMove')).toEqual(['g1', 'f3'])
    expect(w.find('[data-testid="memory-analyzing"]').exists()).toBe(true)
    const flow = w.get('[data-testid="memory-flow"]').text()
    expect(flow).toContain('這一盤 · 2 回合')
    expect(flow).toContain('1. a3 e5')
    expect(flow).toContain('2. Nf3')
    expect(w.find('.animate-pulse').exists()).toBe(false)
    expect(w.get('[data-testid="moment-dots"]').findAll('span')).toHaveLength(0)
    expect(w.get('[data-testid="moment-nav"]').classes()).toContain('invisible')
    expect(w.find('[data-testid="memory-exits"]').exists()).toBe(false)
  })

  it('分析中：百分比在 live 播報之外（讀屏不會一直念數字），那句話仍在 polite 區內', () => {
    // Arrange / Act
    const w = mountCard(undefined, undefined, undefined, { phase: 'ANALYZING' })

    // Assert — 3 手 × 2 段，preview 跑完 1 格 → 1/6
    const readout = w.get('[data-testid="progress-readout"]')
    expect(readout.text()).toBe('17%')
    expect(readout.element.closest('[aria-live]')?.getAttribute('aria-live')).toBe('off')
    expect(w.get('[data-testid="memory-analyzing"]').element.closest('[aria-live]')?.getAttribute('aria-live')).toBe('polite')
  })
})

describe('KeyMomentsCard — 出口與單格', () => {
  it('最後一格是說明格時才出現出口；第一格時沒有', async () => {
    // Arrange
    const w = mountCard()
    expect(w.find('[data-testid="memory-exits"]').exists()).toBe(false)

    // Act
    await nextBtn(w).trigger('click')

    // Assert
    expect(w.find('[data-testid="memory-exits"]').exists()).toBe(true)
  })

  it('最後一格是還沒解的深青格時不出現出口；解完之後出現，且不會被換成零狀態', async () => {
    // Arrange — steady game：沒有說明格，只有一格深青
    const w = await mountThenComplete(seedPendingMate, undefined, undefined, undefined, { moments: [] })
    expect(w.find('[data-testid="deep-prompt"]').exists()).toBe(true)
    expect(w.find('[data-testid="memory-exits"]').exists()).toBe(false)

    // Act
    await board(w).vm.$emit('move-made', { from: 'e1', to: 'e8' })

    // Assert
    expect(w.find('[data-testid="deep-solved"]').exists()).toBe(true)
    expect(w.find('[data-testid="memory-zero-state"]').exists()).toBe(false)
    expect(w.find('[data-testid="memory-exits"]').exists()).toBe(true)
  })

  it('出口：再下一盤打開設定彈窗，回首頁 replace 到 /', async () => {
    // Arrange
    const w = mountCard(undefined, undefined, undefined, { moments: [moment(0)] })
    const [again, home] = w.get('[data-testid="memory-exits"]').findAll('button')

    // Act
    await again.trigger('click')
    await home.trigger('click')

    // Assert
    expect(useUiStore().showPlaySetup).toBe(true)
    expect(routerReplace).toHaveBeenCalledWith('/')
  })

  it('只有一格時 ‹ › 看不見（位置保留），步進鈕照樣在', () => {
    // Arrange / Act
    const w = mountCard(undefined, undefined, undefined, { moments: [moment(0)] })

    // Assert
    expect(prevBtn(w).classes()).toContain('invisible')
    expect(nextBtn(w).classes()).toContain('invisible')
    expect(stepBtn(w).classes()).not.toContain('invisible')
    expect(w.get('[data-testid="moment-nav"]').classes()).not.toContain('invisible')
  })

  it('多格時 ‹ › 看得見', () => {
    // Arrange / Act
    const w = mountCard()

    // Assert
    expect(prevBtn(w).classes()).not.toContain('invisible')
    expect(nextBtn(w).classes()).not.toContain('invisible')
  })
})

describe('KeyMomentsCard — 深青格的日期那一行', () => {
  it('題目來自別盤時，加一行「{M} 月 {D} 日那一盤」，且過 lintNeve', async () => {
    // Arrange / Act — OTHER_GAME_ID 是另一盤的 completedAt
    const w = await mountThenComplete(seedPendingMate)

    // Assert
    const line = w.get('[data-testid="deep-source-day"]').text()
    expect(line).toBe(`${formatGameDay(Number(OTHER_GAME_ID))}那一盤`)
    expect(lintNeve(line)).toEqual([])
  })

  it('題目就是這一盤時不加日期', async () => {
    // Arrange / Act
    const w = await mountThenComplete(() => seedPendingMate(String(GAME_ID), 0))

    // Assert
    expect(w.find('[data-testid="deep-source-day"]').exists()).toBe(false)
  })
})
