import { describe, it, expect } from 'vitest'
import { buildMomentDisplays } from '@/modules/memory/moment-display'
import type { StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'
import type { Moment } from '@/types/memory'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
// 1.e4 之後（黑方走）
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'

function entry(bestMove: string | null): StoredAnalysisEntry {
  return { bestMove, evalCp: 0, depthReached: 16, pv: [], pass: 'deep' }
}

function moment(ply: number, over: Partial<Moment> = {}): Moment {
  return { ply, kind: 'plain', anchor: false, concept: 'none', cp: 100, fav: -Infinity, ...over }
}

describe('buildMomentDisplays', () => {
  it('玩家走的不是最佳手時，顯示引擎建議並標 engine', () => {
    // Arrange — 玩家走 a2a3，引擎要 e2e4
    const input = {
      moments: [moment(0)],
      analysisResults: [entry('e2e4')],
      fens: [START, AFTER_E4],
      moves: ['a2a3'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert
    expect(out).toHaveLength(1)
    expect(out[0].san).toBe('e4')
    expect(out[0].source).toBe('engine')
    expect(out[0].from).toBe('e2')
    expect(out[0].to).toBe('e4')
  })

  it('玩家走的就是最佳手時，顯示玩家那一手並標 own', () => {
    // Arrange — 玩家走 e2e4，引擎也要 e2e4
    const input = {
      moments: [moment(0)],
      analysisResults: [entry('e2e4')],
      fens: [START, AFTER_E4],
      moves: ['e2e4'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert
    expect(out[0].source).toBe('own')
    expect(out[0].san).toBe('e4')
  })

  it('升變後綴大小寫不同仍視為同一手（own，不是 engine）', () => {
    // Arrange — 白兵 a7 可升變；玩家 a7a8Q，引擎 a7a8q
    const fen = '8/P7/8/8/8/8/8/K6k w - - 0 1'
    const input = {
      moments: [moment(0)],
      analysisResults: [entry('a7a8q')],
      fens: [fen, fen],
      moves: ['a7a8Q'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert
    expect(out[0].source).toBe('own')
  })

  it('ply 換算成 1-based 回合數（白第1手=1、黑第1手=1、白第2手=2）', () => {
    // Arrange — 三個連續 ply
    const fens = [START, AFTER_E4, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2']
    const input = {
      moments: [moment(0), moment(1), moment(2)],
      analysisResults: [entry('e2e4'), entry('e7e5'), entry('g1f3')],
      fens: [...fens, fens[2]],
      moves: ['e2e4', 'e7e5', 'g1f3'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert
    expect(out.map((m) => m.moveNumber)).toEqual([1, 1, 2])
  })

  it('SAN 帶消歧資訊（同色兩隻馬走得到同格時輸出 Nbd2 而非 Nd2）', () => {
    // Arrange — b1 與 f3 兩隻白馬都能到 d2（d2 須淨空，否則兩隻都走不過去）
    const fen = 'r1bqkbnr/pppppppp/2n5/8/8/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 1'
    const input = {
      moments: [moment(0)],
      analysisResults: [entry('b1d2')],
      fens: [fen, fen],
      moves: ['a2a3'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert
    expect(out[0].san).toBe('Nbd2')
  })

  it('資料不齊的項目整項略過，不產生空殼列', () => {
    // Arrange — ply0 缺分析、ply1 走法對不上局面、ply2 完整
    const input = {
      moments: [moment(0), moment(1), moment(2)],
      analysisResults: [null, entry('h1h8'), entry('e2e4')],
      fens: [START, START, START, START],
      moves: ['a2a3', 'a2a3', 'a2a3'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert
    expect(out.map((m) => m.ply)).toEqual([2])
  })

  it('輸出依 ply 遞增排序', () => {
    // Arrange — moments 故意亂序
    const input = {
      moments: [moment(2), moment(0)],
      analysisResults: [entry('e2e4'), entry('e7e5'), entry('g1f3')],
      fens: Array(4).fill(START),
      moves: ['a2a3', 'a2a3', 'a2a3'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert
    expect(out.map((m) => m.ply)).toEqual([0, 2])
  })
})
