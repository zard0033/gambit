import { describe, expect, it, beforeEach } from 'vitest'
import { pickNewer, resolveTheme, storedTheme, systemTheme } from '@/lib/theme'

describe('pickNewer', () => {
  it('picks local when there is no remote row yet', () => {
    const result = pickNewer({ theme: 'noir', at: 100 }, null)
    expect(result).toEqual({ theme: 'noir', winner: 'local' })
  })

  it('picks remote when remote is strictly newer', () => {
    const result = pickNewer({ theme: 'cream', at: 100 }, { theme: 'noir', at: 200 })
    expect(result).toEqual({ theme: 'noir', winner: 'remote' })
  })

  it('picks remote on a tie (remote.at >= local.at)', () => {
    const result = pickNewer({ theme: 'cream', at: 100 }, { theme: 'noir', at: 100 })
    expect(result).toEqual({ theme: 'noir', winner: 'remote' })
  })

  it('picks local when local is newer than remote', () => {
    const result = pickNewer({ theme: 'noir', at: 300 }, { theme: 'cream', at: 200 })
    expect(result).toEqual({ theme: 'noir', winner: 'local' })
  })
})

describe('resolveTheme', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('falls back to systemTheme() when nothing is stored locally', () => {
    expect(storedTheme()).toBeNull()
    expect(resolveTheme()).toBe(systemTheme())
  })

  it('prefers the stored local choice over the system default', () => {
    const chosen = systemTheme() === 'noir' ? 'cream' : 'noir'
    localStorage.setItem('ui:theme', chosen)
    expect(resolveTheme()).toBe(chosen)
  })
})
