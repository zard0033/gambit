import { test, expect, type Page } from '@playwright/test'

// Story-004 棋誌全覽 UI. Seeds the guest local-first journal (`chess:journal:entries`) so the
// view renders without a logged-in cloud, and opts into guest browsing so the landing gate
// lets /journal through.

const EMPTY_STATE_COPY = '還沒有什麼好寫的。先下一盤吧。'

interface SeedEntry {
  id: string
  type: 'onset' | 'arrival' | 'solace'
  sourceRefId: string
  volume: string | null
  templateId: string
  params: Record<string, string>
  body: string
  createdAt: number
}

// onset@t1 < arrival@t2 < solace@t3 → timeline desc renders solace, arrival, …, onset last.
const T1 = 1_000_000
const T2 = 2_000_000
const T3 = 3_000_000

const SEED: SeedEntry[] = [
  { id: 'e-onset', type: 'onset', sourceRefId: 'onset', volume: null, templateId: 'onset.1', params: {}, body: 'SEED-ONSET 我是 Neve。', createdAt: T1 },
  { id: 'e-arrival', type: 'arrival', sourceRefId: 'stage-1', volume: '卷一規則', templateId: 'arrival.1', params: {}, body: 'SEED-ARRIVAL 你看懂了盤面。', createdAt: T2 },
  { id: 'e-solace', type: 'solace', sourceRefId: 'game-1', volume: '卷二戰術', templateId: 'solace.1', params: {}, body: 'SEED-SOLACE 今天輸了，但你撐得更久。', createdAt: T3 },
]

async function openJournal(page: Page, opts: { seed?: SeedEntry[] } = {}): Promise<void> {
  await page.addInitScript((seed) => {
    sessionStorage.setItem('gambit:guest-entry', '1')
    if (seed) localStorage.setItem('chess:journal:entries', JSON.stringify(seed))
  }, opts.seed ?? null)
  await page.goto('/journal', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '棋誌' })).toBeVisible()
}

