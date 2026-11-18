import { describe, expect, it } from 'vitest'
import { gameOverDisplay } from '@/modules/game-lifecycle/game-over-display'

describe('gameOverDisplay', () => {
  describe('outcome and title', () => {
    it('test_white_player_wins_on_1_0', () => {
      const d = gameOverDisplay({ endReason: 'checkmate', result: '1-0' }, 'white', 7)
      expect(d.outcome).toBe('win')
      expect(d.title).toBe('你贏了')
    })

    it('test_black_player_wins_on_0_1', () => {
      const d = gameOverDisplay({ endReason: 'checkmate', result: '0-1' }, 'black', 4)
      expect(d.outcome).toBe('win')
      expect(d.title).toBe('你贏了')
    })

    it('test_black_player_loses_on_1_0', () => {
      const d = gameOverDisplay({ endReason: 'checkmate', result: '1-0' }, 'black', 7)
      expect(d.outcome).toBe('loss')
      expect(d.title).toBe('你輸了')
    })

    it('test_draw', () => {
      const d = gameOverDisplay({ endReason: 'stalemate', result: '1/2-1/2' }, 'white', 60)
      expect(d.outcome).toBe('draw')
      expect(d.title).toBe('和局')
    })

    it('test_titles_have_no_exclamation_mark', () => {
      const d = gameOverDisplay({ endReason: 'checkmate', result: '1-0' }, 'white', 7)
      expect(d.title).not.toMatch(/[!！]/)
    })
  })

  describe('reason labels', () => {
    it.each([
      ['checkmate', '1-0', '將殺'],
      ['stalemate', '1/2-1/2', '逼和'],
      ['insufficient-material', '1/2-1/2', '子力不足'],
      ['fifty-move', '1/2-1/2', '五十步'],
      ['threefold', '1/2-1/2', '三次重複'],
    ] as const)('test_%s_label', (endReason, result, label) => {
      expect(gameOverDisplay({ endReason, result }, 'white', 10).reasonLabel).toBe(label)
    })

    it('test_player_resigns_reads_resignation', () => {
      // 玩家執白投降 → 0-1
      const d = gameOverDisplay({ endReason: 'resignation', result: '0-1' }, 'white', 10)
      expect(d.outcome).toBe('loss')
      expect(d.reasonLabel).toBe('投降')
    })

    it('test_opponent_resigns_reads_opponent_resigned', () => {
      // AI 投降，玩家執黑 → 0-1
      const d = gameOverDisplay({ endReason: 'resignation', result: '0-1' }, 'black', 10)
      expect(d.outcome).toBe('win')
      expect(d.reasonLabel).toBe('對手投降')
    })
  })

  describe('move number', () => {
    it('test_white_mates_on_own_move_counts_its_round', () => {
      // Scholar's mate：第 7 個 ply（4. Qxf7#）
      expect(gameOverDisplay({ endReason: 'checkmate', result: '1-0' }, 'white', 7).moveNumber).toBe(4)
    })

    it('test_black_mates_on_black_move_counts_same_round', () => {
      // Fool's mate：第 4 個 ply（2... Qh4#），玩家執黑
      expect(gameOverDisplay({ endReason: 'checkmate', result: '0-1' }, 'black', 4).moveNumber).toBe(2)
    })

    it('test_resign_before_any_move_is_round_1', () => {
      expect(gameOverDisplay({ endReason: 'resignation', result: '0-1' }, 'white', 0).moveNumber).toBe(1)
    })

    it('test_subtitle_joins_reason_and_round', () => {
      const d = gameOverDisplay({ endReason: 'resignation', result: '1-0' }, 'white', 23)
      expect(d.subtitle).toBe('對手投降 · 第 12 回合')
    })

    it('test_invalid_ply_count_throws', () => {
      expect(() => gameOverDisplay({ endReason: 'checkmate', result: '1-0' }, 'white', -1)).toThrow(RangeError)
      expect(() => gameOverDisplay({ endReason: 'checkmate', result: '1-0' }, 'white', 2.5)).toThrow(RangeError)
    })
  })
})
