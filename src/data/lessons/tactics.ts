import type { Lesson } from '../../types/lesson'

/**
 * Tier 2 — 基本戰術 (tactics).
 * Neve's method: each lesson opens with a `scenario`, every interactive step poses
 * the idea as a question and its `hint` is Socratic (goal / what-to-avoid, never the
 * move — the move arrow is the opt-in stage-2 reveal). successText states the
 * transferable principle; later lessons recall earlier tactics by name. Clean-room;
 * all FENs carry both kings (chess.js); validity enforced by lessons.test.ts.
 */

const fork: Lesson = {
  id: 'fork',
  concepts: ['fork'],
  title: '捉雙 (fork)',
  category: 'tactics',
  difficulty: 'beginner',
  tier: 2,
  order: 9,
  summary: '一個子同時攻擊兩個目標，對手只能救一個。',
  scenario: '你跟對手子力相等，誰也不讓誰。但棋盤上藏著一個機會——有沒有辦法「一次攻擊兩顆子」，讓對手顧此失彼？',
  objectives: ['認得捉雙：一子攻兩子', '知道騎士的捉雙最難防（不能被擋）', '知道兵也能捉雙'],
  playerColor: 'white',
  steps: [
    {
      fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1',
      text: '先看清楚整個盤面：黑王在 e8，黑城堡在 a8。有沒有一個格子，能讓你的騎士「同時」碰到這兩個子？',
      highlights: ['e8', 'a8'],
    },
    {
      fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1',
      text: '找到那個「一石二鳥」的落點，騎士跳上去。',
      arrows: [
        { orig: 'b5', dest: 'c7' },
        { orig: 'c7', dest: 'e8' },
        { orig: 'c7', dest: 'a8' },
      ],
      expectedMove: { from: 'b5', to: 'c7' },
      hint: '逐一想像騎士能跳到的格子，哪一個能同時搆到 e8 的王「和」a8 的城堡？而且若那一步順便將軍，對手就更沒辦法兼顧了。',
      successText: '看到沒？這是「將軍」捉雙：對手必須先救王，你下一步就白吃城堡。騎士的捉雙特別致命——因為騎士的攻擊沒辦法被擋住。',
    },
    {
      fen: '4k3/8/3n1n2/8/4P3/8/8/4K3 w - - 0 1',
      text: '捉雙不是騎士的專利。看這兩個黑騎士並排在 d6、f6——你的兵動一步會發生什麼事？',
      highlights: ['d6', 'f6'],
    },
    {
      fen: '4k3/8/3n1n2/8/4P3/8/8/4K3 w - - 0 1',
      text: '想想兵是怎麼吃子的，再決定怎麼推。',
      arrows: [{ orig: 'e4', dest: 'e5' }],
      expectedMove: { from: 'e4', to: 'e5' },
      hint: '兵靠斜線吃子。把兵往前推一格之後，它左右兩條斜前方會不會正好各站著一個騎士？',
      successText: '一個小兵同時威脅兩個騎士——對手只能救一匹。捉雙的本質不是子力大小，而是「同時攻擊」這個圖案，任何子都能做到。',
    },
    {
      fen: '4k3/8/3n1n2/4P3/8/8/8/4K3 b - - 0 1',
      text: '記住這個圖案：每當你的一個子能同時碰到對手兩顆值錢的子，就停下來看——那通常就是免費的子力。',
    },
  ],
}

