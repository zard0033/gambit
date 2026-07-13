# Story 004: ADR-0011 iOS PWA Magic Link Verification

> **Epic**: game-history
> **Sprint Task**: S8-06 (carry from S7-08)
> **Status**: Complete — Magic Link verified end-to-end on iOS Safari (browser mode, S8-06, commit 530a05b); PWA Deep Link (email → installed PWA) deferred as an iOS architectural constraint, documented in ADR-0011
> **Layer**: MVP — Auth / ADR Acceptance
> **Type**: Verification + ADR Update
> **Estimate**: XS (2 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-06-01
> **TR**: pending /architecture-review
> **ADR**: ADR-0005, ADR-0011

## Context

**GDD**: `design/gdd/supabase-integration.md` — Auth Flow
**Requirements**: SUPA-AC-02 (Magic Link callback sets userId), iOS PWA hash fragment handling

**ADR to update**: `docs/architecture/adr-0011-supabase-authentication-and-data-sync-strategy.md`
**Current ADR Status**: Accepted (2026-06-01) — outstanding post-acceptance risk: iOS PWA Magic Link hash fragment interception
**Carried from**: S7-08 (needed iPhone real device — deferred to Sprint 8)

**Engine**: iPhone Safari 16+ PWA | **Risk**: MEDIUM — Safari intercepts `#access_token` fragment before supabase-js can read it in PWA installed mode
**Engine Notes**:
- When a Magic Link is opened in an installed PWA, Safari may strip the `#access_token=...&type=magiclink` hash fragment before supabase-js `onAuthStateChange` fires
- Mitigation: ensure the Supabase redirect URL is the exact PWA origin (no trailing slash mismatch); supabase-js v2 handles hash parsing on `window.location.hash` on app load — verify this runs before the hash is cleared
- If Safari strips the fragment: add a `beforeunload`/`hashchange` listener that reads `window.location.hash` immediately on page load and stores it for supabase-js recovery

**Control Manifest Rules**:
- Required: Verify `#access_token` fragment is read by supabase-js before Safari clears it
- Required: ADR-0011 status confirmed Accepted with iOS validation note added
- Forbidden: Do NOT change ADR-0011 status back to Proposed

---

## Acceptance Criteria

- [ ] **Code check**: `src/main.ts` or `App.vue` reads `window.location.hash` on app load before any async operations; OR confirm supabase-js v2 handles this automatically (read supabase-js source or changelog)
- [ ] **Hash fragment handling**: If Safari strips the fragment before supabase-js fires, a `hashchange` listener is added to preserve it (implementation only needed if iPhone test fails without it)
- [ ] **iPhone manual test** (blocking for ADR Accepted confirmation): Eason installs PWA on iPhone, requests Magic Link via email, opens link → app receives session, `useAuthStore.userId` is set, redirects to home
- [ ] **ADR-0011 note added**: iOS PWA validation completed (Sprint 8-06); Known Risk #5 in ADR resolved or documented as confirmed-handled

---

## Implementation Notes

### Code investigation (do first)

1. Check supabase-js v2 auth client: does `supabase.auth.onAuthStateChange` fire on hash-change or on init?
2. If it fires on init: verify `src/App.vue` `initAuth()` call is early enough in mount lifecycle
3. If the fragment is stripped by Safari PWA before supabase-js init: add to `src/main.ts`:

```typescript
// Preserve Magic Link hash fragment before any async Vue init
const hash = window.location.hash
if (hash.includes('access_token')) {
  sessionStorage.setItem('chess:auth_hash', hash)
}
// useAuthStore.initAuth() should check sessionStorage if window.location.hash is empty
```

### Files to modify (only if needed)

```
src/main.ts                         ← hash preservation (only if iPhone test fails without it)
docs/architecture/adr-0011-...md    ← add iOS validation note; confirm Known Risk #5 resolved
```

### ADR update

Add a note to the "Known Risks" section of ADR-0011:
```
### Post-Acceptance Validation Note (Sprint 8-06)
iOS PWA Magic Link hash fragment: verified [PASS / REQUIRES WORKAROUND] on [date].
[If workaround added]: fragment preserved via sessionStorage in src/main.ts.
```

---

## QA Test Cases

**Gate level**: ADVISORY (requires iPhone hardware) — does not block Sprint 8 Must Have

Manual test on Eason's iPhone:
1. Add chess-training-companion to Home Screen (PWA install)
2. Open app from Home Screen; go to Sign In
3. Enter email; request Magic Link
4. Open Magic Link email on iPhone; tap link
5. **Pass**: App opens, session established, userId set in useAuthStore, redirected to home
6. **Fail**: App opens but session not set → hash fragment issue; apply workaround and re-test

---

## Test Evidence

**Story Type**: Verification + ADR Update
**Required evidence**:
- ADVISORY (Nice to Have): Screenshot or note from Eason confirming iPhone PWA Magic Link success
- ADR-0011 updated with outcome note

---

## Dependencies

- Depends on: `production/epics/supabase/story-006-sign-in-ui.md` (Sign In UI exists)
- Depends on: Eason's iPhone (manual device testing)
- No downstream unlocks in Sprint 8
