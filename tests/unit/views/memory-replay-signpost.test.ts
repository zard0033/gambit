// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() }, from: vi.fn() },
}))

// Stub the real board — the lichess pgn-viewer ESM subpath fails to resolve under vitest, and this
// suite pins the signpost contract, not the board. (Same approach as the old review-view test.)
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

import MemoryView from '@/views/MemoryView.vue'
import { useGameStore, type CompletedGame } from '@/stores/game-store'

// Bridge 3 signpost gating in the dense replay (GDD §3.4 D2; AC-9, AC-9b). The signpost behaviour
// moved from ReviewView into 棋憶's MemoryReplay sub-view (story-007/009 restructure); this pins the
// same VIEW contract: never in the default render, only behind the Show-detail opt-in, inside
// review-detail-panel. We enter the replay sub-view via the (gameId, ply) deep-link (?ply=0).
const COMPLETED_AT = 1700000000000

interface Entry { bestMove: string | null; evalCp?: number; evalMate?: number; depthReached: number; pass: 'deep' }

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/review', component: MemoryView },
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
    moves, playerColor: 'white', result: '0-1', completedAt: COMPLETED_AT, aiSkillLevel: 1, playerMoveTimes: [],
  } as unknown as CompletedGame
  useGameStore().setCompletedGame(game)
}

/** Mount 棋憶 and deep-link straight into the replay sub-view at ply 0 (?ply=0). */
async function mountReplay() {
  const router = makeRouter()
  router.push('/review?ply=0')
  await router.isReady()
  const wrapper = mount(MemoryView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
})

describe('MemoryReplay — Bridge 3 signpost (AC-9b)', () => {
  it('test_replay_signalFires_signpostHiddenUntilOptIn_thenInsideDetailPanel', async () => {
    // Move 0 (White) walks into a forced mate: eval at position 1 (Black to move) is mate-for-mover.
    // allowedForcedMate(0) is true → classify 'mate' → a signpost sits on move 0 (the replay's ply).
    seedAnalysis([
      { bestMove: 'a2a3', evalCp: 20, depthReached: 20, pass: 'deep' },
      { bestMove: 'a7a6', evalMate: 1, depthReached: 20, pass: 'deep' },
    ])
    setGame(['e2e4', 'e7e5'])
    const wrapper = await mountReplay()

    expect(wrapper.find('[data-testid="concept-signpost"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="review-detail-panel"]').exists()).toBe(false)

    const toggle = wrapper.findAll('button').find((b) => b.text().includes('顯示細節'))
    expect(toggle).toBeTruthy()
    await toggle!.trigger('click')
    await flushPromises()

    const panel = wrapper.find('[data-testid="review-detail-panel"]')
    expect(panel.exists()).toBe(true)
    const signpost = panel.find('[data-testid="concept-signpost"]')
    expect(signpost.exists()).toBe(true)
    expect(signpost.text()).toContain('將殺')
  })
})

describe('MemoryReplay — default render unchanged when nothing classifies (AC-9)', () => {
  it('test_replay_noClassifiableMistake_noSignpostAnywhere', async () => {
    seedAnalysis([
      { bestMove: 'a2a3', evalCp: 20, depthReached: 20, pass: 'deep' },
      { bestMove: 'a7a6', evalCp: -10, depthReached: 20, pass: 'deep' },
    ])
    setGame(['e2e4', 'e7e5'])
    const wrapper = await mountReplay()

    expect(wrapper.find('[data-testid="concept-signpost"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="review-detail-panel"]').exists()).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text().includes('顯示細節'))).toBe(false)
  })
})
