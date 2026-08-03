import { test, expect } from '@playwright/test'

// 判斷場搬遷（positioning-v2 前置，2026-08-03）：RecognitionGate 從 ConceptDeepenView 的內部相位
// 拆成 /learn/concept/:conceptId/judge 這個獨立路由。unit 測試（concept-deepen-judge-route.test.ts）
// 已用 shallowMount + 真實 Pinia store 涵蓋 epiphany 跨路由傳遞的邏輯風險；本檔補的是 unit 測試
// 加不到的東西——真實瀏覽器裡這個新路由能不能實際掛載（含真的 chessground），這條路徑此前零 e2e
// 涵蓋。完整的「教學三步＋判斷場三盤」全程互動未涵蓋——那需要逐步對應每個概念的棋著座標，本檔只鎖
// 「路由掛載本身正確」這個結構性風險，全程互動留待需要時再補。

test.describe('/learn/concept/:conceptId/judge — independent route', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('gambit:guest-entry', '1'))
  })

  test('direct entry with a concept that has a judgement field mounts the board, no redirect', async ({ page }) => {
    // Deliberate: judge has no "lesson phase completed" gate (only `deepening`/`recognitionSet`
    // existence, see RecognitionFieldView.vue) — this asserts CURRENT design, not a permanent
    // contract. If a lesson-completion gate is added later, this test is expected to need updating,
    // not a sign the gate broke something (precommit-review 2026-08-03 flagged this coupling).
    await page.goto('/learn/concept/fork/judge?unaided=1', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/learn\/concept\/fork\/judge/)
    await expect(page.locator('cg-board').first()).toBeVisible()
    await expect(page.getByTestId('recognition-prompt').or(page.getByTestId('recognition-feedback'))).toBeVisible()
  })

  test('unknown concept id redirects to the concept map (Calm rule guard)', async ({ page }) => {
    await page.goto('/learn/concept/not-a-real-concept/judge', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL('/learn/concepts')
  })

  test('concept with no judgement field (material) redirects to the concept map', async ({ page }) => {
    // material has canned lesson content but no recognitionSet — /judge for it must never dead-end.
    await page.goto('/learn/concept/material/judge?unaided=1', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL('/learn/concepts')
  })
})
