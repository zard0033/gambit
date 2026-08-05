import { ref, onScopeDispose } from 'vue'
import type { CompletedGame } from '../../stores/game-store'
import type { ExportConfig, ExportContext } from './types'
import { assembleExportPayload } from './assembler'
import { DEFAULT_EXPORT_TUNING } from '../../config/export-tuning'

export type ExportState = 'IDLE' | 'SHARING' | 'COPYING' | 'SUCCESS' | 'FALLBACK'

/** Injectable navigator surface for unit testing. */
export interface NavigatorDeps {
  share?: (data: ShareData) => Promise<void>
  canShare?: (data: ShareData) => boolean
  clipboard?: { writeText: (text: string) => Promise<void> }
}

export function useGameExport(
  game: CompletedGame,
  config: ExportConfig,
  nav?: NavigatorDeps,
  context?: ExportContext,
) {
  const state = ref<ExportState>('IDLE')
  const fallbackText = ref('')

  const _nav = nav ?? navigator
  const feedbackMs = config.feedbackDurationMs ?? DEFAULT_EXPORT_TUNING.feedbackDurationMs
  let successTimer: ReturnType<typeof setTimeout> | undefined

  function clearSuccessTimer(): void {
    if (successTimer !== undefined) {
      clearTimeout(successTimer)
      successTimer = undefined
    }
  }

  /** Enter SUCCESS and auto-revert to IDLE after feedbackDurationMs (Core Rule 9). */
  function enterSuccess(): void {
    state.value = 'SUCCESS'
    clearSuccessTimer()
    successTimer = setTimeout(() => {
      successTimer = undefined
      if (state.value === 'SUCCESS') state.value = 'IDLE'
    }, feedbackMs)
  }

  async function onExportTap(): Promise<void> {
    if (state.value === 'SHARING' || state.value === 'COPYING') return
    clearSuccessTimer() // re-tap during SUCCESS restarts the export

    let payload: string
    try {
      payload = assembleExportPayload(game, config, context)
    } catch {
      // Corrupt move list would make buildPgn throw — never let the share gesture silently
      // dead-lock in IDLE; degrade to FALLBACK with the raw movetext (mirrors data-sync safePgn).
      fallbackText.value = game.moves.join(' ')
      state.value = 'FALLBACK'
      return
    }

    if (_nav.share && _nav.canShare?.({ text: payload })) {
      // Tier 1: Web Share API
      state.value = 'SHARING'
      try {
        await _nav.share({ text: payload })
        enterSuccess()
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          state.value = 'IDLE'
        } else {
          fallbackText.value = payload
          state.value = 'FALLBACK'
        }
      }
    } else if (_nav.clipboard) {
      // Tier 2: Clipboard API
      state.value = 'COPYING'
      try {
        await _nav.clipboard.writeText(payload)
        enterSuccess()
      } catch {
        fallbackText.value = payload
        state.value = 'FALLBACK'
      }
    } else {
      // Tier 3: FALLBACK textarea
      fallbackText.value = payload
      state.value = 'FALLBACK'
    }
  }

  function dismissFallback(): void {
    clearSuccessTimer()
    state.value = 'IDLE'
    fallbackText.value = ''
  }

  onScopeDispose(() => {
    clearSuccessTimer()
  })

  return { state, fallbackText, onExportTap, dismissFallback }
}
