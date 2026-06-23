import type { Lesson } from '../../types/lesson'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'
const AFTER_NF3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'

/**
 * Tier 3 (opening) seed — Control the Center.
 * Occupy the center with a pawn, then develop a knight that attacks it.
 * Neve's method: scenario + Socratic hints (the move arrow is the opt-in reveal).
 */
export const controlTheCenter: Lesson = {
  id: 'control-the-center',
  concepts: ['center'],
  title: '控制中心',
  category: 'opening-principles',
  difficulty: 'beginner',
  tier: 3,
  order: 15,
  summary: '開局的第一原則：用兵佔據中心，再讓子力攻向中心。',
  scenario: '棋局剛開始，整盤都還沒動。你要爭的是什麼？答案幾乎永遠是中心。',
  objectives: ['理解中心格 e4/d4/e5/d5 的重要性', '練習用 e4 佔據中心', '練習用騎士發展並施壓中心'],
  playerColor: 'white',
  steps: [
    {
      fen: START,
      text: '棋盤正中央的四個格子 e4、d4、e5、d5 是兵家必爭之地。佔據中心的一方，子力能伸展到更多地方、攻守都更靈活。',
      highlights: ['e4', 'd4', 'e5', 'd5'],
    },
    {
      fen: START,
      text: '走出第一步，往中心插旗。哪個兵能一步踏進那四格之一？',
      arrows: [{ orig: 'e2', dest: 'e4' }],
      expectedMove: { from: 'e2', to: 'e4' },
      hint: '你想佔據的是 e4/d4 這類中心格。哪個兵第一步就能直接站上中心？（別忘了兵的第一步能走兩格。）',
      successText: '白兵牢牢站在中心，後面的子力也有了出路。',
    },
    {
      fen: AFTER_E4_E5,
      text: '黑方也用 e5 來搶中心，雙方各佔一格。現在不要貪心再推兵——該把睡著的子力叫醒了。',
    },
    {
      fen: AFTER_E4_E5,
      text: '發展一個子，最好是「出子的同時還能施壓中心」的那一步。',
      arrows: [{ orig: 'g1', dest: 'f3' }],
      expectedMove: { from: 'g1', to: 'f3' },
      hint: '找一個還沒動過的騎士，讓它跳到既能出來參戰、又順手攻擊黑方 e5 中心兵的位置。',
      successText: '騎士一步兩用：發展了子力，又對黑方的中心兵施壓。',
    },
    {
      fen: AFTER_NF3,
      text: '記住開局的節奏：先佔中心、再快速出子。別在開局就到處推兵或亂跑同一個子。',
    },
  ],
}
