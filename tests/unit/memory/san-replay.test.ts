import { describe, expect, it } from 'vitest'
import { replaySan } from '@/modules/memory/san-replay'

describe('replaySan', () => {
  it('test_empty_game_has_no_rows', () => {
    expect(replaySan([])).toEqual({ rows: [], plies: 0, invalidAt: null })
  })

  it('test_capture_and_mate_marks', () => {
    // Scholar's mate
    const r = replaySan(['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'])
    expect(r.invalidAt).toBeNull()
    expect(r.plies).toBe(7)
    expect(r.rows).toEqual([
      { n: 1, white: 'e4', black: 'e5' },
      { n: 2, white: 'Bc4', black: 'Nc6' },
      { n: 3, white: 'Qh5', black: 'Nf6' },
      { n: 4, white: 'Qxf7#', black: null },
    ])
  })

  it('test_check_mark', () => {
    const r = replaySan(['e2e4', 'f7f6', 'd1h5'])
    expect(r.rows[1]).toEqual({ n: 2, white: 'Qh5+', black: null })
  })

  it('test_castling', () => {
    const r = replaySan(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1'])
    expect(r.rows[3]).toEqual({ n: 4, white: 'O-O', black: null })
  })

  it('test_capturing_promotion', () => {
    const r = replaySan(['a2a4', 'b7b5', 'a4b5', 'a7a6', 'b5a6', 'c8b7', 'a6b7', 'g8f6', 'b7a8q'])
    expect(r.invalidAt).toBeNull()
    expect(r.rows[4]).toEqual({ n: 5, white: 'bxa8=Q', black: null })
  })

  it('test_uppercase_promotion_piece_is_accepted', () => {
    const r = replaySan(['a2a4', 'b7b5', 'a4b5', 'a7a6', 'b5a6', 'c8b7', 'a6b7', 'g8f6', 'b7a8Q'])
    expect(r.rows[4].white).toBe('bxa8=Q')
  })

  it('test_illegal_move_stops_and_reports_index', () => {
    // 第 3 個 ply（index 2）e4e6 不合法：之後的手不能被接著亂排
    const r = replaySan(['e2e4', 'e7e5', 'e4e6', 'g1f3'])
    expect(r.invalidAt).toBe(2)
    expect(r.plies).toBe(2)
    expect(r.rows).toEqual([{ n: 1, white: 'e4', black: 'e5' }])
  })

  it('test_malformed_uci_stops_and_reports_index', () => {
    const r = replaySan(['e2e4', 'zz99'])
    expect(r.invalidAt).toBe(1)
    expect(r.rows).toEqual([{ n: 1, white: 'e4', black: null }])
  })
})
