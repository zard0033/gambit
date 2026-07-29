/**
 * Difficulty ladder for playing the engine.
 * Spec: design/quick-specs/difficulty-ladder-remake.md
 *
 * Replaces the old "pick a Skill Level 0-20" selector. That selector was 21 rungs of almost
 * nothing: every rung sent `go movetime 3000` with no depth cap, so the only difference between
 * them was Skill Level's candidate jitter. Rung 0 was in fact stronger than lichess's *top* level.
 *
 * These values are lichess's levels 1/2/3/4/6, adopted verbatim. Five rounds of local measurement
 * (four by win rate, one by centipawn loss) failed to produce a better table — win rate over 5-6
 * decided games is too noisy to read (the same pairing came out 83% and then 20% on two runs).
 * lichess's table is tuned against millions of real games; ours had a sample five orders of
 * magnitude smaller. What the measurement *did* settle is baked into the shape of this table:
 *
 *  - No random-move injection. It produces "blunder-shaped" weakness (low median cpLoss, 5-6
 *    catastrophes per 56 moves) — the player wins because the engine gifted a piece, which is
 *    chess.com's low-bot failure mode and gives no sense of achievement. Depth limiting produces
 *    "steady small loss" weakness (higher median, zero catastrophes), which is what we want.
 *  - Depth 8 is the top rung. Beyond depth 6 the engine is already far past a beginner
 *    (d6 vs d10 was undecided in five of six games), so extra rungs buy nothing.
 *  - `skillLevel` must travel with `depth`. At skill 0 the odd-even search effect is severe
 *    (depth 3 lost 0:5 to depth 2); Skill Level's candidate jitter masks it, which is why
 *    lichess can use odd depths without trouble.
 *
 * `skillLevel` is also what gets persisted to `game_sessions.ai_difficulty`, so the column keeps
 * its 0-20 semantics and its CHECK constraint — no migration, and old rows stay readable.
 */

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
  /** Stockfish `Skill Level` UCI option (0-20). Persisted as `ai_difficulty`. */
  skillLevel: number
  /** Search depth cap for `go depth`. */
  depth: number
  /** Per-move time cap for `go … movetime`. */
  movetimeMs: number
}

export const DIFFICULTY_LADDER: readonly DifficultyRung[] = [
  { rung: 1, name: '初學', blurb: '常常看不到你的威脅。', skillLevel: 3, depth: 1, movetimeMs: 50 },
  { rung: 2, name: '進階', blurb: '會抓明顯的破綻，但看不遠。', skillLevel: 6, depth: 2, movetimeMs: 100 },
  { rung: 3, name: '熟練', blurb: '算得到幾步之後，很少送子。', skillLevel: 9, depth: 3, movetimeMs: 150 },
  { rung: 4, name: '精通', blurb: '很少失誤，開局也算得清楚。', skillLevel: 11, depth: 4, movetimeMs: 200 },
  { rung: 5, name: '大師', blurb: '算得很深，幾乎不留破綻。', skillLevel: 17, depth: 8, movetimeMs: 300 },
] as const

/** Rung offered to a player who has never won yet. */
export const DEFAULT_RUNG = 1

/**
 * Pacing floor for the opponent's reply, in ms.
 *
 * Search time and *apparent* thinking time are different things. The ladder's search budget runs
 * 50-300ms, so without this the opponent answers instantly — which reads as blitz, and quietly
 * pressures the player into moving fast too. That is the opposite of what a calm training app
 * wants, and rushing is exactly when a beginner blunders.
 *
 * The delay is a floor, not an addition: time already spent searching counts toward it, so the
 * top rung (300ms search) waits correspondingly less.
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
