import { describe, it, expect } from 'vitest'
import { momentEndState, momentFrames } from '@/modules/memory/choreography'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('momentEndState — reduced-motion / skip target loses no information (AC-9 / EC-5)', () => {
  it('test_endState_mistake_showsBothPlayedAndBetterSimultaneously', () => {
    // A mistake's static end-state must carry BOTH halves on the pre-move board.
    const end = momentEndState({ preMoveFen: START, playedUci: 'e2e4', bestUci: 'd2d4' })

    expect(end.fen).toBe(START) // pre-move board, both moves shown at once
    const playedHi = end.annotations.find((a) => a.kind === 'highlight' && a.role === 'playedMove')
    const betterHi = end.annotations.find((a) => a.kind === 'highlight' && a.role === 'keySquare')
    expect(playedHi).toMatchObject({ square: 'e4' })
    expect(betterHi).toMatchObject({ square: 'd4' })
    // both present simultaneously
    expect(playedHi && betterHi).toBeTruthy()
  })

  it('test_endState_goodMove_showsPlayedThenProvokedReply', () => {
    // A good move (no better move) shows the post-reply board with played (gold) + reply (threat).
    const end = momentEndState({ preMoveFen: START, playedUci: 'e2e4', bestUci: null, replyUci: 'e7e5' })

    expect(end.fen).not.toBe(START) // advanced past the played move + the reply
    expect(end.annotations.some((a) => a.kind === 'arrow' && a.role === 'keySquare' && a.to === 'e4')).toBe(true)
    expect(end.annotations.some((a) => a.kind === 'arrow' && a.role === 'threat' && a.to === 'e5')).toBe(true)
  })
})

describe('momentFrames — the animation path ends on the end-state', () => {
  it('test_frames_lastFrameEqualsEndState', () => {
    const input = { preMoveFen: START, playedUci: 'e2e4', bestUci: 'd2d4' }
    const frames = momentFrames(input, { prePause: 650, moveDuration: 380, readPause: 700, backPause: 520 })
    const end = momentEndState(input)
    expect(frames[0].fen).toBe(START) // starts on the pre-move board
    expect(frames[frames.length - 1]).toMatchObject({ fen: end.fen, annotations: end.annotations })
  })
})
