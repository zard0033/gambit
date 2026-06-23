import type { LessonCategory } from '@/types/lesson'
import type { Volume } from '@/types/journal'
import type { ChessConcept } from '@/types/concept'
import { lessons } from '@/data/lessons'
import { getConceptById } from '@/data/concepts'
import { arrivalParamsForVolume } from '@/data/journal-templates'
import type { CompletedStage, DeepenedConcept } from './settle'

/** Lesson category (= journey stage) → journal volume. The four stages map 1:1 to the four卷. */
const CATEGORY_VOLUME: Record<LessonCategory, Volume> = {
  rules: '卷一規則',
  tactics: '卷二戰術',
  'opening-principles': '卷三開局',
  endgame: '卷四殘局',
}

/**
 * The stages (lesson categories) the player has fully completed — every lesson in the
 * category is in `completedIds`. A stage's `stageId` is its category; this is the ④ arrival
 * dedup key. Empty categories never count as complete.
 */
export function completedStages(completedIds: ReadonlySet<string>): CompletedStage[] {
  const out: CompletedStage[] = []
  for (const category of Object.keys(CATEGORY_VOLUME) as LessonCategory[]) {
    const volume = CATEGORY_VOLUME[category]
    const catLessons = lessons.filter((l) => l.category === category)
    if (catLessons.length > 0 && catLessons.every((l) => completedIds.has(l.id))) {
      out.push({ stageId: category, volume, params: arrivalParamsForVolume(volume) })
    }
  }
  return out
}

/** A concept's journal volume, derived from the category of the lesson that teaches it. */
function conceptVolume(conceptId: ChessConcept): Volume | null {
  const lessonId = getConceptById(conceptId)?.teaches[0]
  const lesson = lessonId ? lessons.find((l) => l.id === lessonId) : undefined
  return lesson ? CATEGORY_VOLUME[lesson.category] : null
}

/**
 * The concepts deepened unaided, turned into epiphany sources. Volume comes from the teaching
 * lesson's category (the same SoT arrival uses); `概念` param is the concept's 繁中 label.
 * A concept with no teaching lesson (no resolvable volume) is skipped — it has no place to file.
 */
export function unaidedDeepenedConcepts(unaidedIds: ReadonlySet<string>): DeepenedConcept[] {
  const out: DeepenedConcept[] = []
  for (const id of unaidedIds) {
    const meta = getConceptById(id as ChessConcept)
    const volume = conceptVolume(id as ChessConcept)
    if (meta && volume) out.push({ conceptId: id, volume, params: { 概念: meta.label } })
  }
  return out
}
