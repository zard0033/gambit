import { createRouter, createWebHistory, START_LOCATION } from 'vue-router'
import { nextTick, watch } from 'vue'
import type { RouterScrollBehavior } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import { useAuthStore } from '@/stores/auth'

export const routes = [
  { path: '/',                name: 'home',      component: HomeView },
  { path: '/play',            name: 'play',      component: () => import('@/views/PlayView.vue') },
  // /learn 與 /learn/concepts 都渲染 LearnPager（同一元件 → 切子頁籤時 pager 實例不重繪，indicator 才能跟手滑動）。
  { path: '/learn',           name: 'learn',     component: () => import('@/views/LearnPager.vue') },
  { path: '/learn/concepts',  name: 'concepts',  component: () => import('@/views/LearnPager.vue') },
  { path: '/learn/concept/:conceptId', name: 'concept-deepen', component: () => import('@/views/ConceptDeepenView.vue'), meta: { fullBleed: true } },
  { path: '/learn/concept/:conceptId/judge', name: 'concept-judge', component: () => import('@/views/RecognitionFieldView.vue'), meta: { fullBleed: true } },
  { path: '/learn/:lessonId', name: 'lesson',    component: () => import('@/views/LessonView.vue'), meta: { fullBleed: true } },
  { path: '/dungeon',          name: 'dungeon',     component: () => import('@/views/DungeonMapView.vue') },
  { path: '/dungeon/:puzzleId', name: 'puzzle',     component: () => import('@/views/DungeonPuzzleView.vue'), meta: { fullBleed: true } },
  { path: '/review',          name: 'review',    component: () => import('@/views/MemoryView.vue') },
  { path: '/history',         name: 'history',   component: () => import('@/views/HistoryView.vue') },
  { path: '/profile',         name: 'profile',   component: () => import('@/views/ProfileView.vue') },
  { path: '/sign-in',         name: 'sign-in',   component: () => import('@/views/SignInView.vue'), meta: { fullBleed: true } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
]

export const scrollBehavior: RouterScrollBehavior = (_to, _from, savedPosition) => savedPosition ?? { top: 0 }

// Guest mode: every route is reachable without login — completed games, history, and profile all
// work from localStorage and back up to the cloud on login (訪客完局紀錄). The guard infrastructure
// below is retained (empty set) so a future genuinely auth-only route can opt in by name.
const AUTH_REQUIRED_ROUTES = new Set<string>([])

// Landing gate: a cold launch lands on sign-in when not authed. Once the visitor chooses to browse
// as guest, this session-scoped flag lets them roam freely; it clears on PWA relaunch so the next
// cold launch re-presents sign-in. Signed-in users restore their session and never hit this gate.
export const GUEST_ENTRY_KEY = 'gambit:guest-entry'

// Factory function: must be called AFTER any history.replaceState() call so that
// createWebHistory() reads the correct URL (replaceState does not fire popstate).
export function createAppRouter() {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    scrollBehavior,
    routes,
  })

  router.beforeEach(async (to) => {
    const needsAuthCheck = AUTH_REQUIRED_ROUTES.has(to.name as string)
    const needsLandingGate = to.name !== 'sign-in'
    if (!needsAuthCheck && !needsLandingGate) return

    const authStore = useAuthStore()

    // Wait for initial auth resolution before making guard decisions (SUPA-AC-S5-02).
    // isAuthLoading is true until initAuth() completes in App.vue onMounted.
    if (authStore.isAuthLoading) {
      await new Promise<void>(resolve => {
        const stop = watch(() => authStore.isAuthLoading, (loading) => {
          if (!loading) { stop(); resolve() }
        })
      })
    }

    // Landing gate: not signed in and hasn't chosen guest this session → present sign-in first.
    if (needsLandingGate && !authStore.userId && !sessionStorage.getItem(GUEST_ENTRY_KEY)) {
      return { name: 'sign-in' }
    }

    if (needsAuthCheck && !authStore.userId) {
      return { name: 'home', query: { login: 'required' } }
    }
    return undefined
  })

  router.afterEach((_to, from) => {
    // A navigation succeeded → clear the one-shot reload guard so a *later* chunk-load failure in
    // this session (e.g. a redeploy changed the hashes) can still self-heal with one reload.
    sessionStorage.removeItem('routerReloadAttempted')
    // Only the very first navigation (from === START_LOCATION) has no enter transition, so
    // App.vue's @after-enter never fires for it — this is the sole case that needs the focus
    // reset here. Every later navigation goes through the journey Transition and is handled by
    // App.vue's focusRouteHeading (@after-enter); doing it here too would focus the outgoing
    // view's h1 before the new one mounts (a11y regression — screen readers hear the old title).
    if (from === START_LOCATION) {
      nextTick(() => {
        // preventScroll: this is an a11y focus reset to the page heading, not a viewport move —
        // without it, focusing a top-of-page h1 yanks the scroll up and fights any view that
        // positions its own initial scroll (e.g. DungeonMapView centring the current node).
        document.querySelector('h1')?.focus({ preventScroll: true })
      })
    }
  })

  router.onError(() => {
    if (!sessionStorage.getItem('routerReloadAttempted')) {
      sessionStorage.setItem('routerReloadAttempted', '1')
      window.location.reload()
    }
  })

  return router
}
