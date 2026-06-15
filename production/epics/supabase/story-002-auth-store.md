# Story 002: useAuthStore

> **Epic**: Supabase
> **Status**: Complete
> **Layer**: Persistence — Foundation
> **Type**: Logic (Pinia store)
> **Estimate**: M (6 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-31
> **TR**: pending /architecture-review
> **ADR**: ADR-0004, ADR-0011

## Context

**GDD**: `design/gdd/supabase-integration.md` — Authentication Flow section
**Requirements**: SUPA-AC-01, SUPA-AC-02, SUPA-AC-03, SUPA-AC-04, SUPA-AC-05

**ADR Governing Implementation**: ADR-0011: Supabase Authentication and Data Sync Strategy
**ADR Decision Summary**: Auth state owned exclusively by `useAuthStore` (Pinia). No other store reads `supabase.auth.*` directly. `initAuth()` called once in `App.vue` `onMounted`. `onAuthStateChange` drives all auth state updates. supabase-js handles JWT refresh automatically.

**Engine**: Web App — Vue 3 Composition API + TypeScript + Pinia 2 | **Risk**: LOW
**Engine Notes**: `supabase.auth.onAuthStateChange()` fires synchronously on first call with the current session state. `SIGNED_IN` event also fires on token refresh — store must be idempotent when `userId` is already set.

**Control Manifest Rules (Persistence Foundation)**:
- Required: `useAuthStore` is the sole owner of auth state; all other stores/components read `useAuthStore.userId`, never `supabase.auth` directly
- Required: `initAuth()` is called exactly once — in `App.vue` `onMounted`
- Required: `isAuthLoading` is `true` during initial `getSession()` call; set to `false` after it resolves (prevents flash of unauthenticated state)
- Forbidden: No `supabase.auth.*` calls outside `src/stores/auth.ts`

---

## Acceptance Criteria

- [ ] **SUPA-AC-01**: GIVEN valid email entered, WHEN `signIn(email)` is called, THEN `supabase.auth.signInWithOtp({ email })` is called and the store transitions to a "check-your-email" state (not `userId` set — that happens via callback).
- [ ] **SUPA-AC-02**: GIVEN Magic Link click opens app with `#access_token` fragment, WHEN `onAuthStateChange` fires `SIGNED_IN`, THEN `useAuthStore.userId` is set to the user's UUID and `isAuthLoading` is false.
- [ ] **SUPA-AC-03**: GIVEN a valid existing session in localStorage, WHEN `initAuth()` calls `getSession()` on mount, THEN `userId` is set without the player seeing the sign-in flow.
- [ ] **SUPA-AC-04**: GIVEN player is logged in, WHEN `signOut()` is called, THEN `supabase.auth.signOut()` is called, `userId` and `email` are set to `null`.
- [ ] **SUPA-AC-05**: GIVEN Magic Link expired, WHEN app receives auth error callback, THEN store does not crash; error is exposed via a reactive `authError` field.
- [ ] **Unit tests**: `tests/unit/stores/auth-store.test.ts` — all scenarios above covered with mocked supabase client.

---

## Implementation Notes

### Files to create / modify

```
src/stores/auth.ts                       ← new
tests/unit/stores/auth-store.test.ts     ← new
src/App.vue                              ← modify (add initAuth() call in onMounted)
```

### Store interface (from ADR-0011)

```typescript
// src/stores/auth.ts
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

interface AuthState {
  userId: string | null
  email: string | null
  isAuthLoading: boolean
  authError: string | null   // for expired OTP, etc.
  pendingEmail: boolean      // true = "check your email" state
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    userId: null,
    email: null,
    isAuthLoading: true,
    authError: null,
    pendingEmail: false,
  }),
  actions: {
    async initAuth() { /* getSession() + onAuthStateChange() setup */ },
    async signIn(email: string) { /* signInWithOtp + set pendingEmail */ },
    async signOut() { /* signOut + clear state */ },
  },
})
```

### initAuth() pattern

```typescript
async initAuth() {
  this.isAuthLoading = true
  const { data: { session } } = await supabase.auth.getSession()
  this.userId = session?.user.id ?? null
  this.email = session?.user.email ?? null
  this.isAuthLoading = false

  supabase.auth.onAuthStateChange((_event, session) => {
    this.userId = session?.user.id ?? null
    this.email = session?.user.email ?? null
    if (_event === 'SIGNED_IN') {
      // trigger useDataSyncStore.flushUnsyncedQueue() here (or via watcher in data-sync store)
    }
  })
}
```

### App.vue modification

```typescript
// src/App.vue
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
onMounted(() => { authStore.initAuth() })
```

### Test strategy

Mock `@/lib/supabase` module. Spy on `supabase.auth.getSession`, `signInWithOtp`, `signOut`, `onAuthStateChange`. Test each action in isolation.

---

## QA Test Cases

**Gate level**: BLOCKING — `tests/unit/stores/auth-store.test.ts` must pass

- **initAuth with existing session**: mock `getSession` returns session → `userId` set, `isAuthLoading` false
- **initAuth no session**: mock `getSession` returns null → `userId` null, `isAuthLoading` false
- **signIn success**: mock `signInWithOtp` success → `pendingEmail` true, no error
- **signIn network error**: mock `signInWithOtp` error → `authError` set, `pendingEmail` false
- **signOut**: mock `signOut` → `userId` null, `email` null
- **onAuthStateChange SIGNED_IN**: fire event → `userId` updated
- **onAuthStateChange SIGNED_OUT**: fire event → `userId` null
- **SUPA-AC-05 expired OTP**: `onAuthStateChange` fires with error → `authError` set, no crash

---

## Test Evidence

**Story Type**: Logic (Pinia store)
**Required evidence**: `tests/unit/stores/auth-store.test.ts` — BLOCKING unit test
**Manual evidence**: Sign-in flow walkthrough in browser (advisory)

---

## Dependencies

- Depends on: story-001-project-setup.md (supabase.ts singleton)
- Unlocks: story-004-data-sync-store.md, story-005-route-guards.md, story-006-sign-in-ui.md

---

## Completion Notes
**Completed**: 2026-05-31
**Criteria**: 6/6 passing
**Deviations**: ADVISORY — S7-05 route guards must check `isAuthLoading` (not just `userId`) because Vue Router `beforeEach` runs before `App.vue.onMounted`. Documented as constraint for S7-05.
**Test Evidence**: Logic — `tests/unit/stores/auth-store.test.ts` 15/15 pass
**Code Review**: Complete — 6 findings addressed (pendingEmail/authError cleared on SIGNED_IN, signOut error exposed, subscription handle stored, _applySession helper extracted)
