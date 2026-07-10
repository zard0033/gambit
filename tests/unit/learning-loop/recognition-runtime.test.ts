import { describe, expect, it } from 'vitest'
import { buildRecognitionSetFromSources } from '@/modules/learning-loop/recognition-runtime'
import type { MissedMateSource } from '@/modules/learning-loop/missed-mate'

const source = (ply: number, uci: string): MissedMateSource => ({
  gameId: 'g1',
  ply,
  fen: `FEN_${ply}`,
  mateMoveUci: uci,
  playerColor: 'white',
})

describe('buildRecognitionSetFromSources', () => {
  it('test_build_mapsEachSourceToRealBoardWithParsedExpectedMove', () => {
    const pending = [source(4, 'g5f7'), source(8, 'b1b8')]

    const set = buildRecognitionSetFromSources('mate', pending)

    expect(set).toBeDefined()
    expect(set!.conceptId).toBe('mate')
    expect(set!.boards).toHaveLength(2)
    expect(set!.boards.every((b) => b.kind === 'real')).toBe(true)
    expect(set!.boards[0]).toMatchObject({
      kind: 'real',
      fen: 'FEN_4',
      expectedMove: { from: 'g5', to: 'f7' },
    })
    expect(set!.boards[1].kind === 'real' && set!.boards[1].expectedMove).toEqual({ from: 'b1', to: 'b8' })
    // No decoy boards → the set carries only real positions.
    expect(set!.boards.some((b) => b.kind === 'decoy')).toBe(false)
  })

  it('test_build_carriesIntroPromptAndMissedHint', () => {
    const set = buildRecognitionSetFromSources('mate', [source(4, 'g5f7')])
    expect(set!.intro.length).toBeGreaterThan(0)
    expect(set!.prompt.length).toBeGreaterThan(0)
    expect(set!.missedHint.length).toBeGreaterThan(0)
  })

  it('test_build_emptyPending_returnsUndefined', () => {
    expect(buildRecognitionSetFromSources('mate', [])).toBeUndefined()
  })
})
