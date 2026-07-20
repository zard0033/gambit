// @vitest-environment happy-dom
/**
 * Parallel-field coverage for the missed-material offense brick (Eason-approved §5 Q2: a NEW
 * `materialSources`/`captureMaterial`/`pendingFor('material')` surface, zero changes to the v1 mate
 * contract — see `tests/unit/stores/recognition-source-store.test.ts` for the untouched mate suite).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRecognitionSourceStore } from '@/stores/recognition-source'
import type { MissedMate } from '@/modules/learning-loop/missed-mate'
import type { MissedMaterial } from '@/modules/learning-loop/missed-material'

const STORAGE_KEY = 'pgr:recognition:sources'

const mate = (ply: number, uci = 'g5f7'): MissedMate => ({ ply, fen: `MATE_${ply}`, mateMoveUci: uci })
const material = (ply: number, uci = 'c3d5'): MissedMaterial => ({
  ply,
  fen: `MAT_${ply}`,
  captureMoveUci: uci,
})

describe('useRecognitionSourceStore — material (parallel to mate)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('test_captureMaterial_storesAndSurfacesPending', () => {
    const store = useRecognitionSourceStore()
    store.captureMaterial('g1', 'white', [material(4)])

    expect(store.hasPending('material')).toBe(true)
    const pending = store.pendingFor('material')
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ gameId: 'g1', ply: 4, fen: 'MAT_4', playerColor: 'white' })
  })

  it('test_captureMaterial_idempotentByGameIdAndPly', () => {
    const store = useRecognitionSourceStore()
    store.captureMaterial('g1', 'white', [material(4)])
    store.captureMaterial('g1', 'white', [material(4)]) // same id → no duplicate

    expect(store.pendingFor('material')).toHaveLength(1)
  })

  it('test_pendingFor_material_returnsOnlyLatestGame', () => {
    const store = useRecognitionSourceStore()
    store.captureMaterial('g1', 'white', [material(4)])
    store.captureMaterial('g2', 'white', [material(8), material(10)])

    const pending = store.pendingFor('material')
    expect(pending.map((s) => s.ply)).toEqual([8, 10])
    expect(pending.every((s) => s.gameId === 'g2')).toBe(true)
  })

  it('test_markConsumed_material_excludesFromPendingAndHasPending', () => {
    const store = useRecognitionSourceStore()
    store.captureMaterial('g1', 'white', [material(4)])
    store.markConsumed(['g1:4'])

    expect(store.hasPending('material')).toBe(false)
    expect(store.pendingFor('material')).toEqual([])
  })

  it('test_markConsumed_material_prunesSourceEntry', () => {
    const store = useRecognitionSourceStore()
    store.captureMaterial('g1', 'white', [material(4)])
    store.markConsumed(['g1:4'])

    expect(store.materialSources).toEqual([])
  })

  it('test_captureMaterial_trimsToRecentGamesMax_dropsOldestGame', () => {
    const store = useRecognitionSourceStore()
    store.captureMaterial('g1', 'white', [material(4)])
    store.captureMaterial('g2', 'white', [material(8)])
    store.captureMaterial('g3', 'white', [material(12)])
    store.captureMaterial('g4', 'white', [material(16)]) // 4th distinct game → g1 evicted

    expect(store.materialSources.some((s) => s.gameId === 'g1')).toBe(false)
    expect(store.materialSources.map((s) => s.gameId).sort()).toEqual(['g2', 'g3', 'g4'])
    expect(store.pendingFor('material').map((s) => s.gameId)).toEqual(['g4'])
  })

  it('test_persist_material_reloadsAcrossStoreInstances', () => {
    const store = useRecognitionSourceStore()
    store.captureMaterial('g1', 'white', [material(4)])
    store.markConsumed(['g1:4'])
    store.captureMaterial('g2', 'black', [material(6)])

    setActivePinia(createPinia())
    const reloaded = useRecognitionSourceStore()
    expect(reloaded.hasPending('material')).toBe(true)
    expect(reloaded.pendingFor('material').map((s) => s.ply)).toEqual([6])
  })

  it('test_mateAndMaterial_areIndependentArrays', () => {
    // Writing mate sources must not surface as material pending, and vice versa — the two are
    // genuinely parallel, not aliases of the same underlying array.
    const store = useRecognitionSourceStore()
    store.captureMate('g1', 'white', [mate(4)])
    store.captureMaterial('g1', 'white', [material(4)])

    expect(store.pendingFor('mate')).toHaveLength(1)
    expect(store.pendingFor('material')).toHaveLength(1)
    expect(store.sources).toHaveLength(1)
    expect(store.materialSources).toHaveLength(1)
  })

  it('test_markConsumed_sharedConsumedSet_blocksBothMateAndMaterialSameId', () => {
    // Same gameId:ply consumed for one concept also blocks recapture under the other — the
    // consumed-id namespace is intentionally shared (store module doc).
    const store = useRecognitionSourceStore()
    store.markConsumed(['g1:4'])
    store.captureMate('g1', 'white', [mate(4)])
    store.captureMaterial('g1', 'white', [material(4)])

    expect(store.hasPending('mate')).toBe(false)
    expect(store.hasPending('material')).toBe(false)
  })

  it('test_load_corruptJson_material_degradesToEmpty', () => {
    localStorage.setItem(STORAGE_KEY, '{ not valid json')
    setActivePinia(createPinia())
    const store = useRecognitionSourceStore()
    expect(store.hasPending('material')).toBe(false)
    expect(store.pendingFor('material')).toEqual([])
  })

  it('test_load_preV2LocalStorage_missingMaterialSourcesField_defaultsToEmpty', () => {
    // Simulates data written before this brick shipped: `materialSources` key absent entirely.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sources: [], consumed: [] }))
    setActivePinia(createPinia())
    const store = useRecognitionSourceStore()
    expect(store.materialSources).toEqual([])
    expect(store.pendingFor('material')).toEqual([])
  })

  describe('kill switch (RECOGNITION_MISSED_MATERIAL_ENABLED = false)', () => {
    afterEach(() => {
      vi.doUnmock('@/config/learning-loop-tuning')
      vi.resetModules()
    })

    it('test_pendingFor_material_killSwitchOff_returnsEmptyEvenForStoredSources', async () => {
      vi.resetModules()
      vi.doMock('@/config/learning-loop-tuning', async () => {
        const actual =
          await vi.importActual<typeof import('@/config/learning-loop-tuning')>(
            '@/config/learning-loop-tuning',
          )
        return { ...actual, RECOGNITION_MISSED_MATERIAL_ENABLED: false }
      })

      const { useRecognitionSourceStore: useStoreFlagOff } = await import('@/stores/recognition-source')
      setActivePinia(createPinia())
      const store = useStoreFlagOff()
      store.captureMaterial('g1', 'white', [material(4)])

      expect(store.hasPending('material')).toBe(false)
      expect(store.pendingFor('material')).toEqual([])
    })

    it('test_pendingFor_material_killSwitchOff_mateStillUnaffected', async () => {
      vi.resetModules()
      vi.doMock('@/config/learning-loop-tuning', async () => {
        const actual =
          await vi.importActual<typeof import('@/config/learning-loop-tuning')>(
            '@/config/learning-loop-tuning',
          )
        return { ...actual, RECOGNITION_MISSED_MATERIAL_ENABLED: false }
      })

      const { useRecognitionSourceStore: useStoreFlagOff } = await import('@/stores/recognition-source')
      setActivePinia(createPinia())
      const store = useStoreFlagOff()
      store.captureMate('g1', 'white', [mate(4)])

      expect(store.hasPending('mate')).toBe(true)
    })
  })
})
