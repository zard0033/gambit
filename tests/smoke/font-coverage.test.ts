import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// The self-hosted Sarasa UI TC files are subsets. A character missing from them silently renders
// in a system font next to Sarasa glyphs (2026-11: 首頁／繼續／投降／棋譜 all did). This guards the
// subset against new copy. On failure rerun `python scripts/subset-sarasa.py <Sarasa TTF dir>`.

const ROOT = resolve(__dirname, '../..')
// Chess glyphs (♔–♟) are not in Sarasa at all; the script reports them and they stay on fallback.
const NOT_IN_SARASA = /[♔-♟]/u

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sourceFiles(p)
    return /\.(vue|ts)$/.test(e.name) ? [p] : []
  })
}

describe('Sarasa UI TC subset coverage', () => {
  it('covers every non-ASCII character used in src/ and index.html', () => {
    const covered = new Set(readFileSync(join(ROOT, 'scripts/sarasa-ui-tc.chars.txt'), 'utf8'))
    const files = [...sourceFiles(join(ROOT, 'src')), join(ROOT, 'index.html')]
    const missing = new Set<string>()
    for (const file of files) {
      for (const ch of readFileSync(file, 'utf8')) {
        if (ch.codePointAt(0)! > 0x7f && !NOT_IN_SARASA.test(ch) && !/\s/u.test(ch) && !covered.has(ch)) missing.add(ch)
      }
    }
    expect([...missing].sort().join('')).toBe('')
  })

  // The service worker serves /fonts/ CacheFirst for a year; only a new URL makes old devices refetch.
  it('pins both font URLs to the current file hash', () => {
    const css = readFileSync(join(ROOT, 'src/assets/fonts.css'), 'utf8')
    for (const weight of ['400', '700']) {
      const name = `sarasa-ui-tc-${weight}.woff2`
      const digest = createHash('sha256').update(readFileSync(join(ROOT, 'public/fonts', name))).digest('hex').slice(0, 8)
      expect(css).toContain(`/fonts/${name}?v=${digest}'`)
    }
  })
})
