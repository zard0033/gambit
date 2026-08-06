import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { MemoryGameSummary } from '@/types/memory'

const { loadMock, readLocalMock, appendMock, flushMock } = vi.hoisted(() => ({
  loadMock: vi.fn(),
  readLocalMock: vi.fn(),
  appendMock: vi.fn(),
  flushMock: vi.fn(),
}))

vi.mock('@/stores/data-sync', () => ({
  useDataSyncStore: () => ({
    loadMemorySummaries: loadMock,
    readLocalMemorySummaries: readLocalMock,
    appendMemorySummary: appendMock,
    flushMemoryQueue: flushMock,
  }),
}))

import { useMemoryStore } from '@/stores/memory'

function summary(o: Partial<MemoryGameSummary> = {}): MemoryGameSummary {
  return {
    schemaVersion: o.schemaVersion ?? 1,
    gameId: o.gameId ?? 'g',
    createdAt: o.createdAt ?? 0,
    stageCounts: o.stageCounts ?? { opening: 0, middlegame: 1, endgame: 0 },
    conceptCounts: o.conceptCounts ?? {},
    anchorStage: o.anchorStage ?? null,
  }
}

describe('useMemoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('load() merges cloud ∪ local, deduped by gameId (cloud wins), current schema only', async () => {
    loadMock.mockResolvedValue([summary({ gameId: 'g1', createdAt: 2 })])
    readLocalMock.mockReturnValue([
      summary({ gameId: 'g1', createdAt: 99 }), // dup gameId → cloud wins
      summary({ gameId: 'g2', createdAt: 3 }),
      summary({ gameId: 'old', schemaVersion: 0 }), // stale schema → ignored
    ])
    const store = useMemoryStore()
    await store.load()

    expect(store.summaries.map((s) => s.gameId).sort()).toEqual(['g1', 'g2'])
    expect(store.summaries.find((s) => s.gameId === 'g1')?.createdAt).toBe(2)
  })

  it('recordGame() appends then reloads', async () => {
    loadMock.mockResolvedValue([])
    readLocalMock.mockReturnValue([])
    appendMock.mockResolvedValue(undefined)
    const store = useMemoryStore()

    await store.recordGame(summary({ gameId: 'gX' }))

    expect(appendMock).toHaveBeenCalledOnce()
    expect(loadMock).toHaveBeenCalled()
  })

  it('reconcileOnLogin() flushes then reloads', async () => {
    loadMock.mockResolvedValue([])
    readLocalMock.mockReturnValue([])
    flushMock.mockResolvedValue(undefined)
    const store = useMemoryStore()

    await store.reconcileOnLogin()

    expect(flushMock).toHaveBeenCalledOnce()
    expect(loadMock).toHaveBeenCalled()
  })
})
