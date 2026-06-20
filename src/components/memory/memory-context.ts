/**
 * 棋憶 (Memory, #22) view context — provided by MemoryView (the shell that owns the single
 * usePostGameReview instance, so analysis runs ONCE for the whole 棋憶 stack) and injected by the
 * dashboard / slideshow / replay sub-views. See `design/ux/memory.md` (shallow stack, one owner).
 */

import type { ComputedRef, InjectionKey } from 'vue'
import { inject } from 'vue'
import type { CompletedGame } from '@/stores/game-store'
import type { usePostGameReview } from '@/modules/post-game-review/use-post-game-review'
import type { Moment } from '@/types/memory'
import type { ClassifyResult } from '@/modules/learning-loop/classify'

export interface MemoryContext {
  /** The single review instance for this game (analysis owner). */
  readonly review: ReturnType<typeof usePostGameReview>
  readonly game: ComputedRef<CompletedGame | null>
  readonly orientation: ComputedRef<'white' | 'black'>
  readonly pgn: ComputedRef<string>
  /** FEN per position 0..N (buildFenSequence) — for plain-language move description. */
  readonly fens: ComputedRef<string[]>
  /** classify() per position i ('none' where unclassified) — feeds selection + per-moment text. */
  readonly concepts: ComputedRef<ClassifyResult[]>
  /** The selected ≤5 key moments (F1), ply-ordered. Empty on a steady game (EC-1). */
  readonly moments: ComputedRef<Moment[]>
  /** White-normalized eval series for the shape-of-game chart (F2). */
  readonly series: ComputedRef<Array<number | null>>
  readonly anchorPly: ComputedRef<number | null>

  // ---- shallow-stack navigation (history-backed; see MemoryView) ----
  /** Open the slideshow at moment index. */
  openMoment: (index: number) => void
  /** Open the dense replay at a ply (default: anchor ply). */
  openReplay: (ply: number) => void
  /** Pop back to the dashboard (in-app "回棋憶"). */
  backToDashboard: () => void
}

export const MEMORY_CONTEXT: InjectionKey<MemoryContext> = Symbol('memory-context')

export function useMemoryContext(): MemoryContext {
  const ctx = inject(MEMORY_CONTEXT)
  if (!ctx) throw new Error('useMemoryContext must be used within MemoryView')
  return ctx
}
