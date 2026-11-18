// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import LessonPlayer from '@/components/lesson/LessonPlayer.vue'
import { rejectAfterMove } from '@/composables/use-board-input'
import type { MoveMadePayload } from '@/composables/use-chess-board'
import type { LessonStep } from '@/types/lesson'

// LessonPlayer's `complete` emit reports `unaided` (no wrong move / hint / reveal anywhere in the run)
// — the deepen wrap-up's "you saw it yourself" acknowledgment hinges on it. This pins that latch.

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// Stub the real board: emit move-made on demand + expose the methods LessonPlayer's board ref calls.
// rejectMove runs the real rejectAfterMove so the soft-reject timing is exercised; only the final
// resetPosition is a mock.
const resetPosition = vi.fn()
vi.mock('@/components/chess-board.vue', () => ({
  default: defineComponent({
    name: 'ChessBoard',
    props: ['fen', 'playerColor', 'disabled', 'coordinates'],
    emits: ['move-made'],
    setup(_props, { expose }) {
      expose({
        boardRef: null,
        squareToRect: () => null,
        resetPosition,
        rejectMove: (payload: Pick<MoveMadePayload, 'animationDoneAt'>, stillValid: () => boolean) =>
          rejectAfterMove(payload, stillValid, resetPosition),
        reapplyFen: vi.fn(),
      })
      return () => null
    },
  }),
}))

beforeEach(() => {
  resetPosition.mockClear()
})

/** A manually-resolved promise standing in for `animationDoneAt` (when the move lands). */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

const STEPS: LessonStep[] = [
  { fen: '4k3/1b6/8/8/8/8/8/1R2K3 w - - 0 1', text: 's0', expectedMove: { from: 'b1', to: 'b7' }, hint: 'h0', arrows: [{ orig: 'b1', dest: 'b7' }] },
  { fen: '4k3/8/8/8/2q5/4N3/8/4K3 w - - 0 1', text: 's1', expectedMove: { from: 'e3', to: 'c4' }, hint: 'h1', arrows: [{ orig: 'e3', dest: 'c4' }] },
]

function mountPlayer(): VueWrapper {
  return mount(LessonPlayer, { props: { steps: STEPS, title: 'T', backTo: '/x', backLabel: 'b' } })
}
const btn = (w: VueWrapper, label: string) => w.findAll('button').find((b) => b.text().includes(label))

async function solveCurrent(w: VueWrapper, move: { from: string; to: string }): Promise<void> {
  await w.findComponent({ name: 'ChessBoard' }).vm.$emit('move-made', move)
  await flushPromises()
}

async function runToFinish(w: VueWrapper): Promise<void> {
  await solveCurrent(w, STEPS[0].expectedMove!)
  await btn(w, '下一步')!.trigger('click')
  await flushPromises()
  await solveCurrent(w, STEPS[1].expectedMove!)
  await btn(w, '完成')!.trigger('click')
}

