import { describe, expect, it } from 'vitest'
import type { Volume } from '@/types/journal'
import {
  allTemplates,
  arrivalParamsForVolume,
  journalTemplates,
  templatesById,
} from '@/data/journal-templates'
import { lintEntryBody } from '@/modules/journal/persona-lint'

const VOLUMES: Volume[] = ['卷一規則', '卷二戰術', '卷三開局', '卷四殘局']

describe('journal template catalog', () => {
  it('has ≥5 variants per pen', () => {
    expect(journalTemplates.onset.length).toBeGreaterThanOrEqual(5)
    expect(journalTemplates.arrival.length).toBeGreaterThanOrEqual(5)
    expect(journalTemplates.solace.length).toBeGreaterThanOrEqual(5)
    expect(journalTemplates.epiphany.length).toBeGreaterThanOrEqual(5)
  })

  it('has unique template ids', () => {
    const ids = allTemplates.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('templatesById resolves every template', () => {
    for (const t of allTemplates) {
      expect(templatesById[t.id]).toBe(t)
    }
  })

  it('every template declares a pen matching its group', () => {
    for (const pen of ['onset', 'arrival', 'solace', 'epiphany'] as const) {
      for (const t of journalTemplates[pen]) expect(t.pen).toBe(pen)
    }
  })
})

describe('persona lint over all rendered bodies', () => {
  it('onset + solace render clean (no emoji / xiangqi; solace also no blame/digit)', () => {
    for (const t of [...journalTemplates.onset, ...journalTemplates.solace]) {
      expect(lintEntryBody(t.render({}), t.pen)).toEqual([])
    }
  })

  it('arrival renders clean for every volume', () => {
    for (const t of journalTemplates.arrival) {
      for (const v of VOLUMES) {
        expect(lintEntryBody(t.render(arrivalParamsForVolume(v)), 'arrival')).toEqual([])
      }
    }
  })

  it('epiphany renders clean (no blame/digit/emoji/xiangqi) for every concept label', () => {
    const LABELS = ['子力', '捉雙', '牽制', '將殺', '串擊', '閃擊', '保護', '控制中心']
    for (const t of journalTemplates.epiphany) {
      for (const label of LABELS) {
        expect(lintEntryBody(t.render({ 概念: label }), 'epiphany')).toEqual([])
      }
    }
  })
})

describe('arrivalParamsForVolume', () => {
  it('provides 卷名 / 學會的 / 應付的 for every volume', () => {
    for (const v of VOLUMES) {
      const p = arrivalParamsForVolume(v)
      expect(p['卷名']).toBeTruthy()
      expect(p['學會的']).toBeTruthy()
      expect(p['應付的']).toBeTruthy()
    }
  })

  it('returns a fresh object (no shared mutable state)', () => {
    const a = arrivalParamsForVolume('卷一規則')
    a['卷名'] = 'mutated'
    expect(arrivalParamsForVolume('卷一規則')['卷名']).toBe('規則')
  })
})
