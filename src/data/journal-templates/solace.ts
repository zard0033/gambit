import type { JournalTemplate } from '@/types/journal'

/**
 * ⑤ solace（低潮的陪伴）— written on a losing streak. Gentle presence, never
 * criticism, never numbers. Validates the feeling, leaves the door open ("come
 * back when you want"), and softly invites review/getting stronger. No params.
 *
 * Persona guard (enforced by tests): no blame/error tokens, no digits, no emoji.
 */
export const solaceTemplates: JournalTemplate[] = [
  {
    id: 'solace.1',
    pen: 'solace',
    render: () =>
      '這幾盤很難熬，我知道。如果想先離開棋盤，去看部劇、玩點別的，都好——棋盤不會走，等你想回來，我都在。',
  },
  {
    id: 'solace.2',
    pen: 'solace',
    render: () =>
      '這幾盤不容易。先歇著，不急。等你想坐回來——無論是再下一盤，還是想覆盤變強——我都在。',
  },
  {
    id: 'solace.3',
    pen: 'solace',
    render: () => '有些日子，棋就是不順。放著吧，盤面不會走。想回來的時候，我陪你重看那幾步。',
  },
  {
    id: 'solace.4',
    pen: 'solace',
    render: () => '我沒有要說什麼。只想讓你知道：想停就停，想再來就再來；哪天想變強了，我也在。',
  },
  {
    id: 'solace.5',
    pen: 'solace',
    render: () =>
      '會難過，是因為你真的在乎這盤棋——我看見了。等你緩過來，想再下、想一起把棋變強，我都等著。',
  },
  {
    id: 'solace.6',
    pen: 'solace',
    render: () => '這一段路有點暗。慢慢來。想休息就休息，想回頭把棋看清楚——我也在。',
  },
]
