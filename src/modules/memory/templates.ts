/**
 * 棋憶 — zero-AI Neve 文案模板（GDD F3，每個 moment 一句）。純函式，不連網。
 * 見 `design/gdd/memory.md` F3 ＋ `design/gambit-design-system/persona-neve.md`「回顧態」。
 *
 * 回顧態的護欄直接寫進句子裡：主詞是「你」、主動語態、不揣測動機、失誤中性（不出現「失誤/錯」）、
 * 好棋只陳述不吹捧、plain 一律挑最安靜的說法。
 *
 * 走法一律用**白話文**（「把主教移到 g5」），不用棋譜記號（`Bg5`）——目標讀者看不懂 SAN。
 *
 * 2026-08-08 自 `e2cb898~1` 復原（D4 連坐刪除）。跨局那句 `renderNeveLine`（F4）不復原：
 * 它的消費端在 D4 一併退役，復原等於留一具沒有呼叫端的屍體。
 *
 * **語氣來源唯一**：吃 `describe.ts::momentTone` 算出來的 tone，不自己從 `Moment.kind` 推——
 * 標題（`momentShortName`）與這裡的內文必須同源，否則會出現「標題稱讚、內文批評同一手」
 * （2026-08-08 precommit-review 抓到）。型別也把這件事鎖住了：`bright`/`best-anyway` 這兩種
 * 「玩家走了最佳手」的情況**在型別上就沒有 `best` 欄位**，模板不可能生出
 * 「與其你剛走的最佳手，不如先走穩一點」這種假建議。
 */

import type { ClassifyResult } from '@/modules/learning-loop/classify'
import { movePhrase, type MoveDesc } from './describe'

/**
 * 一個 moment 的解釋所需的全部素材。依 tone 分成兩族：
 * 玩家走了最佳手（沒有「更好的」）／玩家走的不是最佳手（一定有「更好的」）。
 */
export type MomentText =
  // discriminant 一律用單一字面值：合併成 `'bright' | 'best-anyway'` 會讓 TS 的 narrowing
  // 排不掉整個 member，之後存取 `best` 就會編譯不過。
  | { readonly tone: 'bright'; readonly played: MoveDesc }
  | { readonly tone: 'best-anyway'; readonly played: MoveDesc }
  | {
      readonly tone: 'tactical'
      readonly concept: ClassifyResult
      readonly played: MoveDesc
      readonly best: MoveDesc
      /** material 專用：沒人守的那顆子（中文）與它所在的格，由 `hungMaterialDetail` 供給；判定給不出來時同時缺席。 */
      readonly hungPiece?: string
      readonly hungSquare?: string
    }
  | { readonly tone: 'turning-point'; readonly played: MoveDesc; readonly best: MoveDesc }
  | { readonly tone: 'plain'; readonly played: MoveDesc; readonly best: MoveDesc }

/** F3：渲染一個 moment 的解釋。 */
export function renderMoment(m: MomentText): string {
  const played = movePhrase(m.played)

  if (m.tone === 'bright') {
    return `你穩住了——${played} 之後，把主導權拿了回來。`
  }
  if (m.tone === 'best-anyway') {
    // 玩家走的就是引擎最佳手，卻仍被選進這一盤的關鍵步：局面本身難走，不是這一手的問題。
    // 措辭刻意不預設局面好壞——這個 tone 在順風局也會出現。
    return `${played}，這已經是這裡最好的一手了。`
  }

  const best = movePhrase(m.best)

  if (m.tone === 'tactical') {
    if (m.concept === 'material') {
      // 不知道是哪顆子、在哪一格時，首句整句不講（2026-08-08 Eason 拍板）。原本會 fallback 成
      // 「你的子留在那裡，沒人守著」——一句沒有資訊的話，比不講更糟；回顧態本來就沉默優先。
      if (!m.hungPiece || !m.hungSquare) {
        return `與其${played}，不如先${best}。`
      }
      // 「留在」只有在子本來就在那裡時才是真的。被吃的那格 === 這一手的落點時，是玩家自己把它
      // 送過去的——說「留在」等於把主動送子講成疏忽，而且落點已經在後半句講過一次，不重複。
      if (m.hungSquare === m.played.to) {
        // 「那裡」的指涉物是 played 片語裡的格號。吃過路兵的片語刻意不報格號（被吃的兵不在落點上），
        // 兩個各自正確的決定疊起來就成了一句指不到東西的話——那時把格號自己寫出來。
        // 新增任何不報格號的片語都要回來看這一行。
        const where = m.played.enPassant ? `${m.hungSquare} ` : '那裡'
        return `你${played}，${where}沒人守著。不如先${best}。`
      }
      return `你的${m.hungPiece}留在 ${m.hungSquare}，沒人守著。與其${played}，不如先${best}。`
    }
    if (m.concept === 'mate') {
      return `這裡你忽略了對手的將殺。與其${played}，先${best}，把王照顧好。`
    }
    // tactical 但分類器沒給出概念：不宣稱有沒有戰術，只給方向。
    return `與其${played}，不如先${best}。`
  }

  // turning-point / plain — 沉默優先：不點名戰術，只給一個方向
  return `這裡沒有戰術可抓。你${played}，局面鬆了一點；先${best}會穩一些。`
}
