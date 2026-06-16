# Story 005: Homepage Peek + Unread Watermark

> **Epic**: journal
> **Status**: Ready (ADR-0013 Accepted 2026-06-16)
> **Layer**: Phase 1 Differentiation — UI
> **Type**: UI (homepage slot + device-local watermark)
> **Estimate**: S (2-3 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: (set by /dev-story)
> **TR**: TR-journal-005
> **ADR**: ADR-0013

## Context

**GDD**: `design/gdd/journal.md` — UI Requirements (首頁一角, 未讀記號)
**Requirement**: `TR-journal-005`

**ADR Governing Implementation**: ADR-0013 §5 (device-local state)
**ADR Decision Summary**:
- Unread is a **device-local single watermark** `journalLastSeenAt` (localStorage `chess:journal:lastSeenAt`), **not** synced and **not** per-entry. An entry is unread if `createdAt > journalLastSeenAt`. Opening the journal updates the watermark.
- The homepage peek is **HomeView's responsibility**; `useJournalStore.recent(HOMEPAGE_PEEK_COUNT)` supplies the data.

**Engine**: Web App — Vue 3 + Tailwind | **Risk**: LOW
**Engine Notes**:
- Design SoT: gold is focus/reward ONLY — the unread marker must be **non-gold** (e.g. faint jade / cream-dim dot).
- No notification-badge anxiety: marker is **binary** (有新筆 / 無), never a count; appears **only inside the journal view / peek**, never as a tab/home red-dot count.

**Control Manifest Rules (this layer)**:
- Forbidden: numeric unread count; red-dot badge on tab/home; gold for the unread mark.
- Required: watermark device-local (not synced); touch targets ≥44px on the peek tap area.

---

## Acceptance Criteria

*From GDD Acceptance Criteria, scoped to this story:*

- [ ] **AC-unread**: given an entry with `createdAt > journalLastSeenAt`, opening the journal shows a binary unread marker (non-gold, journal-scope only); after viewing, `journalLastSeenAt` updates and the marker clears and does not reappear on re-open.
- [ ] Homepage peek shows the most recent `HOMEPAGE_PEEK_COUNT` (=3) entries, newest first, and taps through to `/journal`.
- [ ] The unread marker never renders as a number and never appears on the tab/home as a count or red dot.

---

## Implementation Notes

```
src/lib/journal/unread.ts        ← isUnread(entry, lastSeenAt); markSeen() writes chess:journal:lastSeenAt
src/views/HomeView.vue           ← add peek slot: useJournalStore.recent(HOMEPAGE_PEEK_COUNT) → tap → router.push('/journal')
src/views/JournalView.vue        ← on mount, after render: markSeen(now); show non-gold marker on entries where createdAt > lastSeenAt
tests/e2e/journal-unread.spec.ts ← marker shows then clears; never a count; peek count + navigation
```

- `markSeen()` sets `chess:journal:lastSeenAt = Date.now()` on journal view mount (after entries painted, so the marker is briefly visible then clears on next open). Device-local; guest and logged-in share the same local watermark (not synced — calm, no cross-device resurrection).
- Peek visual baseline only; full home redesign IA is Phase 3 (do not restructure HomeView beyond adding the peek slot).

---

## Out of Scope

- story-004: the journal overview view itself.
- Phase 3 IA: moving the journal entry into a tab / full home redesign.

---

## QA Test Cases

**Gate level**: ADVISORY (UI).

- **AC-unread**: Setup: write a new entry, set `lastSeenAt` older. Verify: marker present on newest entry, non-gold, no number. Open journal → re-open. Pass: marker gone, no reappear.
- **peek**: Setup: ≥3 entries. Verify: home shows exactly HOMEPAGE_PEEK_COUNT newest, tap → `/journal`. Pass: count + route.
- **no-badge**: Verify: no count/red-dot on tab/home. Pass: query none.

---

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/journal-peek-unread-evidence.md` OR `tests/e2e/journal-unread.spec.ts`.
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: story-004 (journal view), story-001 (store.recent).
- Unlocks: none (leaf UI).
