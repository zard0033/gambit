/**
 * Concept-deepening uniqueness gate — quick-specs/concept-deepening-page.md §12 gate ②.
 *
 * The unit content-gate (tests/unit/data/concept-deepening.test.ts) only proves each
 * expectedMove is LEGAL — never that it is the UNIQUE best move with no opponent refutation.
 * That is the 2026-06-21 假戰術 trap recorded in CLAUDE.md 棋理護欄 (chess.js 全綠卻被 Qe8/Kxd8
 * 反殺). Noise boards amplify it (the messier the board, the better a refutation hides), so this
 * gate must exist BEFORE any noise-board variant ships (§13 MINIMAL step ①).
 *
 * It drives Stockfish 18 Lite (MultiPV=2, movetime aligned to the iPhone ≤5s/position budget)
 * over every deepening variant's expectedMove and verdicts each:
 *   - tactic concepts: PV1 == expectedMove AND PV1−PV2 ≥ 200cp (no equally-good sibling line)
 *   - mate concept:    PV1 is mate-in-N == expectedMove AND PV2 is not a same/shorter mate
 *   - center/defense:  many equivalent moves by nature (opening choices; the four defensive tools
 *                      often tie) — weak rule only, flagged for manual review of the reported PV1
 *
 * Informational @spike (excluded from CI via playwright.config grepInvert). The report is the
 * signal: read it before committing any new variant. Run:
 *   npx playwright test concept-deepening-uniqueness --project=chromium --grep @spike
 *   CONCEPT=fork npx playwright test concept-deepening-uniqueness --project=chromium --grep @spike
 */
import { test, expect, devices } from '@playwright/test'
import { conceptDeepenings } from '../../src/data/concept-deepening'

test.use({ ...devices['Desktop Chrome'] })

const BUDGET_MS = 5_000
const UNIQUE_CP_GAP = 200

type Kind = 'tactic' | 'mate' | 'weak'
// center + defense are multi-solution by nature — uniqueness is the wrong gate (a defensive
// position routinely has several equally-good tools, e.g. escape-with-check vs escape-with-
// counterattack). Verdict REVIEW: the report still prints PV1 so it's a manual eyeball, not a pass.
const WEAK_RULE = new Set(['center', 'defense'])
const kindOf = (conceptId: string): Kind =>
  conceptId === 'mate' ? 'mate' : WEAK_RULE.has(conceptId) ? 'weak' : 'tactic'

type Target = { id: string; conceptId: string; fen: string; expected: string; kind: Kind }

const filterConcept = process.env.CONCEPT
const targets: Target[] = []
for (const d of Object.values(conceptDeepenings)) {
  if (filterConcept && d.conceptId !== filterConcept) continue
  d.steps.forEach((step, i) => {
    if (!step.expectedMove) return
    const m = step.expectedMove
    targets.push({
      id: `${d.conceptId}#${i}`,
      conceptId: d.conceptId,
      fen: step.fen,
      expected: `${m.from}${m.to}${m.promotion ?? ''}`,
      kind: kindOf(d.conceptId),
    })
  })
}

// Stockfish reports scores from the side-to-move POV (white here). mate → large signed cp:
// an ordering device for the tactic-branch gap only (the mate branch uses mateN(), not this).
function scoreCp(line: string | null): number | null {
  if (!line) return null
  const m = line.match(/score (cp|mate) (-?\d+)/)
  if (!m) return null
  if (m[1] === 'cp') return parseInt(m[2], 10)
  const n = parseInt(m[2], 10)
  return (n >= 0 ? 1 : -1) * (100_000 - Math.abs(n) * 100)
}
function mateN(line: string | null): number | null {
  const m = line?.match(/score mate (-?\d+)/)
  return m ? parseInt(m[1], 10) : null
}
function pvMove(line: string | null): string | null {
  const m = line?.match(/\bpv ([a-h][1-8][a-h][1-8][qrbn]?)/)
  return m ? m[1] : null
}

type Raw = { id: string; depth: number; mpv1: string | null; mpv2: string | null }

