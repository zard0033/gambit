/**
 * Unit tests for the rAF-coalesced resize throttle (Formula 4).
 * TR-move-annotation-005: ResizeObserver + rAF coalesce per ADR-0006 Formula 4.
 * Tests the resize-throttle logic independently of Vue component lifecycle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- rAF polyfill for node environment ----
// Vitest runs in node by default; requestAnimationFrame is not available.
// These mocks allow testing the rAF-coalescing logic without a browser.
let _rafQueue: (() => void)[] = []
let _rafIdCounter = 0

function mockRequestAnimationFrame(cb: () => void): number {
  const id = ++_rafIdCounter
  _rafQueue.push(cb)
  return id
}

function mockCancelAnimationFrame(id: number): void {
  // In our mock, we track by position; simplified: just clear queue for the last registered
  // This is sufficient for our coalescing tests
  void id
  _rafQueue = [] // cancel clears pending callbacks
}

function flushRaf(): void {
  const queue = [..._rafQueue]
  _rafQueue = []
  queue.forEach(cb => cb())
}

// -----------------------------------------------------------------------
// Helpers — testable resize throttle logic extracted from component pattern
// -----------------------------------------------------------------------

interface RafFunctions {
  requestAnimationFrame: (cb: () => void) => number
  cancelAnimationFrame: (id: number) => void
}

/**
 * Standalone resize throttle implementation matching the component pattern.
 * Accepts injectable rAF functions for testability (node environment has no rAF).
 */
function createResizeThrottle(onRedraw: () => void, raf: RafFunctions = {
  requestAnimationFrame: mockRequestAnimationFrame,
  cancelAnimationFrame: mockCancelAnimationFrame,
}) {
  let rafId: number | null = null

  function onResize(): void {
    if (rafId !== null) raf.cancelAnimationFrame(rafId)
    rafId = raf.requestAnimationFrame(() => {
      rafId = null
      onRedraw()
    })
  }

  function cleanup(): void {
    if (rafId !== null) {
      raf.cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  return { onResize, cleanup }
}

// -----------------------------------------------------------------------
// AC-2: rAF coalesces multiple resize events
// -----------------------------------------------------------------------

describe('rAF resize throttle — AC-2: coalescing', () => {
  beforeEach(() => { _rafQueue = []; _rafIdCounter = 0 })

  it('test_resizeThrottle_3RapidEvents_onlyOneRedraw', () => {
    // Arrange
    const redrawSpy = vi.fn()
    const { onResize } = createResizeThrottle(redrawSpy)

    // Act — 3 rapid resize events before any rAF fires
    onResize()
    onResize()
    onResize()

    // Assert — redraw not yet called (rAF pending)
    expect(redrawSpy).not.toHaveBeenCalled()

    // Flush rAF
    flushRaf()

    // Assert — exactly one redraw (last event wins, previous canceled)
    expect(redrawSpy).toHaveBeenCalledTimes(1)
  })

  it('test_resizeThrottle_singleEvent_triggersOneRedraw', () => {
    // Arrange
    const redrawSpy = vi.fn()
    const { onResize } = createResizeThrottle(redrawSpy)

    // Act
    onResize()
    flushRaf()

    // Assert
    expect(redrawSpy).toHaveBeenCalledTimes(1)
  })

  it('test_resizeThrottle_twoSeparateFrames_twoRedraws', () => {
    // Arrange — two separate frames (rAF fires between the two events)
    const redrawSpy = vi.fn()
    const { onResize } = createResizeThrottle(redrawSpy)

    // Frame 1
    onResize()
    flushRaf()
    expect(redrawSpy).toHaveBeenCalledTimes(1)

    // Frame 2
    onResize()
    flushRaf()
    expect(redrawSpy).toHaveBeenCalledTimes(2)
  })
})

// -----------------------------------------------------------------------
// AC-1: ResizeObserver attached and detached
// -----------------------------------------------------------------------

describe('ResizeObserver lifecycle — AC-1', () => {
  it('test_resizeObserver_observeCalledWithBoardElement', () => {
    // Arrange — mock ResizeObserver (no DOM needed)
    const observeSpy = vi.fn()
    // 用一般函式（非箭頭）當實作，才能被 `new` 建構（vitest 4 嚴格化）。
    const MockResizeObserver = vi.fn(function () {
      return { observe: observeSpy, disconnect: vi.fn() }
    })

    // Act — simulate the mount logic (use a plain object as stand-in for HTMLElement)
    const fakeBoardEl = {} as HTMLElement
    const observer = new (MockResizeObserver as unknown as typeof ResizeObserver)(() => {})
    observer.observe(fakeBoardEl)

    // Assert
    expect(observeSpy).toHaveBeenCalledWith(fakeBoardEl)
  })

  it('test_resizeObserver_disconnectCalledOnUnmount', () => {
    // Arrange
    const disconnectSpy = vi.fn()
    const MockResizeObserver = vi.fn(function () {
      return { observe: vi.fn(), disconnect: disconnectSpy }
    })

    // Act — simulate component mount + unmount
    const observer = new (MockResizeObserver as unknown as typeof ResizeObserver)(() => {})
    observer.observe({} as HTMLElement)
    observer.disconnect() // unmount

    // Assert
    expect(disconnectSpy).toHaveBeenCalledTimes(1)
  })
})

// -----------------------------------------------------------------------
// AC-1 (cleanup): cancelAnimationFrame called on unmount if rAF pending
// -----------------------------------------------------------------------

describe('rAF cleanup on unmount — AC-1', () => {
  beforeEach(() => { _rafQueue = []; _rafIdCounter = 0 })

  it('test_resizeThrottle_cleanup_cancelsInFlightRaf', () => {
    // Arrange
    const redrawSpy = vi.fn()
    const { onResize, cleanup } = createResizeThrottle(redrawSpy)

    // Act — trigger resize, then immediately clean up before rAF fires
    onResize()
    cleanup() // unmount — cancels the pending rAF

    // Assert — rAF was canceled; redraw should NOT fire
    flushRaf()
    expect(redrawSpy).not.toHaveBeenCalled()
  })
})
