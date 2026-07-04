import { describe, expect, it } from 'vitest'
import { daysTogether, totalsLine } from '@/modules/journal/totals'

// Noon timestamps keep day boundaries clear of ±1h DST shifts in any local timezone.
const noon = (y: number, m: number, d: number): number => new Date(y, m - 1, d, 12, 0, 0).getTime()

describe('daysTogether', () => {
  it('is 1 on the first day', () => {
    expect(daysTogether(noon(2026, 6, 22), noon(2026, 6, 22))).toBe(1)
  })

  it('counts calendar days inclusively', () => {
    expect(daysTogether(noon(2026, 6, 1), noon(2026, 6, 22))).toBe(22)
  })

  it('ignores time-of-day — same calendar day stays 1', () => {
    const firstMorning = new Date(2026, 5, 22, 8, 0, 0).getTime()
    const sameNight = new Date(2026, 5, 22, 23, 59, 0).getTime()
    expect(daysTogether(firstMorning, sameNight)).toBe(1)
  })

  it('never drops below 1 under clock skew (now before first)', () => {
    expect(daysTogether(noon(2026, 6, 22), noon(2026, 6, 20))).toBe(1)
  })
})

describe('totalsLine', () => {
  it('returns null when there is no game to remember yet', () => {
    expect(totalsLine({ games: 0, entries: 1, days: 1 })).toBeNull()
  })

  it("renders Neve's companionship line with all three counts", () => {
    expect(totalsLine({ games: 3, entries: 2, days: 5 })).toBe(
      '我們同行 5 天了，我記得你的 3 盤棋，也為你寫下了 2 篇。',
    )
  })

  it('carries no emoji (persona tone rule)', () => {
    const line = totalsLine({ games: 12, entries: 8, days: 40 })!
    expect(/\p{Extended_Pictographic}/u.test(line)).toBe(false)
  })
})
