/**
 * 對局日期的顯示字串，固定 zh-TW 寫法「{M} 月 {D} 日」（不補零、不帶年），以本機時區計。
 * 用於棋憶頂列副標，以及深青格題目來自別盤時的「{M} 月 {D} 日那一盤」。
 *
 * @param ts epoch 毫秒（`CompletedGame.completedAt`，或 `MissedMateSource.gameId` 轉成的數字）
 * @throws RangeError ts 不是有限數字時——寧可當場失敗，也不要畫出「NaN 月 NaN 日」。
 */
export function formatGameDay(ts: number): string {
  if (!Number.isFinite(ts)) throw new RangeError(`formatGameDay: 不是有效的時間戳：${String(ts)}`)
  const d = new Date(ts)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}
