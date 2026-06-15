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

// Concept Map — additive redesign (quick-spec concept-tab-tactic-entry). The page is BOTH a calm
// reflection (已學/已練, lesson-only never「未達成」) AND a by-tactic learning entry: every tile is
// tappable and side-doors into its lesson (`?from=concept`). Seeds localStorage BEFORE mount so the
// progress stores hydrate deterministically.

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/learn', component: { template: '<div/>' } },
      { path: '/learn/concepts', component: ConceptMapView },
      { path: '/learn/:lessonId', component: { template: '<div/>' } },
      { path: '/dungeon/:puzzleId', component: { template: '<div/>' } },
    ],
  })
}

function seed(opts: { lessons?: string[]; sideLearned?: string[]; solved?: string[] } = {}) {
  localStorage.setItem(
    'pgr:lessons:progress',
    JSON.stringify({ completed: opts.lessons ?? [], sideLearned: opts.sideLearned ?? [] }),
  )
  localStorage.setItem('pgr:dungeon:progress', JSON.stringify({ solved: opts.solved ?? [], hinted: [] }))
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
    // No practice entry anywhere on this page (removed by design).
    expect(w.find('[data-testid="concept-practise-cta"]').exists()).toBe(false)
  })

  it('test_conceptMap_learnedConcept_showsLearnedChipOnly', async () => {
    // Arrange: fork lesson completed, no fork puzzles solved.
    seed({ lessons: ['fork'] })
    // Act
    const { wrapper: w } = await mountAt()
    const forkTile = tileWithText(w, 'concept-tile-lit', '捉雙')
    // Assert: 已學 chip present, 已練 absent, no practice CTA.
    expect(forkTile).toBeTruthy()
    expect(forkTile.find('.legend-learned').exists()).toBe(true)
    expect(forkTile.find('.legend-practiced').exists()).toBe(false)
    expect(forkTile.find('[data-testid="concept-practise-cta"]').exists()).toBe(false)
  })

  it('test_conceptMap_sideLearnedConcept_litViaSideDoorSignal', async () => {
    // Arrange: pin learned ONLY through the Concept side-door (sideLearned, not linear completion).
    seed({ sideLearned: ['pin'] })
    // Act
    const { wrapper: w } = await mountAt()
    const pinTile = tileWithText(w, 'concept-tile-lit', '牽制')
    // Assert: the side-door signal lights 已學.
    expect(pinTile).toBeTruthy()
    expect(pinTile.find('.legend-learned').exists()).toBe(true)
  })

  it('test_conceptMap_practicedConcept_showsBothChips', async () => {
    // Arrange: material lesson done + a capture puzzle solved.
    const cap = firstPuzzleOfConcept('material')
    seed({ lessons: ['king-and-value'], solved: [cap.id] })
    // Act
    const { wrapper: w } = await mountAt()
    const materialTile = tileWithText(w, 'concept-tile-lit', '子力')
    // Assert: both 已學 and 已練 chips.
    expect(materialTile).toBeTruthy()
    expect(materialTile.find('.legend-learned').exists()).toBe(true)
    expect(materialTile.find('.legend-practiced').exists()).toBe(true)
  })

  it('test_conceptMap_lessonOnlyConcept_neverShowsPractisedOrUnmet', async () => {
    // Arrange: skewer is lesson-only (no drill puzzles). Completing its lesson lights 已學 ONLY.
    seed({ lessons: ['skewer'] })
    // Act
    const { wrapper: w } = await mountAt()
    const skewerTile = tileWithText(w, 'concept-tile-lit', '串擊')
    // Assert
    expect(skewerTile).toBeTruthy()
    expect(skewerTile.find('.legend-learned').exists()).toBe(true)
    expect(skewerTile.find('.legend-practiced').exists()).toBe(false)
    expect(w.text()).not.toContain('未達成')
  })

  it('test_conceptMap_tapTile_sideDoorsIntoLessonWithFromConcept', async () => {
    // Arrange: nothing done — pick a dormant tile (捉雙 / fork → lesson id `fork`).
    seed()
    const { wrapper: w, router } = await mountAt()
    // Act: tap the tile.
    await tileWithText(w, 'concept-tile-dormant', '捉雙').trigger('click')
    await flushPromises()
    // Assert: navigates to the tactic's lesson via the Concept side-door.
    expect(router.currentRoute.value.path).toBe('/learn/fork')
    expect(router.currentRoute.value.query.from).toBe('concept')
  })
})
