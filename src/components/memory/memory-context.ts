/**
 * 棋憶 (Memory, #22) view context — provided by MemoryView (the shell that owns the single
 * usePostGameReview instance) and injected by MemoryDashboard. D4 (2026-08) retired the
 * slideshow/replay drill-in, so this is a flat context now, not a shared stack.
 */

import type { ComputedRef, InjectionKey } from 'vue'
import { inject } from 'vue'
import type { CompletedGame } from '@/stores/game-store'
import type { usePostGameReview } from '@/modules/post-game-review/use-post-game-review'
import type { Moment } from '@/types/memory'

export interface MemoryContext {
  /** The single review instance for this game (analysis owner). */
  readonly review: ReturnType<typeof usePostGameReview>
  readonly game: ComputedRef<CompletedGame | null>
  /** The selected ≤5 key moments (F1), ply-ordered. Empty on a steady game (EC-1). Feeds the
   *  export prompt's key-move-number list — no on-screen moment list in D4's slimmed dashboard. */
  readonly moments: ComputedRef<Moment[]>
  /** Identified opening, when the index recognized the line. Enriches the export prompt. */
  readonly opening: ComputedRef<{ openingName: string; eco: string } | null>
}

export const MEMORY_CONTEXT: InjectionKey<MemoryContext> = Symbol('memory-context')

export function useMemoryContext(): MemoryContext {
  const ctx = inject(MEMORY_CONTEXT)
  if (!ctx) throw new Error('useMemoryContext must be used within MemoryView')
  return ctx
}
