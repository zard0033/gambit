import { Chess } from 'chess.js'

/** 記譜的一列：一個回合，白方一手、黑方一手（黑方還沒走就是 null）。 */
export interface SanRow {
  readonly n: number
  readonly white: string
  readonly black: string | null
}

/** UCI 重播的結果。 */
export interface SanReplay {
  readonly rows: readonly SanRow[]
  /** 成功轉出的 ply 數。 */
  readonly plies: number
  /** 第一個非法 UCI 的索引；全部合法時是 null。 */
  readonly invalidAt: number | null
}

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/

/**
 * 把一盤棋的 UCI 序列（從初始局面起）轉成 SAN 回合列，供棋憶分析中的流式棋譜使用。純函式。
 *
 * 碰到格式錯誤或不合法的一手就停：`rows` 只含它之前的部分，`invalidAt` 記下停在哪一手，
 * 呼叫端與測試都看得出來，不會靜默跳過後面接著亂排。
 */
export function replaySan(uciMoves: readonly string[]): SanReplay {
  const chess = new Chess()
  const sans: string[] = []
  let invalidAt: number | null = null

  for (let i = 0; i < uciMoves.length; i++) {
    const uci = uciMoves[i].toLowerCase()
    if (!UCI_RE.test(uci)) {
      invalidAt = i
      break
    }
    let san: string | null
    try {
      san = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length === 5 ? uci[4] : undefined,
      }).san
    } catch {
      // chess.js 對不合法的一手會丟例外；這裡把它轉成 invalidAt 回報，不吞掉。
      san = null
    }
    if (san === null) {
      invalidAt = i
      break
    }
    sans.push(san)
  }

  const rows: SanRow[] = []
  for (let i = 0; i < sans.length; i += 2) {
    rows.push({ n: i / 2 + 1, white: sans[i], black: sans[i + 1] ?? null })
  }
  return { rows, plies: sans.length, invalidAt }
}
