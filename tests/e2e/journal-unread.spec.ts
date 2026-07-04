import { test, expect, type Page } from '@playwright/test'

// Story-005 首頁 peek + 未讀 watermark.
// Seeds guest journal entries and lastSeenAt to verify unread dot behaviour,
// peek count, navigation to /journal, and absence of count badges.

const STORAGE_KEY = 'chess:journal:lastSeenAt'
const ENTRIES_KEY = 'chess:journal:entries'

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

const T_OLD = 1_000_000  // older than any "now" we set
const T1 = 2_000_000
const T2 = 3_000_000
const T3 = 4_000_000
const T4 = 5_000_000  // 4th entry to test peek cap

const ENTRIES_4: SeedEntry[] = [
  { id: 'e1', type: 'onset', sourceRefId: 'onset', volume: null, templateId: 'onset.1', params: {}, body: 'PEEK-ENTRY-1', createdAt: T1 },
  { id: 'e2', type: 'arrival', sourceRefId: 'stage-1', volume: '卷一規則', templateId: 'arrival.1', params: {}, body: 'PEEK-ENTRY-2', createdAt: T2 },
  { id: 'e3', type: 'solace', sourceRefId: 'game-1', volume: null, templateId: 'solace.1', params: {}, body: 'PEEK-ENTRY-3', createdAt: T3 },
  { id: 'e4', type: 'solace', sourceRefId: 'game-2', volume: null, templateId: 'solace.1', params: {}, body: 'PEEK-ENTRY-4', createdAt: T4 },
]

// addInitScript runs on EVERY navigation. lastSeenAt is only seeded when absent so
// markSeen()'s write survives a re-open (otherwise the second goto re-seeds T_OLD and
// the unread marker never clears). entries re-seed harmlessly (same value each time).
async function openHome(page: Page, opts: { entries?: SeedEntry[]; lastSeenAt?: number } = {}): Promise<void> {
  await page.addInitScript(({ entries, lastSeenAt, eKey, lKey }) => {
    sessionStorage.setItem('gambit:guest-entry', '1')
    if (entries) localStorage.setItem(eKey, JSON.stringify(entries))
    if (lastSeenAt !== undefined && localStorage.getItem(lKey) === null) localStorage.setItem(lKey, String(lastSeenAt))
  }, { entries: opts.entries ?? null, lastSeenAt: opts.lastSeenAt, eKey: ENTRIES_KEY, lKey: STORAGE_KEY })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
}

async function openJournal(page: Page, opts: { entries?: SeedEntry[]; lastSeenAt?: number } = {}): Promise<void> {
  await page.addInitScript(({ entries, lastSeenAt, eKey, lKey }) => {
    sessionStorage.setItem('gambit:guest-entry', '1')
    if (entries) localStorage.setItem(eKey, JSON.stringify(entries))
    if (lastSeenAt !== undefined && localStorage.getItem(lKey) === null) localStorage.setItem(lKey, String(lastSeenAt))
  }, { entries: opts.entries ?? null, lastSeenAt: opts.lastSeenAt, eKey: ENTRIES_KEY, lKey: STORAGE_KEY })
  await page.goto('/journal', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '棋誌' })).toBeVisible()
}

