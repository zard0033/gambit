/**
 * 棋憶 — 關鍵步清單的顯示資料。純函式，把 F1 選出的 `Moment[]` 接上「那一手長什麼樣」。
 *
 * 每項回答同一個問題：這一步值得看的是哪一手？
 *   - 玩家走的就是引擎最佳手 → 看你自己走的那手（`source: 'own'`）
 *   - 否則 → 看引擎建議的那手（`source: 'engine'`）
 *
 * 判準刻意用「玩家走的 === bestMove」而不是 Moment 的 `kind`：`displayKind` 把 anchor 和 bright
 * 都壓成 `'bright'`（selection.ts），拿 kind 反推會把最大失誤誤認成好棋。
 *
 * UCI→SAN 在這裡轉，因為 SAN 需要當下局面才算得出來（`Nbd2` 的消歧要看還有沒有第二隻馬走得到）。
 */
import { Chess } from 'chess.js'
import type { Moment } from '@/types/memory'
import type { StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'

export interface MomentDisplay {
  /** Position index i — 原 Moment 的 ply，供 v-for key 與排序用。 */
  readonly ply: number
  /** 玩家讀得懂的手數（1-based 回合數，非 ply）。 */
  readonly moveNumber: number
  /** 值得看的那一手，SAN 棋譜格式（`Nbd2` / `Qh5+`）。 */
  readonly san: string
  /** 這一手的來源：引擎建議，或玩家自己走對的那手。 */
  readonly source: 'engine' | 'own'
  /** 該步走之前的局面。 */
  readonly fen: string
  /** 那一手的起訖格，供棋盤高亮。 */
  readonly from: string
  readonly to: string
}

export interface BuildMomentDisplaysInput {
  readonly moments: readonly Moment[]
  readonly analysisResults: ReadonlyArray<StoredAnalysisEntry | null>
  /** buildFenSequence 輸出，長度 N+1。 */
  readonly fens: readonly string[]
  /** 對局的 UCI 走法，長度 N。 */
  readonly moves: readonly string[]
}

/** 升變後綴大小寫不影響同一手（`e7e8Q` === `e7e8q`），比對前一律轉小寫。 */
function normalizeUci(uci: string): string {
  return uci.toLowerCase()
}

function uciToSan(fen: string, rawUci: string): { san: string; from: string; to: string } | null {
  // 引擎與歷史快取都可能給出大寫升變後綴（`e7e8Q`），chess.js 只收小寫。
  const uci = normalizeUci(rawUci)
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.length === 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined
  try {
    const move = new Chess(fen).move({ from, to, promotion })
    return { san: move.san, from, to }
  } catch {
    // 走法對不上局面（快取跨版本、資料損毀）——整項跳過，不顯示半套資訊
    return null
  }
}

/**
 * 把 F1 的 moments 轉成清單顯示資料，依手數排序。
 * 資料不齊的項目（缺分析、缺 FEN、走法非法）直接略過而不是顯示佔位符 —— 清單短一項，
 * 好過一列指不到任何一手的空殼。
 */
export function buildMomentDisplays(input: BuildMomentDisplaysInput): MomentDisplay[] {
  const { moments, analysisResults, fens, moves } = input
  const out: MomentDisplay[] = []

  for (const moment of moments) {
    const i = moment.ply
    const fen = fens[i]
    const played = moves[i]
    const best = analysisResults[i]?.bestMove
    if (!fen || !played || !best) continue

    const isOwn = normalizeUci(played) === normalizeUci(best)
    const converted = uciToSan(fen, isOwn ? played : best)
    if (!converted) continue

    out.push({
      ply: i,
      moveNumber: Math.floor(i / 2) + 1,
      san: converted.san,
      source: isOwn ? 'own' : 'engine',
      fen,
      from: converted.from,
      to: converted.to,
    })
  }

  return out.sort((a, b) => a.ply - b.ply)
}
