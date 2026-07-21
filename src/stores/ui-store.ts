import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import {
  type Theme,
  resolveTheme,
  applyTheme,
  persistTheme,
  storedThemeAt,
  pickNewer,
} from '@/lib/theme'
import { useDataSyncStore } from '@/stores/data-sync'

const BEATEN_KEY = 'ui:highestBeatenLevel'

function loadIntOrNull(key: string): number | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  const n = Number.parseInt(raw, 10)
  return Number.isNaN(n) ? null : n
}

export type PendingGame = { color: 'white' | 'black'; level: number }

export const useUiStore = defineStore('ui', () => {
  // Highest Stockfish Skill Level (0–20) the player has beaten — drives the
  // "you cleared this last time, try the next one" hint in the play-setup modal.
  const highestBeatenLevel = ref<number | null>(loadIntOrNull(BEATEN_KEY))

  // Play-setup modal is global (rendered in App.vue) so it opens over the CURRENT page;
  // only after the player confirms do we navigate to /play and start the game.
  const showPlaySetup = ref(false)
  const pendingGame = ref<PendingGame | null>(null)
  // Set when the home "繼續對局" card is tapped → PlayView restores the saved game instead of
  // opening the setup modal (續玩對局).
  const pendingResume = ref(false)

  // Appearance theme (cream / noir). main.ts applies the initial theme before mount;
  // this mirrors it reactively for the settings toggle.
  const theme = ref<Theme>(resolveTheme())
  function setTheme(next: Theme): void {
    const at = Date.now()
    theme.value = next
    applyTheme(next)
    persistTheme(next, at)
    // Push to the cloud (no-op when logged out); other devices pick it up on their next reconcile.
    void useDataSyncStore().upsertThemePreference(next, at)
  }

  /**
   * On login, reconcile the local theme against the cloud row (last-write-wins by timestamp).
   * Cloud newer → adopt it; local newer (or no cloud row yet) → push local up. Wired from App.vue.
   * An OS-derived default (at=0, the user never explicitly chose) is never pushed to the cloud —
   * only an explicit setTheme() should turn into a synced preference.
   */
  async function reconcileOnLogin(): Promise<void> {
    const sync = useDataSyncStore()
    const remote = await sync.loadThemePreference()
    const local = { theme: theme.value, at: storedThemeAt() }
    const { theme: winner, winner: who } = pickNewer(
      local,
      remote ? { theme: remote.theme, at: remote.updatedAt } : null,
    )
    if (who === 'remote' && remote) {
      if (winner !== theme.value) {
        theme.value = winner
        applyTheme(winner)
      }
      persistTheme(winner, remote.updatedAt)
    } else if (local.at > 0) {
      void sync.upsertThemePreference(local.theme, local.at)
    }
  }

  function openPlaySetup(): void {
    showPlaySetup.value = true
  }
  function closePlaySetup(): void {
    showPlaySetup.value = false
  }
  /** Player confirmed setup → stash the choice for PlayView and close the modal. */
  function requestGame(payload: PendingGame): void {
    pendingGame.value = payload
    showPlaySetup.value = false
  }
  /** PlayView pulls (and clears) the pending choice to start the game. */
  function consumePendingGame(): PendingGame | null {
    const g = pendingGame.value
    pendingGame.value = null
    return g
  }
  /** Home requests resuming the saved game; PlayView consumes the flag on mount. */
  function requestResume(): void {
    pendingResume.value = true
  }
  function consumeResume(): boolean {
    const r = pendingResume.value
    pendingResume.value = false
    return r
  }

  watch(highestBeatenLevel, (value) => {
    if (typeof localStorage === 'undefined') return
    if (value === null) localStorage.removeItem(BEATEN_KEY)
    else localStorage.setItem(BEATEN_KEY, String(value))
  })

  function recordWin(level: number): void {
    if (highestBeatenLevel.value === null || level > highestBeatenLevel.value) {
      highestBeatenLevel.value = level
    }
  }

  return {
    highestBeatenLevel,
    recordWin,
    showPlaySetup,
    pendingGame,
    pendingResume,
    theme,
    setTheme,
    reconcileOnLogin,
    openPlaySetup,
    closePlaySetup,
    requestGame,
    consumePendingGame,
    requestResume,
    consumeResume,
  }
})