test.describe('Journal peek (story-005)', () => {
  test('test_home_peek_shows_at_most_three_newest_entries', async ({ page }) => {
    // Arrange: 4 entries seeded (HOMEPAGE_PEEK_COUNT=3 → only 3 appear)
    await openHome(page, { entries: ENTRIES_4, lastSeenAt: T_OLD })

    // Act: wait for peek to render (journal.load() is async)
    const peek = page.locator('[data-testid="journal-peek-entry"]')
    await expect(peek).toHaveCount(3)

    // peek = newest 3 (T4,T3,T2); the onset (e1, pinned last) is excluded.
    const texts = await peek.allTextContents()
    expect(texts.some((t) => t.includes('PEEK-ENTRY-4'))).toBe(true)
    expect(texts.some((t) => t.includes('PEEK-ENTRY-1'))).toBe(false)
  })

  test('test_home_peek_shows_derived_onset_for_fresh_guest', async ({ page }) => {
    await openHome(page)  // no seeded entries

    // 2026-07-04 行為變更：Home mount 會跑 journal.evaluate()（settle 接線），全新 guest 首次
    // 進站即推導 onset 開場條目——棋誌從第一天就活著，peek 恰好顯示這一筆（取代舊的「隱藏」斷言）。
    const peek = page.locator('[data-testid="journal-peek-entry"]')
    await expect(peek).toHaveCount(1)
  })

  test('test_home_peek_navigates_to_journal_on_tap', async ({ page }) => {
    await openHome(page, { entries: ENTRIES_4, lastSeenAt: T_OLD })
    const firstPeek = page.locator('[data-testid="journal-peek-entry"]').first()
    await expect(firstPeek).toBeVisible()

    await firstPeek.click()
    await expect(page).toHaveURL(/\/journal/)
  })

  test('test_home_peek_shows_unread_dot_on_newer_entry', async ({ page }) => {
    // lastSeenAt set before T3, so T3 and T4 are "unread"
    await openHome(page, { entries: ENTRIES_4, lastSeenAt: T2 })

    const dots = page.locator('[data-testid="unread-dot"]')
    // Peek shows T4, T3, T2 (newest 3). T4 and T3 > T2 → 2 dots; T2 is not > T2 → no dot
    await expect(dots).toHaveCount(2)
  })

  test('test_home_no_numeric_unread_badge_on_journal_statcard', async ({ page }) => {
    await openHome(page, { entries: ENTRIES_4, lastSeenAt: T_OLD })

    // The unread dot must not contain any digit
    const dots = page.locator('[data-testid="unread-dot"]')
    for (const dot of await dots.all()) {
      const text = await dot.textContent()
      expect(/\d/.test(text ?? '')).toBe(false)
    }
  })
})

test.describe('Journal unread watermark (/journal, story-005)', () => {
  test('test_journal_unread_dot_visible_on_first_open', async ({ page }) => {
    // Arrange: entry newer than lastSeenAt
    const entry: SeedEntry = { id: 'e-new', type: 'solace', sourceRefId: 'g1', volume: null, templateId: 'solace.1', params: {}, body: 'UNREAD-ENTRY', createdAt: T2 }
    await openJournal(page, { entries: [entry], lastSeenAt: T_OLD })

    // Unread dot should be visible on the entry card
    await expect(page.locator('[data-testid="journal-unread-dot"]')).toHaveCount(1)
  })

  test('test_journal_unread_dot_clears_on_reopen', async ({ page }) => {
    // Arrange: seed entry + old lastSeenAt
    const entry: SeedEntry = { id: 'e-new', type: 'solace', sourceRefId: 'g1', volume: null, templateId: 'solace.1', params: {}, body: 'UNREAD-ENTRY', createdAt: T2 }
    await openJournal(page, { entries: [entry], lastSeenAt: T_OLD })

    // First open: dot visible
    await expect(page.locator('[data-testid="journal-unread-dot"]')).toHaveCount(1)

    // Navigate away and back
    await page.goto('/')
    await page.goto('/journal', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '棋誌' })).toBeVisible()

    // Second open: dot gone (markSeen ran on first open)
    await expect(page.locator('[data-testid="journal-unread-dot"]')).toHaveCount(0)
  })

  test('test_journal_unread_marker_not_a_number', async ({ page }) => {
    const entry: SeedEntry = { id: 'e-new', type: 'solace', sourceRefId: 'g1', volume: null, templateId: 'solace.1', params: {}, body: 'UNREAD-ENTRY', createdAt: T2 }
    await openJournal(page, { entries: [entry], lastSeenAt: T_OLD })

    const dots = page.locator('[data-testid="journal-unread-dot"]')
    for (const dot of await dots.all()) {
      const text = await dot.textContent()
      expect(/\d/.test(text ?? '')).toBe(false)
    }
  })
})
