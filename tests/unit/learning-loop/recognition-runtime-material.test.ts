import { describe, expect, it } from 'vitest'
import { buildRecognitionSetFromSources } from '@/modules/learning-loop/recognition-runtime'
import type { MissedMaterialSource } from '@/modules/learning-loop/missed-material'

const source = (ply: number, uci: string): MissedMaterialSource => ({
  gameId: 'g1',
  ply,
  fen: `FEN_${ply}`,
  captureMoveUci: uci,
  playerColor: 'white',
})

describe('buildRecognitionSetFromSources — material', () => {
  it('test_build_material_mapsEachSourceToRealBoardWithParsedExpectedMove', () => {
    const pending = [source(4, 'c3d5'), source(8, 'f4e6')]

    const set = buildRecognitionSetFromSources('material', pending)

    expect(set).toBeDefined()
    expect(set!.conceptId).toBe('material')
    expect(set!.boards).toHaveLength(2)
    expect(set!.boards.every((b) => b.kind === 'real')).toBe(true)
    expect(set!.boards[0]).toMatchObject({
      kind: 'real',
      fen: 'FEN_4',
      expectedMove: { from: 'c3', to: 'd5' },
    })
    expect(set!.boards[1].kind === 'real' && set!.boards[1].expectedMove).toEqual({ from: 'f4', to: 'e6' })
  })

  it('test_build_material_carriesIntroPromptAndMissedHint', () => {
    const set = buildRecognitionSetFromSources('material', [source(4, 'c3d5')])
    expect(set!.intro.length).toBeGreaterThan(0)
    expect(set!.prompt.length).toBeGreaterThan(0)
    expect(set!.missedHint.length).toBeGreaterThan(0)
  })

  it('test_build_material_emptyPending_returnsUndefined', () => {
    expect(buildRecognitionSetFromSources('material', [])).toBeUndefined()
  })
})
