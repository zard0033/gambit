// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest'
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

import JournalView from '@/views/JournalView.vue'
import { useJournalStore } from '@/stores/journal'
import { useDataSyncStore } from '@/stores/data-sync'
import type { JournalEntry } from '@/types/journal'

// A2 fix: default month expansion must apply exactly once (on first data arrival), not every
// time `expanded.size` happens to be 0 — otherwise a user who manually collapses everything
// gets forced back open when unrelated background data (e.g. a late evaluate() resolve)
// updates the entries list.

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/journal', component: JournalView },
    ],
  })
}

function entry(id: string, createdAt: number, overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id,
    type: 'arrival',
    sourceRefId: id,
    volume: '卷一規則',
    templateId: 'arrival.1',
    params: {},
    body: `entry ${id}`,
    createdAt,
    ...overrides,
  }
}

async function mountView(pinia: ReturnType<typeof createPinia>) {
  const router = makeRouter()
  router.push('/journal')
  await router.isReady()
  const wrapper = mount(JournalView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return wrapper
}

function setup(entries: JournalEntry[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const journal = useJournalStore()
  const dataSync = useDataSyncStore()
  journal.entries = entries
  vi.spyOn(journal, 'load').mockResolvedValue()
  vi.spyOn(dataSync, 'countGames').mockResolvedValue(0)
  return { pinia, journal }
}

describe('JournalView — A2: default month expansion is a one-time flag', () => {
  beforeEach(() => { vi.useRealTimers() })

  it('manually collapsing all months, then a background entries update, does not re-expand', async () => {
    // Arrange — two months so there is a real "most recent month" to auto-expand
    const now = Date.now()
    const oneMonthMs = 31 * 24 * 60 * 60 * 1000
    const entries = [entry('recent', now), entry('older', now - oneMonthMs)]
    const { pinia, journal } = setup(entries)
    const wrapper = await mountView(pinia)

    // Sanity: the most recent month starts expanded (aria-expanded="true")
    const monthButtons = () => wrapper.findAll('button[aria-expanded]')
    expect(monthButtons().length).toBeGreaterThan(0)
    expect(monthButtons()[0].attributes('aria-expanded')).toBe('true')

    // Act 1 — user manually collapses every month
    for (const btn of monthButtons()) {
      if (btn.attributes('aria-expanded') === 'true') await btn.trigger('click')
    }
    await flushPromises()
    expect(monthButtons().every((b) => b.attributes('aria-expanded') === 'false')).toBe(true)

    // Act 2 — background data update (simulates a late evaluate() resolve appending an entry)
    journal.entries = [entry('brand-new', now + 1000), ...entries]
    await wrapper.vm.$nextTick()
    await flushPromises()

    // Assert — still collapsed; the update must not force the most-recent month back open
    expect(monthButtons().every((b) => b.attributes('aria-expanded') === 'false')).toBe(true)
  })

  it('applies default expansion once when entries first arrive', async () => {
    // Arrange — mount with no entries yet (isEmpty state, no month buttons)
    const { pinia, journal } = setup([])
    const wrapper = await mountView(pinia)
    expect(wrapper.findAll('button[aria-expanded]').length).toBe(0)

    // Act — first entries arrive
    const now = Date.now()
    journal.entries = [entry('first', now)]
    await wrapper.vm.$nextTick()

    // Assert — the (only) month defaults to expanded
    const monthButtons = wrapper.findAll('button[aria-expanded]')
    expect(monthButtons.length).toBe(1)
    expect(monthButtons[0].attributes('aria-expanded')).toBe('true')
  })
})
