/**
 * Difficulty ladder for playing the engine.
 * Spec: design/quick-specs/difficulty-ladder-remake.md
 *
 * The ladder is driven by `fallible` — deliberate mistakes picked out of the engine's own MultiPV
 * list (see modules/chess-engine/fallible-pick.ts). Everything else here is scaffolding.
 *
 * That is a reversal, and the reason is worth keeping: Stockfish has no UCI knob that makes it play
 * like a beginner. Measured 2026-08-01 with a "white hangs a knight — does it take?" probe, every
 * available knob took the piece 16-20 times out of 20: Skill Level 0 at depth 1, 5 and 8;
 * `go nodes 1`; `UCI_Elo 1320`, the official floor. Copying lichess's table was a dead end for a
 * separate reason — its levels 1-3 send `Skill Level -9/-5/-1`, and official Stockfish declares the
 * option as `spin min 0 max 20` and *rejects* out-of-range values outright rather than clamping, so
 * those three levels run at the default of 20. Measured: `depth 5 skill -9` and `depth 5 skill 20`
 * behave identically. lichess's low levels are beatable because of its opening book (real sub-1000
 * player move frequencies), not because of engine settings.
 *
 * Two earlier conclusions survive, one inverted:
 *
 *  - No random-move injection. It produces "blunder-shaped" weakness (5-6 catastrophes per 56
 *    moves) — the player wins because the engine gifted a piece, which is chess.com's low-bot
 *    failure mode and gives no sense of achievement. `maxLossCp` is the guardrail against it.
 *  - INVERTED: capping depth low is counterproductive. Higher depth spreads the candidate scores
 *    further apart (midgame: worst move loses 59cp at depth 1, 131cp at depth 8), and a mistake can
 *    only be picked from a spread. A low depth cap does not weaken the engine, it stops the engine
 *    from telling good moves from bad — which is why Skill Level 0 could only jitter within 14cp.
 *    Every rung now searches at depth 8.
 *
 * `skillLevel` no longer weakens anything (play-engine sends 20 to the engine whenever `fallible`
 * is set, so the engine's own jitter cannot disturb the MultiPV ordering we pick from). It is kept
 * because it is what gets persisted to `game_sessions.ai_difficulty` — the column keeps its 0-20
 * semantics and its CHECK constraint, no migration, and old rows stay readable.
 */

/**
 * Per-rung mistake tuning, consumed by modules/chess-engine/fallible-pick.ts.
 * Defined here rather than alongside the picker so the dependency runs modules → config,
 * matching the rest of the codebase (config/ is a data layer and imports nothing from modules/).
 */
export interface FallibleConfig {
  /** Chance this move is a deliberate mistake, 0-1. Humans err sometimes, not every move. */
  probability: number
  /** Lower bound of the mistake window, in centipawns lost against the best move. */
  minLossCp: number
  /** Upper bound. Above this the "mistake" is a hung piece — excluded on purpose. */
  maxLossCp: number
}

export interface DifficultyRung {
  /** Ladder position 1-5. This is what the player picks. */
  rung: number
  /** Player-facing name. Same vocabulary is reused in game history so both read alike. */
  name: string
  /**
   * One line on how this opponent actually plays. Describes the opponent, never the player —
   * "你太弱" framing is off-limits (design-system voice: calm, low-pressure, never evaluative
   * about the player's skill). Must stay honest about the depth cap: rung 5 is depth 8,
   * not full strength, so it must not claim to be.
   */
  blurb: string
  /**
   * Persisted to `game_sessions.ai_difficulty` and used by `rungForSkillLevel` to read back rows
   * that predate the ladder. No longer sent to the engine as a weakening knob — see the file header.
   * The five values must stay distinct, or the reverse lookup collapses.
   */
  skillLevel: number
  /** Search depth cap for `go depth`. Deeper = candidate scores spread wider = mistakes pickable. */
  depth: number
  /** Per-move time cap for `go … movetime`. */
  movetimeMs: number
  /** Deliberate-mistake tuning. Omit for a rung that always plays the engine's best move. */
  fallible?: FallibleConfig
}

