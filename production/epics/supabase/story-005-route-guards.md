# Story 005: Route Guards + App.vue initAuth

> **Epic**: Supabase
> **Status**: Complete
> **Layer**: Persistence — Core
> **Type**: Logic (Vue Router integration)
> **Estimate**: XS (2 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-31
> **TR**: pending /architecture-review
> **ADR**: ADR-0004, ADR-0011

## Context

**GDD**: `design/gdd/supabase-integration.md` — Interactions section (App Router row)
**Requirements**: SUPA-AC-10

**ADR Governing Implementation**: ADR-0011; ADR-0004 (Vue Router History Mode + GitHub Pages)
**ADR Decision Summary**: `useAuthStore.userId !== null` is the guard condition. `/history` and `/profile` routes redirect unauthenticated users to home (`/`). `App.vue` calls `initAuth()` once in `onMounted` — `isAuthLoading` guards against flash of unauthenticated state before the session check resolves.

**Engine**: Web App — Vue Router 4 + Pinia 2 | **Risk**: LOW
**Engine Notes**: Vue Router `beforeEach` global guard runs before each navigation. Pinia store access inside `beforeEach` is safe after `app.use(pinia)` — which happens in `main.ts` before `app.use(router)`. Guard must check `isAuthLoading` to avoid redirect during initial session resolution.

**Control Manifest Rules**:
- Required: Guard reads `useAuthStore().userId` — not `supabase.auth` directly
- Required: Guard waits for `isAuthLoading === false` before making auth decisions
- Required: Redirect target is `{ name: 'home' }` (named route — robust to path changes)
- Forbidden: Guard must not call async auth operations — it only reads store state

---

## Acceptance Criteria

- [ ] **SUPA-AC-10**: GIVEN unauthenticated player navigates to `/history` or `/profile`, WHEN `beforeEach` guard runs, THEN player is redirected to `{ name: 'home' }` with query param `?login=required`.
- [ ] **AC-S5-02**: GIVEN `isAuthLoading === true` (initial session check in flight), WHEN a navigation to a guarded route is triggered, THEN guard waits for `isAuthLoading` to become `false` before deciding (no premature redirect).
- [ ] **AC-S5-03**: GIVEN authenticated player, WHEN navigating to `/history` or `/profile`, THEN navigation proceeds normally.
- [ ] **AC-S5-04**: `App.vue` calls `authStore.initAuth()` exactly once in `onMounted`.

---

## Implementation Notes

### Files to modify

```
src/router/index.ts     ← add beforeEach guard
src/App.vue             ← add initAuth() call in onMounted
```

### Router guard pattern

```typescript
// src/router/index.ts
import { useAuthStore } from '@/stores/auth'

const AUTH_REQUIRED_ROUTES = ['history', 'profile']

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  // Wait for initial auth resolution (avoids flash redirect on first load)
  if (authStore.isAuthLoading) {
    await new Promise<void>(resolve => {
      const stop = watch(() => authStore.isAuthLoading, (loading) => {
        if (!loading) { stop(); resolve() }
      })
    })
  }

  if (AUTH_REQUIRED_ROUTES.includes(to.name as string) && !authStore.userId) {
    return { name: 'home', query: { login: 'required' } }
  }
})
```

### App.vue modification

```typescript
// src/App.vue <script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
onMounted(() => { authStore.initAuth() })
```

Note: `initAuth()` is not awaited in `onMounted` — `isAuthLoading` handles the loading state; the app renders immediately with loading state, resolves when session check completes.

---

## QA Test Cases

**Gate level**: ADVISORY (router integration — hard to unit-test in isolation; manual verification sufficient)

- **SUPA-AC-10**: Navigate to `/history` while `userId = null` → redirected to home
- **AC-S5-03**: Navigate to `/history` while `userId = 'some-uuid'` → navigation proceeds
- **Flash prevention**: Set `isAuthLoading = true`; navigate to `/history`; set `isAuthLoading = false` with no userId → redirect happens after loading resolves, not immediately

Integration test (Playwright): load app fresh, navigate to `/history` → confirm redirect to home.

---

## Test Evidence

**Story Type**: Logic (router integration)
**Required evidence**: Manual browser walkthrough (ADVISORY); Playwright E2E test preferred
**Evidence path**: `production/qa/evidence/s7-05-route-guards-evidence.md`

---

## Dependencies

- Depends on: story-002-auth-store.md (`useAuthStore`, `isAuthLoading`, `userId`)
- Requires: `/history` and `/profile` route names exist in `src/router/index.ts` (check before implementing)

---

## Completion Notes
**Completed**: 2026-05-31
**Criteria**: 4/4 passing
- SUPA-AC-10: unauthenticated → redirect to home?login=required ✅ (unit test)
- AC-S5-02: isAuthLoading guard waits before deciding ✅ (unit test)
- AC-S5-03: authenticated user navigates freely ✅ (unit test)
- AC-S5-04: App.vue onMounted initAuth — already set in S7-02 ✅
**Deviations**: None
**Test Evidence**: Logic — `tests/unit/app-router/auth-guard.test.ts` 6/6 pass; route-table.test.ts updated (9 pass)
**Code Review**: Lean mode — guard pattern matches story spec; isAuthLoading watch correctly prevents premature redirect
