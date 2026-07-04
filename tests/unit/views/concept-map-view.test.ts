// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() }, from: vi.fn() },
}))

import ConceptMapView from '@/views/ConceptMapView.vue'
import { puzzles } from '@/data/puzzles'
import { conceptToMotifs } from '@/data/concepts'

// Concept Map — deepening redesign (quick-spec concept-deepening-page). The page is BOTH a calm
// reflection (已學/已練, lesson-only never「未達成」) AND a door to go deeper: every tile is tappable
// and opens its DEEPENING page (`/learn/concept/:id`) — the old `?from=concept` lesson side-door is
// gone. Deepening completion is a quiet text state (深入 ›/重溫 ›), not a third coloured dot.
// Seeds localStorage BEFORE mount so the progress stores hydrate deterministically.

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/learn', component: { template: '<div/>' } },
      { path: '/learn/concepts', component: ConceptMapView },
      { path: '/learn/concept/:conceptId', component: { template: '<div/>' } },
      { path: '/learn/:lessonId', component: { template: '<div/>' } },
      { path: '/dungeon/:puzzleId', component: { template: '<div/>' } },
    ],
  })
}

function seed(opts: { lessons?: string[]; solved?: string[]; deepened?: string[] } = {}) {
  localStorage.setItem('pgr:lessons:progress', JSON.stringify({ completed: opts.lessons ?? [] }))
  localStorage.setItem('pgr:dungeon:progress', JSON.stringify({ solved: opts.solved ?? [], hinted: [] }))
  localStorage.setItem(
    'pgr:concept:practice',
    JSON.stringify({ practiceSolved: [], deepened: opts.deepened ?? [] }),
  )
}

async function mountAt() {
  const router = makeRouter()
  router.push('/learn/concepts')
  await router.isReady()
  const wrapper = mount(ConceptMapView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

const tileWithText = (w: ReturnType<typeof mount>, testid: string, text: string) =>
  w.findAll(`[data-testid="${testid}"]`).find((t) => t.text().includes(text))!

const firstPuzzleOfConcept = (concept: 'fork' | 'material') =>
  puzzles.find((p) => conceptToMotifs(concept).includes(p.motif))!

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('ConceptMapView', () => {
  it('test_conceptMap_nothingDone_allTilesDormantTappableNeverUnmet', async () => {
    // Arrange + Act
    seed()
    const { wrapper: w } = await mountAt()
    // Assert: first-run = no familiar tiles; all 8 sit quietly in the dormant zone, still tappable.
    expect(w.findAll('[data-testid="concept-tile-lit"]')).toHaveLength(0)
    expect(w.findAll('[data-testid="concept-tile-dormant"]').length).toBe(8)
    expect(w.text()).not.toContain('未達成')
    // Every tile offers the deepening door (深入), never a practice CTA.
    expect(w.findAll('[data-testid="concept-tile-deepen"]').length).toBe(8)
    expect(w.find('[data-testid="concept-practise-cta"]').exists()).toBe(false)
  })

  it('test_conceptMap_learnedConcept_showsPartialCoinOnly', async () => {
    // Arrange: fork lesson completed, no fork puzzles solved.
    seed({ lessons: ['fork'] })
    // Act
    const { wrapper: w } = await mountAt()
    const forkTile = tileWithText(w, 'concept-tile-lit', '捉雙')
    // Assert: partial coin stage (jade ring), full stage (gold + ✓) absent.
    expect(forkTile).toBeTruthy()
    expect(forkTile.find('.coin-learned').exists()).toBe(true)
    expect(forkTile.find('.coin-full').exists()).toBe(false)
    expect(forkTile.find('.coin-check').exists()).toBe(false)
  })

  it('test_conceptMap_learnedReadsLinearCompletionOnly', async () => {
    // Arrange: nothing completed linearly — 已學 must NOT light (the sideLearned union was removed).
    seed()
    // Act
    const { wrapper: w } = await mountAt()
    // Assert: no concept lights up from a phantom side-door signal; every tile sits dormant.
    expect(w.findAll('[data-testid="concept-tile-lit"]').length).toBe(0)
    expect(w.find('[data-concept="pin"]').attributes('data-testid')).toBe('concept-tile-dormant')
  })

  it('test_conceptMap_learnedAndPracticedConcept_showsFullCoin', async () => {
    // Arrange: material lesson done + a capture puzzle solved.
    const cap = firstPuzzleOfConcept('material')
    seed({ lessons: ['king-and-value'], solved: [cap.id] })
    // Act
    const { wrapper: w } = await mountAt()
    const materialTile = tileWithText(w, 'concept-tile-lit', '子力')
    // Assert: full coin stage — gold ring + ✓ badge (shape cue, state never colour-only).
    expect(materialTile).toBeTruthy()
    expect(materialTile.find('.coin-full').exists()).toBe(true)
    expect(materialTile.find('.coin-check').exists()).toBe(true)
    expect(materialTile.find('.coin-learned').exists()).toBe(false)
  })

  it('test_conceptMap_lessonOnlyConcept_neverShowsPractisedOrUnmet', async () => {
    // Arrange: skewer is lesson-only (no drill puzzles). Completing its lesson lights 已學 ONLY.
    seed({ lessons: ['skewer'] })
    // Act
    const { wrapper: w } = await mountAt()
    const skewerTile = tileWithText(w, 'concept-tile-lit', '串擊')
    // Assert: lesson-only concepts cap at the partial stage — full (gold) stays reachable-honest.
    expect(skewerTile).toBeTruthy()
    expect(skewerTile.find('.coin-learned').exists()).toBe(true)
    expect(skewerTile.find('.coin-full').exists()).toBe(false)
    expect(w.text()).not.toContain('未達成')
  })

  it('test_conceptMap_tapTile_opensDeepeningPage', async () => {
    // Arrange: nothing done — pick a dormant tile (捉雙 / fork).
    seed()
    const { wrapper: w, router } = await mountAt()
    // Act: tap the tile.
    await tileWithText(w, 'concept-tile-dormant', '捉雙').trigger('click')
    await flushPromises()
    // Assert: navigates to the tactic's deepening page (no `?from=concept` side-door).
    expect(router.currentRoute.value.path).toBe('/learn/concept/fork')
    expect(router.currentRoute.value.query.from).toBeUndefined()
  })

  it('test_conceptMap_deepenedConcept_showsReturnAffordance', async () => {
    // Arrange: fork deepened; pin not.
    seed({ deepened: ['fork'] })
    const { wrapper: w } = await mountAt()
    // Assert: deepened tile reads 重溫, un-deepened reads 深入.
    expect(w.find('[data-concept="fork"]').text()).toContain('重溫')
    expect(w.find('[data-concept="fork"]').text()).not.toContain('深入')
    expect(w.find('[data-concept="pin"]').text()).toContain('深入')
  })
})
