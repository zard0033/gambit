// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '@/stores/ui-store'

describe('useUiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('is importable and returns a store', () => {
    const store = useUiStore()
    expect(store).toBeDefined()
  })
})
