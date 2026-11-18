// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import RecognitionBoard from '@/components/lesson/RecognitionBoard.vue'
import { rejectAfterMove } from '@/composables/use-board-input'
import type { MoveMadePayload } from '@/composables/use-chess-board'
import type { RecognitionBoard as Board } from '@/types/recognition'

// 判斷場走錯＝棋子靜默滑回。vue3-chessboard 先 emit move 才 board.move，所以重設要等走子落地
// （animationDoneAt）；chessground 在 happy-dom 起不來，棋盤是 stub，但 rejectMove 接的是真的
// rejectAfterMove，只有最後的 resetPosition 是 mock。
const resetPosition = vi.fn()
vi.mock('@/components/chess-board.vue', () => ({
  default: defineComponent({
    name: 'ChessBoard',
    props: ['fen', 'playerColor', 'disabled', 'coordinates', 'lastMove'],
    emits: ['move-made'],
    setup(_props, { expose }) {
      expose({
        rejectMove: (payload: Pick<MoveMadePayload, 'animationDoneAt'>, stillValid: () => boolean) =>
          rejectAfterMove(payload, stillValid, resetPosition),
        reapplyFen: vi.fn(),
      })
      return () => null
    },
  }),
}))

const REAL: Board = {
  kind: 'real',
  fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
  expectedMove: { from: 'a1', to: 'a8' },
  successText: 's',
}
const DECOY: Board = {
  kind: 'decoy',
  fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
  temptMove: { from: 'a1', to: 'a7' },
  refutation: { from: 'e8', to: 'd8' },
  emptyText: 'e',
  trapText: 't',
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

function mountBoard(board: Board = REAL): VueWrapper {
  return mount(RecognitionBoard, { props: { board, active: true, locked: false } })
}
const emitMove = (w: VueWrapper, from: string, to: string, animationDoneAt: Promise<void>) =>
  w.findComponent({ name: 'ChessBoard' }).vm.$emit('move-made', { from, to, animationDoneAt })

beforeEach(() => {
  resetPosition.mockClear()
})

describe('RecognitionBoard — wrong move slides home after the move lands', () => {
  it('test_wrongMove_beforeMoveLands_doesNotReset_thenResetsOnce', async () => {
    // Arrange
    const w = mountBoard()
    const landed = deferred()

    // Act
    await emitMove(w, 'e1', 'e2', landed.promise)
    await flushPromises()

    // Assert
    expect(resetPosition).not.toHaveBeenCalled()
    landed.resolve()
    await flushPromises()
    expect(resetPosition).toHaveBeenCalledTimes(1)
  })

  it('test_wrongMove_boardDeactivatedWhileWaiting_doesNotReset', async () => {
    // Arrange
    const w = mountBoard()
    const landed = deferred()
    await emitMove(w, 'e1', 'e2', landed.promise)

    // Act — the carousel moves on before the move lands
    await w.setProps({ active: false })
    landed.resolve()
    await flushPromises()

    // Assert
    expect(resetPosition).not.toHaveBeenCalled()
  })

  it('test_wrongMove_boardSwappedWhileWaiting_doesNotReset', async () => {
    // Arrange
    const w = mountBoard()
    const landed = deferred()
    await emitMove(w, 'e1', 'e2', landed.promise)

    // Act
    await w.setProps({ board: { ...REAL } })
    landed.resolve()
    await flushPromises()

    // Assert
    expect(resetPosition).not.toHaveBeenCalled()
  })

  it('test_correctMove_neverResets', async () => {
    // Arrange
    const w = mountBoard()
    const landed = deferred()

    // Act
    await emitMove(w, 'a1', 'a8', landed.promise)
    landed.resolve()
    await flushPromises()

    // Assert
    expect(resetPosition).not.toHaveBeenCalled()
    expect(w.emitted('judge')?.[0]).toEqual(['correct'])
  })

  it('test_decoy_nonTemptMove_resetsOnlyAfterMoveLands', async () => {
    // Arrange
    const w = mountBoard(DECOY)
    const landed = deferred()

    // Act
    await emitMove(w, 'e1', 'e2', landed.promise)
    await flushPromises()

    // Assert
    expect(resetPosition).not.toHaveBeenCalled()
    landed.resolve()
    await flushPromises()
    expect(resetPosition).toHaveBeenCalledTimes(1)
    expect(w.emitted('judge')).toBeUndefined()
  })
})
