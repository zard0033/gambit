/**
 * Learning Loop tuning knobs (GDD §7). Data-driven per coding standards; never hardcoded in views.
 */

/**
 * Puzzles of a concept that must be solved (dungeon ∪ practice) before the Concept Map marks it
 * 已練 (GDD §4.2, §7). Safe range 1–5; 0 is excluded — it would mark every concept practised
 * unconditionally.
 */
export const CONCEPT_PRACTICED_THRESHOLD = 1

/**
 * Which Bridge-3 signals the classifier attempts in v1 (GDD §7). fork/pin mistake detection is
 * deferred to Phase C+ (pv-based heuristics are unreliable — see GDD §3.4), so v1 fires only on
 * the two reliably-detectable signals. Consumed by `classify()`（modules/learning-loop/classify.ts，
 * 2026-07-03 接線）——從清單移除某訊號即停用該偵測器。
 */
export const CLASSIFIER_SIGNALS: readonly import('../modules/learning-loop/classify').ClassifierSignal[] =
  ['mate', 'material']

/**
 * Max missed-mate positions captured from one game's review into the recognition-source store, and
 * the cap on how many pending sources one judgement-field run surfaces (棋憶 signpost → RecognitionGate).
 * Safe range 1–3; keeps the judgement field short and the localStorage footprint bounded.
 */
export const RECOGNITION_SOURCE_MAX = 3

/**
 * Feature flag for the「棋憶 signpost → 判斷場接真實對局」brick (v1: missed mate only). When false,
 * both the write path (no missed-mate capture at review COMPLETE) and the read path
 * (`useRecognitionSourceStore.hasPending`/`pendingFor` report empty regardless of stored data) go
 * dark — a clean kill switch with zero behavioural residue, including for sources captured before
 * the flag was flipped off.
 */
export const RECOGNITION_MISSED_MATE_ENABLED = true

/**
 * How many distinct games' worth of unconsumed missed-mate sources the recognition-source store
 * keeps around. `pendingFor` only ever serves the latest game, so older games' unconsumed entries
 * are dead weight — trimming to the N most-recently-written games (by insertion order) bounds
 * localStorage growth for players who accumulate missed mates across many reviewed games without
 * ever running the judgement field.
 */
export const RECOGNITION_SOURCE_GAMES_MAX = 3

/**
 * FIFO cap on the recognition-source store's `consumed` id set (localStorage footprint guard).
 * `sources` entries are pruned as soon as they're consumed, so this only bounds the dedup-guard
 * history (blocks re-capture of the same solved position) — trimming the oldest ids is safe once
 * the list is this long.
 */
export const RECOGNITION_CONSUMED_MAX = 300

/**
 * Pause between the judgement field's final correct verdict and the deepening wrap-up overlay
 * (iPhone 複驗 2026-07-11: the overlay covered Neve's last feedback bubble before it could be
 * read). Pacing, not motion — applies regardless of prefers-reduced-motion. Safe range
 * 800–2000ms; 0 restores the old instant cut.
 */
export const RECOGNITION_COMPLETE_LINGER_MS = 1400
