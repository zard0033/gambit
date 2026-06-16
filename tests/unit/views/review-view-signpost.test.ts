// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() }, from: vi.fn() },
}))

// Stub the real board — the lichess pgn-viewer ESM subpath fails to resolve under vitest,
// and this suite pins the signpost contract, not the board. (Same approach as replay-view.test.ts.)
vi.mock('@/components/pgn-viewer.vue', () => ({
  default: defineComponent({
    name: 'PgnViewer',
    emits: ['move-selected'],
    setup(_props, { expose }) {
      expose({ toPly: vi.fn(), setBestArrow: vi.fn(), getCurrentPly: () => 0 })
      return () => h('div', { class: 'pgn-stub' })
    },
  }),
}))

import ReviewView from '@/views/ReviewView.vue'
import { useGameStore, type CompletedGame } from '@/stores/game-store'

// S-Phase-C — Bridge 3 signpost gating in the review (GDD §3.4 D2; AC-9, AC-9b). The classifier
// itself is unit-tested in classify.test.ts; this pins the VIEW contract: the signpost is never in
// the default render, only appears behind the Show-detail opt-in, and lives inside review-detail-panel.
//
// The fixtures place the classified move at index 0 (the review opens on cursor 0), so the assertion
// needs no navigation — keeping the test independent of #7's separate cursor-nav wiring.

const COMPLETED_AT = 1700000000000

interface Entry {
  bestMove: string | null
  evalCp?: number
  evalMate?: number
  depthReached: number
  pass: 'deep'
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/review', component: ReviewView },
      { path: '/learn/:lessonId', component: { template: '<div/>' } },
      { path: '/dungeon/:puzzleId', component: { template: '<div/>' } },
    ],
  })
}

/** Seed deep analysis into sessionStorage so init() restores COMPLETE without running the engine. */
function seedAnalysis(entries: Entry[]) {
  sessionStorage.setItem(`pgr:analysis:${COMPLETED_AT}`, JSON.stringify(entries))
}

function setGame(moves: string[]) {
  const game = {
    moves,
    playerColor: 'white',
    result: '0-1',
    completedAt: COMPLETED_AT,
    aiSkillLevel: 1,
    playerMoveTimes: [],
  } as unknown as CompletedGame
  useGameStore().setCompletedGame(game)
}

async function mountReview() {
  const router = makeRouter()
  router.push('/review')
  await router.isReady()
  const wrapper = mount(ReviewView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
})

describe('ReviewView — Bridge 3 signpost (AC-9b)', () => {
  it('test_review_signalFires_signpostHiddenUntilOptIn_thenInsideDetailPanel', async () => {
    // Move 0 (White) walks into a forced mate: eval at position 1 (Black to move) is mate-for-mover.
    // allowedForcedMate(0) is true → classify 'mate' → a signpost sits on move 0 (the opening cursor).
    seedAnalysis([
      { bestMove: 'a2a3', evalCp: 20, depthReached: 20, pass: 'deep' },
      { bestMove: 'a7a6', evalMate: 1, depthReached: 20, pass: 'deep' },
    ])
    setGame(['e2e4', 'e7e5'])
    const wrapper = await mountReview()

    // Default render (detail not opened): no signpost, no detail panel.
    expect(wrapper.find('[data-testid="concept-signpost"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="review-detail-panel"]').exists()).toBe(false)

    // Opt in via the Show-detail affordance.
    const toggle = wrapper.findAll('button').find((b) => b.text().includes('顯示細節'))
    expect(toggle).toBeTruthy()
    await toggle!.trigger('click')
    await flushPromises()

    // Signpost now present AND a descendant of the detail panel (never a sibling of the default render).
    const panel = wrapper.find('[data-testid="review-detail-panel"]')
    expect(panel.exists()).toBe(true)
    const signpost = panel.find('[data-testid="concept-signpost"]')
    expect(signpost.exists()).toBe(true)
    expect(signpost.text()).toContain('將殺')
  })
})

describe('ReviewView — default render unchanged when nothing classifies (AC-9)', () => {
  it('test_review_noClassifiableMistake_noSignpostAnywhere', async () => {
    // No mate signal and a non-capturing reply → classify returns none for move 0.
    seedAnalysis([
      { bestMove: 'a2a3', evalCp: 20, depthReached: 20, pass: 'deep' },
      { bestMove: 'a7a6', evalCp: -10, depthReached: 20, pass: 'deep' },
    ])
    setGame(['e2e4', 'e7e5'])
    const wrapper = await mountReview()

    expect(wrapper.find('[data-testid="concept-signpost"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="review-detail-panel"]').exists()).toBe(false)
    // The Show-detail opt-in does not even appear when there is nothing to reveal.
    expect(wrapper.findAll('button').some((b) => b.text().includes('顯示細節'))).toBe(false)
  })
})
