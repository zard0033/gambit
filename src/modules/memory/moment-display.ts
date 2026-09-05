/**
 * 棋憶 — 對話框每一格的顯示資料。純函式，把 F1 選出的 `Moment[]` 接上「那一手長什麼樣、
 * Neve 要說什麼、盤上標什麼」。
 *
 * 每格回答同一件事：這一步發生了什麼？
 *   - 玩家走的就是引擎最佳手 → 只講你自己那手（`source: 'own'`，不顯示「更好的」）
 *   - 否則 → 並排「你走了 / 更好的是」（`source: 'engine'`）
 *
 * 判準刻意用「玩家走的 === bestMove」而不是 Moment 的 `kind`：`displayKind` 把 anchor 和 bright
 * 都壓成 `'bright'`（selection.ts），拿 kind 反推會把最大失誤誤認成好棋。
 *
 * 走法一律白話文（「把主教移到 g5」），不用 SAN——目標讀者看不懂棋譜記號。
 */
import { Chess } from 'chess.js'
import type { Moment } from '@/types/memory'
import type { Annotation } from '@/modules/move-annotation/annotation-types'
import type { StoredAnalysisEntry } from '@/modules/post-game-review/use-post-game-review'
import { describeMove, momentShortName, momentTone, type MoveDesc } from './describe'
import { renderMoment } from './templates'
import { momentEndState, momentStepFens } from './choreography'

export interface MomentDisplay {
  /** Position index i — 原 Moment 的 ply，供 v-for key 與排序用。 */
  readonly ply: number
  /** 玩家讀得懂的手數（1-based 回合數，非 ply）。 */
  readonly moveNumber: number
  /** 這一格的來源：引擎建議，或玩家自己走對的那手。 */
  readonly source: 'engine' | 'own'
  /** 白話短名（「差點被將死」），卡片的標題。 */
  readonly shortName: string
  /** 你實際走的那一手，白話文。 */
  readonly played: MoveDesc
  /** 更好的那一手；`source === 'own'` 時為 null（沒有更好的可講）。 */
  readonly best: MoveDesc | null
  /** Neve 的一句解釋（F3 模板）。 */
  readonly reason: string
  /** 這一格要顯示的局面（失誤＝走子前；好棋＝走完＋對手回應之後）。 */
  readonly fen: string
  /** 盤上的標註（失誤＝兩手同時標；好棋＝你的那手＋對手回應）。 */
  readonly annotations: Annotation[]
  /** 從 `fen` 往前看的後續畫面（失誤＝[你走完, 更好那手走完]；好棋＝空，定格已是終態）。 */
  readonly stepFens: readonly string[]
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

/**
 * 這一手在這個局面走不走得出來。快取跨版本或資料損毀時走法會對不上盤面，整格跳過而不是
 * 顯示半套資訊——少一格，好過一格指不到任何一手。
 */
function isLegalUci(fen: string, rawUci: string): boolean {
  const uci = normalizeUci(rawUci)
  try {
    new Chess(fen).move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length === 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined,
    })
    return true
  } catch {
    return false
  }
}

/**
 * 依 tone 組出這一格的標題與內文。兩者**同源**（`momentTone`）——分開推導會讓標題稱讚、
 * 內文批評同一手（2026-08-08 precommit-review 抓到）。
 */
function renderCopy(
  moment: Moment,
  isOwn: boolean,
  played: MoveDesc,
  best: MoveDesc | null,
): { shortName: string; reason: string } {
  const tone = momentTone(moment, isOwn)
  const shortName = momentShortName(tone, moment.concept)

  // isOwn 的兩個 tone 沒有「更好的」可講；其餘一定有（!isOwn ⇒ best 已在上面驗過非 null）。
  if (tone === 'bright' || tone === 'best-anyway') {
    return { shortName, reason: renderMoment({ tone, played }) }
  }
  if (tone === 'tactical') {
    return { shortName, reason: renderMoment({ tone, concept: moment.concept, played, best: best! }) }
  }
  return { shortName, reason: renderMoment({ tone, played, best: best! }) }
}

/**
 * 把 F1 的 moments 轉成對話框每一格的顯示資料，依手數排序。
 * 資料不齊的項目（缺分析、缺 FEN、走法非法）直接略過。
 */
export function buildMomentDisplays(input: BuildMomentDisplaysInput): MomentDisplay[] {
  const { moments, analysisResults, fens, moves } = input
  const out: MomentDisplay[] = []

  for (const moment of moments) {
    const i = moment.ply
    const fen = fens[i]
    const playedUci = moves[i]
    const bestUci = analysisResults[i]?.bestMove
    if (!fen || !playedUci || !bestUci) continue

    const isOwn = normalizeUci(playedUci) === normalizeUci(bestUci)
    if (!isLegalUci(fen, playedUci)) continue
    if (!isOwn && !isLegalUci(fen, bestUci)) continue

    const played = describeMove(fen, playedUci)
    const best = isOwn ? null : describeMove(fen, bestUci)
    if (!played || (!isOwn && !best)) continue

    const choreography = {
      preMoveFen: fen,
      playedUci,
      bestUci: isOwn ? null : bestUci,
      // 好棋才需要對手的回應；終局最後一手沒有下一手，momentEndState 吃得下 null。
      replyUci: isOwn ? moves[i + 1] ?? null : null,
    }
    const frame = momentEndState(choreography)

    out.push({
      ply: i,
      moveNumber: Math.floor(i / 2) + 1,
      source: isOwn ? 'own' : 'engine',
      ...renderCopy(moment, isOwn, played, best),
      played,
      best,
      fen: frame.fen,
      annotations: frame.annotations,
      stepFens: momentStepFens(choreography),
    })
  }

  return out.sort((a, b) => a.ply - b.ply)
}