test.describe('Journal overview (/journal)', () => {
  test('test_journal_order_renders_desc_with_onset_last', async ({ page }) => {
    await openJournal(page, { seed: SEED })

    const bodies = page.locator('.journal-body')
    await expect(bodies).toHaveCount(3)
    const texts = await bodies.allTextContents()
    expect(texts[0]).toContain('SEED-SOLACE')
    expect(texts[1]).toContain('SEED-ARRIVAL')
    expect(texts[2]).toContain('SEED-ONSET') // onset pinned at the bottom
  })

  test('test_journal_empty_state_shows_fixed_neve_copy', async ({ page }) => {
    await openJournal(page) // no seed → zero entries

    await expect(page.locator('.journal-body')).toHaveCount(0)
    await expect(page.getByText(EMPTY_STATE_COPY, { exact: true })).toBeVisible()
    // no emoji in the empty copy
    expect(/\p{Extended_Pictographic}/u.test(EMPTY_STATE_COPY)).toBe(false)
  })

  test('test_journal_has_no_edit_or_delete_control', async ({ page }) => {
    await openJournal(page, { seed: SEED })

    await expect(page.getByRole('button', { name: /edit|delete|編輯|刪除|移除/i })).toHaveCount(0)
    expect(await page.locator('[contenteditable="true"]').count()).toBe(0)
    expect(await page.locator('input, textarea').count()).toBe(0)
  })

  test('test_journal_reduced_motion_no_animation_on_entry_cards', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openJournal(page, { seed: SEED })

    // The cumulative-visual nodes are the entry cards (they carry the one-shot rise animation).
    const running = await page.locator('.journal-card').evaluateAll((nodes) =>
      nodes.reduce((sum, n) => sum + n.getAnimations().length, 0),
    )
    expect(running).toBe(0)
  })

  test('test_journal_older_months_collapse_and_expand_on_click', async ({ page }) => {
    const mk = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime()
    const multi: SeedEntry[] = [
      { id: 'new2', type: 'solace', sourceRefId: 'g2', volume: '卷二戰術', templateId: 'solace.1', params: {}, body: 'NEWEST-2', createdAt: mk(2026, 6, 16) },
      { id: 'new1', type: 'arrival', sourceRefId: 's2', volume: '卷二戰術', templateId: 'arrival.1', params: {}, body: 'NEWEST-1', createdAt: mk(2026, 6, 2) },
      { id: 'old', type: 'arrival', sourceRefId: 's1', volume: '卷一規則', templateId: 'arrival.2', params: {}, body: 'OLDER-1', createdAt: mk(2026, 5, 10) },
    ]
    await openJournal(page, { seed: multi })

    // Newest month expanded (2 cards); the older month is collapsed (a "篇" affordance, 0 cards).
    await expect(page.locator('.journal-card')).toHaveCount(2)
    const olderHeader = page.getByRole('button', { name: /篇/ }).first()
    await expect(olderHeader).toBeVisible()

    // Expanding the older month reveals its entry.
    await olderHeader.click()
    await expect(page.locator('.journal-card')).toHaveCount(3)
  })

  test('test_journal_cjk_body_is_not_italic', async ({ page }) => {
    await openJournal(page, { seed: SEED })

    const style = await page.locator('.journal-body').first().evaluate((n) => getComputedStyle(n).fontStyle)
    expect(style).not.toBe('italic')
  })

  // 全站累積（memory GDD Rule 24）：Neve 記得 N 盤／同行 N 天／寫下 N 篇。
  test('test_journal_running_totals_line_counts_games_days_entries', async ({ page }) => {
    // Seed three guest games (chess:unsynced:*) so countGames() (guest = local queue) returns 3.
    await page.addInitScript(() => {
      const game = (id: string) => ({
        id, moves: ['e2e4', 'e7e5'], result: '1-0', playerColor: 'white',
        endReason: 'checkmate', aiSkillLevel: 5, completedAt: Date.now(),
        playerMoveTimes: [1000], isTerminal: true,
      })
      for (const id of ['g1', 'g2', 'g3']) {
        localStorage.setItem(`chess:unsynced:${id}`, JSON.stringify(game(id)))
      }
    })
    // Recent dates so "days together" reads realistically (onset ~4 days ago).
    const DAY = 86_400_000
    const now = Date.now()
    const recent: SeedEntry[] = [
      { ...SEED[0], createdAt: now - 4 * DAY },
      { ...SEED[1], createdAt: now - 2 * DAY },
      { ...SEED[2], createdAt: now - 1 * DAY },
    ]
    await openJournal(page, { seed: recent }) // 3 entries: onset + arrival + solace

    // games and entries are stable (3 each); the day count varies, so match it loosely.
    await expect(
      page.getByText(/^我們同行 \d+ 天了，我記得你的 3 盤棋，也為你寫下了 3 篇。$/),
    ).toBeVisible()
  })

  // memory GDD Rule 23: a game-linked entry (solace) taps into that game's 棋憶; milestones don't.
  test('test_journal_solace_entry_taps_into_its_game_memory', async ({ page }) => {
    await page.addInitScript(() => {
      // The game behind the solace entry (SEED solace sourceRefId === 'game-1'), so 棋憶 loads it.
      const game = {
        id: 'game-1',
        moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'],
        result: '0-1', playerColor: 'white', endReason: 'resignation',
        aiSkillLevel: 5, completedAt: Date.now(), playerMoveTimes: [1000], isTerminal: true,
      }
      localStorage.setItem('chess:unsynced:game-1', JSON.stringify(game))
    })
    await openJournal(page, { seed: SEED })

    // Only the solace entry is interactive (onset/arrival are milestones, not game-linked).
    const linked = page.locator('.journal-card[role="button"]')
    await expect(linked).toHaveCount(1)
    await expect(linked).toContainText('回到那盤')
    await linked.click()

    await expect(page).toHaveURL(/\/review\?gameId=game-1/)
    await expect(page.getByRole('heading', { name: '棋憶' })).toBeVisible({ timeout: 15000 })
  })
})
