// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { JournalEntry } from '@/types/journal'

const { appendMock, loadEntriesMock, readLocalMock, completedSet, gameEntries } = vi.hoisted(() => ({
  appendMock: vi.fn(),
  loadEntriesMock: vi.fn(),
  readLocalMock: vi.fn(),
  completedSet: { value: new Set<string>() },
  gameEntries: { value: [] as { id: string; playerResult: string }[] },
}))

vi.mock('@/stores/data-sync', () => ({
  useDataSyncStore: () => ({
    appendJournalEntry: appendMock,
    loadJournalEntries: loadEntriesMock,
    readLocalJournalEntries: readLocalMock,
  }),
}))
vi.mock('@/stores/lesson-progress', () => ({
  useLessonProgressStore: () => ({ completed: completedSet.value }),
}))
vi.mock('@/stores/game-history', () => ({
  useGameHistoryStore: () => ({ entries: gameEntries.value, fetchHistory: vi.fn().mockResolvedValue(undefined) }),
}))

import { useJournalStore } from '@/stores/journal'

const T0 = 1_700_000_000_000

describe('useJournalStore.evaluate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    completedSet.value = new Set()
    gameEntries.value = []
    loadEntriesMock.mockResolvedValue([])
    readLocalMock.mockReturnValue([])
  })

  it('AC-onset-1: first session with no data writes exactly one onset entry', async () => {
    const store = useJournalStore()
    await store.evaluate(T0)

    expect(appendMock).toHaveBeenCalledTimes(1)
    const written = appendMock.mock.calls[0][0] as JournalEntry
    expect(written.type).toBe('onset')
    expect(written.sourceRefId).toBe('onset')
    expect(written.body.length).toBeGreaterThan(0)
  })

  it('AC-onset-2: writes no onset when one already exists', async () => {
    loadEntriesMock.mockResolvedValue([
      { id: 'x', type: 'onset', sourceRefId: 'onset', volume: null, templateId: 'onset.1', params: {}, body: 'b', createdAt: 1 },
    ])
    const store = useJournalStore()
    await store.evaluate(T0)

    expect(appendMock).not.toHaveBeenCalled()
  })

  it('writes nothing when there is no eligible candidate', async () => {
    // onset already exists, no completed stages, no losses
    loadEntriesMock.mockResolvedValue([
      { id: 'x', type: 'onset', sourceRefId: 'onset', volume: null, templateId: 'onset.1', params: {}, body: 'b', createdAt: 1 },
    ])
    gameEntries.value = [{ id: 'g1', playerResult: 'Win' }]
    const store = useJournalStore()
    await store.evaluate(T0)

    expect(appendMock).not.toHaveBeenCalled()
  })
})
