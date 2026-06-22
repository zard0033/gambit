// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import JournalEntryCard from '@/components/journal/JournalEntryCard.vue'
import type { JournalEntry } from '@/types/journal'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'e1',
    type: 'solace',
    sourceRefId: 'game-abc',
    volume: '卷二戰術',
    templateId: 'solace.1',
    params: {},
    body: '今天輸了，但你撐得更久。',
    createdAt: 1_700_000_000_000,
    ...overrides,
  }
}

describe('JournalEntryCard — game-linked tap (memory GDD Rule 23)', () => {
  beforeEach(() => push.mockClear())

  it('a solace entry is an interactive button carrying the 回到那盤 affordance', () => {
    const w = mount(JournalEntryCard, { props: { entry: entry() } })
    const card = w.get('.journal-card')
    expect(card.attributes('role')).toBe('button')
    expect(card.attributes('tabindex')).toBe('0')
    expect(w.text()).toContain('回到那盤')
  })

  it("tapping a solace entry opens that game's 棋憶 by gameId (sourceRefId)", async () => {
    const w = mount(JournalEntryCard, { props: { entry: entry({ sourceRefId: 'game-xyz' }) } })
    await w.get('.journal-card').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'review', query: { gameId: 'game-xyz' } })
  })

  it.each(['onset', 'arrival'] as const)('a milestone %s entry is not interactive', (type) => {
    const sourceRefId = type === 'onset' ? 'onset' : 'stage-1'
    const w = mount(JournalEntryCard, { props: { entry: entry({ type, sourceRefId }) } })
    const card = w.get('.journal-card')
    expect(card.attributes('role')).toBeUndefined()
    expect(card.attributes('tabindex')).toBeUndefined()
    expect(w.text()).not.toContain('回到那盤')
  })

  it('clicking a milestone entry does not navigate', async () => {
    const w = mount(JournalEntryCard, { props: { entry: entry({ type: 'onset', sourceRefId: 'onset' }) } })
    await w.get('.journal-card').trigger('click')
    expect(push).not.toHaveBeenCalled()
  })
})
