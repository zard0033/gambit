/**
 * @axe-core/playwright is installed (package.json devDependencies, 2026-07-03).
 * Story: chess-board/story-005-keyboard-nav (AC-1)
 *
 * Scope: the ChessBoard component root (`[data-testid="chess-board-root"]` in
 * src/components/chess-board.vue) — covers ALL of our own a11y markup: the ARIA grid overlay
 * (row → roving gridcell), the two aria-live announcement regions, castle-hint buttons and
 * coordinate labels. Only `.cg-wrap` (chessground's vendor-rendered squares/pieces/drag layer)
 * is excluded: it's upstream (vue3-chessboard/chessground) code, not ours to fix
 * (see CLAUDE.md board gotchas).
 */
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('ChessBoard accessibility — AC-1', () => {
  test('test_chess_board_a11y_no_serious_or_critical_violations', async ({ page }) => {
    // Guest browsing: opt past the landing gate so /learn/pawn-basics is reachable without
    // signing in (same pattern as journal-view.spec.ts / spa-deep-link.spec.ts).
    await page.addInitScript(() => sessionStorage.setItem('gambit:guest-entry', '1'))

    // pawn-basics has order:1 in the curriculum, so lesson-progress.ts's isUnlocked() always
    // allows it — the board renders immediately, unlike /play which requires a color/skill
    // setup modal before a game (and thus a board) exists.
    await page.goto('/learn/pawn-basics', { waitUntil: 'domcontentloaded' })

    const board = page.getByRole('grid', { name: '西洋棋棋盤' })
    await expect(board).toBeVisible()

    const results = await new AxeBuilder({ page })
      .include('[data-testid="chess-board-root"]')
      .exclude('.cg-wrap')
      .analyze()

    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(seriousOrCritical).toEqual([])
  })
})
