import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { JournalEntry } from '@/types/journal'

const { loadMock, readLocalMock } = vi.hoisted(() => ({
  loadMock: vi.fn(),
  readLocalMock: vi.fn(),
}))

vi.mock('@/stores/data-sync', () => ({
  useDataSyncStore: () => ({
    loadJournalEntries: loadMock,
    readLocalJournalEntries: readLocalMock,
  }),
}))

import { useJournalStore } from '@/stores/journal'

function entry(o: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: o.id ?? o.sourceRefId ?? 'id',
    type: o.type ?? 'arrival',
    sourceRefId: o.sourceRefId ?? 'ref',
    volume: o.volume !== undefined ? o.volume : '卷一規則',
    templateId: o.templateId ?? 'arrival.1',
    params: o.params ?? {},
    body: o.body ?? 'x',
    createdAt: o.createdAt ?? 0,
  }
}

describe('useJournalStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('AC-3: load() merges cloud + local, deduped, newest-first with onset last', async () => {
    loadMock.mockResolvedValue([entry({ sourceRefId: 'arr', type: 'arrival', createdAt: 2 })])
    readLocalMock.mockReturnValue([
      entry({ sourceRefId: 'sol', type: 'solace', volume: '卷二戰術', createdAt: 3 }),
      entry({ sourceRefId: 'onset', type: 'onset', volume: null, createdAt: 1 }),
    ])

    const store = useJournalStore()
    await store.load()

    expect(store.entries.map((e) => e.sourceRefId)).toEqual(['sol', 'arr', 'onset'])
  })

  it('recent(n) returns the newest n entries', async () => {
    loadMock.mockResolvedValue([])
    readLocalMock.mockReturnValue([
      entry({ sourceRefId: 'a', createdAt: 1 }),
      entry({ sourceRefId: 'b', createdAt: 2 }),
      entry({ sourceRefId: 'c', createdAt: 3 }),
    ])
    const store = useJournalStore()
    await store.load()

    expect(store.recent(2).map((e) => e.sourceRefId)).toEqual(['c', 'b'])
  })

  it('byVolume() groups entries and excludes onset (volume null)', async () => {
    loadMock.mockResolvedValue([])
    readLocalMock.mockReturnValue([
      entry({ sourceRefId: 'onset', type: 'onset', volume: null, createdAt: 1 }),
      entry({ sourceRefId: 'r', type: 'arrival', volume: '卷一規則', createdAt: 2 }),
      entry({ sourceRefId: 's', type: 'solace', volume: '卷二戰術', createdAt: 3 }),
    ])
    const store = useJournalStore()
    await store.load()

    const groups = store.byVolume()
    expect(groups['卷一規則'].map((e) => e.sourceRefId)).toEqual(['r'])
    expect(groups['卷二戰術'].map((e) => e.sourceRefId)).toEqual(['s'])
    expect(groups['卷三開局']).toEqual([])
    expect(Object.values(groups).flat().some((e) => e.type === 'onset')).toBe(false)
  })
})
