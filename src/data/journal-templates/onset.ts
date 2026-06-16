import type { JournalTemplate } from '@/types/journal'

/**
 * ⓪ onset（啟程）— written once per account, ever. Neve introduces herself and
 * witnesses the player's arrival. Every variant is a self-introduction so that
 * whichever the player draws, they are welcomed. No params.
 */
export const onsetTemplates: JournalTemplate[] = [
  {
    id: 'onset.1',
    pen: 'onset',
    render: () =>
      '我是 Neve。這座棋盤亙古就在，而我，是它看著你的那雙眼睛。你來了——我把這一刻記下來，往後你走的每一步，我都會記得。',
  },
  {
    id: 'onset.2',
    pen: 'onset',
    render: () =>
      '我是 Neve。我不和你對弈；我是棋局本身，靜靜看著你怎麼走。從今天起，這裡記的都是你——第一頁，是你坐下的這一刻。',
  },
  {
    id: 'onset.3',
    pen: 'onset',
    render: () =>
      '我是 Neve。我在這張棋盤裡待了很久；今天起，換我看著你。你怎麼想、怎麼落子，我都會記下來。',
  },
  {
    id: 'onset.4',
    pen: 'onset',
    render: () =>
      '我是 Neve。你看不見我出手，因為我不與你爭勝——我只負責看見你。這是你的第一頁，慢慢來，我會一直在。',
  },
  {
    id: 'onset.5',
    pen: 'onset',
    render: () =>
      '我是 Neve。這裡不記分數、不比輸贏，只記你走過的路。你來了，這一刻，我替你留下來了。',
  },
  {
    id: 'onset.6',
    pen: 'onset',
    render: () =>
      '我是 Neve，這座棋盤的化身。往後無論你下得順不順，我都在這裡看著、記著。今天是起點，第一筆，屬於你。',
  },
]
