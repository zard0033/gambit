#!/usr/bin/env node
/**
 * Batch sampler for the missed-material rule engine (signpost material offense v1).
 * Mirrors src/modules/learning-loop/missed-material.ts's decision logic in plain JS (chess.js only,
 * no engine) so an adversarial reviewer can bulk-check real games' FEN+bestMove pairs against the
 * six §4 rules WITHOUT importing the TS source (this script has no build step, node -r ok).
 *
 * Usage:
 *   node sample-missed-material.cjs <input.json>
 *
 * Input JSON: array of samples:
 *   {
 *     "id": "any label",
 *     "fen": "<FEN before the move under inspection, side to move = the player>",
 *     "bestMove": "<UCI, e.g. 'f4d5'>",
 *     "cpLoss": <number, optional — defaults to 9999 so geometry/uniqueness is what's under test>,
 *     "actualMove": "<UCI the player actually played, optional — defaults to something != bestMove>"
 *   }
 *
 * Output: one line per sample — COLLECT or SKIP + reason. Deterministic, no network, no engine.
 */
const fs = require('fs')
const REPO_ROOT = 'd:/Personal/Games/Gambit'
const { Chess } = require(REPO_ROOT + '/node_modules/chess.js')

const MISSED_MATERIAL_MIN_CP_GAIN = 300

function oppositeColor(c) {
  return c === 'w' ? 'b' : 'w'
}

/** Mirrors missed-material.ts::isUniqueSafeCapture. */
function isUniqueSafeCapture(fen, captureMoveUci) {
  const chess = new Chess(fen)
  const toSquare = captureMoveUci.slice(2, 4)
  const opponentColor = oppositeColor(chess.turn())

  const safeCaptures = chess
    .moves({ verbose: true })
    .filter((m) => m.to === toSquare && m.captured && !m.flags.includes('e'))
    .filter((m) => {
      const trial = new Chess(fen)
      trial.move({ from: m.from, to: m.to, promotion: m.promotion })
      return trial.attackers(toSquare, opponentColor).length === 0
    })

  if (safeCaptures.length !== 1) {
    return { unique: false, count: safeCaptures.length, candidates: safeCaptures.map((m) => `${m.from}${m.to}`) }
  }
  const only = safeCaptures[0]
  const matches = !only.promotion && `${only.from}${only.to}` === captureMoveUci
  return { unique: matches, count: 1, candidates: [`${only.from}${only.to}`] }
}

/** Mirrors missed-material.ts::selectMissedMaterial's per-position gate (single position, not a game loop). */
function evaluateOne(sample) {
  const { id, fen, bestMove, actualMove } = sample
  const cpLoss = sample.cpLoss ?? 9999
  const played = actualMove ?? (bestMove === 'a1a1' ? 'a1a2' : 'a1a1') // any != bestMove default

  if (!bestMove || bestMove.length === 5) {
    return { id, verdict: 'SKIP', reason: 'no bestMove, or promotion (v1 has no promotion field)' }
  }
  if (played === bestMove) {
    return { id, verdict: 'SKIP', reason: 'player already played bestMove — nothing missed' }
  }

  const pre = new Chess(fen)
  let opponentColor
  try {
    opponentColor = oppositeColor(pre.turn())
  } catch (e) {
    return { id, verdict: 'SKIP', reason: `illegal FEN: ${e.message}` }
  }
  const targetSquare = bestMove.slice(2, 4)

  // rule 3: captured piece had zero defenders BEFORE the capture
  const preDefenders = pre.attackers(targetSquare, opponentColor)
  if (preDefenders.length > 0) {
    return { id, verdict: 'SKIP', reason: `target square ${targetSquare} defended pre-capture by [${preDefenders.join(',')}]` }
  }

  // rule 2: bestMove is actually a capture (and not en-passant — target square logic breaks for ep)
  const applied = new Chess(fen)
  let mv
  try {
    mv = applied.move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4) })
  } catch (e) {
    return { id, verdict: 'SKIP', reason: `bestMove illegal on this FEN: ${e.message}` }
  }
  if (!mv.captured) {
    return { id, verdict: 'SKIP', reason: 'bestMove is not a capture' }
  }
  if (mv.flags.includes('e')) {
    return { id, verdict: 'SKIP', reason: 'en-passant capture — target-square geometry does not apply, excluded' }
  }

  // rule 4: cpLoss threshold
  if (cpLoss < MISSED_MATERIAL_MIN_CP_GAIN) {
    return { id, verdict: 'SKIP', reason: `cpLoss ${cpLoss} < MISSED_MATERIAL_MIN_CP_GAIN ${MISSED_MATERIAL_MIN_CP_GAIN}` }
  }

  // rule 5: unique safe capture
  const uniq = isUniqueSafeCapture(fen, bestMove)
  if (!uniq.unique) {
    return {
      id,
      verdict: 'SKIP',
      reason: `not a unique safe capture of ${targetSquare} — ${uniq.count} safe candidate(s): [${uniq.candidates.join(',')}]`,
    }
  }

  return { id, verdict: 'COLLECT', reason: `${bestMove} safely wins the piece on ${targetSquare}; cpLoss=${cpLoss}` }
}

function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error('Usage: node sample-missed-material.cjs <input.json>')
    process.exit(1)
  }
  const samples = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  const results = samples.map(evaluateOne)
  for (const r of results) {
    console.log(`[${r.verdict}] ${r.id} — ${r.reason}`)
  }
  const collected = results.filter((r) => r.verdict === 'COLLECT').length
  console.log(`\n${collected}/${results.length} collected`)
}

main()
