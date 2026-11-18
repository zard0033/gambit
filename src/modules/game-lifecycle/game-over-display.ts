import type { EndReason, TerminalState } from './use-game-lifecycle'

/** 從玩家角度看的結果。 */
export type PlayerOutcome = 'win' | 'loss' | 'draw'

/** 完局紙要顯示的文字（標題／副標），純資料、不含樣式。 */
export interface GameOverDisplay {
  readonly outcome: PlayerOutcome
  /** 「你贏了」／「你輸了」／「和局」——不加驚嘆號。 */
  readonly title: string
  /** 結束原因標籤，例如「將殺」；玩家贏且對手投降時寫「對手投降」。 */
  readonly reasonLabel: string
  /** 結束在第幾回合（最後一手所在的回合，最少 1）。 */
  readonly moveNumber: number
  /** 「{原因} · 第 N 回合」。 */
  readonly subtitle: string
}

const TITLE: Record<PlayerOutcome, string> = {
  win: '你贏了',
  loss: '你輸了',
  draw: '和局',
}

const REASON_LABEL: Record<EndReason, string> = {
  checkmate: '將殺',
  resignation: '投降',
  stalemate: '逼和',
  'insufficient-material': '子力不足',
  'fifty-move': '五十步',
  threefold: '三次重複',
}

/**
 * 依終局狀態算出完局紙的標題、原因與回合數。
 *
 * 回合數＝最後一手所在的回合：從初始局面起算，第 1、2 個 ply 都是第 1 回合，所以是 ceil(ply / 2)；
 * 執黑或執白都用同一套編號（白方先走）。一手都沒走就投降時算第 1 回合。
 *
 * @param terminal 對局的終局狀態
 * @param playerColor 玩家執的顏色
 * @param plyCount 實際走了幾個 ply（`moveHistory.length`）
 * @throws RangeError plyCount 不是非負整數時
 */
export function gameOverDisplay(
  terminal: TerminalState,
  playerColor: 'white' | 'black',
  plyCount: number,
): GameOverDisplay {
  if (!Number.isInteger(plyCount) || plyCount < 0) {
    throw new RangeError(`gameOverDisplay: plyCount 必須是非負整數，收到 ${String(plyCount)}`)
  }
  const outcome: PlayerOutcome =
    terminal.result === '1/2-1/2'
      ? 'draw'
      : (terminal.result === '1-0') === (playerColor === 'white')
        ? 'win'
        : 'loss'
  const reasonLabel =
    terminal.endReason === 'resignation' && outcome === 'win' ? '對手投降' : REASON_LABEL[terminal.endReason]
  const moveNumber = Math.max(1, Math.ceil(plyCount / 2))
  return {
    outcome,
    title: TITLE[outcome],
    reasonLabel,
    moveNumber,
    subtitle: `${reasonLabel} · 第 ${moveNumber} 回合`,
  }
}
