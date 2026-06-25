// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { ResumePayload, ResumeSnapshot } from '@/types/resume'

const upsertResumeGame = vi.fn().mockResolvedValue(true)
const deleteResumeGame = vi.fn().mockResolvedValue(true)
const loadResumeGame = vi.fn<() => Promise<ResumeSnapshot | null>>().mockResolvedValue(null)

vi.mock('@/stores/data-sync', () => ({
  useDataSyncStore: () => ({ upsertResumeGame, deleteResumeGame, loadResumeGame }),
}))

import { useResumeGameStore } from '@/stores/resume-game'

const STORAGE_KEY = 'pgr:resume:game'

function payload(over: Partial<ResumePayload> = {}): ResumePayload {
  return { moves: ['e2e4', 'e7e5'], playerColor: 'white', level: 5, playerMoveTimes: [1200], ...over }
}

describe('useResumeGameStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    loadResumeGame.mockResolvedValue(null)
    localStorage.clear()
  })

  it('saveLocal writes to localStorage and exposes current + hasResume with a stamped updatedAt', () => {
    const store = useResumeGameStore()
    expect(store.hasResume).toBe(false)

    store.saveLocal(payload({ level: 9 }))

    expect(store.hasResume).toBe(true)
    expect(store.current?.level).toBe(9)
    expect(typeof store.current?.updatedAt).toBe('number')
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) as string)
    expect(persisted.moves).toEqual(['e2e4', 'e7e5'])
  })

  it('hydrates current from existing localStorage on init', () => {
    const snap: ResumeSnapshot = { ...payload(), updatedAt: 1_700_000_000_000 }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap))

    const store = useResumeGameStore()
    expect(store.current?.updatedAt).toBe(1_700_000_000_000)
  })

  it('treats corrupt localStorage as no resume', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    const store = useResumeGameStore()
    expect(store.hasResume).toBe(false)
  })

  it('clear removes the local snapshot and deletes the cloud copy', async () => {
    const store = useResumeGameStore()
    store.saveLocal(payload())

    await store.clear()

    expect(store.hasResume).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(deleteResumeGame).toHaveBeenCalledOnce()
  })

  it('syncToCloud pushes the current snapshot (no-op when empty)', async () => {
    const store = useResumeGameStore()
    await store.syncToCloud()
    expect(upsertResumeGame).not.toHaveBeenCalled()

    store.saveLocal(payload())
    await store.syncToCloud()
    expect(upsertResumeGame).toHaveBeenCalledOnce()
  })

  describe('reconcileOnLogin — last-write-wins', () => {
    it('pulls the cloud copy down when it is newer than local', async () => {
      const store = useResumeGameStore()
      store.saveLocal(payload({ level: 3 })) // local stamped ~now
      const cloud: ResumeSnapshot = { ...payload({ level: 12 }), updatedAt: Date.now() + 100_000 }
      loadResumeGame.mockResolvedValue(cloud)

      await store.reconcileOnLogin()

      expect(store.current?.level).toBe(12)
      expect(upsertResumeGame).not.toHaveBeenCalled()
    })

    it('pushes local up when it is at least as new as cloud', async () => {
      const store = useResumeGameStore()
      const cloud: ResumeSnapshot = { ...payload({ level: 12 }), updatedAt: 1 } // ancient
      loadResumeGame.mockResolvedValue(cloud)
      store.saveLocal(payload({ level: 3 })) // local stamped ~now (newer)

      await store.reconcileOnLogin()

      expect(store.current?.level).toBe(3)
      expect(upsertResumeGame).toHaveBeenCalledOnce()
    })

    it('does nothing when both local and cloud are empty', async () => {
      const store = useResumeGameStore()
      loadResumeGame.mockResolvedValue(null)

      await store.reconcileOnLogin()

      expect(store.hasResume).toBe(false)
      expect(upsertResumeGame).not.toHaveBeenCalled()
    })
  })
})
