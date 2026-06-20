// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() }, from: vi.fn() },
}))
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

// Story-010 / AC-15 (deep-link half): /review?ply=N opens 棋憶 and mounts the replay with the cursor
// at ply N. Rule 22: the dashboard shows NO "saved to journal" CTA (the entry is automatic).
const COMPLETED_AT = 1700000000042

function seedAnalysis() {
  const entries = [
    { bestMove: 'a2a3', evalCp: 20, depthReached: 20, pass: 'deep' },
    { bestMove: 'a7a6', evalCp: -10, depthReached: 20, pass: 'deep' },
    { bestMove: 'b1c3', evalCp: 15, depthReached: 20, pass: 'deep' },
    { bestMove: 'b8c6', evalCp: -5, depthReached: 20, pass: 'deep' },
  ]
  sessionStorage.setItem(`pgr:analysis:${COMPLETED_AT}`, JSON.stringify(entries))
}
function setGame() {
  useGameStore().setCompletedGame({
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
    playerColor: 'white', result: '1/2-1/2', completedAt: COMPLETED_AT, aiSkillLevel: 1, playerMoveTimes: [],
  } as unknown as CompletedGame)
}

async function mountAtPly(ply: number) {
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/review', component: MemoryView },
      { path: '/learn/:lessonId', component: { template: '<div/>' } },
      { path: '/dungeon/:puzzleId', component: { template: '<div/>' } },
    ],
  })
  router.push(`/review?ply=${ply}`)
  await router.isReady()
  const wrapper = mount(MemoryView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
})

describe('棋憶 deep-link (story-010 / AC-15)', () => {
  it('test_deeplink_ply_mountsReplayWithCursorAtThatPly', async () => {
    seedAnalysis()
    setGame()
    const wrapper = await mountAtPly(2)
    // the replay nav read-out shows the cursor at ply 2 of 4
    expect(wrapper.text()).toContain('2 / 4')
  })

  it('test_dashboard_hasNoSavedToJournalCta (Rule 22)', async () => {
    seedAnalysis()
    setGame()
    const wrapper = await mountAtPly(0)
    // entry creation is automatic — never an action prompt on the surface
    expect(wrapper.text()).not.toContain('存到棋誌')
    expect(wrapper.text()).not.toContain('儲存到棋誌')
    expect(wrapper.text().toLowerCase()).not.toContain('saved to journal')
  })
})
