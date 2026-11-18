import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// The self-hosted Sarasa UI TC files are subsets. A character missing from them silently renders
// in a system font next to Sarasa glyphs (2026-11: 首頁／繼續／投降／棋譜 all did). This guards the
// subset against new copy. On failure rerun `python scripts/subset-sarasa.py <Sarasa TTF dir>`.

const ROOT = resolve(__dirname, '../..')
const HAN = /[一-鿿]/u

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sourceFiles(p)
    return /\.(vue|ts)$/.test(e.name) ? [p] : []
  })
}

describe('Sarasa UI TC subset coverage', () => {
  it('covers every Han character used in src/', () => {
    const covered = new Set(readFileSync(join(ROOT, 'scripts/sarasa-ui-tc.chars.txt'), 'utf8'))
    const missing = new Set<string>()
    for (const file of sourceFiles(join(ROOT, 'src'))) {
      for (const ch of readFileSync(file, 'utf8')) {
        if (HAN.test(ch) && !covered.has(ch)) missing.add(ch)
      }
    }
    expect([...missing].sort().join('')).toBe('')
  })
})