const pin: Lesson = {
  id: 'pin',
  concepts: ['pin'],
  title: '牽制 (pin)',
  category: 'tactics',
  difficulty: 'beginner',
  tier: 2,
  order: 10,
  summary: '攻擊一個子，逼它不敢動，因為它身後是更重要的子。',
  scenario: '對手的一個騎士擋在你和它的王中間。如果那個騎士動了，後面的王就暴露了——這代表那個騎士其實「動不了」。怎麼利用？',
  objectives: ['認得牽制：前子不能動，因為身後有更重要的子', '理解「絕對牽制」（身後是王，依規則不能動）'],
  playerColor: 'white',
  steps: [
    {
      fen: '4k3/8/8/4n3/8/8/8/R5K1 w - - 0 1',
      text: '黑騎士在 e5，黑王在它正後方的 e8。想想看：如果你的城堡站到 e 線上，那個騎士會變怎樣？',
      highlights: ['e5', 'e8'],
    },
    {
      fen: '4k3/8/8/4n3/8/8/8/R5K1 w - - 0 1',
      text: '佔住那條把騎士和王串起來的線。',
      arrows: [{ orig: 'a1', dest: 'e1' }],
      expectedMove: { from: 'a1', to: 'e1' },
      hint: '騎士和牠的王連成一條直線。你要的不是吃騎士，而是用城堡「壓住」整條線——哪一步能做到？',
      successText: '這就是「絕對牽制」：騎士一旦移開，城堡就將軍它的王——依規則它根本不能動。被釘死的子等於暫時消失，你可以從容地多派子力來吃掉它。',
    },
    {
      fen: '4k3/8/8/4n3/8/8/8/4R1K1 b - - 0 1',
      text: '牽制的價值在於「凍結」對手的一個子。下次看到對手某個子和它的王（或后、城堡）連成一線，就想到牽制——把那條線佔住。',
    },
  ],
}

const skewer: Lesson = {
  id: 'skewer',
  concepts: ['skewer'],
  title: '串擊 (skewer)',
  category: 'tactics',
  difficulty: 'intermediate',
  tier: 2,
  order: 11,
  summary: '牽制的反面：先攻擊前面的大子，逼它讓開，吃掉身後的子。',
  scenario: '你剛學過牽制——前面小、後面大。串擊正好相反：前面是「大子」，被你攻擊後不得不躲，露出後面的子。',
  objectives: ['認得串擊', '分清牽制（後面大）與串擊（前面大）的差別'],
  playerColor: 'white',
  steps: [
    {
      fen: '8/8/8/r3k3/8/8/8/4K2R w - - 0 1',
      text: '黑王在 e5，同一橫排的 a5 站著黑城堡。王是最值錢的，它一定得對將軍讓步。你的城堡能不能利用這條橫線？',
      highlights: ['e5', 'a5'],
    },
    {
      fen: '8/8/8/r3k3/8/8/8/4K2R w - - 0 1',
      text: '沿著那條橫排，正面將軍黑王。',
      arrows: [{ orig: 'h1', dest: 'h5' }],
      expectedMove: { from: 'h1', to: 'h5' },
      hint: '王和城堡在同一排上。你要從這一排的哪一端、用城堡將軍黑王，逼牠讓開、把後面的城堡暴露出來？',
      successText: '王被將軍，只能讓開這條橫線——然後你就吃掉它身後的城堡。這就是串擊：把「大子」逼到前面當盾牌，後面的子就保不住了。記住和牽制的差別：牽制是後面大、串擊是前面大。',
    },
    {
      fen: '8/8/8/r3k2R/8/8/8/4K3 b - - 0 1',
      text: '牽制與串擊是一對雙胞胎，關鍵都在「兩個子站成一條線」。學會看這條線，半盤的戰術都被你看穿了。',
    },
  ],
}

