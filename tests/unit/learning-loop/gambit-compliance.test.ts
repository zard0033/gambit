import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// S14-06 — Gambit compliance, automatable half (GDD AC-10 / AC-11a). The Concept Map and its
// Learn-section tab must carry NO streak/timer/leaderboard/XP framing, NO emoji as icons, and NO
// 象棋 vocabulary (車/馬/象 — must use 城堡/騎士/主教). The 44×44px target check is AC-11a's
// Playwright half and lives in the e2e/visual pass, not here.

const LL_FILES = [
  'src/views/ConceptMapView.vue',
  'src/views/ConceptDeepenView.vue',
  'src/views/RecognitionFieldView.vue',
  'src/components/lesson/LessonPlayer.vue',
  'src/components/lesson/DeepeningWrapUp.vue',
  'src/components/learn-tabs.vue',
  'src/data/concepts/index.ts',
  'src/data/concept-deepening/index.ts',
  'src/types/concept.ts',
  'src/modules/learning-loop/mastery.ts',
]

const sources = LL_FILES.map((rel) => ({
  rel,
  text: readFileSync(resolve(process.cwd(), rel), 'utf8'),
}))

describe('Learning Loop — Gambit compliance', () => {
  // \b word boundaries so "export"/"experience" don't trip the bare "xp"/"points" tokens.
  const FORBIDDEN_LATIN = /\b(streak|timer|leaderboard|xp|points)\b/i
  const FORBIDDEN_CJK = /(連勝|計時|排行|積分)/
  const XIANGQI_TERMS = /[車馬象]/
  const EMOJI = /\p{Emoji_Presentation}/u

  it('test_compliance_noStreakTimerLeaderboardXp', () => {
    for (const { rel, text } of sources) {
      expect(FORBIDDEN_LATIN.test(text), `${rel} contains a streak/timer/XP term`).toBe(false)
      expect(FORBIDDEN_CJK.test(text), `${rel} contains a 連勝/計時/排行 term`).toBe(false)
    }
  })

  it('test_compliance_noEmojiAsIcons', () => {
    for (const { rel, text } of sources) {
      expect(EMOJI.test(text), `${rel} contains an emoji`).toBe(false)
    }
  })

  it('test_compliance_noXiangqiVocabulary', () => {
    // Must use 城堡/騎士/主教, never the 象棋 車/馬/象.
    for (const { rel, text } of sources) {
      expect(XIANGQI_TERMS.test(text), `${rel} uses a 象棋 term (車/馬/象)`).toBe(false)
    }
  })
})
