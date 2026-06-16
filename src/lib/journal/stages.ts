import type { LessonCategory } from '@/types/lesson'
import type { Volume } from '@/types/journal'
import { lessons } from '@/data/lessons'
import { arrivalParamsForVolume } from '@/data/journal-templates'
import type { CompletedStage } from './settle'

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
