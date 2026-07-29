import { describe, it, expect } from 'vitest'
import {
  DIFFICULTY_LADDER,
  DEFAULT_RUNG,
  MIN_THINK_MS,
  THINK_JITTER_MS,
  rungAt,
  rungForSkillLevel,
  remainingThinkDelayMs,
} from '../../../src/config/difficulty-tuning'

describe('difficulty ladder — table invariants', () => {
  it('test_difficultyLadder_shape_isFiveRungsNumberedOneToFive', () => {
    // Assert
    expect(DIFFICULTY_LADDER.map((r) => r.rung)).toEqual([1, 2, 3, 4, 5])
  })

  it('test_difficultyLadder_everyRung_capsSearchDepth', () => {
    // The whole point of the remake: the old selector sent no depth cap, so all 21 rungs
    // played at effectively full strength. An uncapped rung here is that bug coming back.
    for (const rung of DIFFICULTY_LADDER) {
      expect(rung.depth).toBeGreaterThan(0)
      expect(Number.isFinite(rung.depth)).toBe(true)
    }
  })

  it('test_difficultyLadder_skillDepthAndMovetime_increaseMonotonically', () => {
    // Arrange / Act
    for (let i = 1; i < DIFFICULTY_LADDER.length; i++) {
      const prev = DIFFICULTY_LADDER[i - 1]
      const curr = DIFFICULTY_LADDER[i]

      // Assert — a rung the player cannot feel is a rung that should not exist
      expect(curr.skillLevel).toBeGreaterThan(prev.skillLevel)
      expect(curr.depth).toBeGreaterThan(prev.depth)
      expect(curr.movetimeMs).toBeGreaterThan(prev.movetimeMs)
    }
  })

  it('test_difficultyLadder_skillLevels_stayInStockfishRange', () => {
    // ai_difficulty persists these raw, under CHECK (ai_difficulty BETWEEN 0 AND 20).
    for (const rung of DIFFICULTY_LADDER) {
      expect(rung.skillLevel).toBeGreaterThanOrEqual(0)
      expect(rung.skillLevel).toBeLessThanOrEqual(20)
    }
  })
})

describe('rungAt', () => {
  it('test_rungAt_knownRung_returnsMatchingEntry', () => {
    // Act
    const rung = rungAt(3)

    // Assert
    expect(rung.rung).toBe(3)
    expect(rung.depth).toBe(3)
  })

  it('test_rungAt_outOfRangeValue_fallsBackToDefaultRung', () => {
    // A corrupt localStorage value must never crash the game or hand the player full strength.
    expect(rungAt(0).rung).toBe(DEFAULT_RUNG)
    expect(rungAt(99).rung).toBe(DEFAULT_RUNG)
    expect(rungAt(Number.NaN).rung).toBe(DEFAULT_RUNG)
  })
})

describe('remainingThinkDelayMs — 出手節奏', () => {
  it('test_thinkDelay_fastSearch_padsUpToTheFloor', () => {
    // 檔一只搜 50ms，若不補停頓就會瞬間落子，讀起來像快棋
    expect(remainingThinkDelayMs(50, 0)).toBe(MIN_THINK_MS - 50)
  })

  it('test_thinkDelay_isAFloorNotAnAddition', () => {
    // 搜得久的檔位要等得比較少，總節奏才一致
    const fast = remainingThinkDelayMs(50, 0.5)
    const slow = remainingThinkDelayMs(300, 0.5)
    expect(slow).toBe(fast - 250)
  })

  it('test_thinkDelay_searchAlreadyExceedsFloor_returnsZero', () => {
    // 絕不回負值——負的 setTimeout 會立刻觸發，等於沒有節奏保護
    expect(remainingThinkDelayMs(MIN_THINK_MS + THINK_JITTER_MS + 500, 1)).toBe(0)
  })

  it('test_thinkDelay_jitter_staysWithinFloorAndSpread', () => {
    // 隨機只在 floor 與 floor+jitter 之間擺動，不會產生離譜的等待
    for (const roll of [0, 0.25, 0.5, 0.75, 1]) {
      const delay = remainingThinkDelayMs(0, roll)
      expect(delay).toBeGreaterThanOrEqual(MIN_THINK_MS)
      expect(delay).toBeLessThanOrEqual(MIN_THINK_MS + THINK_JITTER_MS)
    }
  })
})

describe('rungForSkillLevel — legacy 0-20 values', () => {
  it('test_rungForSkillLevel_exactLadderValue_returnsThatRung', () => {
    expect(rungForSkillLevel(3).rung).toBe(1)
    expect(rungForSkillLevel(17).rung).toBe(5)
  })

  it('test_rungForSkillLevel_legacyValue_returnsNearestRung', () => {
    // Saved resume games and ui:highestBeatenLevel hold raw Skill Levels from the old selector.
    expect(rungForSkillLevel(0).rung).toBe(1) // nearest to 3
    expect(rungForSkillLevel(7).rung).toBe(2) // nearest to 6
    expect(rungForSkillLevel(20).rung).toBe(5) // nearest to 17
  })

  it('test_rungForSkillLevel_everyLegacyValue_resolvesWithoutThrowing', () => {
    // The old selector could produce any of 0-20; none may crash the restore path.
    for (let skill = 0; skill <= 20; skill++) {
      const rung = rungForSkillLevel(skill)
      expect(DIFFICULTY_LADDER).toContain(rung)
    }
  })

  it('test_rungForSkillLevel_nonFiniteValue_returnsDefaultRung', () => {
    expect(rungForSkillLevel(Number.NaN).rung).toBe(DEFAULT_RUNG)
    expect(rungForSkillLevel(Number.POSITIVE_INFINITY).rung).toBe(DEFAULT_RUNG)
  })
})
