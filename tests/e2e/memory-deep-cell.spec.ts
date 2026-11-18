import { test, expect, type Page } from '@playwright/test'

// 棋憶深青格「走錯不滑回」回歸（wave 1a 步驟 1）。vue3-chessboard 的 move() 先 emit 'move'、之後才
// board.move()，在 move 事件裡同步重設的盤會被函式庫接下來那一步蓋掉，錯的子留在錯的格、題目卡死。
// unit 測試的棋盤是 stub，抓不到這個時序，只有真的 chessground 抓得到。
//
// 種子讓 /review 不跑 Stockfish：分析快取每一格都是 pass:'deep'，init 同步進 COMPLETE。

const GAME_ID = 'deep-cell-1'
const COMPLETED_AT = 1700000000000
const MOVES = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6']
// 底線將殺，唯一解 e1e8（同 key-moments-card.test.ts 的 MATE_FEN）。題目掛在另一盤上。
const MATE_FEN = '6k1/5ppp/8/8/8/8/5PPP/4Q1K1 w - - 0 1'

async function seed(page: Page): Promise<void> {
  await page.addInitScript(
    ({ gameId, completedAt, moves, mateFen }) => {
      sessionStorage.setItem('gambit:guest-entry', '1')
      localStorage.setItem(`chess:unsynced:${gameId}`, JSON.stringify({
        id: gameId, moves, result: '1-0', playerColor: 'white', endReason: 'resignation',
        aiSkillLevel: 5, completedAt, playerMoveTimes: [1000], isTerminal: true,
      }))
      const key = `pgr:analysis:v2:${completedAt}`
      localStorage.setItem(key, JSON.stringify(
        moves.map(() => ({ bestMove: 'e2e4', evalCp: 20, depthReached: 16, pass: 'deep' })),
      ))
      localStorage.setItem('pgr:analysis:index:v2', JSON.stringify([key]))
      localStorage.setItem('pgr:recognition:sources', JSON.stringify({
        sources: [{ gameId: String(completedAt - 1), ply: 8, fen: mateFen, mateMoveUci: 'e1e8', playerColor: 'white' }],
        consumed: [],
      }))
    },
    { gameId: GAME_ID, completedAt: COMPLETED_AT, moves: MOVES, mateFen: MATE_FEN },
  )
}

const board = (page: Page) => page.locator('[data-testid="key-moments"] cg-board')

/** 白方視角：點格子中心（chessground 吃 board 上的 pointer 座標，不吃 element click）。 */
async function clickSquare(page: Page, square: string): Promise<void> {
  const box = await board(page).boundingBox()
  if (!box) throw new Error('cg-board has no bounding box')
  const sq = box.width / 8
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1])
  await page.mouse.click(box.x + (file + 0.5) * sq, box.y + (8 - rank + 0.5) * sq)
}

type ProbeWindow = Window & { __pawns: () => string[]; __seen: Set<string> }

/**
 * 在頁內裝一個探針：`__pawns()` 回盤上白兵目前所在的格子（由棋子的實際位置換算，動畫中途也算得出來），
 * 另外每個 animation frame 記下出現過的格子到 `__seen`。錯棋在 g3 只停留幾百毫秒，從 Playwright
 * 端輪詢在平行負載下會漏掉，所以「子確實走過去了」要靠頁內逐幀記錄來證明。
 */
async function installPawnProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as ProbeWindow
    w.__pawns = () => {
      // 每次重新查：chessground redraw 會換掉 cg-board 元素，抓舊的會量到 0 寬的殘骸。
      const el = document.querySelector('[data-testid="key-moments"] cg-board')
      if (!el) return []
      const br = el.getBoundingClientRect()
      const sq = br.width / 8
      return [...el.querySelectorAll('piece.white.pawn')]
        .filter((p) => !p.classList.contains('ghost'))
        .map((p) => {
          const r = p.getBoundingClientRect()
          const f = Math.floor((r.left + r.width / 2 - br.left) / sq)
          const rank = 8 - Math.floor((r.top + r.height / 2 - br.top) / sq)
          return `${'abcdefgh'[f]}${rank}`
        })
        .sort()
    }
    w.__seen = new Set()
    const tick = (): void => {
      for (const s of w.__pawns()) w.__seen.add(s)
      requestAnimationFrame(tick)
    }
    tick()
  })
}

const whitePawnSquares = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as ProbeWindow).__pawns())
const seenSquares = (page: Page): Promise<string[]> =>
  page.evaluate(() => [...(window as unknown as ProbeWindow).__seen])

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test.describe(`棋憶深青格（reducedMotion: ${reducedMotion}）`, () => {
    test.use({ contextOptions: { reducedMotion } })

    test('走錯的子滑回原格，之後走正解能通關', async ({ page }) => {
      // Arrange
      await seed(page)
      await page.goto(`/review?gameId=${GAME_ID}`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('deep-prompt')).toBeVisible({ timeout: 15000 })
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
        .toBe(reducedMotion === 'reduce')
      await board(page).scrollIntoViewIfNeeded()
      await installPawnProbe(page)
      expect(await whitePawnSquares(page)).toEqual(['f2', 'g2', 'h2'])

      // Act — 走一步錯棋 g2→g3
      await clickSquare(page, 'g2')
      await clickSquare(page, 'g3')

      // Assert — 先確認子真的走過去了（否則下面的「回到原格」恆真），再確認它回來
      await expect.poll(() => seenSquares(page), { timeout: 2000 }).toContain('g3')
      await expect.poll(() => whitePawnSquares(page), { timeout: 2000 })
        .toEqual(['f2', 'g2', 'h2'])
      await expect(page.getByTestId('deep-prompt')).toBeVisible()

      // Act — 正解
      await clickSquare(page, 'e1')
      await clickSquare(page, 'e8')

      // Assert
      await expect(page.getByTestId('deep-solved')).toBeVisible({ timeout: 2000 })
    })
  })
}
