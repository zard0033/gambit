import { test, expect } from '@playwright/test'

test.describe('SPA deep-link redirect handling', () => {
  // The landing gate sends an unauthenticated visitor with no guest flag to /sign-in (the gate now
  // runs before mount). These tests exercise the SPA redirect rewrite, not the gate — opt into guest
  // browsing first so /play is allowed through and we can assert the rewrite landed.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('gambit:guest-entry', '1'))
  })

  test('navigating to /?redirect=%2Fplay rewrites URL to /play', async ({ page }) => {
    // Simulate what 404.html produces: /?redirect=%2Fplay
    // main.ts reads the ?redirect param and calls history.replaceState before app mounts
    await page.goto('/?redirect=%2Fplay', { waitUntil: 'domcontentloaded' })

    // Assert URL was rewritten to /play by the redirect handler in main.ts
    await expect(page).toHaveURL('/play')
  })

  test('PlayView is visible after SPA redirect to /play', async ({ page }) => {
    await page.goto('/?redirect=%2Fplay', { waitUntil: 'domcontentloaded' })

    // Assert the Play view rendered (PlayView renders inside <main>)
    await expect(page.locator('main')).toBeVisible()
  })

  // Regression: entering /play directly opens the setup modal on /play itself; confirming it used
  // to bounce back home — the modal-dismiss guard saw pendingGame already consumed and
  // isGameInProgress still false (only set on the first player move) and misread "started" as
  // "cancelled". The guard now keys on lifecycle phase === 'SETUP' (never started this visit).
  test('confirming setup after direct /play entry starts the game and stays on /play', async ({ page }) => {
    await page.goto('/play', { waitUntil: 'domcontentloaded' })

    // Setup modal opens in place (no pending game from Home). Confirm with defaults.
    await page.getByRole('button', { name: '開始對局' }).click()

    // The game must start on /play — no bounce back to home.
    await expect(page.locator('cg-board')).toBeVisible()
    await expect(page).toHaveURL('/play')
  })
})
