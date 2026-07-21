// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const loadThemePreference = vi.fn().mockResolvedValue(null)
const upsertThemePreference = vi.fn().mockResolvedValue(undefined)

vi.mock('@/stores/data-sync', () => ({
  useDataSyncStore: () => ({ loadThemePreference, upsertThemePreference }),
}))

import { useUiStore } from '@/stores/ui-store'

describe('useUiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    loadThemePreference.mockResolvedValue(null)
    localStorage.clear()
  })

  it('is importable and returns a store', () => {
    const store = useUiStore()
    expect(store).toBeDefined()
  })

  describe('reconcileOnLogin — theme sync', () => {
    it('test_reconcileOnLogin_neverChosen_doesNotPushOsDefaultToCloud', async () => {
      // Arrange: fresh device, user never called setTheme() → storedThemeAt() stays 0
      const store = useUiStore()

      // Act
      await store.reconcileOnLogin()

      // Assert: an OS-derived default must not be persisted as if it were a real choice
      expect(upsertThemePreference).not.toHaveBeenCalled()
    })

    it('test_reconcileOnLogin_explicitChoice_pushesLocalWhenNoCloudRow', async () => {
      // Arrange
      const store = useUiStore()
      store.setTheme('noir') // explicit choice → stamps a real updatedAt
      upsertThemePreference.mockClear() // ignore the push triggered by setTheme itself

      // Act
      await store.reconcileOnLogin()

      // Assert
      expect(upsertThemePreference).toHaveBeenCalledWith('noir', expect.any(Number))
    })

    it('test_reconcileOnLogin_cloudNewer_adoptsRemoteTheme', async () => {
      // Arrange
      const store = useUiStore()
      store.setTheme('noir')
      loadThemePreference.mockResolvedValue({ theme: 'cream', updatedAt: Date.now() + 100_000 })

      // Act
      await store.reconcileOnLogin()

      // Assert
      expect(store.theme).toBe('cream')
    })
  })
})
