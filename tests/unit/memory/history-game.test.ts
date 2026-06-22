import { describe, expect, it } from 'vitest'
import { historyEntryToCompletedGame } from '@/modules/memory/history-game'
import type { GameHistoryEntry } from '@/types/game-history'

function entry(overrides: Partial<GameHistoryEntry> = {}): GameHistoryEntry {
  return {
    id: 'g1',
    playedAt: new Date('2026-06-20T10:00:00Z'),
    displayDate: '2026-06-20',
    playerResult: 'Win',
    playerResultPrefix: 'W',
    playerColor: 'white',
    endReason: 'checkmate',
    endReasonDisplay: '將死',
    aiDifficulty: 5,
    difficultyLabel: 'Easy',
    moveCount: 6,
    openingName: null,
    openingEco: null,
    openingDisplay: '—',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6',
    ...overrides,
  }
}

describe('historyEntryToCompletedGame', () => {
  it('replays the PGN into the UCI move list', () => {
    const game = historyEntryToCompletedGame(entry())
    expect(game?.moves).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'])
  })

  it('encodes a promotion as a 5-char UCI move', () => {
    // White's h-pawn races up and captures the h8 rook, promoting: g7xh8=Q.
    const pgn = '1. h4 a5 2. h5 a4 3. h6 a3 4. hxg7 axb2 5. gxh8=Q'
    const game = historyEntryToCompletedGame(entry({ pgn }))
    expect(game?.moves).toContain('g7h8q')
  })

  it('maps player-relative result + colour to standard PGN result', () => {
    expect(historyEntryToCompletedGame(entry({ playerResult: 'Win', playerColor: 'white' }))?.result).toBe('1-0')
    expect(historyEntryToCompletedGame(entry({ playerResult: 'Win', playerColor: 'black' }))?.result).toBe('0-1')
    expect(historyEntryToCompletedGame(entry({ playerResult: 'Loss', playerColor: 'white' }))?.result).toBe('0-1')
    expect(historyEntryToCompletedGame(entry({ playerResult: 'Draw' }))?.result).toBe('1/2-1/2')
  })

  it('sets completedAt from playedAt (keeps the summary game_id stable)', () => {
    const ts = new Date('2026-06-20T10:00:00Z').getTime()
    expect(historyEntryToCompletedGame(entry())?.completedAt).toBe(ts)
    expect(historyEntryToCompletedGame(entry())?.aiSkillLevel).toBe(5)
  })

  it('returns null for an unreplayable PGN (malformed row must not crash the view)', () => {
    expect(historyEntryToCompletedGame(entry({ pgn: '' }))).toBeNull()
    expect(historyEntryToCompletedGame(entry({ pgn: 'total garbage not a pgn' }))).toBeNull()
  })

  it('returns null when playedAt is missing (avoids game_id/cache-key collision on "0")', () => {
    expect(historyEntryToCompletedGame(entry({ playedAt: null }))).toBeNull()
  })
})
