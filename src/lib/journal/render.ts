import type { JournalParams, JournalTemplate, Pen } from '@/types/journal'
import { journalTemplates, templatesById } from '@/data/journal-templates'

/**
 * Deterministic, non-negative 32-bit string hash (FNV-1a). Used to pick a
 * template variant from a stable key (e.g. `source_ref_id`) so re-renders are
 * stable and different entries vary — without `Math.random` (R9 zero-AI).
 */
export function hashInt(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Pick a template variant for a pen, deterministically from `sourceRefId`.
 * Same key → same variant; spreads different keys across the variant pool.
 */
export function pickTemplate(pen: Pen, sourceRefId: string): JournalTemplate {
  const variants = journalTemplates[pen]
  return variants[hashInt(sourceRefId) % variants.length]
}

/**
 * Render a template id with params. Pure and deterministic — the basis for the
 * immutable `body` snapshot and golden-file testing (R9).
 * @throws if `templateId` is unknown.
 */
export function render(templateId: string, params: JournalParams = {}): string {
  const template = templatesById[templateId]
  if (!template) throw new Error(`Unknown journal template: ${templateId}`)
  return template.render(params)
}
