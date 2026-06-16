/**
 * Journal (棋誌) tuning knobs. See design/gdd/journal.md → Tuning Knobs and ADR-0013.
 * Values are data-driven config, not magic numbers in logic.
 */

/** Max entries written in one session (F2). v1 candidates ≤3 so this never truncates. */
export const SESSION_ENTRY_CAP = 3

/** Consecutive losses required to trigger ⑤ solace (F1). */
export const SOLACE_LOSS_STREAK = 3

/** Minimum sessions between two ⑤ solace entries (anti-spam, device-local). */
export const SOLACE_COOLDOWN = 3

/** Idle gap (minutes) that ends a session — used only for ⑤ cooldown / ④ carryover counting. */
export const SESSION_IDLE_TIMEOUT_MIN = 30

/** Number of recent entries the homepage peek shows. */
export const HOMEPAGE_PEEK_COUNT = 3
