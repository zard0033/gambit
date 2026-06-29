import type { ChessConcept } from '../../types/concept'
import type { RecognitionSet } from '../../types/recognition'

/**
 * Recognition-gate catalog (quick-specs/concept-deepening-page.md §15). One entry per concept that
 * has a judgement field. MINIMAL scope = fork only; other concepts keep the single-board silent
 * gate (no entry here). All boards passed the three gates 2026-06-26 (chess.js → Stockfish → two
 * independent adversarial reviews); verification numbers live in spec §15.8.
 *
 * `Partial<Record<…>>` keeps this additive: a concept without a recognition set simply has no key.
 */
export const recognitionSets: Partial<Record<ChessConcept, RecognitionSet>> = {
  fork: {
    conceptId: 'fork',
    intro:
      '之前我指給你看、也讓你自己找過。這次不一樣——下面幾盤，有的藏著捉雙，有的什麼也沒有。',
    prompt: '這一盤有沒有捉雙？',
    missedHint: '還有一手在等你。再看一眼這一盤——捉雙就藏在這裡。',
    boards: [
      // real A — Ne5+ forks Kg6 + Rc6 (gap 1005cp). g7/f7-style noise: a5/b5/h7 pawns (L1).
      {
        kind: 'real',
        fen: '8/7p/2r3k1/pp6/7P/5N2/P5P1/4K3 w - - 0 1',
        expectedMove: { from: 'f3', to: 'e5' },
        successText: '將軍捉雙——對手忙著救王，下一步城堡就是你的。',
      },
      // decoy — Nf6+ "looks" like a royal fork (Kg8 + Rd5) but the g7 pawn (hidden in f7/g7/h7)
      // guards f6: ...gxf6 wins the knight. PV1 is a quiet move; no white tactic exists (L1).
      {
        kind: 'decoy',
        fen: '6k1/5ppp/8/3r4/4N3/5P2/P6P/4K3 w - - 0 1',
        temptMove: { from: 'e4', to: 'f6' },
        refutation: { from: 'g7', to: 'f6' },
        emptyText:
          '對，這裡沒有。騎士看似能跳 f6 同時碰王和城堡——但 g7 的兵守著那一格，你沒上當。',
        trapText:
          '看起來像皇家捉雙，對吧？可是 g7 的兵守著 f6。騎士一跳，他一個 gxf6 就把牠吃了，城堡安然無事——你反而白丟一隻騎士。捉雙之前，先看落點有沒有人守。',
      },
      // real B — Ne7+ forks Kg8 + Qc8 (gap 703cp). Noise: a7/g7/h7 + a2/g2/h2 pawns (L1).
      {
        kind: 'real',
        fen: '2q3k1/p5pp/8/3N4/8/8/P5PP/4K3 w - - 0 1',
        expectedMove: { from: 'd5', to: 'e7' },
        successText: '騎士一跳，將軍王、又叉著后，對手只能救一個。',
      },
    ],
  },
}

/** Returns the recognition set for a concept, or `undefined` if it has no judgement field. */
export function getRecognitionSet(id: string): RecognitionSet | undefined {
  return recognitionSets[id as ChessConcept]
}
