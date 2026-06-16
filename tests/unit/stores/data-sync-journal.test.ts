// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useDataSyncStore } from '@/stores/data-sync'
import type { JournalEntry } from '@/types/journal'

function mockUpsert(result: { error: unknown } = { error: null }) {
  const upsertFn = vi.fn().mockResolvedValueOnce(result)
  vi.mocked(supabase.from).mockReturnValueOnce({ upsert: upsertFn } as never)
  return upsertFn
}

function mockSelectOrder(result: { data: unknown; error: unknown }) {
  const orderFn = vi.fn().mockResolvedValueOnce(result)
  const selectFn = vi.fn().mockReturnValue({ order: orderFn })
  vi.mocked(supabase.from).mockReturnValueOnce({ select: selectFn } as never)
  return { selectFn, orderFn }
}

/** Mock upsert across multiple appendJournalEntry calls; one result per call, in order. */
function mockUpsertMany(results: { error: unknown }[]) {
  const upsertFn = vi.fn()
  results.forEach((r) => upsertFn.mockResolvedValueOnce(r))
  vi.mocked(supabase.from).mockReturnValue({ upsert: upsertFn } as never)
  return upsertFn
}

function mockAuthSubscription() {
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue(
    { data: { subscription: { unsubscribe: vi.fn() } } } as never,
  )
}

function entry(o: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: o.id ?? 'id-1',
    type: o.type ?? 'arrival',
    sourceRefId: o.sourceRefId ?? 'stage-rules',
    volume: o.volume !== undefined ? o.volume : '卷一規則',
    templateId: o.templateId ?? 'arrival.1',
    params: o.params ?? { 卷名: '規則' },
    body: o.body ?? '你走完了「規則」這一卷。',
    createdAt: o.createdAt ?? 1_700_000_000_000,
  }
}

