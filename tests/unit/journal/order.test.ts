import { describe, expect, it } from 'vitest'
import type { JournalEntry } from '@/types/journal'
import { compareForTimeline, mergeAndOrder } from '@/modules/journal/order'

function entry(o: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: o.id ?? o.sourceRefId ?? 'id',
    type: o.type ?? 'arrival',
    sourceRefId: o.sourceRefId ?? 'ref',
    volume: o.volume !== undefined ? o.volume : '卷一規則',
    templateId: o.templateId ?? 'arrival.1',
    params: o.params ?? {},
    body: o.body ?? 'x',
    createdAt: o.createdAt ?? 0,
  }
}

describe('compareForTimeline', () => {
  it('orders newest first', () => {
    const list = [entry({ sourceRefId: 'a', createdAt: 1 }), entry({ sourceRefId: 'b', createdAt: 2 })]
    expect([...list].sort(compareForTimeline).map((e) => e.sourceRefId)).toEqual(['b', 'a'])
  })

  it('pins onset last even when it is newest', () => {
    const list = [
      entry({ sourceRefId: 'onset', type: 'onset', volume: null, createdAt: 999 }),
      entry({ sourceRefId: 'a', createdAt: 1 }),
    ]
    expect([...list].sort(compareForTimeline).map((e) => e.sourceRefId)).toEqual(['a', 'onset'])
  })
})

describe('mergeAndOrder', () => {
  it('AC-order: merges cloud + local, newest first, onset last', () => {
    const cloud = [entry({ sourceRefId: 'arr', type: 'arrival', createdAt: 2 })]
    const local = [
      entry({ sourceRefId: 'sol', type: 'solace', volume: '卷二戰術', createdAt: 3 }),
      entry({ sourceRefId: 'onset', type: 'onset', volume: null, createdAt: 1 }),
    ]
    expect(mergeAndOrder(cloud, local).map((e) => e.sourceRefId)).toEqual(['sol', 'arr', 'onset'])
  })

  it('dedups by sourceRefId, first list wins (cloud over local)', () => {
    const cloud = [entry({ sourceRefId: 'x', body: 'cloud', createdAt: 5 })]
    const local = [entry({ sourceRefId: 'x', body: 'local', createdAt: 5 })]
    const merged = mergeAndOrder(cloud, local)
    expect(merged).toHaveLength(1)
    expect(merged[0].body).toBe('cloud')
  })
})
