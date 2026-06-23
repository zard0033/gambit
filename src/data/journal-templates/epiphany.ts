import type { JournalTemplate } from '@/types/journal'

/**
 * ⑥ epiphany（你自己看出來的）— written when a concept's deepening silent gate is solved with
 * no aid (no hint, no reveal arrow). Neve steps back: she names what the player saw for themselves,
 * never her teaching. Param: 概念 (the concept label, e.g. '捉雙'). No digits, no blame.
 *
 * Persona guard (enforced by tests): no blame/error tokens, no digits, no emoji, no xiangqi terms.
 */
export const epiphanyTemplates: JournalTemplate[] = [
  {
    id: 'epiphany.1',
    pen: 'epiphany',
    render: (p) => `這一手「${p['概念']}」，我一句都沒提醒——是你自己看見的。下一次，你也會先看見它。`,
  },
  {
    id: 'epiphany.2',
    pen: 'epiphany',
    render: (p) => `我退到了一旁，盤面什麼也沒指。可你還是找到了那步「${p['概念']}」。沒人指，你也認得，這不容易。`,
  },
  {
    id: 'epiphany.3',
    pen: 'epiphany',
    render: (p) => `沒有提示、沒有箭頭，你獨自認出了「${p['概念']}」。我教過的，今天你不用我指，也認得了。`,
  },
  {
    id: 'epiphany.4',
    pen: 'epiphany',
    render: (p) => `「${p['概念']}」這一關我沉默著看你走完。你沒求助，也走對了——這份看見，是你掙來的。`,
  },
  {
    id: 'epiphany.5',
    pen: 'epiphany',
    render: (p) => `從前要我指給你看的「${p['概念']}」，這次你自己就認出來了。我沒出聲，但都看在眼裡。`,
  },
  {
    id: 'epiphany.6',
    pen: 'epiphany',
    render: (p) => `我什麼都沒說，你卻把「${p['概念']}」看穿了。往後坐上棋盤，這次的看見會留著。`,
  },
]
