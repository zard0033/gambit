// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() }, from: vi.fn() },
}))

import ConceptDeepenView from '@/views/ConceptDeepenView.vue'
import RecognitionFieldView from '@/views/RecognitionFieldView.vue'
import LessonPlayer from '@/components/lesson/LessonPlayer.vue'
import RecognitionGate from '@/components/lesson/RecognitionGate.vue'
import DeepeningWrapUp from '@/components/lesson/DeepeningWrapUp.vue'
import { useConceptProgressStore } from '@/stores/concept-progress'
import { useRecognitionSourceStore } from '@/stores/recognition-source'

// 判斷場搬遷（positioning-v2 前置，2026-08-03）：RecognitionGate 從 ConceptDeepenView 的內部相位
// 拆成 RecognitionFieldView 這個獨立路由。跨路由沒有共享的記憶體狀態，lessonUnaided 必須靠
// query string 傳遞——這是整段搬遷唯一會「靜默漏發」epiphany 的風險點，本檔就是為了鎖住它。
// shallowMount：LessonPlayer/RecognitionGate 內部會掛真的 chessground，不是本測試要驗的東西，
// 用 stub 直接驅動 @complete 事件即可。

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/learn/concepts', component: { template: '<div/>' } },
      { path: '/learn/concept/:conceptId', name: 'concept-deepen', component: ConceptDeepenView },
      { path: '/learn/concept/:conceptId/judge', name: 'concept-judge', component: RecognitionFieldView },
    ],
  })
}

async function mountDeepenAt(conceptId: string, query: Record<string, string> = {}) {
  const router = makeRouter()
  router.push({ name: 'concept-deepen', params: { conceptId }, query })
  await router.isReady()
  const wrapper = shallowMount(ConceptDeepenView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

async function mountJudgeAt(conceptId: string, query: Record<string, string> = {}) {
  const router = makeRouter()
  router.push({ name: 'concept-judge', params: { conceptId }, query })
  await router.isReady()
  const wrapper = shallowMount(RecognitionFieldView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('ConceptDeepenView → judge route handoff', () => {
  it('test_onLessonDone_conceptWithJudgementField_pushesToJudgeRouteWithUnaidedQuery', async () => {
    const { wrapper, router } = await mountDeepenAt('fork') // fork has a canned recognitionSet
    wrapper.findComponent(LessonPlayer).vm.$emit('complete', true)
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('concept-judge')
    expect(router.currentRoute.value.params.conceptId).toBe('fork')
    expect(router.currentRoute.value.query.unaided).toBe('1')
  })

  it('test_onLessonDone_lessonAided_pushesUnaidedQueryZero', async () => {
    const { wrapper, router } = await mountDeepenAt('fork')
    wrapper.findComponent(LessonPlayer).vm.$emit('complete', false)
    await flushPromises()

    expect(router.currentRoute.value.query.unaided).toBe('0')
  })

  it('test_onLessonDone_conceptWithoutJudgementField_finishesInPlaceNoNavigation', async () => {
    // material has no recognitionSet — must NOT navigate to a judge route that doesn't exist for it.
    const { wrapper, router } = await mountDeepenAt('material')
    wrapper.findComponent(LessonPlayer).vm.$emit('complete', true)
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('concept-deepen')
    expect(wrapper.findComponent(DeepeningWrapUp).exists()).toBe(true)
  })
})

describe('RecognitionFieldView — epiphany requires both phases unaided', () => {
  it('test_onRecognitionDone_bothPhasesUnaided_marksEpiphany', async () => {
    const { wrapper } = await mountJudgeAt('fork', { unaided: '1' })
    wrapper.findComponent(RecognitionGate).vm.$emit('complete', true)
    await flushPromises()

    const progress = useConceptProgressStore()
    expect(progress.isDeepened('fork')).toBe(true)
    expect(progress.deepenedUnaided.has('fork')).toBe(true)
  })

  it('test_onRecognitionDone_lessonPhaseWasAided_doesNotMarkEpiphany', async () => {
    // Query says the LessonPlayer phase needed a hint — even a clean gate run must not fire epiphany.
    const { wrapper } = await mountJudgeAt('fork', { unaided: '0' })
    wrapper.findComponent(RecognitionGate).vm.$emit('complete', true)
    await flushPromises()

    const progress = useConceptProgressStore()
    expect(progress.isDeepened('fork')).toBe(true) // still records "deepened", just not "unaided"
    expect(progress.deepenedUnaided.has('fork')).toBe(false)
  })

  it('test_onRecognitionDone_gatePhaseWasMissed_doesNotMarkEpiphany', async () => {
    const { wrapper } = await mountJudgeAt('fork', { unaided: '1' })
    wrapper.findComponent(RecognitionGate).vm.$emit('complete', false)
    await flushPromises()

    const progress = useConceptProgressStore()
    expect(progress.deepenedUnaided.has('fork')).toBe(false)
  })

  it('test_onRecognitionDone_missingUnaidedQuery_defaultsToAidedNeverPhantomFiresEpiphany', async () => {
    // Malformed/absent query (e.g. a stale deep link) must fail safe: never phantom-fire epiphany.
    const { wrapper } = await mountJudgeAt('fork', {})
    wrapper.findComponent(RecognitionGate).vm.$emit('complete', true)
    await flushPromises()

    const progress = useConceptProgressStore()
    expect(progress.deepenedUnaided.has('fork')).toBe(false)
  })
})

describe('RecognitionFieldView — 只吃公版題（wave 2 之後）', () => {
  // 玩家自己漏看的將殺不再走這條路：棋憶頁的深青互動格就地承接（wave 2，2026-09），
  // `?source=recognition` 與 runtime set 已隨路標一起刪除。這裡守的是「這頁只認公版題」。
  it('test_judgeView_pendingMissedMate_stillServesCannedSetAndLeavesItUnconsumed', async () => {
    const source = useRecognitionSourceStore()
    source.captureMate('game-1', 'black', [
      { ply: 5, fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', mateMoveUci: 'a1a8' },
    ])

    const { wrapper } = await mountJudgeAt('mate', { unaided: '1' })
    const gate = wrapper.findComponent(RecognitionGate)

    expect(gate.props('playerColor')).toBe('white') // 公版題一律白方先手
    expect(gate.props('set').boards).not.toContainEqual(
      expect.objectContaining({ fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1' }),
    )

    gate.vm.$emit('complete', true)
    await flushPromises()

    // 這一題屬於棋憶頁，不該被概念地圖的公版題流程順手消費掉。
    expect(source.pendingFor('mate')).toHaveLength(1)
  })
})
