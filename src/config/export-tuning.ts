/**
 * Game Export tuning constants and the Claude.ai prompt template.
 * Source of truth per game-export-share.md §7 (Tuning Knobs → Source of truth).
 * System-level config — NOT exposed to end users in v0.
 */

/**
 * The "Coach" prompt template (game-export-share.md §3).
 * Verbatim literal — the ```pgn fence characters are part of the payload,
 * not Markdown. Slots in {{...}} are filled by the assembler; {{OPENING_LINE}}
 * and {{REVIEW_HINT_LINE}} are whole-line slots removed (with their newline)
 * when their source data is absent.
 */
export const COACH_PROMPT_TEMPLATE = [
  "I just played a chess game and I'd like you to review it like a patient coach",
  "helping a beginner improve. I'm an adult learner working through fundamentals.",
  '',
  'Here is the game in PGN:',
  '',
  '```pgn',
  '{{PGN}}',
  '```',
  '',
  'Context:',
  '- I played {{PLAYER_COLOR}} against Stockfish (skill level {{AI_SKILL_LEVEL}}).',
  '- Result: {{RESULT_PLAIN}}.',
  '{{OPENING_LINE}}',
  '{{REVIEW_HINT_LINE}}',
  '',
  'Please:',
  '1. Name the opening and tell me, in one or two sentences, the main idea behind it.',
  '2. Walk me through the 2-3 most important moments of the game — where the',
  '   advantage shifted and why — in plain language, not just engine evaluations.',
  '3. Point out one or two recurring habits or mistakes I should work on, with a',
  '   concrete example move from this game.',
  '4. Suggest one specific thing to study or practice next.',
  '',
  'Keep it encouraging and concrete. Use move numbers so I can follow along on a board.',
  "Don't just list every move — focus on what will actually help me improve.",
].join('\n')

/** Default tuning values (game-export-share.md Tuning Knobs table). */
export const DEFAULT_EXPORT_TUNING = {
  eventTag: 'Chess Training Companion',
  siteTag: 'Chess Training Companion (local)',
  aiNameTemplate: 'Stockfish (level {{N}})',
  // 2026-08-02：useGameExport composable 已移除（positioning-v2 D7），此欄位已無消費端；下次動這支檔時可清。
  feedbackDurationMs: 2000,
  promptTokenBudget: 4000,
  maxPlyBeforeWarn: 200,
  charsPerToken: 4,
} as const
