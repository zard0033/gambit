import type { JournalEntry, JournalParams, Pen, Volume } from '@/types/journal'
import { pickTemplate, render } from './render'
import { SESSION_ENTRY_CAP, SOLACE_COOLDOWN, SOLACE_LOSS_STREAK } from '@/config/journal-config'

/** A pen eligible to be written this settle, with everything needed to render it. */
export interface Candidate {
  pen: Pen
  sourceRefId: string
  volume: Volume | null
  params: JournalParams
}

/** A journey stage (lesson category) the player has completed. */
export interface CompletedStage {
  stageId: string
  volume: Volume
  params: JournalParams
}

/** A concept whose deepening silent gate was solved unaided — the epiphany source. */
export interface DeepenedConcept {
  conceptId: string
  volume: Volume
  params: JournalParams
}

export type GameOutcome = 'win' | 'loss' | 'draw'

/** A played game, newest-first, reduced to what settle needs. */
export interface PlayedGame {
  id: string
  outcome: GameOutcome
}

/** Everything the settle derivation reads — all from persistent state (R5: no ephemeral buffer in v1). */
export interface SettleSnapshot {
  /** True if an onset entry already exists (R6 once-only). */
  hasOnset: boolean
  /** Stages currently complete (from lesson-progress + catalog). */
  completedStages: CompletedStage[]
  /** stageIds that already have an arrival entry (R6 / AC-arrival-2/3 dedup). */
  recordedStageIds: ReadonlySet<string>
  /** Concepts deepened unaided (eligible for an epiphany entry). */
  unaidedDeepenings: DeepenedConcept[]
  /** conceptIds that already have an epiphany entry (dedup — one epiphany per concept). */
  recordedEpiphanyRefIds: ReadonlySet<string>
  /** Recent games, newest-first (for the leading loss run). */
  recentGames: PlayedGame[]
  /** Sessions since the last solace (∞ if never) — for SOLACE_COOLDOWN. */
  sessionsSinceLastSolace: number
  /** Entry timestamp (epoch ms) — injected for determinism. */
  now: number
  /** Id generator — injected for determinism. */
  newId: () => string
}

/** Priority for F2 selection (higher wins). Phase 2 inserts move=1. */
const PRIORITY: Record<Pen, number> = { onset: 5, epiphany: 4, arrival: 3, solace: 2 }

/** Count the leading run of losses (newest-first) and the game that triggered it. */
export function leadingLossRun(games: PlayedGame[]): { count: number; triggeringGameId: string | null } {
  let count = 0
  for (const g of games) {
    if (g.outcome === 'loss') count++
    else break
  }
  return { count, triggeringGameId: count > 0 ? games[0].id : null }
}

/** Map a game-history playerResult to a settle outcome. */
export function outcomeFromResult(result: 'Win' | 'Loss' | 'Draw' | 'Unknown'): GameOutcome {
  if (result === 'Win') return 'win'
  if (result === 'Loss') return 'loss'
  return 'draw'
}

/** F1 gates: derive every eligible candidate from the snapshot (pure, zero-AI). */
export function deriveCandidates(s: SettleSnapshot): Candidate[] {
  const out: Candidate[] = []

  if (!s.hasOnset) {
    out.push({ pen: 'onset', sourceRefId: 'onset', volume: null, params: {} })
  }

  for (const stage of s.completedStages) {
    if (!s.recordedStageIds.has(stage.stageId)) {
      out.push({ pen: 'arrival', sourceRefId: stage.stageId, volume: stage.volume, params: stage.params })
    }
  }

  for (const c of s.unaidedDeepenings) {
    if (!s.recordedEpiphanyRefIds.has(c.conceptId)) {
      out.push({ pen: 'epiphany', sourceRefId: c.conceptId, volume: c.volume, params: c.params })
    }
  }

  const { count, triggeringGameId } = leadingLossRun(s.recentGames)
  if (count >= SOLACE_LOSS_STREAK && s.sessionsSinceLastSolace >= SOLACE_COOLDOWN && triggeringGameId) {
    out.push({ pen: 'solace', sourceRefId: triggeringGameId, volume: '卷二戰術', params: {} })
  }

  return out
}

/** F2: take the top `cap` candidates by priority. A 4-candidate session (onset+epiphany+arrival+
 * solace) drops the lowest (solace) past the cap; it re-derives on the next settle. */
export function selectCandidates(candidates: Candidate[], cap: number = SESSION_ENTRY_CAP): Candidate[] {
  return [...candidates].sort((a, b) => PRIORITY[b.pen] - PRIORITY[a.pen]).slice(0, cap)
}

/** Build the immutable entry for a candidate (picks a template variant, renders the body). */
export function buildEntry(c: Candidate, now: number, newId: () => string): JournalEntry {
  const template = pickTemplate(c.pen, c.sourceRefId)
  return {
    id: newId(),
    type: c.pen,
    sourceRefId: c.sourceRefId,
    volume: c.volume,
    templateId: template.id,
    params: c.params,
    body: render(template.id, c.params),
    createdAt: now,
  }
}

/** Full settle: gates → select (cap) → build. Returns the ≤cap entries to write. */
export function planEntries(s: SettleSnapshot): JournalEntry[] {
  return selectCandidates(deriveCandidates(s)).map((c) => buildEntry(c, s.now, s.newId))
}
