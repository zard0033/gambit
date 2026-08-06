// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { createAppRouter, GUEST_ENTRY_KEY } from '@/router/index'

function makeRouter() {
  return createAppRouter()
}

function mockAuthSubscription() {
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue(
    { data: { subscription: { unsubscribe: vi.fn() } } } as unknown as ReturnType<
      typeof supabase.auth.onAuthStateChange
    >
  )
}

describe('auth route guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockAuthSubscription()
    sessionStorage.clear()
  })

  // Guest mode (訪客完局紀錄): history is public once the visitor opts into guest browsing
  // (GUEST_ENTRY_KEY set by the sign-in screen). They read their games from localStorage.
  it('test_authGuard_guest_historyRoute_allowsNavigation', async () => {
    sessionStorage.setItem(GUEST_ENTRY_KEY, '1')
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null }, error: null,
    })
    const router = makeRouter()
    const authStore = useAuthStore()
    await authStore.initAuth()

    await router.push('/history')
    expect(router.currentRoute.value.name).toBe('history')
    expect(router.currentRoute.value.query.login).toBeUndefined()
  })

  // Landing gate: a cold launch (no guest flag, not signed in) is redirected to sign-in first.
  it('test_landingGate_guest_noFlag_redirectsToSignIn', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null }, error: null,
    })
    const router = makeRouter()
    const authStore = useAuthStore()
    await authStore.initAuth()

    await router.push('/history')
    expect(router.currentRoute.value.name).toBe('sign-in')
  })

  // Home is the one synchronously-imported view, so a cold start lands on it first; the landing
  // gate must still redirect an unauthed, no-flag visitor to sign-in (PWA cold-start flash fix).
  it('test_landingGate_homeRoute_noFlag_redirectsToSignIn', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null }, error: null,
    })
    const router = makeRouter()
    const authStore = useAuthStore()
    await authStore.initAuth()

    await router.push('/')
    expect(router.currentRoute.value.name).toBe('sign-in')
  })

  // The sign-in screen itself is always reachable (no flag, no session) — never gates itself.
  it('test_landingGate_signInRoute_alwaysReachable', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null }, error: null,
    })
    const router = makeRouter()
    const authStore = useAuthStore()
    await authStore.initAuth()

    await router.push('/sign-in')
    expect(router.currentRoute.value.name).toBe('sign-in')
  })

  it('test_authGuard_authenticated_historyRoute_allowsNavigation (AC-S5-03)', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: { user: { id: 'uid-1', email: 'a@b.com' } } as never }, error: null,
    })
    const router = makeRouter()
    const authStore = useAuthStore()
    await authStore.initAuth()

    await router.push('/history')
    expect(router.currentRoute.value.name).toBe('history')
  })

  it('test_authGuard_publicRoutes_noRedirect', async () => {
    sessionStorage.setItem(GUEST_ENTRY_KEY, '1')
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null }, error: null,
    })
    const router = makeRouter()
    const authStore = useAuthStore()
    await authStore.initAuth()

    await router.push('/play')
    expect(router.currentRoute.value.name).toBe('play')
  })

  it('test_authGuard_isAuthLoadingTrue_doesNotBlockGuestNav', async () => {
    // Guest already opted in (flag set): navigating mid-auth-load resolves straight through
    // without redirect or hang.
    sessionStorage.setItem(GUEST_ENTRY_KEY, '1')
    let resolveSession!: (v: unknown) => void
    vi.mocked(supabase.auth.getSession).mockReturnValueOnce(
      new Promise(r => { resolveSession = r as typeof resolveSession })
    )
    const router = makeRouter()
    const authStore = useAuthStore()

    const initPromise = authStore.initAuth()
    expect(authStore.isAuthLoading).toBe(true)

    const navPromise = router.push('/history')

    resolveSession({ data: { session: null }, error: null })
    await initPromise
    await navPromise

    expect(router.currentRoute.value.name).toBe('history')
    expect(router.currentRoute.value.query.login).toBeUndefined()
  })
})
