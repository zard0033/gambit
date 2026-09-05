import { describe, it, expect } from 'vitest'
import { buildMomentDisplays } from '@/modules/memory/moment-display'
import { MEMORY_BRIGHT_GATE } from '@/config/memory-config'
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
  it('玩家走的不是最佳手時，並排兩手並標 engine', () => {
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
    expect(out[0].source).toBe('engine')
    expect(out[0].played).toEqual({ piece: '兵', to: 'a3' })
    expect(out[0].best).toEqual({ piece: '兵', to: 'e4' })
  })

  it('玩家走的就是最佳手時標 own，且不給「更好的」', () => {
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
    expect(out[0].played).toEqual({ piece: '兵', to: 'e4' })
    expect(out[0].best).toBeNull()
  })

  it('走法描述用中文棋子名，不用 SAN 記號', () => {
    // Arrange — b1 的馬走到 d2（SAN 會寫 Nbd2，白話文只講「騎士」與目標格）
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
    expect(out[0].best).toEqual({ piece: '騎士', to: 'd2' })
    expect(out[0].reason).toContain('把騎士移到 d2')
    expect(out[0].reason).not.toContain('Nbd2')
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

  it('資料不齊的項目整項略過，不產生空殼格', () => {
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

describe('buildMomentDisplays — 文案模板選擇', () => {
  // selection.ts 的 displayKind 把 anchor（這盤代價最大的一手）和真正的好棋都壓成 'bright'。
  // 這組測試守的就是「別對著最大失誤說你穩住了」——active.md 記名的坑。
  const BRIGHT_PRAISE = '你穩住了'

  it('anchor 被壓成 bright 時不得渲染成好棋文案', () => {
    // Arrange — kind='bright' 但 anchor 且 fav 遠低於門檻，玩家走的也不是最佳手
    const input = {
      moments: [moment(0, { kind: 'bright', anchor: true, fav: -500 })],
      analysisResults: [entry('e2e4')],
      fens: [START, AFTER_E4],
      moves: ['a2a3'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert
    expect(out[0].reason).not.toContain(BRIGHT_PRAISE)
  })

  it('走得好但不是最佳手：標題與內文一致地當成好轉，不互相矛盾', () => {
    // Arrange — fav 過得了門檻，但玩家走的 !== bestMove（走了好手，只是不是引擎首選）
    const input = {
      moments: [moment(0, { kind: 'bright', fav: MEMORY_BRIGHT_GATE + 100 })],
      analysisResults: [entry('e2e4')],
      fens: [START, AFTER_E4],
      moves: ['a2a3'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert — 標題與內文同源，不會一個稱讚一個說局面變壞
    expect(out[0].shortName).toBe('你穩住了自己')
    expect(out[0].reason).toContain(BRIGHT_PRAISE)
    expect(out[0].reason).not.toContain('局面鬆了一點')
  })

  it('玩家走的就是最佳手：不套失誤標題，也不建議一個「更好的」', () => {
    // Arrange — tactical moment 但玩家走的就是 bestMove（被迫的局面，最佳手仍失分）
    const input = {
      moments: [moment(0, { kind: 'tactical', concept: 'material' })],
      analysisResults: [entry('e2e4')],
      fens: [START, AFTER_E4],
      moves: ['e2e4'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert — 不得指控一手正確的走法，更不得憑空建議「走穩一點」
    expect(out[0].source).toBe('own')
    expect(out[0].shortName).toBe('已經是最好的一手')
    expect(out[0].reason).not.toContain('與其')
    expect(out[0].reason).not.toContain('走穩一點')
    expect(out[0].reason).toContain('這已經是這裡最好的一手了')
  })

  it('標題與內文永遠同源：稱讚的格子不得同時說局面變壞', () => {
    // Arrange — 掃過會走進不同 tone 的四種 moment
    const cases: Array<{ m: Partial<Moment>; own: boolean }> = [
      { m: { kind: 'bright', fav: MEMORY_BRIGHT_GATE + 100 }, own: true },
      { m: { kind: 'bright', anchor: true, fav: -500 }, own: false },
      { m: { kind: 'tactical', concept: 'mate' }, own: false },
      { m: { kind: 'plain' }, own: true },
    ]

    for (const { m, own } of cases) {
      // Act
      const out = buildMomentDisplays({
        moments: [moment(0, m)],
        analysisResults: [entry('e2e4')],
        fens: [START, AFTER_E4],
        moves: [own ? 'e2e4' : 'a2a3'],
      })

      // Assert
      const praisedInHeadline = out[0].shortName.includes('穩住')
      const criticizedInBody = out[0].reason.includes('局面鬆了一點')
      expect(praisedInHeadline && criticizedInBody).toBe(false)
    }
  })

  it('玩家走了最佳手且 fav 過門檻，才給好棋文案', () => {
    // Arrange — own + kind bright + fav 過門檻
    const input = {
      moments: [moment(0, { kind: 'bright', fav: MEMORY_BRIGHT_GATE + 100 })],
      analysisResults: [entry('e2e4')],
      fens: [START, AFTER_E4],
      moves: ['e2e4'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert
    expect(out[0].reason).toContain(BRIGHT_PRAISE)
  })

  it('tactical + material 在不知道是哪顆子時，不說「沒人守著」那半句', () => {
    // Arrange — hangingPiece 判定還沒接上，模板拿不到 hungPiece/hungSquare
    const input = {
      moments: [moment(0, { kind: 'tactical', concept: 'material' })],
      analysisResults: [entry('e2e4')],
      fens: [START, AFTER_E4],
      moves: ['a2a3'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert — 只留「與其…不如先…」，不吐沒有資訊的那半句
    expect(out[0].reason).not.toContain('沒人守著')
    expect(out[0].reason).toBe('與其把兵移到 a3，不如先把兵移到 e4。')
  })

  it('tactical + mate 講將殺威脅，不講子力', () => {
    // Arrange
    const input = {
      moments: [moment(0, { kind: 'tactical', concept: 'mate' })],
      analysisResults: [entry('e2e4')],
      fens: [START, AFTER_E4],
      moves: ['a2a3'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert
    expect(out[0].reason).toContain('將殺')
    expect(out[0].reason).toContain('把兵移到 e4')
  })
})

describe('buildMomentDisplays — 盤面標註', () => {
  it('失誤格在走子前的局面同時標出兩手', () => {
    // Arrange — 玩家 a2a3、引擎 e2e4
    const input = {
      moments: [moment(0)],
      analysisResults: [entry('e2e4')],
      fens: [START, AFTER_E4],
      moves: ['a2a3'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert — 局面停在走子前，兩手各一箭頭一高亮
    expect(out[0].fen).toBe(START)
    expect(out[0].annotations).toEqual([
      { kind: 'arrow', role: 'playedMove', from: 'a2', to: 'a3' },
      { kind: 'highlight', role: 'playedMove', square: 'a3' },
      { kind: 'arrow', role: 'keySquare', from: 'e2', to: 'e4' },
      { kind: 'highlight', role: 'keySquare', square: 'e4' },
    ])
  })

  it('好棋格走到對手回應之後的局面', () => {
    // Arrange — 玩家走了最佳手 e2e4，對手回 e7e5
    const input = {
      moments: [moment(0)],
      analysisResults: [entry('e2e4'), entry('g1f3')],
      fens: [START, AFTER_E4, AFTER_E4],
      moves: ['e2e4', 'e7e5'],
    }

    // Act
    const out = buildMomentDisplays(input)

    // Assert — 盤面已含黑兵到 e5；對手的回應用灰色（次要）而非與自己那手同色
    expect(out[0].fen).toContain('4p3')
    expect(out[0].annotations).toContainEqual({ kind: 'arrow', role: 'keySquare', from: 'e2', to: 'e4' })
    expect(out[0].annotations).toContainEqual({ kind: 'arrow', role: 'playedMove', from: 'e7', to: 'e5' })
  })
})

/**
 * hanging-piece 判定接線（2026-09-05）。`classify` 早就算出「哪顆子、在哪一格」再丟掉，`renderCopy`
 * 現在用同一組輸入重算一次。這組守的是**接線**：判定回得出來時標題與內文要一起點名，回不出來時
 * 兩邊要一起退回籠統版——只修一邊會讓標題說「后沒人守著」、內文卻不提是哪顆子。
 */
describe('buildMomentDisplays — material 的 hanging piece', () => {
  // 白 Nb1-c3?? 撞上 d4 的兵；黑 dxc3 收下騎士，白方無子可回吃。
  const HUNG_FEN = '4k3/8/8/8/3p4/8/8/1N2K3 w - - 0 1'
  const AFTER_NC3 = '4k3/8/8/8/3p4/2N5/8/4K3 b - - 1 1'

  function build(moves: string[]) {
    return buildMomentDisplays({
      moments: [moment(0, { kind: 'tactical', concept: 'material', cp: 300 })],
      analysisResults: [entry('e1e2')],
      fens: [HUNG_FEN, AFTER_NC3],
      moves,
    })
  }

  it('判定回得出來時，標題與內文都點名是哪顆子、在哪一格', () => {
    const out = build(['b1c3', 'd4c3'])

    expect(out[0].shortName).toBe('騎士沒人守著')
    expect(out[0].reason).toContain('c3')
    expect(out[0].reason).toContain('沒人守著')
  })

  it('子是玩家自己送過去的（被吃格＝落點）時不說「留在」', () => {
    // 「留在」會把主動送子講成疏忽——玩家這一手正是把騎士放上 c3 的。
    expect(build(['b1c3', 'd4c3'])[0].reason).not.toContain('留在')
  })

  it('沒有對手回應（對局結束在這一手）→ 判定無從算起，兩邊一起退回籠統版', () => {
    const out = build(['b1c3'])

    expect(out[0].shortName).toBe('漏掉一個子')
    expect(out[0].reason).not.toContain('沒人守著')
  })
})

/**
 * precommit-review（deep, `wf_004dd5a2-dd4`）抓到的一條：「那裡沒人守著」的指涉物是 played 片語裡的
 * 格號，而吃過路兵的片語刻意不報格號（被吃的兵不在落點上）——兩個各自正確的決定疊起來就成了
 * 「你用兵吃過路兵，那裡沒人守著」，「那裡」指不到東西。`hungMaterialDetail` 排除的是**對手回應**
 * 是 e.p.，不是玩家這一手是 e.p.，所以這條路真的走得到。
 */
describe('buildMomentDisplays — 吃過路兵那一手被吃時，句子仍要指得出格子', () => {
  it('片語不報格號時，句子自己把格號寫出來', () => {
    // 白 e5xf6 e.p.，黑 g7xf6 收下那顆兵（普通吃子，不是 e.p.）——f6 無白方守子。
    const fen = '4k1n1/6p1/8/4Pp2/8/8/8/4K3 w - f6 0 1'
    const afterEp = '4k1n1/6p1/5P2/8/8/8/8/4K3 b - - 0 1'

    const out = buildMomentDisplays({
      moments: [moment(0, { kind: 'tactical', concept: 'material', cp: 300 })],
      analysisResults: [entry('e1e2')],
      fens: [fen, afterEp],
      moves: ['e5f6', 'g7f6'],
    })

    expect(out[0].reason).toContain('用兵吃過路兵')
    expect(out[0].reason).toContain('f6 沒人守著')
    expect(out[0].reason).not.toContain('那裡沒人守著')
  })
})
