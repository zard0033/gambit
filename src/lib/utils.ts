import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Time-of-day greeting (local time). */
export function greetingForNow(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早安'
  if (h < 18) return '午安'
  return '晚安'
}

/** Sky mood of the atmospheric home scene. Shares the greetingForNow hour boundaries. */
export type TimeBucket = 'night' | 'morning' | 'afternoon' | 'evening'

/** Pure time-of-day bucket for a given local hour (0–23). Same boundaries as greetingForNow. */
export function timeBucketForHour(hour: number): TimeBucket {
  if (hour < 6) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}
