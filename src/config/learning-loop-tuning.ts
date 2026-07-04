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
 * Bridge-3 concept signposts shown per game review (GDD §3.4, §7). Safe range 1–3; 0 is excluded —
 * it would never show a signpost. Signposts are ranked by cpLoss and the top N are kept.
 */
export const MISTAKE_CONCEPT_MAX_LINKS = 1

/**
 * Which Bridge-3 signals the classifier attempts in v1 (GDD §7). fork/pin mistake detection is
 * deferred to Phase C+ (pv-based heuristics are unreliable — see GDD §3.4), so v1 fires only on
 * the two reliably-detectable signals. Consumed by `classify()`（modules/learning-loop/classify.ts，
 * 2026-07-03 接線）——從清單移除某訊號即停用該偵測器。
 */
export const CLASSIFIER_SIGNALS: readonly import('../modules/learning-loop/classify').ClassifierSignal[] =
  ['mate', 'material']
