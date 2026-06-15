# Story 004: sessionStorage Persistence — Throttled Writes, pv Stripped

> **Epic**: Post-Game Review
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: S (2 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-28
> **TR**: TR-post-game-review-005
> **ADR**: ADR-0001, ADR-0007

## Context

**GDD**: `design/gdd/post-game-review.md`
**Requirement**: `TR-post-game-review-005`

**ADR Governing Implementation**: ADR-0007: Post-Game Review Analysis Loop and sessionStorage Schema
**ADR Decision Summary**: sessionStorage key: `pgr:analysis:<gameId>` where `gameId = completedGame.completedAt.toString()`. Strip `pv` from persisted records (size guard — 30–60 UCI strings per position). Throttle writes via rAF-piggybacked or 500ms debounce — NOT synchronous per position. Wrap every `setItem` in `try/catch`; set `persistenceAvailable = false` on error; never surface to player.

**Control Manifest Rules (Feature layer)**:
- Required: sessionStorage key format: `pgr:analysis:<gameId>`
- Required: Strip `pv` from persisted records
- Required: Wrap every `sessionStorage.setItem` in `try/catch`; set `persistenceAvailable = false` on error
- Required: Throttle sessionStorage writes (rAF-piggybacked or 500ms debounce); NOT synchronous per position
- Forbidden: Never persist `pv` in sessionStorage
- Forbidden: Never use IndexedDB for v0 review persistence

---

## Acceptance Criteria

- [x] sessionStorage key is `pgr:analysis:<completedGame.completedAt.toString()>`.
- [x] Persisted records strip the `pv` field: `{ bestMove, evalCp?, evalMate?, depthReached, pass }` only.
- [x] Writes are debounced/throttled — multiple `analysisResults` updates within 500ms result in at most one `setItem` call.
- [x] Every `sessionStorage.setItem` call is inside a `try/catch`; on `QuotaExceededError` or any other error, `persistenceAvailable` is set to `false` and no error is shown to the player.
- [x] On PostGameReview mount, if `sessionStorage.getItem(key)` contains a prior analysis for the same `gameId`, the results are restored and the review resumes (no re-analysis needed).

---

## Implementation Notes

*From ADR-0007 §3:*

```ts
const key = `pgr:analysis:${completedGame.completedAt.toString()}`
let persistenceAvailable = true
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function flushToSessionStorage() {
  if (!persistenceAvailable) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    try {
      const stripped = analysisResults.value.map(r =>
        r ? { bestMove: r.bestMove, evalCp: r.evalCp, evalMate: r.evalMate, depthReached: r.depthReached, pass: r.pass } : null
      )
      sessionStorage.setItem(key, JSON.stringify(stripped))
    } catch {
      persistenceAvailable = false
    }
  }, 500)
}

function tryRestoreFromSessionStorage() {
  try {
    const saved = sessionStorage.getItem(key)
    if (saved) {
      const parsed = JSON.parse(saved) as (PersistedResult | null)[]
      analysisResults.value = parsed
      // if all results are deep, skip analysis; else resume from where left off
    }
  } catch { /* ignore restore failures */ }
}
```

- Call `tryRestoreFromSessionStorage()` on mount before starting analysis.
- `pv` is never included in the persisted record type — enforce via TypeScript `Omit<ReviewResult, 'pv'>`.

---

## QA Test Cases

- **AC-1**: Key format
  - Given: `completedGame.completedAt = 1716900000000`
  - When: key is constructed
  - Then: key === `'pgr:analysis:1716900000000'`

- **AC-2**: pv stripped from persisted data
  - Given: analysisResults with `pv: ['e2e4', 'e7e5']` in each result
  - When: `sessionStorage.getItem(key)` parsed
  - Then: no `pv` field in any persisted record

- **AC-3**: Debounce coalesces writes
  - Given: spy on `sessionStorage.setItem`; 5 updates in 100ms
  - When: 500ms debounce timer fires
  - Then: `setItem` called exactly 1 time (not 5)

- **AC-4**: QuotaExceededError handled silently
  - Given: mock `sessionStorage.setItem` to throw `DOMException` (QuotaExceededError)
  - When: `flushToSessionStorage()` called
  - Then: `persistenceAvailable === false`; no user-facing error thrown or displayed

- **AC-5**: Restore on remount
  - Given: sessionStorage contains prior analysis for same gameId
  - When: PostGameReview mounts
  - Then: `analysisResults` populated from storage; analysis loop NOT re-run if all results are `pass: 'deep'`

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/post-game-review/sessionstorage.test.ts`

**Status**: [x] `tests/unit/post-game-review/sessionstorage.test.ts` — 8 tests, all pass (2026-05-30)

---

## Dependencies

- Depends on: Story 001 (flushToSessionStorage is called from within analysis loop)
- Unlocks: Nothing — terminal persistence feature
