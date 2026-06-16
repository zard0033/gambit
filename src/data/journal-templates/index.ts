import type { JournalTemplate, Pen } from '@/types/journal'
import { onsetTemplates } from './onset'
import { arrivalTemplates } from './arrival'
import { solaceTemplates } from './solace'

export { arrivalParamsForVolume } from './arrival'

/** All v1 templates, grouped by pen. The settle engine picks one variant per entry. */
export const journalTemplates: Record<Pen, JournalTemplate[]> = {
  onset: onsetTemplates,
  arrival: arrivalTemplates,
  solace: solaceTemplates,
}

/** Flat list of every template across all pens. */
export const allTemplates: readonly JournalTemplate[] = [
  ...onsetTemplates,
  ...arrivalTemplates,
  ...solaceTemplates,
]

/** Lookup by template id (e.g. `arrival.3`). */
export const templatesById: Readonly<Record<string, JournalTemplate>> = Object.freeze(
  Object.fromEntries(allTemplates.map((t) => [t.id, t])),
)
