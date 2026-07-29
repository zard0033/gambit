import { describe, expect, it, vi } from 'vitest'
import { DIFFICULTY_LADDER } from '../../../src/config/difficulty-tuning'
import {
  mapPlayerResult,
  mapDifficultyLabel,
  mapDisplayDate,
  mapEndReasonDisplay,
  mapOpeningDisplay,
} from '@/utils/game-history-mappers'

// ── Formula 1 — mapPlayerResult ──────────────────────────────────────────

describe('mapPlayerResult', () => {
  it('AC-06a: white_wins + white → Win', () => {
    const r = mapPlayerResult('white_wins', 'white')
    expect(r.playerResult).toBe('Win')
    expect(r.playerResultPrefix).toBe('W')
  })

  it('AC-06b: white_wins + black → Loss', () => {
    const r = mapPlayerResult('white_wins', 'black')
    expect(r.playerResult).toBe('Loss')
    expect(r.playerResultPrefix).toBe('L')
  })

  it('AC-06c: black_wins + black → Win', () => {
    const r = mapPlayerResult('black_wins', 'black')
    expect(r.playerResult).toBe('Win')
    expect(r.playerResultPrefix).toBe('W')
  })

  it('AC-06d: black_wins + white → Loss', () => {
    const r = mapPlayerResult('black_wins', 'white')
    expect(r.playerResult).toBe('Loss')
    expect(r.playerResultPrefix).toBe('L')
  })

  it('AC-06e: draw + white → Draw', () => {
    const r = mapPlayerResult('draw', 'white')
    expect(r.playerResult).toBe('Draw')
    expect(r.playerResultPrefix).toBe('½')
  })

  it('AC-06f: draw + black → Draw', () => {
    const r = mapPlayerResult('draw', 'black')
    expect(r.playerResult).toBe('Draw')
    expect(r.playerResultPrefix).toBe('½')
  })

  it('AC-23: abandoned → Unknown + "?" prefix + console.warn emitted; row still renders', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = mapPlayerResult('abandoned', 'white')
    expect(r.playerResult).toBe('Unknown')
    expect(r.playerResultPrefix).toBe('?')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})

// ── Formula 2 — mapDifficultyLabel ───────────────────────────────────────

describe('mapDifficultyLabel', () => {
  it('AC-07a: 0 → Beginner', () => {
    expect(mapDifficultyLabel(0)).toBe('Beginner')
  })

  it('AC-07b: 5 → Easy', () => {
    expect(mapDifficultyLabel(5)).toBe('Easy')
  })

  it('AC-07c: 10 → Intermediate', () => {
    expect(mapDifficultyLabel(10)).toBe('Intermediate')
  })

  it('AC-07d: 13 → Hard', () => {
    expect(mapDifficultyLabel(13)).toBe('Hard')
  })

  it('AC-07e: 20 → Master', () => {
    expect(mapDifficultyLabel(20)).toBe('Master')
  })

  it('AC-07f: 21 → Unknown with console.warn (finite out-of-range)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(mapDifficultyLabel(21)).toBe('Unknown')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('AC-07g: null → Unknown (type guard — must NOT coerce to Beginner)', () => {
    expect(mapDifficultyLabel(null)).toBe('Unknown')
  })

  it('AC-07h: NaN → Unknown (type guard, no warn)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(mapDifficultyLabel(NaN)).toBe('Unknown')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('AC-07i: undefined → Unknown (type guard)', () => {
    expect(mapDifficultyLabel(undefined)).toBe('Unknown')
  })

  it('test_mapDifficultyLabel_everyLadderRung_getsItsOwnLabel', () => {
    // The reason Formula 2's bands were recut (2026-07-29): under the old bands rungs 三 and 四
    // both resolved to 'Intermediate', so the ladder read as flat in game history.
    // Arrange / Act
    const labels = DIFFICULTY_LADDER.map((rung) => mapDifficultyLabel(rung.skillLevel))

    // Assert
    expect(new Set(labels).size).toBe(DIFFICULTY_LADDER.length)
    expect(labels).not.toContain('Unknown')
  })
})

// ── Formula 3 — mapDisplayDate ───────────────────────────────────────────

describe('mapDisplayDate', () => {
  it('returns a Date and non-empty displayDate for a valid ISO string', () => {
    const { date, displayDate } = mapDisplayDate('2024-03-15T10:00:00Z')
    expect(date).toBeInstanceOf(Date)
    expect(displayDate).not.toBe('—')
    expect(displayDate.length).toBeGreaterThan(0)
  })

  it('AC-17: invalid date string → null + em dash display, no JS error', () => {
    expect(() => {
      const { date, displayDate } = mapDisplayDate('not-a-date')
      expect(date).toBeNull()
      expect(displayDate).toBe('—')
    }).not.toThrow()
  })
})

// ── Formula 4 — mapEndReasonDisplay ──────────────────────────────────────

describe('mapEndReasonDisplay', () => {
  it('AC-19: checkmate → Checkmate', () => {
    expect(mapEndReasonDisplay('checkmate')).toBe('Checkmate')
  })

  it('AC-20: fifty_move → 50-move rule', () => {
    expect(mapEndReasonDisplay('fifty_move')).toBe('50-move rule')
  })

  it('AC-21: resign → Resignation', () => {
    expect(mapEndReasonDisplay('resign')).toBe('Resignation')
  })

  it('AC-21: draw_agreement → Agreed draw', () => {
    expect(mapEndReasonDisplay('draw_agreement')).toBe('Agreed draw')
  })

  it('AC-21: threefold → Threefold repetition', () => {
    expect(mapEndReasonDisplay('threefold')).toBe('Threefold repetition')
  })

  it('AC-21: insufficient → Insufficient material', () => {
    expect(mapEndReasonDisplay('insufficient')).toBe('Insufficient material')
  })

  it('AC-21b: stalemate → Stalemate', () => {
    expect(mapEndReasonDisplay('stalemate')).toBe('Stalemate')
  })

  it('AC-22: unknown_future_value → raw passthrough + console.warn, row renders', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(mapEndReasonDisplay('unknown_future_value')).toBe('unknown_future_value')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})

// ── Opening priority — mapOpeningDisplay ─────────────────────────────────

describe('mapOpeningDisplay', () => {
  it('AC-08a: opening_name present → shows name', () => {
    expect(mapOpeningDisplay('Ruy Lopez', 'C65')).toBe('Ruy Lopez')
  })

  it('AC-08b: opening_name null, eco present → shows eco', () => {
    expect(mapOpeningDisplay(null, 'B20')).toBe('B20')
  })

  it('AC-08c: both null → Unknown opening', () => {
    expect(mapOpeningDisplay(null, null)).toBe('Unknown opening')
  })
})
