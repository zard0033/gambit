// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  recordSolaceSession,
  sessionsSinceLastSolace,
  touchSession,
} from '@/lib/journal/session'

const MIN = 60_000
const T0 = 1_700_000_000_000

describe('touchSession', () => {
  beforeEach(() => localStorage.clear())

  it('starts at ordinal 1', () => {
    expect(touchSession(T0)).toBe(1)
  })

  it('keeps the same ordinal within the idle window', () => {
    expect(touchSession(T0)).toBe(1)
    expect(touchSession(T0 + 5 * MIN)).toBe(1)
  })

  it('bumps the ordinal after the idle timeout (30 min)', () => {
    expect(touchSession(T0)).toBe(1)
    expect(touchSession(T0 + 31 * MIN)).toBe(2)
  })
})

describe('sessionsSinceLastSolace / recordSolaceSession', () => {
  beforeEach(() => localStorage.clear())

  it('is infinite when no solace has been recorded', () => {
    expect(sessionsSinceLastSolace(1)).toBe(Number.POSITIVE_INFINITY)
  })

  it('counts sessions since the recorded solace ordinal', () => {
    recordSolaceSession(2)
    expect(sessionsSinceLastSolace(2)).toBe(0)
    expect(sessionsSinceLastSolace(5)).toBe(3)
  })
})
