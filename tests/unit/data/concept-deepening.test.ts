import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import { conceptDeepenings, getConceptDeepening } from '../../../src/data/concept-deepening'
import { concepts } from '../../../src/data/concepts'

// Concept deepening content-validity gate (quick-specs/concept-deepening-page.md §8 AC1).
// Every FEN must load (both kings), every interactive expectedMove must be legal, every
// interactive step must carry a Socratic hint + reveal arrow, and the side-to-move must be the
// player (white). The 將殺 deepening additionally claims checkmate — assert it with isCheckmate().

const allDeepenings = Object.values(conceptDeepenings)

describe('concept deepening catalog', () => {
  it('test_catalog_coversEveryConcept', () => {
    const covered = new Set(allDeepenings.map((d) => d.conceptId))
    for (const c of concepts) {
      expect(covered.has(c.id), `concept "${c.id}" has no deepening`).toBe(true)
    }
  })

  it('test_catalog_conceptIdMatchesKey', () => {
    for (const [key, d] of Object.entries(conceptDeepenings)) {
      expect(d.conceptId, `key ${key} mismatches conceptId`).toBe(key)
    }
  })

  it('test_catalog_eachHasIntroAndSteps', () => {
    for (const d of allDeepenings) {
      expect(d.intro.trim(), `${d.conceptId}: empty intro`).toBeTruthy()
      expect(d.steps.length, `${d.conceptId}: needs ≥2 steps`).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('getConceptDeepening', () => {
  it('test_getConceptDeepening_existingId_returnsEntry', () => {
    expect(getConceptDeepening('fork')).toBe(conceptDeepenings.fork)
  })

  it('test_getConceptDeepening_unknownId_returnsUndefined', () => {
    expect(getConceptDeepening('no-such-concept')).toBeUndefined()
  })
})

describe('concept deepening chess-validity', () => {
  it('test_allSteps_fenIsLegalPosition', () => {
    for (const d of allDeepenings) {
      d.steps.forEach((step, i) => {
        expect(
          () => new Chess(step.fen),
          `${d.conceptId} step ${i}: illegal FEN "${step.fen}"`,
        ).not.toThrow()
      })
    }
  })

  it('test_interactiveSteps_expectedMoveIsLegal', () => {
    for (const d of allDeepenings) {
      d.steps.forEach((step, i) => {
        if (!step.expectedMove) return
        const chess = new Chess(step.fen)
        const move = step.expectedMove
        expect(
          () => chess.move({ from: move.from, to: move.to, promotion: move.promotion }),
          `${d.conceptId} step ${i}: illegal expectedMove ${move.from}${move.to} in "${step.fen}"`,
        ).not.toThrow()
      })
    }
  })

  it('test_interactiveSteps_haveSocraticHintAndRevealArrow', () => {
    for (const d of allDeepenings) {
      d.steps.forEach((step, i) => {
        if (!step.expectedMove) return
        expect(step.hint?.trim(), `${d.conceptId} step ${i}: missing Socratic hint`).toBeTruthy()
        expect(
          step.arrows && step.arrows.length > 0,
          `${d.conceptId} step ${i}: missing reveal arrow(s)`,
        ).toBe(true)
      })
    }
  })

  it('test_interactiveSteps_sideToMoveIsWhite', () => {
    for (const d of allDeepenings) {
      d.steps.forEach((step, i) => {
        if (!step.expectedMove) return
        expect(
          new Chess(step.fen).turn(),
          `${d.conceptId} step ${i}: side-to-move must be white (the player)`,
        ).toBe('w')
      })
    }
  })

  it('test_mateDeepening_expectedMoveDeliversCheckmate', () => {
    // The 將殺 deepening teaches real mating patterns — each interactive move must be mate.
    conceptDeepenings.mate.steps.forEach((step, i) => {
      if (!step.expectedMove) return
      const chess = new Chess(step.fen)
      chess.move({ from: step.expectedMove.from, to: step.expectedMove.to })
      expect(chess.isCheckmate(), `mate step ${i}: ${step.expectedMove.from}${step.expectedMove.to} is not checkmate`).toBe(true)
    })
  })
})