describe('useDataSyncStore — journal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    mockAuthSubscription()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null }, error: null,
    } as never)
  })

  describe('appendJournalEntry — logged in', () => {
    it('upserts with event-level idempotency (onConflict user_id,source_ref_id, ignoreDuplicates)', async () => {
      const upsertFn = mockUpsert({ error: null })
      useAuthStore().userId = 'uid-1'
      const store = useDataSyncStore()

      await store.appendJournalEntry(entry())

      expect(supabase.from).toHaveBeenCalledWith('journal_entries')
      expect(upsertFn).toHaveBeenCalledOnce()
      const [row, opts] = upsertFn.mock.calls[0]
      expect(opts).toEqual({ onConflict: 'user_id,source_ref_id', ignoreDuplicates: true })
      expect(row).toMatchObject({ user_id: 'uid-1', source_ref_id: 'stage-rules', type: 'arrival' })
    })

    it('AC-4: queues to chess:journal:unsynced on insert error', async () => {
      mockUpsert({ error: { message: 'offline' } })
      useAuthStore().userId = 'uid-1'
      const store = useDataSyncStore()

      await store.appendJournalEntry(entry({ sourceRefId: 'stage-tactics' }))

      expect(localStorage.getItem('chess:journal:unsynced:stage-tactics')).toBeTruthy()
    })
  })

  describe('appendJournalEntry — guest', () => {
    it('AC-2: writes to chess:journal:entries with no supabase call', async () => {
      const store = useDataSyncStore()
      await store.appendJournalEntry(entry({ sourceRefId: 'onset' }))

      expect(supabase.from).not.toHaveBeenCalled()
      const raw = localStorage.getItem('chess:journal:entries')
      expect(raw).toBeTruthy()
      expect(JSON.parse(raw as string)).toHaveLength(1)
    })

    it('is idempotent locally by sourceRefId', async () => {
      const store = useDataSyncStore()
      await store.appendJournalEntry(entry({ sourceRefId: 'onset' }))
      await store.appendJournalEntry(entry({ sourceRefId: 'onset' }))

      expect(JSON.parse(localStorage.getItem('chess:journal:entries') as string)).toHaveLength(1)
    })
  })

  describe('loadJournalEntries', () => {
    it('AC-2: returns [] with no supabase call when logged out', async () => {
      const store = useDataSyncStore()
      expect(await store.loadJournalEntries()).toEqual([])
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('maps DB rows to JournalEntry, newest first', async () => {
      mockSelectOrder({
        data: [
          {
            id: 'r1', type: 'arrival', source_ref_id: 'stage-rules', volume: '卷一規則',
            template_id: 'arrival.1', params: { 卷名: '規則' }, body: 'b1',
            created_at: '2026-06-16T00:00:00.000Z',
          },
        ],
        error: null,
      })
      useAuthStore().userId = 'uid-1'
      const store = useDataSyncStore()

      const out = await store.loadJournalEntries()
      expect(out).toHaveLength(1)
      expect(out[0]).toMatchObject({ sourceRefId: 'stage-rules', templateId: 'arrival.1', volume: '卷一規則' })
      expect(out[0].createdAt).toBe(new Date('2026-06-16T00:00:00.000Z').getTime())
    })

    it('throws on a read error', async () => {
      mockSelectOrder({ data: null, error: { message: 'boom' } })
      useAuthStore().userId = 'uid-1'
      const store = useDataSyncStore()
      await expect(store.loadJournalEntries()).rejects.toThrow(/boom/)
    })
  })

  describe('readLocalJournalEntries', () => {
    it('reads guest entries and unsynced queue', async () => {
      const store = useDataSyncStore()
      localStorage.setItem('chess:journal:entries', JSON.stringify([entry({ sourceRefId: 'onset' })]))
      localStorage.setItem(
        'chess:journal:unsynced:stage-tactics',
        JSON.stringify(entry({ sourceRefId: 'stage-tactics' })),
      )

      const refs = store.readLocalJournalEntries().map((e) => e.sourceRefId).sort()
      expect(refs).toEqual(['onset', 'stage-tactics'])
    })

    it('skips a corrupt blob without throwing', () => {
      const store = useDataSyncStore()
      localStorage.setItem('chess:journal:entries', '{not json')
      expect(store.readLocalJournalEntries()).toEqual([])
    })
  })

  describe('flushJournalQueue — guest→login reconcile', () => {
    it('AC-guest-reconcile: pushes guest entries to cloud and clears the guest blob', async () => {
      const store = useDataSyncStore()
      await store.appendJournalEntry(entry({ id: 'a', sourceRefId: 'onset' }))
      await store.appendJournalEntry(entry({ id: 'b', sourceRefId: 'stage-rules' }))
      expect(JSON.parse(localStorage.getItem('chess:journal:entries') as string)).toHaveLength(2)

      const upsertFn = mockUpsertMany([{ error: null }, { error: null }])
      useAuthStore().userId = 'uid-1'
      await store.flushJournalQueue()

      expect(upsertFn).toHaveBeenCalledTimes(2)
      expect(localStorage.getItem('chess:journal:entries')).toBeNull()
    })

    it('dedups by sourceRefId across guest blob and unsynced queue', async () => {
      const store = useDataSyncStore()
      localStorage.setItem('chess:journal:entries', JSON.stringify([entry({ id: 'a', sourceRefId: 'onset' })]))
      localStorage.setItem('chess:journal:unsynced:onset', JSON.stringify(entry({ id: 'a2', sourceRefId: 'onset' })))

      const upsertFn = mockUpsertMany([{ error: null }])
      useAuthStore().userId = 'uid-1'
      await store.flushJournalQueue()

      expect(upsertFn).toHaveBeenCalledTimes(1)
    })

    it('no loss: a failed entry re-queues to unsynced, the guest blob is cleared', async () => {
      const store = useDataSyncStore()
      localStorage.setItem(
        'chess:journal:entries',
        JSON.stringify([entry({ id: 'a', sourceRefId: 'onset' }), entry({ id: 'b', sourceRefId: 'stage-rules' })]),
      )

      mockUpsertMany([{ error: null }, { error: { message: 'offline' } }])
      useAuthStore().userId = 'uid-1'
      await store.flushJournalQueue()

      expect(localStorage.getItem('chess:journal:entries')).toBeNull()
      expect(localStorage.getItem('chess:journal:unsynced:stage-rules')).toBeTruthy()
      expect(localStorage.getItem('chess:journal:unsynced:onset')).toBeNull()
    })
  })
})
