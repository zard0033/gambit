/**
 * S5-03: ADR-0007 OQ-5 spike — Stockfish depth-22 reachability
 *
 * HISTORICAL (2026-06-25): production lowered REVIEW_TARGET_DEPTH 22→16 for iPhone review-speed UX
 * (see ADR-0007 Status note / engine-tuning.ts). This spike's literal `22`/`10000` below are the
 * ORIGINAL target it measured — kept as the reachability record, not the current production values.
 *
 * Purpose: Determine if `REVIEW_TARGET_DEPTH = 22` is achievable within
 * `REVIEW_MAX_MOVE_TIME_MS = 10000` on the test machine.
 *
 * Platform note: Tests run on desktop Chromium (not real iPhone Safari).
 * WASM workers are NOT affected by DevTools CPU throttle — results represent
 * an unthrottled desktop baseline. Real-device iPhone testing remains advisory.
 *
 * Run: npx playwright test depth-22-spike --project=chromium
 * Excluded from default CI suite (@spike tag).
 */
import { test, expect, devices } from '@playwright/test'

// Spike requires WASM workers — only reliable on Chromium in CI headless
test.use({ ...devices['Desktop Chrome'] })

const REVIEW_TARGET_DEPTH = 22
const REVIEW_MAX_MOVE_TIME_MS = 10_000

const SPIKE_POSITIONS = [
  { label: 'Starting position', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  { label: 'Ruy Lopez after 3.Bb5', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
  { label: 'Middlegame (queens on board)', fen: 'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 9' },
]

type SpikeResult = {
  label: string
  fen: string
  depthReached: number
  elapsedMs: number
  reachedTarget: boolean
  withinBudget: boolean
}

test.describe('@spike depth-22 reachability (S5-03 / ADR-0007 OQ-5)', () => {
  test.setTimeout(120_000)

  test('NNUE depth-22 spike — desktop Chromium baseline', async ({ page }) => {
    await page.goto('/')

    const results: SpikeResult[] = await page.evaluate(
      async ({ positions, targetDepth, budgetMs }) => {
        const results: Array<{
          label: string
          fen: string
          depthReached: number
          elapsedMs: number
          reachedTarget: boolean
          withinBudget: boolean
        }> = []

        await new Promise<void>((resolveAll) => {
          const worker = new Worker('/stockfish/stockfish-nnue-16-single.js')
          let posIdx = 0
          let maxDepth = 0
          let posStart = 0
          let initialized = false

          const nextPosition = () => {
            if (posIdx >= positions.length) {
              worker.terminate()
              resolveAll()
              return
            }
            maxDepth = 0
            posStart = performance.now()
            worker.postMessage(`position fen ${positions[posIdx].fen}`)
            // Use movetime (same as REVIEW_MAX_MOVE_TIME_MS) — report what depth is reached in budget
            worker.postMessage(`go movetime ${budgetMs}`)
          }

          worker.onmessage = (e: MessageEvent) => {
            const line = String(e.data)

            if (!initialized) {
              if (line.includes('uciok')) {
                // Spike note: NNUE file (nn-5af11540bbfe.nnue) not deployed to public/stockfish/.
                // Review engine falls back to HCE in practice. Testing HCE mode here.
                worker.postMessage('setoption name Hash value 16')
                worker.postMessage('setoption name Threads value 1')
                worker.postMessage('isready')
              } else if (line.includes('readyok')) {
                initialized = true
                nextPosition()
              }
            } else {
              if (line.startsWith('info')) {
                const m = line.match(/\bdepth (\d+)/)
                if (m) maxDepth = Math.max(maxDepth, parseInt(m[1], 10))
              } else if (line.startsWith('bestmove')) {
                const elapsed = Math.round(performance.now() - posStart)
                results.push({
                  label: positions[posIdx].label,
                  fen: positions[posIdx].fen,
                  depthReached: maxDepth,
                  elapsedMs: elapsed,
                  reachedTarget: maxDepth >= targetDepth,
                  withinBudget: elapsed <= budgetMs,
                })
                posIdx++
                nextPosition()
              }
            }
          }

          worker.postMessage('uci')
        })

        return results
      },
      { positions: SPIKE_POSITIONS, targetDepth: REVIEW_TARGET_DEPTH, budgetMs: REVIEW_MAX_MOVE_TIME_MS },
    )

    // Print results table
    console.log('\n=== S5-03 Depth-22 Spike Results ===')
    console.log('Engine: Stockfish 16 NNUE (single-threaded WASM)')
    console.log('Platform: Desktop Chromium (not iPhone — WASM worker unthrottled)')
    console.log(`Target depth: ${REVIEW_TARGET_DEPTH} | Budget: ${REVIEW_MAX_MOVE_TIME_MS}ms\n`)

    for (const r of results) {
      const status = r.reachedTarget && r.withinBudget ? '✅ PASS' : r.reachedTarget ? '⚠️  SLOW' : '❌ FAIL'
      console.log(`${status}  ${r.label}`)
      console.log(`       depth ${r.depthReached} in ${r.elapsedMs}ms`)
    }

    const allReachedDepth = results.every((r) => r.reachedTarget)
    const allWithinBudget = results.every((r) => r.withinBudget)
    console.log(`\nAll reached depth ${REVIEW_TARGET_DEPTH}: ${allReachedDepth}`)
    console.log(`All within ${REVIEW_MAX_MOVE_TIME_MS}ms budget: ${allWithinBudget}`)

    // The spike is informational — we always pass the test itself,
    // but we assert results exist so they're captured in the report.
    expect(results).toHaveLength(SPIKE_POSITIONS.length)
    for (const r of results) {
      expect(r.depthReached).toBeGreaterThan(0)
    }
  })
})
