/**
 * 棋憶 (Memory, #22) — F1 key-moment selection. Pure function over Post-Game Review (#7) output;
 * runs no analysis (ADR-0014 §3). See `design/gdd/memory.md` Formula F1.
 *
 * Count is not fixed — cap MEMORY_MOMENT_MAX, floor 0 (a steady game surfaces nothing, EC-1).
 * `gatedCandidates` exposes the pre-cap gated set (F1 Step 3) for the F4 cross-game tagging.
 */

import {
  computeCpLoss,
  type StoredAnalysisEntry,
} from '@/modules/post-game-review/use-post-game-review'
import type { ClassifyResult } from '@/modules/learning-loop/classify'
import type { Moment, MomentKind } from '@/types/memory'
import {
  MEMORY_MOMENT_CP_GATE,
  MEMORY_ANCHOR_FLOOR,
  MEMORY_BRIGHT_GATE,
  CONCEPT_BONUS,
  MEMORY_MOMENT_MAX,
} from '@/config/memory-config'

export interface SelectMomentsInput {
  readonly analysisResults: ReadonlyArray<StoredAnalysisEntry | null>
  readonly isPlayerMove: (i: number) => boolean
  /** Concept per position i (caller pre-computes via #20 classify); 'none' where unclassified. */
  readonly concepts: ReadonlyArray<ClassifyResult>
  /** #7's anchor (computed once, never moved); null on a steady game. */
  readonly biggestSwingCursor: number | null
}

export interface MemorySelectionTuning {
  gate?: number
  anchorFloor?: number
  brightGate?: number
  conceptBonus?: number
  max?: number
}

/**
 * Favorable swing for a bright candidate: fav = -(E[i] + E[i+1]) using side-to-move evalCp.
 * Returns -Infinity (never a bright candidate) when either position is a mate score or missing —
 * this IS the mate guard (GDD F1 source B): without it a mate's ±MATE_CP spikes fav to ~+60000.
 */
function favAt(curr: StoredAnalysisEntry | null, next: StoredAnalysisEntry | null): number {
  if (!curr || !next) return Number.NEGATIVE_INFINITY
  if (curr.evalMate !== undefined || next.evalMate !== undefined) return Number.NEGATIVE_INFINITY
  if (curr.evalCp === undefined || next.evalCp === undefined) return Number.NEGATIVE_INFINITY
  return -(curr.evalCp + next.evalCp)
}

interface Candidate {
  ply: number
  cp: number
  fav: number
  concept: ClassifyResult
  tactical: boolean
  anchor: boolean
  bright: boolean
  plain: boolean
  score: number
}

/** Displayed kind (GDD Rule 12): tactical wins; anchor/bright both render as 'bright' (pivotal/bright);
 *  otherwise 'plain'. The `anchor` flag is carried separately for emphasis. */
function displayKind(c: Candidate): MomentKind {
  if (c.tactical) return 'tactical'
  if (c.anchor || c.bright) return 'bright'
  return 'plain'
}

function toMoment(c: Candidate): Moment {
  return { ply: c.ply, kind: displayKind(c), anchor: c.anchor, concept: c.concept, cp: c.cp, fav: c.fav }
}

/** F1 Steps 1–3: gather the three sources, same-ply merge, then gate (anchor & bright exempt). */
function gate(input: SelectMomentsInput, tuning: MemorySelectionTuning): Candidate[] {
  const gate = tuning.gate ?? MEMORY_MOMENT_CP_GATE
  const anchorFloor = tuning.anchorFloor ?? MEMORY_ANCHOR_FLOOR
  const brightGate = tuning.brightGate ?? MEMORY_BRIGHT_GATE
  const conceptBonus = tuning.conceptBonus ?? CONCEPT_BONUS
  const { analysisResults, isPlayerMove, concepts, biggestSwingCursor } = input

  const byPly = new Map<number, Candidate>()
  const ensure = (ply: number, cp: number, fav: number, concept: ClassifyResult): Candidate => {
    let c = byPly.get(ply)
    if (!c) {
      c = { ply, cp, fav, concept, tactical: false, anchor: false, bright: false, plain: false, score: 0 }
      byPly.set(ply, c)
    }
    return c
  }

  // best bright across the whole game (source B, max 1)
  let brightPly = -1
  let brightFav = Number.NEGATIVE_INFINITY

  for (let i = 0; i < analysisResults.length - 1; i++) {
    if (!isPlayerMove(i)) continue
    const cp = computeCpLoss(i, analysisResults, isPlayerMove)
    if (cp === null) continue
    const concept = concepts[i] ?? 'none'
    const fav = favAt(analysisResults[i], analysisResults[i + 1])

    if (concept !== 'none') {
      const c = ensure(i, cp, fav, concept)
      c.tactical = true
      c.score = Math.max(c.score, cp + conceptBonus)
    }
    if (biggestSwingCursor !== null && i === biggestSwingCursor) {
      const c = ensure(i, cp, fav, concept)
      c.anchor = true
      c.score = Math.max(c.score, cp)
    }
    if (concept === 'none' && cp >= gate) {
      const c = ensure(i, cp, fav, concept)
      c.plain = true
      c.score = Math.max(c.score, cp)
    }
    if (fav >= brightGate && fav > brightFav) {
      brightFav = fav
      brightPly = i
    }
  }

  if (brightPly >= 0) {
    const cp = computeCpLoss(brightPly, analysisResults, isPlayerMove) ?? 0
    const c = ensure(brightPly, cp, brightFav, input.concepts[brightPly] ?? 'none')
    c.bright = true
    c.score = Math.max(c.score, brightFav)
  }

  // Step 3: gate — anchor (cp >= anchorFloor) and bright are exempt.
  return [...byPly.values()].filter((c) => {
    if (c.bright) return true
    if (c.anchor && c.cp >= anchorFloor) return true
    return c.cp >= gate
  })
}

/** Pre-cap gated candidates (F1 Step 3) in ply order — feeds the F4 cross-game stageCounts. */
export function gatedCandidates(input: SelectMomentsInput, tuning: MemorySelectionTuning = {}): Moment[] {
  return gate(input, tuning)
    .sort((a, b) => a.ply - b.ply)
    .map(toMoment)
}

/** F1 final selection: gate → Step 4 (rank, force-include anchor + bright, cap) → Step 5 (ply order). */
export function selectMoments(input: SelectMomentsInput, tuning: MemorySelectionTuning = {}): Moment[] {
  const max = tuning.max ?? MEMORY_MOMENT_MAX
  const ranked = [...gate(input, tuning)].sort((a, b) => b.score - a.score || a.ply - b.ply)

  const kept: Candidate[] = []
  const pushUnique = (c: Candidate) => {
    if (!kept.includes(c)) kept.push(c)
  }
  for (const c of ranked) if (c.anchor || c.bright) pushUnique(c)
  for (const c of ranked) {
    if (kept.length >= max) break
    pushUnique(c)
  }

  return kept
    .slice(0, max)
    .sort((a, b) => a.ply - b.ply)
    .map(toMoment)
}
