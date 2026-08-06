// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

// D6: header 齒輪 popover 接住登出／外觀切換／重置對局記錄——三個破壞性/狀態變更操作，
// precommit-review 標記為 confirmed（無測試釘住任何一個唯一入口）。

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() },
    from: vi.fn(),
  },
}))

import SettingsMenu from '@/components/settings-menu.vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui-store'

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/history', name: 'history', component: { template: '<div/>' } },
      { path: '/sign-in', name: 'sign-in', component: { template: '<div/>' } },
    ],
  })
}

async function mountMenu() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = makeRouter()
  router.push('/')
  await router.isReady()
  const authStore = useAuthStore()
  authStore.userId = 'test-user-id' // SettingsMenu only mounts for signed-in users
  const uiStore = useUiStore()
  const wrapper = mount(SettingsMenu, {
    global: { plugins: [pinia, router] },
    attachTo: document.body, // Popover content teleports to document.body
  })
  return { wrapper, authStore, uiStore, router }
}

function clickByText(text: string): void {
  const el = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
  if (!el) throw new Error(`no button with text "${text}"`)
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('SettingsMenu', () => {
  it('test_settingsMenu_signOutClick_callsAuthSignOutAndRedirectsToSignIn', async () => {
    const { wrapper, authStore, router } = await mountMenu()
    vi.spyOn(authStore, 'signOut').mockResolvedValue(undefined)
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.find('[aria-label="設定"]').trigger('click')
    await flushPromises()

    clickByText('登出')
    await flushPromises()

    expect(authStore.signOut).toHaveBeenCalledOnce()
    expect(pushSpy).toHaveBeenCalledWith('/sign-in')

    wrapper.unmount()
  })

  it('test_settingsMenu_noirButtonClick_callsSetThemeWithNoir', async () => {
    const { wrapper, uiStore } = await mountMenu()
    vi.spyOn(uiStore, 'setTheme').mockImplementation(() => {})

    await wrapper.find('[aria-label="設定"]').trigger('click')
    await flushPromises()

    clickByText('玄夜')
    await flushPromises()

    expect(uiStore.setTheme).toHaveBeenCalledWith('noir')

    wrapper.unmount()
  })

  it('test_settingsMenu_resetClick_opensResetHistoryDialog', async () => {
    const { wrapper } = await mountMenu()

    await wrapper.find('[aria-label="設定"]').trigger('click')
    await flushPromises()

    clickByText('重置對局記錄')
    await flushPromises()

    expect(document.body.textContent).toContain('這會清除你的對局歷史')

    wrapper.unmount()
  })
})
