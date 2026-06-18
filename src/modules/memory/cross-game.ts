/**
 * 棋憶 (Memory, #22) — F4 Steps 2–4: the cross-game Neve line, rule-based and zero-AI.
 * See `design/gdd/memory.md` Formula F4. Returns a NeveSignal (numbers + branch); story-005 fills
 * the template. There is deliberately NO weakest-stage branch (vision anti-rating guardrail).
 *
 * Robust to input order: it sorts the window by createdAt internally, so neither the caller nor the
 * DB sort order matters.
 */

import type { MemoryGameSummary, NeveSignal, Stage } from '@/types/memory'
import {
  OBS_WINDOW,
  OBS_MIN_SAMPLE,
  OBS_MIN_STAGE,
  OBS_IMPROVE_DELTA,
  OBS_CONCEPT_FRAC,
} from '@/config/memory-config'

const STAGES: Stage[] = ['opening', 'middlegame', 'endgame']

export interface CrossGameTuning {
  window?: number
  minSample?: number
  minStage?: number
  improveDelta?: number
  conceptFrac?: number
}

function stageSum(games: ReadonlyArray<MemoryGameSummary>, stage: Stage): number {
  return games.reduce((s, g) => s + g.stageCounts[stage], 0)
}

/** Largest fractional drop in a stage's per-game gated-moment rate from the older to the recent half.
 *  Both halves must hold >= minStage gated moments in that stage (noise floor; no div-by-zero). */
function bestImprovingStage(
  window: ReadonlyArray<MemoryGameSummary>,
  minStage: number,
  improveDelta: number,
): Stage | null {
  const half = Math.floor(window.length / 2)
  if (half === 0) return null
  const older = window.slice(0, half)
  const recent = window.slice(window.length - half)

  let best: Stage | null = null
  let bestDrop = -Infinity
  for (const stage of STAGES) {
    const olderSum = stageSum(older, stage)
    const recentSum = stageSum(recent, stage)
    if (olderSum < minStage || recentSum < minStage) continue // skip: not enough signal
    const olderRate = olderSum / older.length
    const recentRate = recentSum / recent.length
    if (olderRate <= 0) continue
    const drop = (olderRate - recentRate) / olderRate
    if (drop >= improveDelta && drop > bestDrop) {
      bestDrop = drop
      best = stage
    }
  }
  return best
}

/** The single concept holding >= conceptFrac of all gated concept-moments across the window. */
function dominantConcept(window: ReadonlyArray<MemoryGameSummary>, conceptFrac: number): string | null {
  const counts: Record<string, number> = {}
  let total = 0
  for (const g of window) {
    for (const [concept, n] of Object.entries(g.conceptCounts)) {
      counts[concept] = (counts[concept] ?? 0) + n
      total += n
    }
  }
  if (total === 0) return null
  let topConcept: string | null = null
  let topN = 0
  for (const [concept, n] of Object.entries(counts)) {
    if (n > topN) {
      topN = n
      topConcept = concept
    }
  }
  return topConcept !== null && topN / total >= conceptFrac ? topConcept : null
}

/** Pick exactly one Neve line: improving > recurring > neutral; first-or-few on insufficient sample. */
export function pickNeveLine(
  summaries: ReadonlyArray<MemoryGameSummary>,
  tuning: CrossGameTuning = {},
): NeveSignal {
  const windowSize = tuning.window ?? OBS_WINDOW
  const minSample = tuning.minSample ?? OBS_MIN_SAMPLE
  const minStage = tuning.minStage ?? OBS_MIN_STAGE
  const improveDelta = tuning.improveDelta ?? OBS_IMPROVE_DELTA
  const conceptFrac = tuning.conceptFrac ?? OBS_CONCEPT_FRAC

  // Order chronologically by createdAt (robust to caller/DB sort), then take the most recent window.
  const chronological = [...summaries].sort((a, b) => a.createdAt - b.createdAt)
  const window = chronological.slice(-windowSize)
  const n = window.length

  if (n < minSample) return { kind: 'first-or-few', n: summaries.length }

  const improving = bestImprovingStage(window, minStage, improveDelta)
  if (improving) return { kind: 'improving', stage: improving, n }

  const recurring = dominantConcept(window, conceptFrac)
  if (recurring) return { kind: 'recurring', concept: recurring, n }

  return { kind: 'neutral', n }
}
