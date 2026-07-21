import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import { createAppRouter } from './router'
import { useAuthStore } from './stores/auth'
import App from './App.vue'
import { applyTheme, resolveTheme } from './lib/theme'
import './assets/main.css'
import 'vue3-chessboard/style.css'
import './assets/board-theme.css'

// Set the theme on <html> before mount so the first paint is already correct (no flash).
// An inline <script> in index.html would be the earliest hook but is blocked by CSP
// (script-src 'self'), so this module-top call is the earliest allowed.
applyTheme(resolveTheme())

// Handle GitHub Pages SPA fallback redirect
const redirect = new URLSearchParams(window.location.search).get('redirect')
if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
  window.history.replaceState(null, '', redirect)
}

// ADR-0016: autoUpdate + immediate — a new deploy takes effect on next load, never locking
// a device onto a stale service worker.
registerSW({ immediate: true })

const app = createApp(App)
app.use(createPinia())
const router = createAppRouter()
app.use(router)

// Resolve the persisted auth session BEFORE the first navigation completes, then mount only once
// the router is ready. The initial guard decision (landing gate) awaits isAuthLoading, so the app
// renders its final route in one shot — no flash of the synchronous HomeView before the sign-in
// redirect on a PWA cold start. initAuth() is fired (not awaited) here so router.isReady() can
// drive the wait through the guard.
useAuthStore().initAuth()
router.isReady().then(() => app.mount('#app'))
