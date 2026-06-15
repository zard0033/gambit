# Story 008: ADR-0011 → Accepted (iOS PWA Validation)

> **Epic**: Supabase
> **Status**: Not Started (backlog — Nice to Have)
> **Layer**: Persistence — Validation
> **Type**: Spike / Validation
> **Estimate**: XS (2 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-30
> **TR**: pending /architecture-review
> **ADR**: ADR-0004, ADR-0011

## Context

**GDD**: `design/gdd/supabase-integration.md` — Edge Cases section (Magic Link on different device)
**Requirements**: SUPA-AC-02 (on-device)

**ADR Governing Implementation**: ADR-0011 — Status: Proposed → Accepted
**ADR Decision Summary**: ADR-0011 is currently Proposed. The known risk requiring on-device validation is: iOS PWA Magic Link callback — `#access_token` hash fragment must survive the iOS URL open. If the PWA is installed, Safari may or may not strip the fragment on redirect. This spike confirms the fragment is handled correctly on a real iPhone with the PWA installed.

**Engine**: iOS Safari 16+ + PWA | **Risk**: MEDIUM (iOS-specific behavior)
**Engine Notes**: The hash fragment (`#access_token=...`) is handled by supabase-js via `onAuthStateChange`. If Safari strips the fragment before the PWA processes it, the auth callback silently fails. Mitigation: Supabase also provides a PKCE flow that avoids hash fragments. If hash fragment fails, ADR-0011 Decision section must be updated to use PKCE instead.

---

## Acceptance Criteria

- [ ] **SUPA-AC-02 (on-device)**: On a real iPhone with the PWA installed to Home Screen, GIVEN player taps a Magic Link email, WHEN Safari opens the PWA, THEN `onAuthStateChange` fires `SIGNED_IN` and `useAuthStore.userId` is set.
- [ ] **AC-S8-02**: If SUPA-AC-02 fails (fragment stripped): document the failure mode; update ADR-0011 Decision to PKCE flow; update `useAuthStore` accordingly.
- [ ] **AC-S8-03**: ADR-0011 status updated from `Proposed` to `Accepted` in `docs/architecture/adr-0011-supabase-authentication-and-data-sync-strategy.md`.
- [ ] **AC-S8-04**: Control manifest updated to include ADR-0011 (`/create-control-manifest update` or manual add).

---

## Implementation Notes

### Validation steps

1. Build and deploy to GitHub Pages (or use `npx vite preview --host` with ngrok for local test)
2. Install PWA to iPhone Home Screen
3. Navigate to sign-in screen; enter real email; tap "Send Magic Link"
4. Open email on iPhone; tap Magic Link
5. Observe: does the PWA open? Does `userId` get set?
6. If yes: proceed to AC-S8-03/04
7. If no: debug hash fragment handling; consider PKCE alternative

### PKCE alternative (if hash fragment fails)

Supabase supports PKCE flow via:
```typescript
await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: window.location.origin, shouldCreateUser: true }
})
```
PKCE exchanges the code in the URL query param (not hash) — more robust on iOS PWA. If needed, update ADR-0011 Decision section and `useAuthStore.initAuth()` to call `exchangeCodeForSession()`.

### Control manifest update

After ADR-0011 is Accepted, run `/create-control-manifest update` or manually add ADR-0011 to the manifest's ADR coverage list.

---

## QA Test Cases

**Gate level**: ADVISORY (nice-to-have spike)

- **Primary**: Magic Link works on real iPhone PWA → SUPA-AC-02 passes on-device
- **Fallback**: Hash fragment fails → PKCE decision documented in ADR-0011; ADR status still becomes Accepted with updated Decision text

**Evidence path**: `production/qa/evidence/s7-08-adr-0011-accepted-evidence.md`

---

## Test Evidence

**Story Type**: Spike / Validation
**Required evidence**: On-device test result documented (ADVISORY)

---

## Dependencies

- Depends on: story-002-auth-store.md (useAuthStore implemented)
- Depends on: story-006-sign-in-ui.md (sign-in screen to trigger Magic Link)
- Depends on: GitHub Pages deploy or local ngrok setup for PWA install
