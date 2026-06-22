// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import LessonPlayer from '@/components/lesson/LessonPlayer.vue'
import type { LessonStep } from '@/types/lesson'

// LessonPlayer's `complete` emit reports `unaided` (no wrong move / hint / reveal anywhere in the run)
// — the deepen wrap-up's "you saw it yourself" acknowledgment hinges on it. This pins that latch.

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// Stub the real board: emit move-made on demand + expose the methods LessonPlayer's board ref calls.
vi.mock('@/components/chess-board.vue', () => ({
  default: defineComponent({
    name: 'ChessBoard',
    props: ['fen', 'playerColor', 'disabled', 'coordinates'],
    emits: ['move-made'],
    setup(_props, { expose }) {
      expose({ boardRef: null, squareToRect: () => null, resetPosition: vi.fn(), reapplyFen: vi.fn() })
      return () => null
    },
  }),
}))

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
})
