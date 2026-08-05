/**
 * Unit tests for useGameExport Tier-1/2/3 Delivery State Machine.
 * Story: game-export/story-002-tier-delivery
 * AC-1..AC-6
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { useGameExport } from '../../../src/modules/game-export/use-game-export'
import type { NavigatorDeps } from '../../../src/modules/game-export/use-game-export'
import type { ExportConfig } from '../../../src/modules/game-export/types'
import type { CompletedGame } from '../../../src/stores/game-store'

// ---- Fixtures ----

function makeGame(): CompletedGame {
  return {
    moves: Object.freeze(['e2e4', 'e7e5']),
    playerColor: 'white',
    result: '1-0',
    endReason: 'checkmate',
    completedAt: Date.now(),
    aiSkillLevel: 10,
    playerMoveTimes: Object.freeze([1000, 1000]),
    isTerminal: true,
  }
}

const config: ExportConfig = { playerName: 'Alice', aiSkillLevel: 10, includeAnnotations: false }

function makeShareNav(resolves = true): NavigatorDeps {
  return {
    share: vi.fn().mockImplementation(() => resolves ? Promise.resolve() : Promise.reject(new Error('SystemError'))),
    canShare: vi.fn().mockReturnValue(true),
    clipboard: undefined,
  }
}

function makeClipboardNav(rejects = false): NavigatorDeps {
  return {
    share: undefined,
    canShare: undefined,
    clipboard: {
      writeText: vi.fn().mockImplementation(() =>
        rejects
          ? Promise.reject(new DOMException('Not allowed', 'NotAllowedError'))
          : Promise.resolve(),
      ),
    },
  }
}

function makeNoNav(): NavigatorDeps {
  return { share: undefined, canShare: undefined, clipboard: undefined }
}

// ---- AC-1: Tier-1 share → SUCCESS ----

describe('useGameExport — AC-1: Tier-1 share success', () => {
  it('test_onExportTap_tier1Share_transitionsToSuccess', async () => {
    const nav = makeShareNav(true)
    const { state, onExportTap } = useGameExport(makeGame(), config, nav)

    expect(state.value).toBe('IDLE')
    await onExportTap()

    expect(nav.share).toHaveBeenCalledTimes(1)
    expect((nav.share as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ text: expect.any(String) })
    expect(state.value).toBe('SUCCESS')
  })

  it('test_onExportTap_tier1Share_usesCanShareProbe', async () => {
    const nav = makeShareNav(true)
    const { onExportTap } = useGameExport(makeGame(), config, nav)

    await onExportTap()

    expect(nav.canShare).toHaveBeenCalledWith(expect.objectContaining({ text: expect.any(String) }))
  })
})

// ---- AC-2: AbortError → IDLE ----

describe('useGameExport — AC-2: AbortError → IDLE', () => {
  it('test_onExportTap_abortError_returnsToIdle_notFallback', async () => {
    const nav: NavigatorDeps = {
      share: vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')),
      canShare: vi.fn().mockReturnValue(true),
      clipboard: undefined,
    }
    const { state, fallbackText, onExportTap } = useGameExport(makeGame(), config, nav)

    await onExportTap()

    expect(state.value).toBe('IDLE')
    expect(fallbackText.value).toBe('')
  })
})

// ---- AC-3: Non-AbortError share rejection → FALLBACK ----

describe('useGameExport — AC-3: non-AbortError → FALLBACK', () => {
  it('test_onExportTap_systemError_transitionsToFallback', async () => {
    const nav = makeShareNav(false)
    const { state, fallbackText, onExportTap } = useGameExport(makeGame(), config, nav)

    await onExportTap()

    expect(state.value).toBe('FALLBACK')
    expect(fallbackText.value).toContain('```pgn')
  })
})

// ---- AC-4: Clipboard NotAllowedError → FALLBACK ----

describe('useGameExport — AC-4: clipboard NotAllowedError → FALLBACK', () => {
  it('test_onExportTap_clipboardNotAllowed_transitionsToFallback', async () => {
    const nav = makeClipboardNav(true)
    const { state, onExportTap } = useGameExport(makeGame(), config, nav)

    await onExportTap()

    expect(state.value).toBe('FALLBACK')
  })

  it('test_onExportTap_clipboardSuccess_transitionsToSuccess', async () => {
    const nav = makeClipboardNav(false)
    const { state, onExportTap } = useGameExport(makeGame(), config, nav)

    await onExportTap()

    expect(state.value).toBe('SUCCESS')
  })

  it('test_onExportTap_noShareNoClipboard_transitionsToFallback', async () => {
    const nav = makeNoNav()
    const { state, onExportTap } = useGameExport(makeGame(), config, nav)

    await onExportTap()

    expect(state.value).toBe('FALLBACK')
  })
})

// ---- AC-5: In-flight tap suppression ----

describe('useGameExport — AC-5: in-flight tap suppression', () => {
  it('test_onExportTap_whileSharing_doesNothing', async () => {
    let resolveShare!: () => void
    const nav: NavigatorDeps = {
      share: vi.fn().mockImplementation(() => new Promise<void>(r => { resolveShare = r })),
      canShare: vi.fn().mockReturnValue(true),
      clipboard: undefined,
    }
    const { state, onExportTap } = useGameExport(makeGame(), config, nav)

    // Start first tap — leaves state as SHARING
    const first = onExportTap()
    expect(state.value).toBe('SHARING')

    // Second tap while SHARING — should be a no-op
    await onExportTap()
    expect(nav.share).toHaveBeenCalledTimes(1) // still only one call

    resolveShare()
    await first
  })

  it('test_onExportTap_whileCopying_doesNothing', async () => {
    let resolveWrite!: () => void
    const nav: NavigatorDeps = {
      share: undefined,
      canShare: undefined,
      clipboard: {
        writeText: vi.fn().mockImplementation(() => new Promise<void>(r => { resolveWrite = r })),
      },
    }
    const { state, onExportTap } = useGameExport(makeGame(), config, nav)

    const first = onExportTap()
    expect(state.value).toBe('COPYING')

    await onExportTap()
    expect(nav.clipboard!.writeText).toHaveBeenCalledTimes(1)

    resolveWrite()
    await first
  })
})

// ---- AC-6: No await before tier decision ----

describe('useGameExport — AC-6: no await before tier decision (static check)', () => {
  it('test_useGameExportSource_noAwaitBeforeAssembleExportPayload', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../../src/modules/game-export/use-game-export.ts', import.meta.url)),
      'utf8',
    )
    // The first occurrence of assembleExportPayload in onExportTap must appear before any 'await'
    const tapStart = src.indexOf('async function onExportTap')
    const firstAwait = src.indexOf('await', tapStart)
    const assembleCall = src.indexOf('assembleExportPayload', tapStart)

    expect(tapStart).toBeGreaterThan(-1)
    expect(assembleCall).toBeGreaterThan(-1)
    // assembleExportPayload must appear before the first await in the function body
    expect(assembleCall).toBeLessThan(firstAwait)
  })
})

// ---- SUCCESS → IDLE auto-revert timer (game-export-share.md Core Rule 9) ----

describe('useGameExport — SUCCESS→IDLE feedback timer', () => {
  it('test_onExportTap_success_revertsToIdleAfterFeedbackDuration', async () => {
    vi.useFakeTimers()
    try {
      const nav = makeClipboardNav(false)
      const { state, onExportTap } = useGameExport(makeGame(), config, nav)

      await onExportTap()
      expect(state.value).toBe('SUCCESS')

      vi.advanceTimersByTime(2000) // default feedbackDurationMs
      expect(state.value).toBe('IDLE')
    } finally {
      vi.useRealTimers()
    }
  })

  it('test_onExportTap_success_honoursCustomFeedbackDuration', async () => {
    vi.useFakeTimers()
    try {
      const nav = makeClipboardNav(false)
      const cfg: ExportConfig = { ...config, feedbackDurationMs: 1000 }
      const { state, onExportTap } = useGameExport(makeGame(), cfg, nav)

      await onExportTap()
      expect(state.value).toBe('SUCCESS')

      vi.advanceTimersByTime(999)
      expect(state.value).toBe('SUCCESS') // not yet
      vi.advanceTimersByTime(1)
      expect(state.value).toBe('IDLE')
    } finally {
      vi.useRealTimers()
    }
  })
})

// ---- dismissFallback ----

describe('useGameExport — dismissFallback', () => {
  it('test_dismissFallback_resetsStateToIdle', async () => {
    const nav = makeNoNav()
    const { state, fallbackText, onExportTap, dismissFallback } = useGameExport(makeGame(), config, nav)

    await onExportTap()
    expect(state.value).toBe('FALLBACK')

    dismissFallback()
    expect(state.value).toBe('IDLE')
    expect(fallbackText.value).toBe('')
  })
})
