import type { Pen } from '@/types/journal'
import { lintBody } from '@/lib/persona-lint'

/** Pen-aware convenience wrapper: applies the strict rules (no blame, no digit) to the affirming
 * pens — solace and epiphany — which must never criticise or quote numbers. */
export function lintEntryBody(text: string, pen: Pen): string[] {
  return lintBody(text, { solace: pen === 'solace' || pen === 'epiphany' })
}
