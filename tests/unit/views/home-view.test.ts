// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import HomeView from '@/views/HomeView.vue'
import { useJournalStore } from '@/stores/journal'

// A1 fix: HomeView is one of the settle-pipeline trigger points (棋誌 onset/arrival/solace
// never fire without a call site invoking journalStore.evaluate() — see stores/journal.ts).

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/learn', component: { template: '<div/>' } },
      { path: '/learn/:lessonId', component: { template: '<div/>' } },
      { path: '/dungeon', component: { template: '<div/>' } },
      { path: '/journal', component: { template: '<div/>' } },
      { path: '/play', component: { template: '<div/>' } },
    ],
  })
}

function mountView(pinia: ReturnType<typeof createPinia>) {
  const router = makeRouter()
  router.push('/')
  return mount(HomeView, { global: { plugins: [pinia, router] } })
}

describe('HomeView — A1: journal settle wiring', () => {
  it('calls journal.evaluate() (fire-and-forget) on mount', async () => {
    // Arrange
    const pinia = createPinia()
    setActivePinia(pinia)
    const journal = useJournalStore()
    const evaluateSpy = vi.spyOn(journal, 'evaluate').mockResolvedValue()

    // Act
    mountView(pinia)
    await flushPromises()

    // Assert
    expect(evaluateSpy).toHaveBeenCalledTimes(1)
  })

  it('does not block render while evaluate() is pending (fire-and-forget, no in-flight guard)', async () => {
    // Arrange — evaluate() hangs forever; the page must still mount and render.
    const pinia = createPinia()
    setActivePinia(pinia)
    const journal = useJournalStore()
    vi.spyOn(journal, 'evaluate').mockImplementation(() => new Promise(() => {}))

    // Act
    const wrapper = mountView(pinia)
    await flushPromises()

    // Assert — hero heading rendered even though evaluate() never resolved
    expect(wrapper.text()).toContain('棋盤未曾離開，你來了。')
  })
})
