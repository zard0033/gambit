// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PgnViewer from '@/components/pgn-viewer.vue'

// --- Mock setup ---

// Explicit call signatures: a bare `ReturnType<typeof vi.fn>` widens to `Mock<Procedure |
// Constructable>` under vitest 4, which TS then refuses to call directly (它以為可能是 constructor).
let mockViewerInstance: {
  toPath: Mock<(path: unknown, recursive: boolean) => void>
  curData: Mock<() => unknown>
}

vi.mock('@lichess-org/pgn-viewer', () => ({
  default: vi.fn().mockImplementation(() => mockViewerInstance),
}))

const TEST_PGN = '1.e4 e5 2.Nf3 Nc6'

beforeEach(() => {
  // Fresh instance per test — prevents toPath patch leaking between tests
  mockViewerInstance = {
    toPath: vi.fn<(path: unknown, recursive: boolean) => void>(),
    curData: vi.fn<() => unknown>().mockReturnValue({}),
  }
  vi.clearAllMocks()
  // Re-assign after clearAllMocks so the factory closure returns the fresh object
  mockViewerInstance = {
    toPath: vi.fn<(path: unknown, recursive: boolean) => void>(),
    curData: vi.fn<() => unknown>().mockReturnValue({}),
  }
})

// --- Tests ---

describe('PgnViewer', () => {
  it('AC-01: mounts with valid PGN without console errors or warnings', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const wrapper = mount(PgnViewer, { props: { pgn: TEST_PGN } })
    await flushPromises()

    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()

    wrapper.unmount()
    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('AC-02: emits move-selected with uci when user navigates to a move', async () => {
    mockViewerInstance.curData.mockReturnValue({
      uci: 'e2e4',
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    })

    const wrapper = mount(PgnViewer, { props: { pgn: TEST_PGN } })
    await flushPromises()

    // Simulate pgn-viewer calling the (now-patched) toPath internally
    mockViewerInstance.toPath({} as any, false)

    expect(wrapper.emitted('move-selected')).toBeTruthy()
    expect(wrapper.emitted('move-selected')![0]).toEqual(['e2e4'])

    wrapper.unmount()
  })

  it('AC-02: does not emit move-selected for initial position (no uci)', async () => {
    // curData returns Initial position object (no uci property)
    mockViewerInstance.curData.mockReturnValue({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' })

    const wrapper = mount(PgnViewer, { props: { pgn: TEST_PGN } })
    await flushPromises()

    mockViewerInstance.toPath({} as any, false)

    expect(wrapper.emitted('move-selected')).toBeFalsy()

    wrapper.unmount()
  })

  it('AC-03: passes orientation prop to pgn-viewer start()', async () => {
    const { default: startMock } = await import('@lichess-org/pgn-viewer')

    mount(PgnViewer, { props: { pgn: TEST_PGN, orientation: 'black' } })
    await flushPromises()

    expect(startMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ orientation: 'black' }),
    )
  })

  it('AC-03: defaults to white orientation when prop is omitted', async () => {
    const { default: startMock } = await import('@lichess-org/pgn-viewer')

    mount(PgnViewer, { props: { pgn: TEST_PGN } })
    await flushPromises()

    expect(startMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ orientation: 'white' }),
    )
  })

  it('AC-04: initialises pgn-viewer with keyboardToMove: true', async () => {
    const { default: startMock } = await import('@lichess-org/pgn-viewer')

    mount(PgnViewer, { props: { pgn: TEST_PGN } })
    await flushPromises()

    expect(startMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ keyboardToMove: true }),
    )
  })

  it('AC-05: container div is rendered and receives touch/click events', async () => {
    const { default: startMock } = await import('@lichess-org/pgn-viewer')

    const wrapper = mount(PgnViewer, { props: { pgn: TEST_PGN } })
    await flushPromises()

    const container = wrapper.find('.pgn-viewer-wrapper')
    expect(container.exists()).toBe(true)
    // pgn-viewer receives the container element — touch/click handled internally
    expect(startMock).toHaveBeenCalledWith(container.element, expect.any(Object))

    wrapper.unmount()
  })

  it('AC-06: no console errors on unmount', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const wrapper = mount(PgnViewer, { props: { pgn: TEST_PGN } })
    await flushPromises()
    wrapper.unmount()

    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('does not throw or log errors for invalid PGN', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => mount(PgnViewer, { props: { pgn: 'not-valid' } })).not.toThrow()

    errorSpy.mockRestore()
  })

  it('does not call start() for empty PGN', async () => {
    const { default: startMock } = await import('@lichess-org/pgn-viewer')

    mount(PgnViewer, { props: { pgn: '' } })
    await flushPromises()

    expect(startMock).not.toHaveBeenCalled()
  })

  it('remounts viewer when pgn prop changes', async () => {
    const { default: startMock } = await import('@lichess-org/pgn-viewer')

    const wrapper = mount(PgnViewer, { props: { pgn: TEST_PGN } })
    await flushPromises()

    await wrapper.setProps({ pgn: '1.d4 d5' })
    await flushPromises()

    expect(startMock).toHaveBeenCalledTimes(2)
    expect(startMock).toHaveBeenLastCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ pgn: '1.d4 d5' }),
    )

    wrapper.unmount()
  })

  it('exposes getViewer() returning the pgn-viewer instance', async () => {
    const wrapper = mount(PgnViewer, { props: { pgn: TEST_PGN } })
    await flushPromises()

    const viewerInstance = (wrapper.vm as any).getViewer()
    expect(viewerInstance).toBe(mockViewerInstance)

    wrapper.unmount()
  })
})
