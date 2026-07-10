// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRecognitionSourceStore } from '@/stores/recognition-source'
import type { MissedMate } from '@/modules/learning-loop/missed-mate'

const STORAGE_KEY = 'pgr:recognition:sources'

const mate = (ply: number, uci = 'g5f7'): MissedMate => ({ ply, fen: `FEN_${ply}`, mateMoveUci: uci })

describe('useRecognitionSourceStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('test_captureMate_storesAndSurfacesPending', () => {
    const store = useRecognitionSourceStore()
    store.captureMate('g1', 'white', [mate(4)])

    expect(store.hasPending('mate')).toBe(true)
    const pending = store.pendingFor('mate')
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ gameId: 'g1', ply: 4, fen: 'FEN_4', playerColor: 'white' })
  })

  it('test_captureMate_idempotentByGameIdAndPly', () => {
    const store = useRecognitionSourceStore()
    store.captureMate('g1', 'white', [mate(4)])
    store.captureMate('g1', 'white', [mate(4)]) // same id → no duplicate

    expect(store.pendingFor('mate')).toHaveLength(1)
  })

  it('test_hasPending_falseForNonMateConcept', () => {
    const store = useRecognitionSourceStore()
    store.captureMate('g1', 'white', [mate(4)])
    expect(store.hasPending('fork')).toBe(false)
    expect(store.pendingFor('fork')).toEqual([])
  })

  it('test_pendingFor_returnsOnlyLatestGame', () => {
    const store = useRecognitionSourceStore()
    store.captureMate('g1', 'white', [mate(4)])
    store.captureMate('g2', 'white', [mate(8), mate(10)])

    const pending = store.pendingFor('mate')
    expect(pending.map((s) => s.ply)).toEqual([8, 10]) // g1 excluded — only the latest game
    expect(pending.every((s) => s.gameId === 'g2')).toBe(true)
  })

  it('test_markConsumed_excludesFromPendingAndHasPending', () => {
    const store = useRecognitionSourceStore()
    store.captureMate('g1', 'white', [mate(4)])
    store.markConsumed(['g1:4'])

    expect(store.hasPending('mate')).toBe(false)
    expect(store.pendingFor('mate')).toEqual([])
  })

  it('test_captureMate_skipsAlreadyConsumedId', () => {
    const store = useRecognitionSourceStore()
    store.captureMate('g1', 'white', [mate(4)])
    store.markConsumed(['g1:4'])
    store.captureMate('g1', 'white', [mate(4)]) // re-review → must not resurface

    expect(store.hasPending('mate')).toBe(false)
  })

  it('test_pendingFor_fallsToOlderGameWhenLatestFullyConsumed', () => {
    const store = useRecognitionSourceStore()
    store.captureMate('g1', 'white', [mate(4)])
    store.captureMate('g2', 'white', [mate(8)])
    store.markConsumed(['g2:8']) // newest game done → older one still pending

    const pending = store.pendingFor('mate')
    expect(pending.map((s) => s.gameId)).toEqual(['g1'])
  })

  it('test_persist_reloadsAcrossStoreInstances', () => {
    const store = useRecognitionSourceStore()
    store.captureMate('g1', 'white', [mate(4)])
    store.markConsumed(['g1:4'])
    store.captureMate('g2', 'black', [mate(6)])

    // Fresh pinia + store → must rehydrate sources AND consumed from localStorage.
    setActivePinia(createPinia())
    const reloaded = useRecognitionSourceStore()
    expect(reloaded.hasPending('mate')).toBe(true)
    expect(reloaded.pendingFor('mate').map((s) => s.ply)).toEqual([6])
  })

  it('test_markConsumed_prunesSourceEntry', () => {
    const store = useRecognitionSourceStore()
    store.captureMate('g1', 'white', [mate(4)])
    store.markConsumed(['g1:4'])

    expect(store.sources).toEqual([])
  })

  it('test_markConsumed_reReviewSameGameStillBlockedByConsumedGuard', () => {
    const store = useRecognitionSourceStore()
    store.captureMate('g1', 'white', [mate(4)])
    store.markConsumed(['g1:4'])
    store.captureMate('g1', 'white', [mate(4)]) // re-review of the same game/ply

    expect(store.sources).toEqual([]) // dedup guard (consumed set) still blocks re-capture
    expect(store.hasPending('mate')).toBe(false)
  })

  it('test_load_corruptJsonDegradesToEmpty', () => {
    localStorage.setItem(STORAGE_KEY, '{ not valid json')
    setActivePinia(createPinia())
    const store = useRecognitionSourceStore()
    expect(store.hasPending('mate')).toBe(false)
    expect(store.pendingFor('mate')).toEqual([])
  })

  it('test_captureMate_trimsToRecentGamesMax_dropsOldestGame', () => {
    const store = useRecognitionSourceStore()
    store.captureMate('g1', 'white', [mate(4)])
    store.captureMate('g2', 'white', [mate(8)])
    store.captureMate('g3', 'white', [mate(12)])
    store.captureMate('g4', 'white', [mate(16)]) // 4th distinct game → g1 must be evicted

    expect(store.sources.some((s) => s.gameId === 'g1')).toBe(false)
    expect(store.sources.map((s) => s.gameId).sort()).toEqual(['g2', 'g3', 'g4'])
    // pendingFor still only serves the latest game — trimming doesn't change that contract.
    expect(store.pendingFor('mate').map((s) => s.gameId)).toEqual(['g4'])
  })

  describe('kill switch (RECOGNITION_MISSED_MATE_ENABLED = false)', () => {
    afterEach(() => {
      vi.doUnmock('@/config/learning-loop-tuning')
      vi.resetModules()
    })

    it('test_pendingFor_killSwitchOff_returnsEmptyEvenForStoredSources', async () => {
      vi.resetModules()
      vi.doMock('@/config/learning-loop-tuning', async () => {
        const actual =
          await vi.importActual<typeof import('@/config/learning-loop-tuning')>(
            '@/config/learning-loop-tuning',
          )
        return { ...actual, RECOGNITION_MISSED_MATE_ENABLED: false }
      })

      const { useRecognitionSourceStore: useStoreFlagOff } = await import('@/stores/recognition-source')
      setActivePinia(createPinia())
      const store = useStoreFlagOff()
      // Data written while the flag was on (or by a stale write path) must still read as empty.
      store.captureMate('g1', 'white', [mate(4)])

      expect(store.hasPending('mate')).toBe(false)
      expect(store.pendingFor('mate')).toEqual([])
    })
  })
})
