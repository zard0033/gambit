import type { JournalParams, JournalTemplate, Volume } from '@/types/journal'

/**
 * ④ arrival（抵達·回望）— written when a journey volume is completed. Speaks to
 * what the player has learned and what they can now handle (constructive, shows
 * accumulation). Params: 卷名 / 學會的 / 應付的 (per-volume copy below).
 */
export const arrivalTemplates: JournalTemplate[] = [
  {
    id: 'arrival.1',
    pen: 'arrival',
    render: (p) => `你走完了「${p['卷名']}」這一卷。${p['學會的']}——接下來，你就能${p['應付的']}。`,
  },
  {
    id: 'arrival.2',
    pen: 'arrival',
    render: (p) => `「${p['卷名']}」告一段落。你已經能${p['學會的']}；再往前，${p['應付的']}也難不倒你了。`,
  },
  {
    id: 'arrival.3',
    pen: 'arrival',
    render: (p) =>
      `這一卷讀完了。${p['學會的']}，從前還要想一想，現在你看一眼就知道——往後${p['應付的']}，你也接得住。`,
  },
  {
    id: 'arrival.4',
    pen: 'arrival',
    render: (p) => `「${p['卷名']}」到這裡。你累積的不只是進度——是${p['學會的']}，是接下來能${p['應付的']}的底氣。`,
  },
  {
    id: 'arrival.5',
    pen: 'arrival',
    render: (p) =>
      `你把「${p['卷名']}」走完了。${p['學會的']}，這是你一步一步換來的；接下來${p['應付的']}，你已經準備好了。`,
  },
  {
    id: 'arrival.6',
    pen: 'arrival',
    render: (p) => `「${p['卷名']}」結束。我不說漂亮——我說的是，你現在${p['學會的']}了，也能開始${p['應付的']}了。`,
  },
]

/**
 * Per-volume copy injected into arrival templates. Data-driven — edit here to
 * tune what each volume's "you learned / you can now handle" reads as.
 */
const VOLUME_COPY: Record<Volume, { 卷名: string; 學會的: string; 應付的: string }> = {
  卷一規則: {
    卷名: '規則',
    學會的: '看懂每顆子怎麼走、怎麼吃',
    應付的: '坐上任何一盤棋，都看得懂盤面在發生什麼',
  },
  卷二戰術: {
    卷名: '戰術',
    學會的: '認得出叉子、牽制這些戰術',
    應付的: '在中局抓住對手露出的破綻',
  },
  卷三開局: {
    卷名: '開局',
    學會的: '穩穩把開局走好',
    應付的: '從容走過開局，不再手忙腳亂',
  },
  卷四殘局: {
    卷名: '殘局',
    學會的: '把子力不多的殘局收好',
    應付的: '在棋盤只剩幾顆子時穩住，把優勢收成勝利',
  },
}

/** Params for an arrival entry in the given volume. */
export function arrivalParamsForVolume(volume: Volume): JournalParams {
  return { ...VOLUME_COPY[volume] }
}