describe('LessonPlayer — complete(unaided)', () => {
  it('test_complete_cleanRun_emitsUnaidedTrue', async () => {
    const wrapper = mountPlayer()
    await runToFinish(wrapper)
    expect(wrapper.emitted('complete')?.[0]).toEqual([true])
  })

  it('test_complete_afterHint_emitsUnaidedFalse', async () => {
    const wrapper = mountPlayer()
    await btn(wrapper, '提示')!.trigger('click')
    await flushPromises()
    await runToFinish(wrapper)
    expect(wrapper.emitted('complete')?.[0]).toEqual([false])
  })

  it('test_complete_afterWrongMove_emitsUnaidedFalse', async () => {
    const wrapper = mountPlayer()
    await solveCurrent(wrapper, { from: 'b1', to: 'b2' }) // wrong → latches aid, disables board
    await btn(wrapper, '重試')!.trigger('click') // clear the wrong move before retrying
    await flushPromises()
    await runToFinish(wrapper)
    expect(wrapper.emitted('complete')?.[0]).toEqual([false])
  })

  it('test_softReject_legalNonTaughtMove_showsNoteNoPenalty', async () => {
    // Arrange: step 0's answer is b1→b7, but b1→b2 is a legal soft-reject (gentle redirect, no penalty).
    const softSteps: LessonStep[] = [
      { ...STEPS[0], softRejects: [{ from: 'b1', to: 'b2', note: 'b2 也可以，但這課我們走 b7' }] },
      STEPS[1],
    ]
    const wrapper = mount(LessonPlayer, { props: { steps: softSteps, title: 'T', backTo: '/x', backLabel: 'b' } })
    // Act: play the soft-rejected move (legal, not the taught answer)
    await solveCurrent(wrapper, { from: 'b1', to: 'b2' })
    // Assert: gentle note shown, NOT routed through the wrong-move penalty path
    expect(wrapper.text()).toContain('這課我們走 b7')
    expect(btn(wrapper, '重試')).toBeUndefined()
    // Act: finish cleanly with the taught moves
    await solveCurrent(wrapper, { from: 'b1', to: 'b7' })
    await btn(wrapper, '下一步')!.trigger('click')
    await flushPromises()
    await solveCurrent(wrapper, STEPS[1].expectedMove!)
    await btn(wrapper, '完成')!.trigger('click')
    // Assert: a soft reject must NOT latch aid → the run is still unaided
    expect(wrapper.emitted('complete')?.[0]).toEqual([true])
  })
})

// vue3-chessboard emits `move` BEFORE its own board.move(), so a reset made synchronously inside the
// move-made handler gets overwritten and the soft-rejected piece stays on the wrong square.
describe('LessonPlayer — soft reject waits for the move to land', () => {
  // Step 1 (Ne3→c4 is taught) also soft-rejects Ne3→g4.
  const SOFT_STEPS: LessonStep[] = [
    STEPS[0],
    { ...STEPS[1], softRejects: [{ from: 'e3', to: 'g4', note: 'g4 也行，但這課走 c4' }] },
  ]

  async function mountAtSoftStep(): Promise<VueWrapper> {
    const w = mount(LessonPlayer, { props: { steps: SOFT_STEPS, title: 'T', backTo: '/x', backLabel: 'b' } })
    await solveCurrent(w, STEPS[0].expectedMove!)
    await btn(w, '下一步')!.trigger('click')
    await flushPromises()
    return w
  }
  const emitMove = (w: VueWrapper, from: string, to: string, animationDoneAt: Promise<void>) =>
    w.findComponent({ name: 'ChessBoard' }).vm.$emit('move-made', { from, to, animationDoneAt })

  it('test_softReject_beforeMoveLands_doesNotReset_thenResetsOnce', async () => {
    // Arrange
    const w = await mountAtSoftStep()
    const landed = deferred()

    // Act
    await emitMove(w, 'e3', 'g4', landed.promise)
    await flushPromises()

    // Assert
    expect(resetPosition).not.toHaveBeenCalled()
    landed.resolve()
    await flushPromises()
    expect(resetPosition).toHaveBeenCalledTimes(1)
  })

  it('test_softReject_stepChangedWhileWaiting_doesNotReset', async () => {
    // Arrange
    const w = await mountAtSoftStep()
    const landed = deferred()
    await emitMove(w, 'e3', 'g4', landed.promise)

    // Act — leave the step before the move lands
    await btn(w, '上一步')!.trigger('click')
    landed.resolve()
    await flushPromises()

    // Assert
    expect(resetPosition).not.toHaveBeenCalled()
  })

  it('test_softReject_solvedWhileWaiting_doesNotReset', async () => {
    // Arrange
    const w = await mountAtSoftStep()
    const landed = deferred()
    await emitMove(w, 'e3', 'g4', landed.promise)

    // Act
    await emitMove(w, 'e3', 'c4', Promise.resolve())
    landed.resolve()
    await flushPromises()

    // Assert
    expect(resetPosition).not.toHaveBeenCalled()
  })

  it('test_correctMove_neverResets', async () => {
    // Arrange
    const w = await mountAtSoftStep()
    const landed = deferred()

    // Act
    await emitMove(w, 'e3', 'c4', landed.promise)
    landed.resolve()
    await flushPromises()

    // Assert
    expect(resetPosition).not.toHaveBeenCalled()
  })
})
