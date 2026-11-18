import { describe, expect, it } from 'vitest'
import { formatGameDay } from '@/utils/game-day'

// 以本機時區建構時間戳，與 formatGameDay 的本機時區語意一致，任何 TZ 下都穩定。
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime()

describe('formatGameDay', () => {
  it('test_single_digit_month_and_day_are_not_zero_padded', () => {
    expect(formatGameDay(local(2026, 1, 5))).toBe('1 月 5 日')
  })

  it('test_double_digit_month_and_day', () => {
    expect(formatGameDay(local(2026, 11, 16))).toBe('11 月 16 日')
  })

  it('test_year_boundary_drops_year', () => {
    expect(formatGameDay(local(2025, 12, 31, 23, 59))).toBe('12 月 31 日')
    expect(formatGameDay(local(2026, 1, 1, 0, 1))).toBe('1 月 1 日')
  })

  it('test_accepts_game_id_string_converted_to_number', () => {
    const id = String(local(2026, 3, 9))
    expect(formatGameDay(Number(id))).toBe('3 月 9 日')
  })

  it('test_non_finite_timestamp_throws', () => {
    expect(() => formatGameDay(Number('abc'))).toThrow(RangeError)
    expect(() => formatGameDay(Infinity)).toThrow(RangeError)
  })
})