const discoveredAttack: Lesson = {
  id: 'discovered-attack',
  concepts: ['discovered'],
  title: '閃擊 (discovered attack)',
  category: 'tactics',
  difficulty: 'intermediate',
  tier: 2,
  order: 12,
  summary: '移開前面的子，露出後面子力的攻擊；若露出的是將軍，威力最大。',
  scenario: '你的城堡和對手的王在同一條線上，但中間卡著你自己的一個騎士。這個騎士擋住了城堡——但反過來想，移開它的瞬間會發生什麼？',
  objectives: ['認得閃擊：移開一子、露出另一子的攻擊', '理解「閃將」最強：一步同時做兩件事'],
  playerColor: 'white',
  steps: [
    {
      fen: '4k3/8/3q4/8/4N3/8/8/4R1K1 w - - 0 1',
      text: '你的城堡在 e1、黑王在 e8，但騎士卡在 e4 中間。同時注意：黑后就站在 d6。你的騎士一動，會同時發生兩件事——是哪兩件？',
      highlights: ['e1', 'e8', 'd6'],
    },
    {
      fen: '4k3/8/3q4/8/4N3/8/8/4R1K1 w - - 0 1',
      text: '讓騎士一步做兩件事：自己賺一個子，同時替後面的城堡開路。',
      arrows: [
        { orig: 'e4', dest: 'd6' },
        { orig: 'e1', dest: 'e8' },
      ],
      expectedMove: { from: 'e4', to: 'd6' },
      hint: '騎士一離開 e 線，城堡就直接打到黑王。那麼，要往哪裡跳，才能在開路的同時順手撈走最值錢的黑后？',
      successText: '一步兩得——騎士吃了后，同時城堡的 e 線打開、將軍黑王。對手忙著解將，根本來不及救后——你白賺一個后。這就是閃擊的威力：移開的那個子自己也在做事。',
    },
    {
      fen: '4k3/8/3N4/8/8/8/8/4R1K1 b - - 0 1',
      text: '閃將之所以可怕，是因為對手「必須」回應將軍，沒空管你順手撈走的子。看到自己的子卡在「攻擊線」上，就問一句：移開它能不能順便將軍？',
    },
  ],
}

const protection: Lesson = {
  id: 'protection',
  concepts: ['defense'],
  title: '保護與化解威脅',
  category: 'tactics',
  difficulty: 'beginner',
  tier: 2,
  order: 13,
  summary: '子被攻擊時的四個選項：移開、保護、反擊、吃掉攻擊者。',
  scenario: '戰術不只用來進攻——當對手威脅你的子時，你也得看懂局面、冷靜選出最好的回應，而不是一被嚇到就亂逃。',
  objectives: ['知道被攻擊時的四種選項', '練習「吃掉攻擊者」與「加一個防守者」'],
  playerColor: 'white',
  steps: [
    {
      fen: '4k3/8/8/8/1b6/P7/8/4R1K1 w - - 0 1',
      text: '黑主教從 b4 沿斜線盯上你 e1 的城堡。被攻擊時你有四招：移開、保護、反擊、或吃掉攻擊者。這裡哪一招最乾脆？',
      highlights: ['b4', 'e1'],
    },
    {
      fen: '4k3/8/8/8/1b6/P7/8/4R1K1 w - - 0 1',
      text: '與其逃跑，不如直接解決威脅的來源。',
      arrows: [{ orig: 'a3', dest: 'b4' }],
      expectedMove: { from: 'a3', to: 'b4' },
      hint: '威脅來自那個主教。你身邊有沒有一個小子，剛好能把攻擊你的那個主教吃掉？用小換大幾乎都划算。',
      successText: '威脅來源直接消失，最省事。能用小子吃掉攻擊你大子的子，幾乎永遠划算。',
    },
    {
      fen: '3r2k1/8/8/8/8/3B4/4N3/6K1 w - - 0 1',
      text: '這次不同：黑城堡從 d8 沿 d 線盯上你 d3 的主教，你沒有子能吃到它。除了逃，還能怎麼守住主教？',
      highlights: ['d8', 'd3'],
    },
    {
      fen: '3r2k1/8/8/8/8/3B4/4N3/6K1 w - - 0 1',
      text: '不一定要逃——給你的主教找一個後盾。',
      arrows: [{ orig: 'e2', dest: 'f4' }],
      expectedMove: { from: 'e2', to: 'f4' },
      hint: '吃不到攻擊者、又不想退時，第三條路是「加一個防守者」。騎士走哪一步能保護到 d3？這樣對手吃主教，你就能用騎士吃回更值錢的城堡。',
      successText: '現在主教有了後盾：對手若 Rxd3，你就 Nxd3，用騎士換到他更值錢的城堡——他反而虧，自然不敢吃。加一個防守者，威脅就化解了，子也不必逃。',
    },
    {
      fen: '3r2k1/8/8/8/8/3B4/5N2/6K1 b - - 0 1',
      text: '被攻擊先別慌，把四個選項都掃一遍：移開、保護、反擊、吃掉攻擊者，挑損失最小的。看懂全局再決定，這才是我的下法。',
    },
  ],
}