export const DIFFICULTY_LADDER: readonly DifficultyRung[] = [
  // 窗口初版（2026-08-01）：probability 與 cp 帶是這張表唯一真正的旋鈕，其餘欄位都不再影響棋力。
  // 靠實玩校準——這是第一次校準真的會動，先前調 skill/depth 等於在調啞彈。
  // movetime 1000：全寬 MultiPV 跑 depth 8 桌機最慢 156ms、手機估 ~600ms，留足餘裕跑完；
  // 出手節奏本來就有 MIN_THINK_MS 900 的地板，所以玩家感覺不到差別。
  {
    rung: 1, name: '初學', blurb: '常常走錯方向，破綻不少。',
    skillLevel: 0, depth: 8, movetimeMs: 1000,
    fallible: { probability: 0.6, minLossCp: 100, maxLossCp: 300 },
  },
  {
    rung: 2, name: '進階', blurb: '偶爾走岔，明顯的威脅抓得到。',
    skillLevel: 6, depth: 8, movetimeMs: 1000,
    fallible: { probability: 0.4, minLossCp: 70, maxLossCp: 200 },
  },
  {
    rung: 3, name: '熟練', blurb: '算得到幾步之後，很少送子。',
    skillLevel: 9, depth: 8, movetimeMs: 1000,
    fallible: { probability: 0.25, minLossCp: 50, maxLossCp: 120 },
  },
  {
    rung: 4, name: '精通', blurb: '很少失誤，開局也算得清楚。',
    skillLevel: 11, depth: 8, movetimeMs: 1000,
    fallible: { probability: 0.12, minLossCp: 30, maxLossCp: 80 },
  },
  // 頂階不犯錯：fallible 省略 → 一律走引擎最佳手。
  { rung: 5, name: '大師', blurb: '算得很深，幾乎不留破綻。', skillLevel: 17, depth: 8, movetimeMs: 1000 },
] as const

/** Rung offered to a player who has never won yet. */
export const DEFAULT_RUNG = 1

/**
 * Pacing floor for the opponent's reply, in ms.
 *
 * Search time and *apparent* thinking time are different things. Even a full-width search finishes
 * well inside this floor (measured 156ms worst case on desktop at depth 8), so without it the
 * opponent answers near-instantly — which reads as blitz, and quietly pressures the player into
 * moving fast too. That is the opposite of what a calm training app wants, and rushing is exactly
 * when a beginner blunders.
 *
 * The delay is a floor, not an addition: time already spent searching counts toward it, so a
 * position that took longer to search waits correspondingly less.
 */
export const MIN_THINK_MS = 900
/** Random spread on top of the floor, so the opponent's pace is not mechanically identical. */
export const THINK_JITTER_MS = 600

/**
 * How much longer to wait before playing a move that took `elapsedMs` to find.
 * `roll` is injectable so tests stay deterministic.
 */
export function remainingThinkDelayMs(elapsedMs: number, roll: number = Math.random()): number {
  const target = MIN_THINK_MS + roll * THINK_JITTER_MS
  return Math.max(0, Math.round(target - elapsedMs))
}

/** Clamps to the ladder, so a corrupt or out-of-range stored value can never crash the game. */
export function rungAt(rung: number): DifficultyRung {
  return DIFFICULTY_LADDER.find((r) => r.rung === rung) ?? DIFFICULTY_LADDER[DEFAULT_RUNG - 1]
}

/**
 * Reverse lookup by Skill Level, for values that predate the ladder.
 * Saved resume games and `ui:highestBeatenLevel` both hold a raw 0-20 Skill Level, and
 * `game_sessions.ai_difficulty` is full of them. Nearest rung wins; ties go to the weaker rung.
 */
export function rungForSkillLevel(skillLevel: number): DifficultyRung {
  if (!Number.isFinite(skillLevel)) return DIFFICULTY_LADDER[DEFAULT_RUNG - 1]
  let best = DIFFICULTY_LADDER[0]
  let bestDistance = Math.abs(best.skillLevel - skillLevel)
  for (const candidate of DIFFICULTY_LADDER) {
    const distance = Math.abs(candidate.skillLevel - skillLevel)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}
