import { describe, expect, it } from 'vitest'
import { usePuzzle } from '@/modules/practice/use-puzzle'
import type { Puzzle } from '@/types/puzzle'

const singleMove: Puzzle = {
  id: 't-single', level: 1, order: 1, motif: 'capture',
  title: 't', prompt: 'p', brief: 'b',
  fen: '4k3/8/8/8/3q4/8/8/3RK3 w - - 0 1',
  solution: [{ from: 'd1', to: 'd4' }],
  hint: 'h', successText: 's',
}

const multiMove: Puzzle = {
  id: 't-multi', level: 2, order: 2, motif: 'fork',
  title: 't', prompt: 'p', brief: 'b',
  fen: '4k3/3r4/8/8/4N3/8/8/4K3 w - - 0 1',
  solution: [
    { from: 'e4', to: 'f6' },
    { from: 'e8', to: 'd8' },
    { from: 'f6', to: 'd7' },
  ],
  hint: 'h', successText: 's',
}

const mateAny: Puzzle = {
  id: 't-mate', level: 3, order: 3, motif: 'mate-in-1', acceptAnyMate: true,
  title: 't', prompt: 'p', brief: 'b',
  // White rooks a1/h1 + Ke1; black king h8 boxed by g7/h7. Ra8# mates along the 8th rank;
  // acceptAnyMate accepts it even though it differs from the authored line below.
  fen: '7k/6pp/8/8/8/8/8/R3K2R w - - 0 1',
  solution: [{ from: 'h1', to: 'h7' }], // authored line is arbitrary; acceptAnyMate widens it
  hint: 'h', successText: 's',
}

describe('usePuzzle — single-move', () => {
  it('test_correct_move_solves', () => {
    const p = usePuzzle(singleMove)
    const r = p.submitMove({ from: 'd1', to: 'd4' })
    expect(r.kind).toBe('correct-solved')
    expect(p.phase.value).toBe('solved')
  })

  it('test_wrong_legal_move_keeps_state', () => {
    const p = usePuzzle(singleMove)
    const r = p.submitMove({ from: 'e1', to: 'e2' }) // legal king move, off-line
    expect(r.kind).toBe('wrong')
    expect(p.phase.value).toBe('solving')
    expect(p.wrong.value).toBe(true)
    expect(p.plyIndex.value).toBe(0)
  })
})

describe('usePuzzle — multi-move', () => {
  it('test_ply_progression_advances_with_opponent_reply', () => {
    const p = usePuzzle(multiMove)

    const r1 = p.submitMove({ from: 'e4', to: 'f6' })
    expect(r1.kind).toBe('correct-advance')
    expect(p.awaitingOpponent.value).toBe(true)
    if (r1.kind === 'correct-advance') {
      expect(r1.opponentReply).toEqual({ from: 'e8', to: 'd8' })
    }

    p.commitOpponentReply()
    expect(p.awaitingOpponent.value).toBe(false)
    expect(p.plyIndex.value).toBe(2)

    const r2 = p.submitMove({ from: 'f6', to: 'd7' })
    expect(r2.kind).toBe('correct-solved')
    expect(p.phase.value).toBe('solved')
  })

  it('test_wrong_first_move_does_not_advance', () => {
    const p = usePuzzle(multiMove)
    const r = p.submitMove({ from: 'e4', to: 'g5' }) // legal knight move, wrong square
    expect(r.kind).toBe('wrong')
    expect(p.plyIndex.value).toBe(0)
    expect(p.awaitingOpponent.value).toBe(false)
  })

  it('test_input_locked_while_awaiting_opponent', () => {
    const p = usePuzzle(multiMove)
    p.submitMove({ from: 'e4', to: 'f6' })
    // Player tries to move again before the opponent reply commits.
    const r = p.submitMove({ from: 'f6', to: 'd7' })
    expect(r.kind).toBe('wrong')
    expect(p.plyIndex.value).toBe(0)
  })
})

describe('usePuzzle — acceptAnyMate', () => {
  it('test_any_mating_move_accepted', () => {
    const p = usePuzzle(mateAny)
    // Ra8# is a different move from the authored line (h1h7) but still mate.
    const r = p.submitMove({ from: 'a1', to: 'a8' })
    expect(r.kind).toBe('correct-solved')
  })

  it('test_non_mating_move_rejected_even_if_legal', () => {
    const p = usePuzzle(mateAny)
    const r = p.submitMove({ from: 'a1', to: 'a4' }) // legal, not mate
    expect(r.kind).toBe('wrong')
  })
})