const tier2Capstone: Lesson = {
  id: 'tactics-capstone',
  title: '綜合演練：看出圖案',
  category: 'tactics',
  difficulty: 'intermediate',
  tier: 2,
  order: 14,
  summary: '把牽制、捉雙、串擊、閃擊融會貫通——用兩步組合贏下對手的后。',
  scenario: '一盤真正的中局：你少了一點子力、看似下風。但我教過你——別看子力多寡，看「圖案」。黑王在 e4、黑后在 e7，疊在同一條 e 線上。前面是王、後面是后，這條線上有東西。',
  objectives: ['在真實處境中辨識戰術圖案', '把單一戰術串成兩步組合'],
  playerColor: 'white',
  steps: [
    {
      fen: '8/4q3/8/8/4k3/8/8/R5K1 w - - 0 1',
      text: '先別急著走。整條 e 線上，前面站著最值錢的黑王、後面是黑后——這正是「串擊」的圖案：逼前面的王讓開，後面的后就保不住了。你的城堡該去哪？',
      highlights: ['e4', 'e7'],
    },
    {
      fen: '8/4q3/8/8/4k3/8/8/R5K1 w - - 0 1',
      text: '用串擊的方式，沿 e 線正面將軍黑王。',
      arrows: [{ orig: 'a1', dest: 'e1' }],
      expectedMove: { from: 'a1', to: 'e1' },
      hint: '王和后都在 e 線上、王在前面。哪一步能讓你的城堡佔住整條 e 線、正面將軍黑王，逼牠讓出這條線？',
      successText: '將軍。黑王被迫離開 e 線——它一讓開，後面的后就失去掩護了。',
    },
    {
      fen: '8/4q3/8/3k4/8/8/8/4R1K1 w - - 0 1',
      text: '黑王逃到 d5（我替對手走了這步）。后孤零零地站在 e7，而你的城堡正控制著整條 e 線。收網吧。',
      highlights: ['e7'],
    },
    {
      fen: '8/4q3/8/3k4/8/8/8/4R1K1 w - - 0 1',
      text: '這條線現在歸你了——去拿走它的后。',
      arrows: [{ orig: 'e1', dest: 'e7' }],
      expectedMove: { from: 'e1', to: 'e7' },
      hint: '黑王已被趕離 e 線，后孤零零留在線上、無人保護。你佔線的城堡能一路走到哪裡？',
      successText: '后到手——你用一個落後的局面，只靠「看出圖案」就贏回一個后——這就是我要你練的：不是記招式，是讓眼睛自動看見王和后站在同一條線上。',
    },
    {
      fen: '8/4R3/8/3k4/8/8/8/6K1 b - - 0 1',
      text: '回顧一下：牽制、捉雙、串擊、閃擊，骨子裡都是同一件事——讓你的一個子，逼對手在兩個損失之間二選一。學會看這個圖案，你就從「背棋步」升級成「看懂棋」了。',
    },
  ],
}

/** Tier 2 lessons in curriculum order. */
export const tacticsLessons: Lesson[] = [
  fork,
  pin,
  skewer,
  discoveredAttack,
  protection,
  tier2Capstone,
]
