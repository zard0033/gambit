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

  mate: {
    conceptId: 'mate',
    // Kill types deliberately avoid K+Q vs K 逼角 (used by the silent gate + rules/endgame lessons —
    // CLAUDE.md 課程／試煉棋理護欄). real A = 悶殺 (smothered Nf7#, fresh across the dataset),
    // real B = 雙城堡爬樓梯 (Rb8#, the ladder taught in this deepening's step1, new position). decoy =
    // 底線假殺 refuted by the guarding rook (Rd8+ ...Rxd8). chess.js proof (scratchpad verify-mate.cjs):
    //   real A 6rk/6pp/8/6N1/8/8/8/6K1 — 11 legal, exactly 1 mate = g5f7 (Nf7#).
    //   real B 5k2/R7/8/8/8/8/8/1R2K3 — 29 legal, exactly 1 mate = b1b8 (Rb8#).
    //   decoy  r5k1/5ppp/8/8/8/8/8/3R2K1 — Rd8+ is a check (not mate); only reply ...Rxd8 captures on
    //          d8; white has ZERO mate-in-1 on the board. Stockfish uniqueness spike is the @spike gate.
    intro:
      '之前我指給你看、也讓你自己找過。這次不一樣——下面幾盤，有的一步就能將死，有的只是看起來像。',
    prompt: '這一盤能不能一步將死？',
    missedHint: '還有一手在等你。再看一眼這一盤——一步將死就藏在這裡。',
    boards: [
      // real A — smothered mate: Nf7# (Kg8 boxed by its own Rg8/g7/h7, knight untouchable).
      {
        kind: 'real',
        fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
        expectedMove: { from: 'g5', to: 'f7' },
        successText: '悶殺——國王被自己的城堡和兵堵得死死的，騎士一跳就無處可逃。自己人把王圍住時，最怕的就是騎士。',
      },
      // decoy — 底線假殺：Rd8+ looks like a back-rank mate (Kg8 shut in by f7/g7/h7) but the black
      // rook on a8 guards the back rank：...Rxd8 wins the rook. No white mate exists here (L1 noise a8/rook).
      {
        kind: 'decoy',
        fen: 'r5k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1',
        temptMove: { from: 'd1', to: 'd8' },
        refutation: { from: 'a8', to: 'd8' },
        emptyText:
          '對，這裡沒有。城堡切進底線看著像將死，可是牠那顆城堡守著底排——一將軍就被吃掉了。',
        trapText:
          '看起來像底線將殺，對吧？可是牠的城堡正守著底排。城堡一切進去，牠一個 Rxd8 就把牠吃回去，白丟一子。將死之前，先確認沒有子能吃掉你將軍的那一手。',
      },
      // real B — 雙城堡爬樓梯：Ra7 seals the 7th, Rb8# checks along the 8th (Kf8 caught between).
      {
        kind: 'real',
        fen: '5k2/R7/8/8/8/8/8/1R2K3 w - - 0 1',
        expectedMove: { from: 'b1', to: 'b8' },
        successText: '雙城堡爬樓梯——一個城堡封住旁邊那排、一個沿底線將軍，國王縮在邊上一格也逃不掉。',
      },
    ],
  },
}

/** Returns the recognition set for a concept, or `undefined` if it has no judgement field. */
export function getRecognitionSet(id: string): RecognitionSet | undefined {
  return recognitionSets[id as ChessConcept]
}
