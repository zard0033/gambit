import type { ChessConcept } from '../../types/concept'
import type { ConceptDeepening } from '../../types/concept-deepening'

/**
 * Concept deepening catalog (quick-specs/concept-deepening-page.md §2.2 + §10–§13).
 * One entry per concept — the `Record<ChessConcept, …>` makes adding a concept without deepening
 * content a compile error. Each concept has a `variants` pool of full 3-step Neve-收手 triplets
 * (step 0 she shows → step 1 she only asks → step 2 silence); active variant selected
 * deterministically via `deepenedCount % variants.length`. All single-concept entries use
 * `variants.length === 1` (degenerate, zero-breaking migration from old `steps` shape).
 * Clean-room; all FENs carry both kings; chess.js validity + mate claims enforced by
 * tests/unit/data/concept-deepening.test.ts. New variants must pass all 3 gates before commit:
 * chess.js → Stockfish uniqueness spike → adversarial chess review.
 */
export const conceptDeepenings: Record<ChessConcept, ConceptDeepening> = {
  material: {
    conceptId: 'material',
    title: '子力 · 深化',
    intro: '子力的深化不在算分數，在養成一雙眼睛：每步落子前，先掃對手有沒有「沒人保護」的子。',
    essence: '子力的精髓：落子前先掃一遍——對手哪顆子沒人守？看見它，便宜就是你的。',
    variants: [
      [
        {
          fen: '4k3/1b6/8/8/8/8/8/1R2K3 w - - 0 1',
          text: '先養那雙眼睛：黑方有一顆子沒人守著。找到它，收下來。',
          highlights: ['b7'],
          arrows: [{ orig: 'b1', dest: 'b7' }],
          expectedMove: { from: 'b1', to: 'b7' },
          hint: '順著 b 線往上。沒被保護的子，就是免費的。',
          successText: '免費一個主教。沒人保護的子，就是棋盤上的免費午餐。',
        },
        {
          fen: '4k3/8/2p5/3r4/8/4N3/8/4K3 w - - 0 1',
          text: '這次它有兵守著——但守它的子，會不會比它便宜？划算的交換，也是賺。',
          highlights: ['d5'],
          arrows: [{ orig: 'e3', dest: 'd5' }],
          expectedMove: { from: 'e3', to: 'd5' },
          hint: '騎士（3）換城堡（5）：就算對手用兵吃回騎士，你仍淨賺。',
          successText: '用騎士換到城堡——就算被兵吃回，你還是多賺了子力。小子換大子，幾乎永遠划算。',
        },
        {
          fen: '4k3/8/8/8/2q5/4N3/8/4K3 w - - 0 1',
          text: '這一個，我不說了。盤上有顆子沒人守——自己找找看。',
          highlights: [],
          arrows: [{ orig: 'e3', dest: 'c4' }],
          expectedMove: { from: 'e3', to: 'c4' },
          hint: '騎士走 L 形，想想哪一步能踏上那顆沒人守的子。',
          successText: '騎士白吃一個后，這盤大概就定了。沒人守的子，你自己看出來了。',
        },
      ],
    ],
  },

  fork: {
    conceptId: 'fork',
    title: '捉雙 · 深化',
    intro: '捉雙的深化，是在更亂的盤面第一眼看出那個「一石二鳥」的落點。',
    essence: '捉雙的精髓：一個落點，兩個威脅，對手只能救一個。',
    variants: [
      // Two-step lead-in only (step0 she shows → step1 she only asks). The third step is now the
      // Recognition Gate (data/concept-deepening/recognition.ts), a silent 3-board judgement field —
      // it replaces the old silent single board AND the noise-board variant pool (spec §15.2).
      [
        {
          fen: '2q1k3/8/8/8/4N3/8/8/4K3 w - - 0 1',
          text: '捉雙＝一個落點同時碰兩顆子。先看王和后——有一格能一次將軍王、又叉到后。',
          highlights: ['e8', 'c8'],
          arrows: [
            { orig: 'e4', dest: 'd6' },
            { orig: 'd6', dest: 'e8' },
            { orig: 'd6', dest: 'c8' },
          ],
          expectedMove: { from: 'e4', to: 'd6' },
          hint: '找騎士能跳到、且同時搆到 e8 和 c8 的那一格。',
          successText: '將軍捉雙（皇家捉雙）：對手忙著救王，你下一步就吃后。',
        },
        {
          fen: 'r5k1/8/8/8/8/8/8/3QK3 w - - 0 1',
          text: '換你看：他的王和城堡站得開——有沒有一格，能用兩條斜線同時搆到？',
          highlights: ['g8', 'a8'],
          arrows: [
            { orig: 'd1', dest: 'd5' },
            { orig: 'd5', dest: 'g8' },
            { orig: 'd5', dest: 'a8' },
          ],
          expectedMove: { from: 'd1', to: 'd5' },
          hint: '找一個同時對著 g8 和 a8 兩條斜線的落點。',
          successText: '后的捉雙靠長射程：一個落點、兩條斜線。將軍逼王讓開，城堡就到手。',
        },
      ],
    ],
  },

  pin: {
    conceptId: 'pin',
    title: '牽制 · 深化',
    intro: '牽制的深化：認得釘子只是第一步。真正賺子力，是「先釘住，再多派一個子把它吃掉」。',
    essence: '牽制的精髓：先把它釘死，動不了的子等於消失——再多派一個子收下。',
    variants: [
      [
        {
          fen: '4k3/8/8/4n3/3P4/8/8/4R1K1 w - - 0 1',
          text: '牽制＝釘住對手一顆子，讓它動不了。黑騎士 e5 被釘在王前面，一步都跑不掉。被釘死的子等於消失，現在收下它。',
          highlights: ['e5'],
          arrows: [{ orig: 'd4', dest: 'e5' }],
          expectedMove: { from: 'd4', to: 'e5' },
          hint: '你的 d4 兵斜吃得到 e5。釘住的騎士跑不掉。',
          successText: '釘住、再吃掉——這才是牽制的完整用法：先凍結它，再用便宜的子收下。',
        },
        {
          fen: 'k7/8/8/q7/8/8/8/R5K1 w - - 0 1',
          text: '換你看：黑后 a5、黑王 a8 疊在 a 線上，后被釘住、王又離得太遠。這顆釘死的后，誰來收？',
          highlights: ['a5'],
          arrows: [{ orig: 'a1', dest: 'a5' }],
          expectedMove: { from: 'a1', to: 'a5' },
          hint: '城堡沿 a 線吃后。王在 a8，搆不到 a5。',
          successText: '釘在線上、又沒後援的子，直接吃掉就好。牽制的極致：對手連換子的機會都沒有。',
        },
        {
          fen: '3k4/8/8/3n4/2P5/8/8/3RK3 w - - 0 1',
          text: '這一個，我不說了。他有顆子被釘在王前面，一步也動不了——被釘死的子等於消失，自己找找看誰來收下它。',
          highlights: [],
          arrows: [{ orig: 'c4', dest: 'd5' }],
          expectedMove: { from: 'c4', to: 'd5' },
          hint: '你的 c4 兵斜吃得到 d5 的騎士。它被釘在王前面，跑不掉。',
          successText: '釘住、再吃掉——被釘在王前面的子動彈不得，用便宜的兵收下它就好。',
        },
      ],
    ],
  },

  mate: {
    conceptId: 'mate',
    title: '將殺 · 深化',
    intro: '將殺的深化，是把「將死」從碰運氣變成看得出來的圖案：底線殺、雙城堡爬樓梯、后王逼角。',
    essence: '將殺的精髓：不是算殺幾步，是看見王沒有一格能逃的那一刻。',
    variants: [
      [
        {
          fen: '6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1',
          text: '底線殺：黑王被自己的兵悶在底線，f7 g7 h7 把往前的逃路全堵死了。城堡有一條空線直通他的底線。',
          highlights: ['g8'],
          arrows: [{ orig: 'd1', dest: 'd8' }],
          expectedMove: { from: 'd1', to: 'd8' },
          hint: '把城堡開到第 8 排將軍。王往前逃的路被自己的兵堵死了。',
          successText: '底線將殺：王被自己的兵關住，城堡一將就死。看到對手底線沒「透氣孔」，就找城堡或后攻底線。',
        },
        {
          fen: '4k3/R7/8/8/8/8/8/4K2R w - - 0 1',
          text: '換你收：a7 的城堡已經封死整條第 7 排，王退不下來。另一個城堡還閒著——它能不能上去把最後一排也封了？',
          highlights: ['e8'],
          arrows: [{ orig: 'h1', dest: 'h8' }],
          expectedMove: { from: 'h1', to: 'h8' },
          hint: '把 h1 城堡開到第 8 排。第 7 排被 a7 封住，王無路可逃。',
          successText: '雙城堡「爬樓梯」：一個封排、一個將軍，輪流把王逼到邊線。殘局最可靠的殺法。',
        },
        {
          // 2026-07-03 換盤：原王翼盤（Qg7#）與試煉 l1-support-mate 逐字同盤——玩家先在試煉解過、
          // 沉默關變成背答案，稀釋 epiphany。改盤兩輪：第一輪鏡到 a8 角被對抗審查否決（rules.ts
          // 的 special-rules/rules-capstone 已用 Kc6+Qb7# 教過兩次）。定案＝h1 角（全資料集
          // K+Q vs K 窮舉掃描唯一零使用的角落）：同殺型（后貼臉、王撐腰）、把王逼到棋盤下方。
          // chess.js 窮舉 28 走法唯一 mate-in-1 = Qg2；Stockfish 唯一解閘門另驗。
          fen: '6Q1/8/8/8/8/5K2/8/7k w - - 0 1',
          text: '這一個，我不說了。王已縮在角落，你的王罩住了他僅剩的逃生格——后只差貼上去那一步。',
          highlights: [],
          arrows: [{ orig: 'g8', dest: 'g2' }],
          expectedMove: { from: 'g8', to: 'g2' },
          hint: '把后沿直線俯衝到 g2 將軍——你的王 f3 罩著它，黑王吃不掉，逃生格也全被封。',
          successText: '后+王的基本殺：后將軍、王保護后並封逃生格。記住后不能單獨將殺，一定要王來幫忙。',
        },
      ],
    ],
  },

  skewer: {
    conceptId: 'skewer',
    title: '串擊 · 深化',
    intro: '串擊的深化：牽制的雙胞胎，差別在「前面大、後面小」。練習把對手最值錢的子逼到前面當盾牌。',
    essence: '串擊的精髓：大子在前、值錢的子在後、連成一線——將軍前面的，逼牠讓開，後面的就到手。',
    variants: [
      [
        {
          fen: '8/8/8/q3k3/8/8/8/6KR w - - 0 1',
          text: '串擊＝大子在前、值錢的子在後、連成一線。先看這條橫排：黑王、黑后排在同一線上，前面那顆最值錢、躲不過將軍。',
          highlights: ['e5', 'a5'],
          arrows: [{ orig: 'h1', dest: 'h5' }],
          expectedMove: { from: 'h1', to: 'h5' },
          hint: '從橫排的右端用城堡將軍黑王，逼牠讓開，後面的后就暴露了。',
          successText: '串擊：王被將軍只能讓開橫排，你再吃掉它身後的后。和牽制反過來——串擊是前面大。',
        },
        {
          fen: '8/1q6/8/8/4k3/8/8/4KB2 w - - 0 1',
          text: '換你看：黑王、黑后這次連在一條斜線上，王在前。哪個子能擺上這條斜線，正面將軍那顆大的？',
          highlights: ['e4', 'b7'],
          arrows: [{ orig: 'f1', dest: 'g2' }],
          expectedMove: { from: 'f1', to: 'g2' },
          hint: '主教走到 g2 這條斜線將軍黑王，王一讓開，後面的后就保不住了。',
          successText: '主教也能串擊——關鍵永遠是「大子在前、值錢的子在後、連成一線」。',
        },
        {
          fen: '8/3q4/8/8/3k4/8/8/R3K3 w - - 0 1',
          text: '這一個，我不說了。直行上也有「前大後小、連成一線」。',
          highlights: [],
          arrows: [{ orig: 'a1', dest: 'd1' }],
          expectedMove: { from: 'a1', to: 'd1' },
          hint: '把城堡擺到 d 行底端將軍黑王，王一閃，后就暴露。',
          successText: '橫的、斜的、直的，圖案都一樣：王在前、后在後、連成一線。',
        },
      ],
    ],
  },

  discovered: {
    conceptId: 'discovered',
    title: '閃擊 · 深化',
    intro: '閃擊的深化：移開一個子，露出後面子力的攻擊。最強的是閃將與雙將——對手被迫解將，你移開的子順手撈一個。',
    essence: '閃擊的精髓：移開卡在攻擊線上的自己人，後面那顆子的威脅就現身了。',
    variants: [
      [
        {
          fen: '4k3/8/2q5/4N3/8/8/8/4R1K1 w - - 0 1',
          text: '這是閃將：你的城堡 e1 和黑王 e8 之間，卡著自己的騎士；黑后落單在 c6。看那條被堵住的 e 線，再看那顆沒人守的后。',
          highlights: ['e8', 'c6'],
          arrows: [
            { orig: 'e5', dest: 'c6' },
            { orig: 'e1', dest: 'e8' },
          ],
          expectedMove: { from: 'e5', to: 'c6' },
          hint: '騎士跳去吃 c6 的后，同時打開 e 線將軍。對手忙著解將，沒空管被吃的后。',
          successText: '閃將+吃子：移開的騎士自己賺一個后，後面的城堡又將軍。一步做兩件事——閃擊的精髓。',
        },
        {
          fen: 'q3k3/8/4N3/8/8/8/8/4R1K1 w - - 0 1',
          text: '黑后 a8、黑王 e8。你的騎士擋在 e 線城堡前——有沒有一步，能讓騎士自己將軍、同時讓開 e 線露出城堡，順手又叉上那顆后？',
          highlights: ['e8', 'a8'],
          arrows: [
            { orig: 'e6', dest: 'c7' },
            { orig: 'e1', dest: 'e8' },
            { orig: 'c7', dest: 'a8' },
          ],
          expectedMove: { from: 'e6', to: 'c7' },
          hint: '騎士跳到 c7：它將軍王（c7→e8），又讓開 e 線露出城堡＝雙將，而且 c7 正叉著 a8 的后。',
          successText: '雙將：兩個子同時將軍，王只能移動、不能擋也不能吃。王一逃，你就吃掉 a8 的后。',
        },
        {
          fen: '4k3/8/8/6b1/4N3/8/8/4R1K1 w - - 0 1',
          text: '這一個，我不說了。盤上有顆你的子，正擋在自己後面那記攻擊的前頭——移開它，看能不能順手再做一件事。',
          highlights: [],
          arrows: [
            { orig: 'e4', dest: 'g5' },
            { orig: 'e1', dest: 'e8' },
          ],
          expectedMove: { from: 'e4', to: 'g5' },
          hint: '騎士吃 g5 的主教，順便讓開 e 線、露出城堡將軍。',
          successText: '你看出來了——卡在攻擊線上的自己人，常是閃擊的引信。每次問：移開它能不能順便將軍或吃子？',
        },
      ],
    ],
  },

  defense: {
    conceptId: 'defense',
    title: '保護 · 深化',
    intro: '保護的深化：被攻擊時別慌，把四招（吃攻擊者／加防守者／反擊／移開）掃一遍，挑損失最小的。',
    essence: '保護的精髓：被攻擊先別逃——把四招掃一遍，挑損失最小的那一招。',
    variants: [
      [
        {
          fen: '4k3/8/8/8/3n4/2P2R2/8/4K3 w - - 0 1',
          text: '黑騎士 d4 正攻擊你 f3 的城堡。被攻擊時有四招：吃攻擊者、加防守者、反擊、移開。先掃最乾脆的——這個攻擊者，你有子搆得到嗎？',
          highlights: ['d4', 'f3'],
          arrows: [{ orig: 'c3', dest: 'd4' }],
          expectedMove: { from: 'c3', to: 'd4' },
          hint: '你的 c3 兵斜吃得到 d4 的騎士嗎？用小兵換騎士很划算。',
          successText: '威脅來源直接消失，還用兵賺了騎士。能吃掉攻擊者，通常就是最好的答案。',
        },
        {
          fen: '3r2k1/8/8/8/3N4/8/8/2BK4 w - - 0 1',
          text: '黑城堡 d8 沿 d 線盯著你的騎士 d4，騎士背後正是你的王——它一讓開，城堡就將軍，等於被釘死、跑不掉；你也沒有子搆得到城堡。吃不掉、逃不了，第二招呢？',
          highlights: ['d8', 'd4'],
          arrows: [{ orig: 'c1', dest: 'e3' }],
          expectedMove: { from: 'c1', to: 'e3' },
          hint: '幫騎士找後盾。主教走哪一步能保護 d4？這樣對手吃騎士，你就用主教吃回更值錢的城堡。',
          successText: '加一個防守者：對手若吃騎士，你用主教換到更值錢的城堡——他反而虧。逃不了的子，補個後盾一樣守得住。',
        },
        {
          fen: '1k5b/8/8/4R3/8/8/8/4K3 w - - 0 1',
          text: '這一個，我不說了。你的城堡被主教盯上，又沒人守著——逃是唯一的活路。但盤上藏著一手：逃的同時將一軍，等黑王讓開，城堡轉頭就能吃下主教。',
          highlights: [],
          arrows: [
            { orig: 'e5', dest: 'e8' },
            { orig: 'e8', dest: 'b8' },
            { orig: 'e8', dest: 'h8' },
          ],
          expectedMove: { from: 'e5', to: 'e8' },
          hint: '城堡跳上底排：一頭將軍黑王、另一頭正對著主教。黑王被將只能讓開，城堡轉頭就吃下主教。',
          successText: '逃得漂亮：城堡閃開主教、跳上底排同時將軍，又盯住它身後的主教。黑王一讓開，城堡回頭就收下它。被攻擊時冷靜掃四招——最穩的一招，有時是逃的同時順手反將一軍。',
        },
      ],
    ],
  },

  center: {
    conceptId: 'center',
    title: '控制中心 · 深化',
    intro: '控制中心的深化：開局的隱形戰場。每一步問——這步有沒有幫我佔住或攻擊中央四格（d4 e4 d5 e5）？',
    essence: '控制中心的精髓：開局每一步都先問一句——這步有沒有佔住或攻擊中央那四格？',
    variants: [
      [
        {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          text: '開局的隱形戰場在中央那四格。你的兵裡，有一支推出去就能站上中心、又替後面的子讓開路。',
          highlights: ['e4', 'd5'],
          arrows: [{ orig: 'e2', dest: 'e4' }],
          expectedMove: { from: 'e2', to: 'e4' },
          hint: '把王前面的兵推兩格——它站上中央、控制 d5 和 f5，還放出你的主教。',
          successText: '1.e4——一步佔中央、開主教、開后的斜線。中央的兵像兩支矛，限制對手的子能去哪。',
        },
        {
          fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
          text: '中央站穩了，子力也該往中間走。你的騎士還在角落——它跳去哪，既指著中央、又壓上對方那支 e5 的兵？',
          highlights: ['f3', 'e5'],
          arrows: [{ orig: 'g1', dest: 'f3' }],
          expectedMove: { from: 'g1', to: 'f3' },
          hint: '騎士跳 f3：攻擊 e5、控制中央，還替易位鋪路。別往 h3 那種邊角跳。',
          successText: 'Nf3——騎士指向中央、攻擊 e5、準備易位。原則：騎士往中間發展，站在邊線力量最弱。',
        },
        {
          fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
          text: '這一個，我不說了。你已經佔住中央，現在輪到去爭對手的——想想哪一步爭中央。',
          highlights: [],
          arrows: [{ orig: 'd2', dest: 'd4' }],
          expectedMove: { from: 'd2', to: 'd4' },
          hint: '推 d 兵兩格到 d4，直接攻擊 e5。對手若 exd4，你會搶得發展先機。',
          successText: 'd4！——挑戰並打開中央。控制中心不只站著，還要主動爭奪。',
        },
      ],
    ],
  },
}

/** Returns the deepening for a concept, or `undefined` if the id is not a known concept. */
export function getConceptDeepening(id: string): ConceptDeepening | undefined {
  return (conceptDeepenings as Record<string, ConceptDeepening>)[id]
}
