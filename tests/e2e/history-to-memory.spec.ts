import { test, expect } from '@playwright/test'

// 對局紀錄 → 點一盤 → 棋憶 (slice A). A history row routes to /review?gameId, which loads that past
// game into the same 棋憶 the post-game flow shows (no more legacy /replay screen).
test('tapping a history row opens that game in 棋憶', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('gambit:guest-entry', '1')
    const game = {
      id: 'hist-mem-1',
      moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'],
      result: '1-0', playerColor: 'white', endReason: 'resignation',
      aiSkillLevel: 5, completedAt: Date.now(), playerMoveTimes: [1000], isTerminal: true,
    }
    localStorage.setItem('chess:unsynced:hist-mem-1', JSON.stringify(game))
  })
  await page.goto('/history', { waitUntil: 'domcontentloaded' })

  const row = page.locator('[data-testid="history-row"]').first()
  await expect(row).toBeVisible()
  await row.click()

  await expect(page).toHaveURL(/\/review\?gameId=hist-mem-1/)
  await expect(page.getByRole('heading', { name: '棋憶' })).toBeVisible({ timeout: 15000 })
})
