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

  it('test_difficultyLadder_everyRung_searchesDeepEnoughToSpreadCandidates', () => {
    // 反轉自舊設計（2026-08-01 量測）：壓低 depth 不是弱化引擎，是讓它分不出好壞——
    // 候選分數全擠在一起，窗口就沒東西可挑。難度差異一律由 fallible 負責，depth 不再是旋鈕。
    for (const rung of DIFFICULTY_LADDER) {
      expect(rung.depth).toBeGreaterThanOrEqual(8)
      expect(Number.isFinite(rung.depth)).toBe(true)
    }
  })

  it('test_difficultyLadder_skillLevels_stayDistinct', () => {
    // skillLevel 已不送給引擎，但仍是 ai_difficulty 的持久化值，且 rungForSkillLevel 靠它反查。
    // 一旦有兩階撞值，還原舊存檔就會落到錯的階。
    const seen = new Set(DIFFICULTY_LADDER.map((r) => r.skillLevel))
    expect(seen.size).toBe(DIFFICULTY_LADDER.length)
  })

  it('test_difficultyLadder_skillLevels_stayInStockfishRange', () => {
    // ai_difficulty persists these raw, under CHECK (ai_difficulty BETWEEN 0 AND 20).
    for (const rung of DIFFICULTY_LADDER) {
      expect(rung.skillLevel).toBeGreaterThanOrEqual(0)
      expect(rung.skillLevel).toBeLessThanOrEqual(20)
    }
  })
})

describe('difficulty ladder — 犯錯窗口', () => {
  it('test_difficultyLadder_topRung_neverMakesMistakes', () => {
    // 頂階省略 fallible ＝一律走引擎最佳手
    expect(DIFFICULTY_LADDER[DIFFICULTY_LADDER.length - 1].fallible).toBeUndefined()
  })

  it('test_difficultyLadder_lowerRungs_allDefineAWindow', () => {
    // 除了頂階，每一階都要有窗口——沒有窗口的階等於滿血，玩家會撞到隱形的難度斷層
    for (const rung of DIFFICULTY_LADDER.slice(0, -1)) {
      expect(rung.fallible).toBeDefined()
    }
  })

  it('test_difficultyLadder_mistakeRate_fallsAsRungsRise', () => {
    const rates = DIFFICULTY_LADDER.filter((r) => r.fallible).map((r) => r.fallible!.probability)
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeLessThan(rates[i - 1])
    }
  })

  it('test_difficultyLadder_mistakeWindow_narrowsAsRungsRise', () => {
    // 階梯之所以有階：高階不只錯得少，錯得也更輕
    const windows = DIFFICULTY_LADDER.filter((r) => r.fallible).map((r) => r.fallible!)
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i].minLossCp).toBeLessThan(windows[i - 1].minLossCp)
      expect(windows[i].maxLossCp).toBeLessThan(windows[i - 1].maxLossCp)
    }
  })

  it('test_difficultyLadder_everyWindow_staysBelowTheHangingPieceLine', () => {
    // 這條線是與已否決的「隨機送子」的分界：量測顯示 >=400cp 的候選就是掛子，
    // 玩家靠對方送子贏沒有成就感（chess.com 低階 bot 的失敗模式）。
    for (const rung of DIFFICULTY_LADDER) {
      if (!rung.fallible) continue
      expect(rung.fallible.maxLossCp).toBeLessThan(400)
    }
  })

  it('test_difficultyLadder_everyWindow_isNonEmptyAndProbabilityIsAFraction', () => {
    for (const rung of DIFFICULTY_LADDER) {
      if (!rung.fallible) continue
      expect(rung.fallible.minLossCp).toBeLessThan(rung.fallible.maxLossCp)
      expect(rung.fallible.probability).toBeGreaterThan(0)
      expect(rung.fallible.probability).toBeLessThanOrEqual(1)
    }
  })
})

describe('rungAt', () => {
  it('test_rungAt_knownRung_returnsMatchingEntry', () => {
    // Act
    const rung = rungAt(3)

    // Assert
    expect(rung.rung).toBe(3)
    expect(rung.name).toBe('熟練')
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
    expect(rungForSkillLevel(0).rung).toBe(1)
    expect(rungForSkillLevel(17).rung).toBe(5)
  })

  it('test_rungForSkillLevel_legacyValue_returnsNearestRung', () => {
    // Saved resume games and ui:highestBeatenLevel hold raw Skill Levels from the old selector.
    expect(rungForSkillLevel(2).rung).toBe(1) // nearest to 0
    expect(rungForSkillLevel(7).rung).toBe(2) // nearest to 6
    expect(rungForSkillLevel(20).rung).toBe(5) // nearest to 17
  })

  it('test_rungForSkillLevel_equidistantValue_favoursTheWeakerRung', () => {
    // skill 3 sits exactly between rung 1 (skill 0) and rung 2 (skill 6). The doc comment promises
    // ties go to the weaker rung — without this, a restored game could silently level the player up.
    expect(rungForSkillLevel(3).rung).toBe(1)
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
