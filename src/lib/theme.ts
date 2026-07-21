// Theme = cream (default light) | noir (dark "Dusk"). Applied as data-theme on
// <html>; cream is the absence of the attribute. Persisted device-local in
// localStorage and synced cross-device via Supabase (user_preferences), reconciled
// last-write-wins by timestamp. Defaults to the OS prefers-color-scheme.
export type Theme = 'cream' | 'noir'

const THEME_KEY = 'ui:theme'
const THEME_AT_KEY = 'ui:theme:updatedAt'

export function storedTheme(): Theme | null {
  if (typeof localStorage === 'undefined') return null
  const v = localStorage.getItem(THEME_KEY)
  return v === 'noir' || v === 'cream' ? v : null
}

/** ms epoch of the last explicit local choice; 0 if the user never chose (still on system default). */
export function storedThemeAt(): number {
  if (typeof localStorage === 'undefined') return 0
  const n = Number.parseInt(localStorage.getItem(THEME_AT_KEY) ?? '', 10)
  return Number.isNaN(n) ? 0 : n
}

export function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'cream'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'noir' : 'cream'
}

export function resolveTheme(): Theme {
  return storedTheme() ?? systemTheme()
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'noir') root.dataset.theme = 'noir'
  else delete root.dataset.theme
  // Keep the mobile browser chrome (status bar tint) in sync with the surface.
  // #0a0f0c = --color-surface-deep under [data-theme='noir'] (src/assets/main.css).
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'noir' ? '#0a0f0c' : '#103029')
}

export function persistTheme(theme: Theme, at: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(THEME_KEY, theme)
  localStorage.setItem(THEME_AT_KEY, String(at))
}

/** Last-write-wins between the local choice and the cloud row (null = no cloud row yet). */
export function pickNewer(
  local: { theme: Theme; at: number },
  remote: { theme: Theme; at: number } | null,
): { theme: Theme; winner: 'local' | 'remote' } {
  if (!remote) return { theme: local.theme, winner: 'local' }
  return remote.at >= local.at
    ? { theme: remote.theme, winner: 'remote' }
    : { theme: local.theme, winner: 'local' }
}
