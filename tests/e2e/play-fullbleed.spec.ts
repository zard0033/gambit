import { test, expect, type Page } from '@playwright/test'

// 對局頁全屏（wave-1a 步驟 3）：/play 是任務頁——不顯示底部導覽、頂列自畫返回，返回一律 replace('/')。
// 四條入口／出口流程：(a) 首頁設定彈窗開局、(b) 直接進 /play 再取消、(c) 走一步後返回再接回、
// (d) spa-deep-link 照舊（那支 spec 本身）。

const NAV = 'nav[aria-label="主要導覽"]'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('gambit:guest-entry', '1'))
})

/** 白方視角點格子中心（chessground 吃 board 上的 pointer 座標）。 */
async function clickSquare(page: Page, square: string): Promise<void> {
  const box = await page.locator('cg-board').boundingBox()
  if (!box) throw new Error('cg-board has no bounding box')
  const sq = box.width / 8
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1])
  await page.mouse.click(box.x + (file + 0.5) * sq, box.y + (8 - rank + 0.5) * sq)
}

test('(a) 首頁設定彈窗開局 → /play，沒有導覽', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '開始對局' }).first().click() // 首頁卡上的按鈕 → 開設定彈窗
  await page.getByRole('dialog').getByRole('button', { name: '開始對局' }).click()

  // /play 是 lazy chunk：剛起的 dev server 第一次要現編，URL 要等 chunk 載完才換，給寬一點
  await expect(page).toHaveURL('/play', { timeout: 15000 })
  await expect(page.locator('cg-board')).toBeVisible()
  await expect(page.locator(NAV)).toHaveCount(0)
  await expect(page.locator('header h1')).toHaveText(/^對 /)
  await expect(page.getByTestId('score-paper')).toBeVisible()
})

test('(b) 直接進 /play 再取消 → 回到 /', async ({ page }) => {
  await page.goto('/play', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: '開始對局' })).toBeVisible()
  // 開局前：頂列只寫「對局」、還沒有記譜紙
  // 設定彈窗開著時背景是 aria-hidden，用 DOM 定位頂列標題
  await expect(page.locator('header h1')).toHaveText('對局')
  await expect(page.getByTestId('score-paper')).toHaveCount(0)
  await expect(page.locator(NAV)).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(page).toHaveURL('/')
})

test('(c) 走一步後按返回 → 回到 /，「繼續對局」接得回原局', async ({ page }) => {
  // 換掉真的 Stockfish：只回 uciok／readyok、不回 bestmove（AI 永遠在想）。這條測的是續玩快照，不是引擎；
  // 真引擎的 WASM 在平行負載下載入＋編譯要 4 秒以上，超過 handshake 的 5 秒 uciok 上限就會 CRASHED，
  // 玩家一走子 AI 就認輸、對局結束、續玩快照被清掉，卡片永遠不會出現。
  await page.route('**/stockfish/stockfish-18-lite-single.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: "onmessage=function(e){var d=String(e.data).trim();if(d==='uci')postMessage('uciok');else if(d==='isready')postMessage('readyok')}",
    }),
  )
  await page.goto('/play', { waitUntil: 'domcontentloaded' })
  // 預設執色可能是黑或白；這裡固定選白，才能用白方視角的座標走第一步
  await page.getByRole('button', { name: '執白' }).click()
  await page.getByRole('button', { name: '開始對局' }).click()
  await expect(page.getByText('輪到你')).toBeVisible()

  await clickSquare(page, 'e2')
  await clickSquare(page, 'e4')
  await expect(page.getByTestId('score-sheet')).toContainText('e4')

  await page.getByTestId('task-top-row-back').click()
  await expect(page).toHaveURL('/')
  await expect(page.getByText('繼續對局')).toBeVisible()

  await page.getByRole('button', { name: /^繼續/ }).first().click()
  await expect(page).toHaveURL('/play')
  await expect(page.getByTestId('score-sheet')).toContainText('e4')
  await expect(page.locator(NAV)).toHaveCount(0)
})
