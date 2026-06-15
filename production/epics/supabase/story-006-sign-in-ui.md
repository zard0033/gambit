# Story 006: Sign In UI

> **Epic**: Supabase
> **Status**: Complete (2026-05-31)
> **Layer**: Persistence — Feature UI
> **Type**: UI
> **Estimate**: M (4 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-30
> **TR**: pending /architecture-review
> **ADR**: ADR-0004, ADR-0011

## Context

**GDD**: `design/gdd/supabase-integration.md` — Authentication Flow section
**Requirements**: SUPA-AC-01, SUPA-AC-04, SUPA-AC-05

**ADR Governing Implementation**: ADR-0011; ADR-0004 (routing)
**ADR Decision Summary**: Sign In UI calls `useAuthStore.signIn(email)`. Three states: idle (email form), pending (check-your-email), error (show `authError`). Sign-out trigger reads `useAuthStore.signOut()`. No password field — Magic Link only.

**Engine**: Web App — Vue 3 Composition API + TypeScript + Tailwind CSS | **Risk**: LOW
**Engine Notes**: Touch targets ≥ 44×44px (ADR-0009 / technical preferences). No hover-only interactions — mobile has no hover state. Error and pending states must be conveyed without color alone (accessibility).

**Control Manifest Rules (UI layer)**:
- Required: All interactive elements ≥ 44×44px touch target
- Required: No hover-only interactions — state changes accessible via focus/click
- Required: `isAuthLoading` guards submit button (show spinner; disable button)
- Required: Error message text is visible; not color-only indicator
- Forbidden: No direct supabase.auth calls from the component — all via `useAuthStore`

---

## Acceptance Criteria

- [x] **SUPA-AC-01 (UI)**: GIVEN player on sign-in screen, WHEN valid email entered and "Send Magic Link" tapped, THEN `useAuthStore.signIn(email)` is called and UI transitions to "check-your-email" state showing confirmation message.
- [x] **SUPA-AC-04 (UI)**: GIVEN player is logged in, WHEN "Sign out" button tapped, THEN `useAuthStore.signOut()` is called and player returns to home.
- [x] **SUPA-AC-05 (UI)**: GIVEN `authError` is set in store, THEN error message is displayed in the form (text, not just color).
- [x] **AC-S6-04**: Email input and "Send" button have touch targets ≥ 44×44px (verified in DevTools).
- [x] **AC-S6-05**: Submit button is disabled while `isAuthLoading` is true.
- [x] **AC-S6-06**: "Check your email" state shows the email address the link was sent to.

---

## Implementation Notes

### Files to create / modify

```
src/views/SignInView.vue        ← new (or src/components/sign-in-form.vue if modal preferred)
src/router/index.ts             ← add /sign-in route
```

### Component state machine

```
idle
  → (submit email) → pending ("Check your email for a link")
  → (authError set) → error (show error message, allow retry)
```

### Template sketch

```vue
<template>
  <div class="flex flex-col items-center justify-center min-h-screen px-4">
    <h1 class="text-2xl font-semibold mb-6">Sign in</h1>

    <!-- Idle state: email form -->
    <form v-if="!authStore.pendingEmail" @submit.prevent="handleSubmit" class="w-full max-w-sm">
      <label for="email" class="block text-sm mb-1">Email address</label>
      <input
        id="email"
        v-model="email"
        type="email"
        required
        class="w-full border rounded px-3 py-3 mb-4 text-base min-h-[44px]"
        placeholder="you@example.com"
      />
      <div v-if="authStore.authError" class="text-red-600 text-sm mb-3" role="alert">
        {{ authStore.authError }}
      </div>
      <button
        type="submit"
        :disabled="authStore.isAuthLoading"
        class="w-full bg-green-700 text-white py-3 rounded min-h-[44px] font-medium"
      >
        {{ authStore.isAuthLoading ? 'Sending…' : 'Send Magic Link' }}
      </button>
    </form>

    <!-- Pending state: check email -->
    <div v-else class="text-center">
      <p class="text-lg mb-2">Check your email</p>
      <p class="text-sm text-gray-600">We sent a link to <strong>{{ email }}</strong></p>
      <button @click="authStore.pendingEmail = false" class="mt-4 text-sm underline min-h-[44px]">
        Use a different email
      </button>
    </div>
  </div>
</template>
```

### Sign-out placement

Add a "Sign out" button in the navigation or profile area (existing HomeView / nav component). Button calls `authStore.signOut()`. Visible only when `authStore.userId !== null`.

---

## QA Test Cases

**Gate level**: ADVISORY (visual/UI story)

- Email form renders with input + button
- Submit calls `authStore.signIn(email)` with correct email value
- Pending state shows "Check your email" + email address
- Error state shows error text (not color-only)
- Button disabled during `isAuthLoading`
- Touch targets ≥ 44px (DevTools check)

**Manual evidence**: Screenshot of sign-in flow + "check your email" state
**Evidence path**: `production/qa/evidence/s7-06-sign-in-ui-evidence.md`

---

## Test Evidence

**Story Type**: UI
**Required evidence**: Manual walkthrough with screenshot (ADVISORY)

---

## Dependencies

- Depends on: story-002-auth-store.md (`useAuthStore` with `signIn`, `pendingEmail`, `authError`)
- Unlocks: story-008-adr-accepted.md (iOS device test requires sign-in UI to exist)
