/**
 * Replay navigation state (S10-02).
 * Single source of truth for the current ply while replaying a game. The board
 * (pgn-viewer) is mirrored from this state, not the other way around, so the
 * custom controls (prev/next/play/slider) and the move list never disagree.
 *
 * `total` is the number of half-moves; valid plies are 0..total
 * (0 = initial position, N = after the N-th half-move).
 */
import { ref, computed, readonly, type Ref } from 'vue'

export interface ReplayNavigationOptions {
  /** Auto-play step interval in ms. */
  intervalMs?: number
}

export function useReplayNavigation(total: Ref<number>, options?: ReplayNavigationOptions) {
  const intervalMs = options?.intervalMs ?? 1000

  const currentPly = ref(0)
  const isPlaying = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const canGoNext = computed(() => currentPly.value < total.value)
  const canGoPrev = computed(() => currentPly.value > 0)

  function clamp(ply: number): number {
    return Math.max(0, Math.min(ply, total.value))
  }

  function nextMove(): void {
    if (canGoNext.value) currentPly.value++
  }

  function prevMove(): void {
    if (canGoPrev.value) currentPly.value--
  }

  function jumpToMove(ply: number): void {
    currentPly.value = clamp(ply)
  }

  function stop(): void {
    isPlaying.value = false
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  function play(): void {
    if (isPlaying.value || !canGoNext.value) return
    isPlaying.value = true
    timer = setInterval(() => {
      if (currentPly.value >= total.value) {
        stop()
      } else {
        currentPly.value++
      }
    }, intervalMs)
  }

  function togglePlay(): void {
    if (isPlaying.value) stop()
    else play()
  }

  return {
    currentPly,
    isPlaying: readonly(isPlaying),
    canGoNext,
    canGoPrev,
    nextMove,
    prevMove,
    jumpToMove,
    play,
    stop,
    togglePlay,
  }
}