test.describe('@spike concept-deepening uniqueness gate', () => {
  test.setTimeout(Math.max(120_000, targets.length * (BUDGET_MS + 1_500) + 30_000))

  test('every deepening expectedMove is the clear best (MultiPV=2)', async ({ page }) => {
    await page.goto('/')

    const raw: Raw[] = await page.evaluate(
      async ({ targets, budgetMs }) => {
        const out: Raw[] = []
        await new Promise<void>((done) => {
          const worker = new Worker('/stockfish/stockfish-18-lite-single.js')
          let idx = 0
          let inited = false
          let depth = 0
          let mpv1: string | null = null
          let mpv2: string | null = null

          const next = () => {
            if (idx >= targets.length) {
              worker.terminate()
              done()
              return
            }
            depth = 0
            mpv1 = null
            mpv2 = null
            worker.postMessage(`position fen ${targets[idx].fen}`)
            worker.postMessage(`go movetime ${budgetMs}`)
          }

          worker.onmessage = (e: MessageEvent) => {
            const line = String(e.data)
            if (!inited) {
              if (line.includes('uciok')) {
                worker.postMessage('setoption name MultiPV value 2')
                worker.postMessage('setoption name Threads value 1')
                worker.postMessage('setoption name Hash value 16')
                worker.postMessage('isready')
              } else if (line.includes('readyok')) {
                inited = true
                next()
              }
              return
            }
            if (line.startsWith('info') && line.includes('multipv') && line.includes(' pv ')) {
              const dm = line.match(/\bdepth (\d+)/)
              if (dm) depth = Math.max(depth, parseInt(dm[1], 10))
              if (/multipv 1\b/.test(line)) mpv1 = line
              else if (/multipv 2\b/.test(line)) mpv2 = line
            } else if (line.startsWith('bestmove')) {
              out.push({ id: targets[idx].id, depth, mpv1, mpv2 })
              idx++
              next()
            }
          }
          worker.postMessage('uci')
        })
        return out
      },
      { targets: targets.map((t) => ({ id: t.id, fen: t.fen })), budgetMs: BUDGET_MS },
    )

    const byId = new Map(raw.map((r) => [r.id, r]))
    const rows = targets.map((t) => {
      const r = byId.get(t.id) ?? null
      const move = pvMove(r?.mpv1 ?? null)
      const cp1 = scoreCp(r?.mpv1 ?? null)
      const cp2 = scoreCp(r?.mpv2 ?? null)
      const moveOk = move === t.expected
      let verdict: 'PASS' | 'FAIL' | 'REVIEW' = 'PASS'
      let note = ''

      if (t.kind === 'weak') {
        verdict = 'REVIEW'
        note = `${t.conceptId} weak-rule, manual (pv1=${move ?? '?'}${moveOk ? ' ✓matches' : ''})`
      } else if (t.kind === 'mate') {
        const m1 = mateN(r?.mpv1 ?? null)
        const m2 = mateN(r?.mpv2 ?? null)
        if (!moveOk) { verdict = 'FAIL'; note = `pv1 ${move} ≠ ${t.expected}` }
        else if (!(m1 !== null && m1 > 0)) { verdict = 'FAIL'; note = `pv1 not a mate (cp ${cp1})` }
        else if (m2 !== null && m2 > 0 && m2 <= m1) { verdict = 'FAIL'; note = `pv2 also mate-in-${m2} (≤${m1}) — mate not unique` }
        else { note = `mate-in-${m1}` }
      } else {
        const gap = cp1 !== null && cp2 !== null ? cp1 - cp2 : null
        if (!moveOk) { verdict = 'FAIL'; note = `pv1 ${move} ≠ ${t.expected}` }
        else if (cp2 === null) { note = `unique (only line); cp1=${cp1}` }
        else if (gap !== null && gap < UNIQUE_CP_GAP) { verdict = 'FAIL'; note = `gap ${gap}cp < ${UNIQUE_CP_GAP} (pv2=${pvMove(r?.mpv2 ?? null)} ${cp2})` }
        else { note = `gap ${gap}cp` }
      }
      return { t, verdict, note, depth: r?.depth ?? 0 }
    })

    console.log('\n=== Concept-Deepening Uniqueness Gate (Stockfish 18 Lite, MultiPV=2) ===')
    console.log(`movetime ${BUDGET_MS}ms/pos | unique gap ≥ ${UNIQUE_CP_GAP}cp | ${rows.length} positions${filterConcept ? ` | CONCEPT=${filterConcept}` : ''}\n`)
    for (const row of rows) {
      const icon = row.verdict === 'PASS' ? '✅' : row.verdict === 'REVIEW' ? '🔎' : '❌'
      console.log(`${icon} ${row.verdict.padEnd(6)} ${row.t.id.padEnd(16)} expect ${row.t.expected.padEnd(6)} d${row.depth}  ${row.note}`)
    }
    const pass = rows.filter((r) => r.verdict === 'PASS').length
    const fail = rows.filter((r) => r.verdict === 'FAIL').length
    const review = rows.filter((r) => r.verdict === 'REVIEW').length
    console.log(`\nSUMMARY: ${pass} PASS / ${fail} FAIL / ${review} REVIEW (center/defense weak-rule)`)
    if (fail > 0) {
      console.log('⚠️  FAILs are informational here (existing data may be legitimately non-unique).')
      console.log('   For a NEW noise-board variant, a FAIL means: do NOT ship it — adjust the noise until it passes.')
    }

    // The spike itself only proves the engine actually analysed every target — the gate signal is the report above.
    expect(raw, 'engine returned fewer results than targets').toHaveLength(targets.length)
    for (const r of raw) expect(r.depth, `${r.id} got no engine depth`).toBeGreaterThan(0)
  })
})
