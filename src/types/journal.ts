/**
 * Journal (棋誌) shared types. See `design/gdd/journal.md` and ADR-0013.
 * v1 pens: onset / arrival / solace. Phase 2 widens `Pen` (no migration —
 * `journal_entries.type` is a free text column).
 */

/** A journal pen (entry kind). v1 implements onset/arrival/solace; epiphany = a concept
 * deepening's silent gate solved with no aid ("你自己看出來的"). */
export type Pen = 'onset' | 'arrival' | 'solace' | 'epiphany'

/** Journey volume an entry is filed under. `onset` is filed under none (null). */
export type Volume = '卷一規則' | '卷二戰術' | '卷三開局' | '卷四殘局'

/** Data injected into a template at render time (e.g. arrival's 卷名/學會的/應付的). */
export type JournalParams = Record<string, string>

/** A zero-AI template句: its rendered output is a deterministic function of params (R9). */
export interface JournalTemplate {
  /** Stable id, e.g. `onset.1`, `arrival.3`. Persisted on the entry for golden/lint. */
  readonly id: string
  readonly pen: Pen
  /** Pure, deterministic render. onset/solace ignore params; arrival reads 卷名/學會的/應付的. */
  readonly render: (params: JournalParams) => string
}

/** A persisted journal entry (mirrors the `journal_entries` row — ADR-0013 §1). */
export interface JournalEntry {
  readonly id: string
  readonly type: Pen
  /** Event idempotency key: onset='onset', arrival=stageId, solace=triggering gameId, epiphany=conceptId. */
  readonly sourceRefId: string
  /** null for onset (pinned at the book's start, filed under no volume). */
  readonly volume: Volume | null
  readonly templateId: string
  readonly params: JournalParams
  /** Immutable rendered Neve text snapshot (R2 append-only). */
  readonly body: string
  /** Epoch ms (mirrors `created_at`). */
  readonly createdAt: number
}
